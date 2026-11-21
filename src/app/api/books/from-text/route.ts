import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { parseChaptersFromTxt } from "@/lib/ingest/chunk";
import { ingestParsedBook } from "@/lib/ingest/saveBook";

interface FromTextBody {
  title?: string;
  author?: string;
  text?: string;
  url?: string;
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

  let body: FromTextBody;
  try {
    body = (await req.json()) as FromTextBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let title = body.title?.trim() || "";
  const author = body.author?.trim() || "Unknown author";
  let rawText = body.text?.trim() || "";
  const rawUrl = body.url?.trim() || "";

  if (!rawText && rawUrl) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: "Only http and https URLs are supported." },
        { status: 400 }
      );
    }

    try {
      const res = await fetch(parsedUrl.toString());
      if (!res.ok) {
        return NextResponse.json(
          { error: `Failed to fetch URL (${res.status}).` },
          { status: 422 }
        );
      }
      const html = await res.text();
      const $ = cheerio.load(html);
      $("script, style, nav, header, footer, aside").remove();
      if (!title) {
        title =
          $("h1").first().text().trim() ||
          $("title").first().text().trim() ||
          parsedUrl.hostname;
      }
      rawText = ($("article").text() || $("main").text() || $("body").text())
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    } catch {
      return NextResponse.json(
        { error: "Unable to fetch or parse content from that URL." },
        { status: 422 }
      );
    }
  }

  if (!title) {
    return NextResponse.json(
      { error: "Please provide a book or article title." },
      { status: 400 }
    );
  }
  if (rawText.length < 80) {
    return NextResponse.json(
      { error: "Please provide at least a short passage (80+ characters)." },
      { status: 400 }
    );
  }

  try {
    const chapters = parseChaptersFromTxt(rawText);
    const result = await ingestParsedBook({
      title,
      author,
      chapters,
      source: "text_paste",
      rightsNote: rawUrl
        ? `Imported from web URL (${rawUrl}) for personal use.`
        : "User-pasted text for personal use.",
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to index pasted text.",
      },
      { status: 500 }
    );
  }
}
