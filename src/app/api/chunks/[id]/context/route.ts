import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid chunk id." }, { status: 400 });
  }

  const spoilerParam = req.nextUrl.searchParams.get("spoilerLimit");
  const spoilerLimit =
    spoilerParam !== null && Number.isFinite(Number(spoilerParam))
      ? Math.max(1, Number(spoilerParam))
      : null;

  const supabase = getSupabaseServerClient();
  const { data: target, error: targetErr } = await supabase
    .from("chunks")
    .select("id, book_id, chapter_idx, seq, page, content")
    .eq("id", id)
    .maybeSingle();

  if (targetErr) {
    return NextResponse.json({ error: targetErr.message }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: "Chunk not found." }, { status: 404 });
  }
  if (spoilerLimit !== null && target.chapter_idx > spoilerLimit) {
    return NextResponse.json(
      { error: "Passage is past your current spoiler limit." },
      { status: 403 }
    );
  }

  const [{ data: chapter }, { data: neighbors, error: neighErr }] =
    await Promise.all([
      supabase
        .from("chapters")
        .select("title")
        .eq("book_id", target.book_id)
        .eq("idx", target.chapter_idx)
        .maybeSingle(),
      supabase
        .from("chunks")
        .select("id, seq, page, content")
        .eq("book_id", target.book_id)
        .eq("chapter_idx", target.chapter_idx)
        .gte("seq", Math.max(0, target.seq - 1))
        .lte("seq", target.seq + 1)
        .order("seq", { ascending: true }),
    ]);

  if (neighErr) {
    return NextResponse.json({ error: neighErr.message }, { status: 500 });
  }

  return NextResponse.json({
    chunkId: target.id,
    bookId: target.book_id,
    chapterIdx: target.chapter_idx,
    chapterTitle: chapter?.title ?? null,
    page: target.page,
    chunks: (neighbors ?? []).map((c) => ({
      id: c.id,
      seq: c.seq,
      page: c.page,
      content: c.content,
      isTarget: c.id === target.id,
    })),
  });
}
