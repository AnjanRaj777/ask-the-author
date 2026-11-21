import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";
import { parseBookBuffer } from "@/lib/ingest/parse";
import { ingestParsedBook } from "@/lib/ingest/saveBook";

const ALLOWED_HOSTS = new Set([
  "www.gutenberg.org",
  "gutenberg.org",
  "standardebooks.org",
  "archive.org",
]);

interface ImportBody {
  externalId?: string;
  title?: string;
  author?: string;
  downloadUrl?: string;
  format?: "epub" | "txt";
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

  let body: ImportBody;
  try {
    body = (await req.json()) as ImportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const externalId = body.externalId?.trim();
  const downloadUrl = body.downloadUrl?.trim();
  const format = body.format === "epub" ? "epub" : "txt";

  if (!externalId || !downloadUrl) {
    return NextResponse.json(
      { error: "externalId and downloadUrl are required." },
      { status: 400 }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(downloadUrl);
  } catch {
    return NextResponse.json({ error: "Invalid download URL." }, { status: 400 });
  }
  if (
    parsedUrl.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(parsedUrl.hostname)
  ) {
    return NextResponse.json(
      { error: "Download host is not in the public-domain allowlist." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  // Deduplicate: return existing ready book if already imported
  const { data: existing } = await supabase
    .from("books")
    .select("id, title, author, chapter_count, status")
    .eq("external_id", externalId)
    .maybeSingle();

  if (existing && existing.status === "ready") {
    const { data: personaRow } = await supabase
      .from("personas")
      .select("display_name, starter_questions")
      .eq("book_id", existing.id)
      .maybeSingle();

    return NextResponse.json({
      bookId: existing.id,
      title: existing.title,
      author: existing.author,
      chapterCount: existing.chapter_count,
      personaName:
        (personaRow?.display_name as string) || (existing.author as string),
      starterQuestions: Array.isArray(personaRow?.starter_questions)
        ? personaRow.starter_questions
        : [],
    });
  }

  try {
    const fileRes = await fetch(parsedUrl.toString());
    if (!fileRes.ok) {
      throw new Error(`Failed to download public-domain book (${fileRes.status}).`);
    }
    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsed = await parseBookBuffer(buffer, `book.${format}`);

    const result = await ingestParsedBook({
      title: body.title?.trim() || parsed.title,
      author: body.author?.trim() || parsed.author,
      chapters: parsed.chapters,
      source: "public_domain",
      rightsNote: `Public-domain import (${externalId}).`,
      externalId,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to import public-domain book.",
      },
      { status: 500 }
    );
  }
}
