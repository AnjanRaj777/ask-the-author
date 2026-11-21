import { FAST_MODEL, getMuseClient } from "@/lib/ai/muse";
import { embedTexts } from "@/lib/ai/embeddings";
import { getSupabaseServerClient } from "@/lib/db/supabase";
import { chunkChapters, type ParsedChapter } from "@/lib/ingest/chunk";
import type { BookSource } from "@/lib/types";

const MAX_BATCH_CHUNKS = 8;
const MAX_BATCH_TOKENS = 4500;
const RETRY_DELAYS_MS = [21_000, 40_000, 62_000, 62_000];

async function embedWithRetry(texts: string[]): Promise<number[][]> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await embedTexts(texts, "document");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const delay = RETRY_DELAYS_MS[attempt];
      if (msg.includes("429") && delay !== undefined) {
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  return embedTexts(texts, "document");
}

function buildTokenSafeBatches<T extends { tokenCount: number }>(
  items: T[]
): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let currentTokens = 0;

  for (const item of items) {
    const itemTokens = item.tokenCount + 30;
    if (
      current.length > 0 &&
      (current.length >= MAX_BATCH_CHUNKS ||
        currentTokens + itemTokens > MAX_BATCH_TOKENS)
    ) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(item);
    currentTokens += itemTokens;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export async function generateStarterQuestions(
  title: string,
  openingExcerpt: string
): Promise<string[]> {
  const fallback = [
    `What is the main premise introduced in the opening of "${title}"?`,
    "Who are the key figures or ideas you introduce early on?",
    "What tone or perspective did you set in the first chapter?",
  ];

  if (!process.env.MUSE_API_KEY || !openingExcerpt.trim()) {
    return fallback;
  }

  try {
    const muse = getMuseClient();
    const resp = await muse.chat.completions.create({
      model: FAST_MODEL,
      max_tokens: 400,
      stream: false,
      reasoning_effort: "low",
      messages: [
        {
          role: "system",
          content:
            "Generate 3 concise, spoiler-free starter questions a reader might ask the author after reading only the opening chapter. Return ONLY a JSON array of 3 strings.",
        },
        {
          role: "user",
          content: `Book: "${title}"\n\nOpening excerpt:\n${openingExcerpt.slice(0, 3000)}`,
        },
      ],
    });

    const raw = resp.choices[0]?.message?.content?.trim() ?? "";
    const match = /\[[\s\S]*\]/.exec(raw);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((q) => typeof q === "string" && q.trim().length > 0)
    ) {
      return parsed.slice(0, 4).map((q) => q.trim());
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export interface IngestedBookResult {
  bookId: string;
  title: string;
  author: string;
  chapterCount: number;
  personaName: string;
  starterQuestions: string[];
}

export async function ingestParsedBook(params: {
  title: string;
  author: string;
  chapters: ParsedChapter[];
  source: BookSource;
  rightsNote: string;
  externalId?: string | null;
}): Promise<IngestedBookResult> {
  const { title, author, chapters, source, rightsNote, externalId } = params;
  const chunks = chunkChapters(chapters);
  if (chunks.length === 0) {
    throw new Error("No readable passages were found in this text.");
  }

  const hasAuthor =
    Boolean(author) && !/^unknown author$/i.test(author.trim());
  const personaDisplayName = hasAuthor ? author : "The Author";
  const supabase = getSupabaseServerClient();

  const insertPayload: Record<string, unknown> = {
    title,
    author: author || "Unknown author",
    source,
    status: "embedding",
    chapter_count: chapters.length,
    persona_mode: "author",
    rights_note: rightsNote,
  };
  if (externalId) {
    insertPayload.external_id = externalId;
  }

  const { data: bookRow, error: bookErr } = await supabase
    .from("books")
    .insert(insertPayload)
    .select("id")
    .single();

  if (bookErr || !bookRow) {
    throw new Error(bookErr?.message || "Failed to create book record.");
  }

  const bookId = bookRow.id as string;

  try {
    const chapterRows = chapters.map((c) => ({
      book_id: bookId,
      idx: c.idx,
      title: c.title,
    }));
    const { error: chErr } = await supabase.from("chapters").insert(chapterRows);
    if (chErr) throw new Error(chErr.message);

    const batches = buildTokenSafeBatches(chunks);
    for (const batch of batches) {
      const texts = batch.map(
        (c) => `[${title} · Ch. ${c.chapterIdx} · ${c.chapterTitle}]\n${c.content}`
      );
      const vectors = await embedWithRetry(texts);
      const rows = batch.map((c, idx) => ({
        book_id: bookId,
        chapter_idx: c.chapterIdx,
        seq: c.seq,
        page: null,
        char_start: c.charStart,
        char_end: c.charEnd,
        content: c.content,
        token_count: c.tokenCount,
        embedding: JSON.stringify(vectors[idx]),
      }));
      const { error: chunkErr } = await supabase.from("chunks").insert(rows);
      if (chunkErr) throw new Error(chunkErr.message);
    }

    const openingExcerpt = chapters
      .slice(0, 2)
      .map((c) => c.text)
      .join("\n\n");
    const starterQuestions = await generateStarterQuestions(title, openingExcerpt);

    const { error: personaErr } = await supabase.from("personas").insert({
      book_id: bookId,
      display_name: personaDisplayName,
      voice_notes: hasAuthor
        ? `Speak in the first person as ${author}, grounded strictly in the text.`
        : "Speak in the first person as the author of this book, grounded strictly in the text.",
      themes: [],
      bio_facts: null,
      style_samples: [],
      starter_questions: starterQuestions,
    });
    if (personaErr) throw new Error(personaErr.message);

    const { error: readyErr } = await supabase
      .from("books")
      .update({ status: "ready" })
      .eq("id", bookId);
    if (readyErr) throw new Error(readyErr.message);

    return {
      bookId,
      title,
      author: author || "Unknown author",
      chapterCount: chapters.length,
      personaName: personaDisplayName,
      starterQuestions,
    };
  } catch (err) {
    await supabase.from("books").update({ status: "failed" }).eq("id", bookId);
    throw err;
  }
}
