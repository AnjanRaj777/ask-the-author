import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

export interface BookSearchResult {
  externalId: string;
  title: string;
  author: string;
  alreadyIngested: boolean;
  bookId?: string;
  downloadUrl?: string;
  format?: "epub" | "txt";
}

interface GutendexBook {
  id: number;
  title: string;
  authors: Array<{ name: string }>;
  formats: Record<string, string>;
}

function formatGutenbergAuthor(raw: string): string {
  const cleaned = raw.replace(/\s*\([^)]*\)/g, "").trim();
  const parts = cleaned.split(",").map((p) => p.trim());
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `${parts[1]} ${parts[0]}`;
  }
  return cleaned || "Unknown author";
}

function pickDownloadFormat(
  formats: Record<string, string>
): { url: string; format: "epub" | "txt" } | null {
  const txtKeys = [
    "text/plain; charset=utf-8",
    "text/plain; charset=us-ascii",
    "text/plain",
  ];
  for (const key of txtKeys) {
    const url = formats[key];
    if (url && !url.endsWith(".zip")) {
      return { url, format: "txt" };
    }
  }
  const epub = formats["application/epub+zip"];
  if (epub) {
    return { url: epub, format: "epub" };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results: BookSearchResult[] = [];
  const seenIds = new Set<string>();

  // 1. Search already-ingested books in Supabase if configured
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const supabase = getSupabaseServerClient();
      const { data } = await supabase
        .from("books")
        .select("id, title, author, external_id")
        .eq("status", "ready")
        .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
        .limit(6);

      for (const row of data ?? []) {
        const extId = (row.external_id as string | null) || `db:${row.id}`;
        seenIds.add(extId);
        results.push({
          externalId: extId,
          title: row.title as string,
          author: row.author as string,
          alreadyIngested: true,
          bookId: row.id as string,
        });
      }
    } catch {
      // Continue to public-domain search even if DB lookup fails
    }
  }

  // 2. Search Project Gutenberg via Gutendex (with a 5s timeout so slow responses don't hang)
  try {
    const res = await fetch(
      `https://gutendex.com/books?search=${encodeURIComponent(q)}`,
      {
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 300 },
      }
    );
    if (res.ok) {
      const data = (await res.json()) as { results?: GutendexBook[] };
      for (const b of (data.results ?? []).slice(0, 10)) {
        const externalId = `gutenberg:${b.id}`;
        if (seenIds.has(externalId)) continue;
        const dl = pickDownloadFormat(b.formats ?? {});
        if (!dl) continue;
        seenIds.add(externalId);
        results.push({
          externalId,
          title: b.title,
          author: b.authors?.[0]?.name
            ? formatGutenbergAuthor(b.authors[0].name)
            : "Unknown author",
          alreadyIngested: false,
          downloadUrl: dl.url,
          format: dl.format,
        });
      }
    }
  } catch {
    // Return any local results if Gutendex is unreachable
  }

  return NextResponse.json({ results });
}
