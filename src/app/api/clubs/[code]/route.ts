import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/db/auth";
import { getSupabaseServerClient } from "@/lib/db/supabase";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { code } = await context.params;
  const inviteCode = code.trim().toUpperCase();

  const supabase = getSupabaseServerClient();
  const { data: club, error: clubErr } = await supabase
    .from("book_clubs")
    .select(
      "id, name, invite_code, created_at, books(id, slug, title, author, chapter_count, source, personas(display_name))"
    )
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (clubErr) {
    return NextResponse.json({ error: clubErr.message }, { status: 500 });
  }
  if (!club) {
    return NextResponse.json({ error: "Book club not found." }, { status: 404 });
  }

  const book = Array.isArray(club.books) ? club.books[0] : club.books;
  const personaObj = book?.personas
    ? Array.isArray(book.personas)
      ? book.personas[0]
      : book.personas
    : null;

  const { data: members } = await supabase
    .from("book_club_members")
    .select("user_id, display_name, spoiler_limit, joined_at")
    .eq("club_id", club.id)
    .order("joined_at", { ascending: true });

  const myMembership = (members ?? []).find((m) => m.user_id === user.id);

  let messages: Array<{
    id: string;
    authorName: string;
    role: "member" | "assistant";
    content: string;
    answerMode: string | null;
    citations: unknown[];
    spoilerLimitUsed: number | null;
    createdAt: string;
    isOwn: boolean;
  }> = [];

  if (myMembership) {
    const { data: rows } = await supabase
      .from("book_club_messages")
      .select(
        "id, user_id, author_name, role, content, answer_mode, citations, spoiler_limit_used, created_at"
      )
      .eq("club_id", club.id)
      .order("created_at", { ascending: true })
      .limit(150);

    messages = (rows ?? []).map((r) => ({
      id: r.id as string,
      authorName: r.author_name as string,
      role: r.role as "member" | "assistant",
      content: r.content as string,
      answerMode: (r.answer_mode as string | null) ?? null,
      citations: Array.isArray(r.citations) ? r.citations : [],
      spoilerLimitUsed: (r.spoiler_limit_used as number | null) ?? null,
      createdAt: r.created_at as string,
      isOwn: r.user_id === user.id,
    }));
  }

  return NextResponse.json({
    club: {
      id: club.id,
      name: club.name,
      inviteCode: club.invite_code,
      bookId: book?.slug || book?.id || "",
      bookTitle: book?.title || "Unknown book",
      bookAuthor: book?.author || "",
      chapterCount: book?.chapter_count || 1,
      personaName:
        personaObj?.display_name || book?.author || "The Author",
    },
    isMember: Boolean(myMembership),
    mySpoilerLimit: myMembership?.spoiler_limit ?? 1,
    members: (members ?? []).map((m) => ({
      displayName: m.display_name as string,
      spoilerLimit: m.spoiler_limit as number,
      isMe: m.user_id === user.id,
    })),
    messages,
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to join this club." }, { status: 401 });
  }

  const { code } = await context.params;
  const inviteCode = code.trim().toUpperCase();

  let body: { displayName?: string; spoilerLimit?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // optional body
  }

  const supabase = getSupabaseServerClient();
  const { data: club } = await supabase
    .from("book_clubs")
    .select("id, books(chapter_count)")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (!club) {
    return NextResponse.json({ error: "Book club not found." }, { status: 404 });
  }

  const book = Array.isArray(club.books) ? club.books[0] : club.books;
  const maxCh = (book?.chapter_count as number | undefined) || 1;
  const spoilerLimit = Math.max(
    1,
    Math.min(Number(body.spoilerLimit ?? 1), maxCh)
  );
  const displayName =
    body.displayName?.trim() || user.email?.split("@")[0] || "Reader";

  const { error } = await supabase.from("book_club_members").upsert(
    {
      club_id: club.id,
      user_id: user.id,
      display_name: displayName,
      spoiler_limit: spoilerLimit,
    },
    { onConflict: "club_id,user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, spoilerLimit });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { code } = await context.params;
  const inviteCode = code.trim().toUpperCase();

  let body: { spoilerLimit?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: club } = await supabase
    .from("book_clubs")
    .select("id, books(chapter_count)")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (!club) {
    return NextResponse.json({ error: "Book club not found." }, { status: 404 });
  }

  const book = Array.isArray(club.books) ? club.books[0] : club.books;
  const maxCh = (book?.chapter_count as number | undefined) || 1;
  const spoilerLimit = Math.max(
    1,
    Math.min(Number(body.spoilerLimit ?? 1), maxCh)
  );

  const { error } = await supabase
    .from("book_club_members")
    .update({ spoiler_limit: spoilerLimit })
    .eq("club_id", club.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, spoilerLimit });
}
