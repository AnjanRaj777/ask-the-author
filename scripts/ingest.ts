import fs from "node:fs";
import path from "node:path";
import { embedTexts } from "../src/lib/ai/embeddings";
import { getSupabaseServerClient } from "../src/lib/db/supabase";
import { chunkChapters, parseChaptersFromTxt } from "../src/lib/ingest/chunk";

interface PersonaSeed {
  title: string;
  author: string;
  source: "public_domain" | "upload";
  rights_note?: string;
  persona_mode: "author" | "guide";
  display_name: string;
  voice_notes?: string;
  themes?: string[];
  bio_facts?: string;
  style_samples?: string[];
  starter_questions?: string[];
}

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  }
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const slugFlagIdx = args.indexOf("--slug");
  const personaFlagIdx = args.indexOf("--persona");

  const positional = args.filter(
    (a, i) =>
      !a.startsWith("--") &&
      i !== slugFlagIdx + 1 &&
      i !== personaFlagIdx + 1
  );

  const file =
    positional[0] || path.join("books", "pride-and-prejudice-sample.txt");
  const slug =
    slugFlagIdx !== -1
      ? args[slugFlagIdx + 1]
      : path
          .basename(file, path.extname(file))
          .replace(/-sample$/, "");
  const personaFile =
    personaFlagIdx !== -1
      ? args[personaFlagIdx + 1]
      : path.join("books", "personas", `${slug}.json`);

  return { file, slug, personaFile, dryRun };
}

/**
 * Phase 1 Ingest CLI
 * Usage:
 *   npm run ingest -- ./books/pride-and-prejudice-sample.txt --dry-run
 *   npm run ingest -- ./books/pride-and-prejudice-sample.txt --slug pride-and-prejudice
 */
async function main() {
  loadEnvLocal();
  const { file, slug, personaFile, dryRun } = parseArgs(process.argv);
  const resolvedBook = path.resolve(process.cwd(), file);

  if (!fs.existsSync(resolvedBook)) {
    console.error(`Book file not found: ${resolvedBook}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(resolvedBook, "utf-8");
  const chapters = parseChaptersFromTxt(raw);
  const chunks = chunkChapters(chapters);

  console.log(`Book: ${path.basename(resolvedBook)} (slug: ${slug})`);
  console.log(`Chapters: ${chapters.length}`);
  console.log(
    `Chunks: ${chunks.length} (avg ~${Math.round(
      chunks.reduce((sum, c) => sum + c.tokenCount, 0) / Math.max(1, chunks.length)
    )} tokens)`
  );

  const resolvedPersona = path.resolve(process.cwd(), personaFile);
  let personaSeed: PersonaSeed | null = null;
  if (fs.existsSync(resolvedPersona)) {
    personaSeed = JSON.parse(
      fs.readFileSync(resolvedPersona, "utf-8")
    ) as PersonaSeed;
    console.log(`Persona: ${personaSeed.display_name}`);
  } else {
    console.log(`No persona file at ${personaFile}; using defaults.`);
  }

  if (dryRun) {
    console.log("Dry run complete (no database writes or embeddings).");
    return;
  }

  const supabase = getSupabaseServerClient();
  const embeddingModel =
    process.env.EMBEDDING_PROVIDER === "openai"
      ? process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"
      : process.env.VOYAGE_EMBEDDING_MODEL || "voyage-3";

  // 1. Upsert book row by slug
  const title = personaSeed?.title ?? slug.replace(/-/g, " ");
  const author = personaSeed?.author ?? "Unknown Author";

  const { data: existingBook } = await supabase
    .from("books")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  let bookId: string;
  if (existingBook?.id) {
    bookId = existingBook.id;
    const { error: updErr } = await supabase
      .from("books")
      .update({
        title,
        author,
        source: personaSeed?.source ?? "public_domain",
        rights_note: personaSeed?.rights_note ?? null,
        status: "embedding",
        chapter_count: chapters.length,
        persona_mode: personaSeed?.persona_mode ?? "guide",
        embedding_model: embeddingModel,
      })
      .eq("id", bookId);
    if (updErr) throw updErr;

    // Clear old chapters & chunks for clean re-ingest
    await supabase.from("chunks").delete().eq("book_id", bookId);
    await supabase.from("chapters").delete().eq("book_id", bookId);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("books")
      .insert({
        slug,
        title,
        author,
        source: personaSeed?.source ?? "public_domain",
        rights_note: personaSeed?.rights_note ?? null,
        status: "embedding",
        chapter_count: chapters.length,
        persona_mode: personaSeed?.persona_mode ?? "guide",
        embedding_model: embeddingModel,
      })
      .select("id")
      .single();
    if (insErr || !inserted) throw insErr;
    bookId = inserted.id;
  }

  // 2. Insert chapters
  const { error: chapErr } = await supabase.from("chapters").insert(
    chapters.map((c) => ({
      book_id: bookId,
      idx: c.idx,
      title: c.title,
    }))
  );
  if (chapErr) throw chapErr;

  // 3. Upsert persona
  const { error: perErr } = await supabase.from("personas").upsert({
    book_id: bookId,
    display_name: personaSeed?.display_name ?? `${author} (AI Simulation)`,
    voice_notes: personaSeed?.voice_notes ?? null,
    themes: personaSeed?.themes ?? [],
    bio_facts: personaSeed?.bio_facts ?? null,
    style_samples: personaSeed?.style_samples ?? [],
    starter_questions: personaSeed?.starter_questions ?? [],
  });
  if (perErr) throw perErr;

  // 4. Embed and insert chunks in batches of 64
  const BATCH_SIZE = 64;
  for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
    const batch = chunks.slice(start, start + BATCH_SIZE);
    const textsToEmbed = batch.map(
      (c) => `[${title} · ${c.chapterTitle}]\n${c.content}`
    );
    const embeddings = await embedTexts(textsToEmbed, "document");

    const { error: chunkErr } = await supabase.from("chunks").insert(
      batch.map((c, idx) => ({
        book_id: bookId,
        chapter_idx: c.chapterIdx,
        seq: c.seq,
        char_start: c.charStart,
        char_end: c.charEnd,
        content: c.content,
        token_count: c.tokenCount,
        embedding: embeddings[idx],
      }))
    );
    if (chunkErr) throw chunkErr;
    console.log(
      `Embedded & stored chunks ${start + 1}–${start + batch.length} of ${chunks.length}`
    );
  }

  // 5. Mark book ready
  await supabase.from("books").update({ status: "ready" }).eq("id", bookId);
  console.log(`Ingest complete! Book ID: ${bookId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
