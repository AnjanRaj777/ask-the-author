import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/db/auth";
import { resolveBookRow } from "@/lib/db/resolveBook";
import { getSupabaseServerClient } from "@/lib/db/supabase";

function makeInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, clubs: [] });
  }

  const supabase = getSupabaseServerClient();
  const { data: memberships, error } = await supabase
    .from("book_club_members")
    .select(
      "spoiler_limit, joined_at, book_clubs(id, name, invite_code, created_at, books(id, slug, title, author, chapter_count))"
    )
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clubs = (memberships ?? [])
    .map((m) => {
      const club = Array.isArray(m.book_clubs)
        ? m.book_clubs[0]
        : m.book_clubs;
      if (!club) return null;
      const book = Array.isArray(club.books) ? club.books[0] : club.books;
      return {
        id: club.id as string,
        name: club.name as string,
        inviteCode: club.invite_code as string,
        spoilerLimit: m.spoiler_limit as number,
        bookId: (book?.slug || book?.id || "") as string,
        bookTitle: (book?.title as string | undefined) ?? "Unknown book",
        bookAuthor: (book?.author as string | undefined) ?? "",
        chapterCount: (book?.chapter_count as number | undefined) ?? 1,
        createdAt: club.created_at as string,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ authenticated: true, clubs });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to create a book club." }, { status: 401 });
  }

  let body: {
    bookId?: string;
    name?: string;
    displayName?: string;
    spoilerLimit?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const bookKey = body.bookId?.trim();
  const clubName = body.name?.trim();
  if (!bookKey || !clubName) {
    return NextResponse.json(
      { error: "bookId and name are required." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const book = await resolveBookRow(supabase, bookKey);
  if (!book) {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  const inviteCode = makeInviteCode();
  const { data: club, error: clubErr } = await supabase
    .from("book_clubs")
    .insert({
      book_id: book.id,
      name: clubName,
      invite_code: inviteCode,
      created_by: user.id,
    })
    .select("id, invite_code")
    .single();

  if (clubErr || !club) {
    return NextResponse.json(
      { error: clubErr?.message || "Failed to create book club." },
      { status: 500 }
    );
  }

  const displayName =
    body.displayName?.trim() ||
    user.email?.split("@")[0] ||
    "Reader";
  const spoilerLimit = Math.max(
    1,
    Math.min(Number(body.spoilerLimit ?? 1), book.chapter_count || 1)
  );

  const { error: memErr } = await supabase.from("book_club_members").insert({
    club_id: club.id,
    user_id: user.id,
    display_name: displayName,
    spoiler_limit: spoilerLimit,
  });

  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: club.id,
    inviteCode: club.invite_code,
  });
}
