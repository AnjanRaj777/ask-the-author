import { NextRequest, NextResponse } from "next/server";
import { FAST_MODEL, getMuseClient } from "@/lib/ai/muse";
import { embedTexts } from "@/lib/ai/embeddings";
import { getSupabaseServerClient } from "@/lib/db/supabase";
import { chunkChapters } from "@/lib/ingest/chunk";
import { parseBookBuffer } from "@/lib/ingest/parse";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXT_RE = /\.(epub|pdf|txt)$/i;
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

async function generateStarterQuestions(
  title: string,
  openingExcerpt: string
): Promise<string[]> {
  const fallback = [
    `What is the main premise introduced in the opening of "${title}"?`,
    "Who are the key figures or concepts introduced early on?",
    "What tone or style does the author set in the first chapter?",
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
            "Generate 3 concise, spoiler-free starter questions a reader might ask after reading only the opening chapter. Return ONLY a JSON array of 3 strings.",
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

export async function POST(req: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !(process.env.VOYAGE_API_KEY || process.env.OPENAI_API_KEY)
  ) {
    return NextResponse.json(
      {
        error:
          "Server is missing Supabase or embeddings API keys in .env.local.",
      },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data upload." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const ownershipConfirmed = formData.get("ownershipConfirmed") === "true";

  if (!ownershipConfirmed) {
    return NextResponse.json(
      { error: "Please confirm you own this copy for personal use." },
      { status: 400 }
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (!ALLOWED_EXT_RE.test(file.name)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload an EPUB, PDF, or TXT file." },
      { status: 400 }
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File exceeds the 20 MB upload limit." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = await parseBookBuffer(buffer, file.name);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to parse book file.",
      },
      { status: 422 }
    );
  }

  const chunks = chunkChapters(parsed.chapters);
  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "No readable passages were found in this file." },
      { status: 422 }
    );
  }

  const hasAuthor =
    Boolean(parsed.author) && !/^unknown author$/i.test(parsed.author.trim());
  const personaMode = "author";
  const personaDisplayName = hasAuthor ? parsed.author : "The Author";

  const supabase = getSupabaseServerClient();

  const { data: bookRow, error: bookErr } = await supabase
    .from("books")
    .insert({
      title: parsed.title,
      author: parsed.author,
      source: "upload",
      status: "embedding",
      chapter_count: parsed.chapters.length,
      persona_mode: personaMode,
      rights_note: "Private user upload for personal use.",
    })
    .select("id")
    .single();

  if (bookErr || !bookRow) {
    return NextResponse.json(
      { error: bookErr?.message || "Failed to create book record." },
      { status: 500 }
    );
  }

  const bookId = bookRow.id as string;

  try {
    const chapterRows = parsed.chapters.map((c) => ({
      book_id: bookId,
      idx: c.idx,
      title: c.title,
    }));
    const { error: chErr } = await supabase
      .from("chapters")
      .insert(chapterRows);
    if (chErr) throw new Error(chErr.message);

    const batches = buildTokenSafeBatches(chunks);
    for (const batch of batches) {
      const texts = batch.map(
        (c) => `[${parsed.title} · Ch. ${c.chapterIdx} · ${c.chapterTitle}]\n${c.content}`
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

    const openingExcerpt = parsed.chapters
      .slice(0, 2)
      .map((c) => c.text)
      .join("\n\n");
    const starterQuestions = await generateStarterQuestions(
      parsed.title,
      openingExcerpt
    );

    const { error: personaErr } = await supabase.from("personas").insert({
      book_id: bookId,
      display_name: personaDisplayName,
      voice_notes: hasAuthor
        ? `Speak in the first person as ${parsed.author}, grounded strictly in the uploaded text.`
        : "Speak in the first person as the author of this book, grounded strictly in the uploaded text.",
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

    return NextResponse.json({
      bookId,
      title: parsed.title,
      author: parsed.author,
      chapterCount: parsed.chapters.length,
      personaName: personaDisplayName,
      starterQuestions,
    });
  } catch (err) {
    await supabase
      .from("books")
      .update({ status: "failed" })
      .eq("id", bookId);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to ingest uploaded book.",
      },
      { status: 500 }
    );
  }
}
