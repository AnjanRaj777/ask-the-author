import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/db/auth";
import { resolveBookRow } from "@/lib/db/resolveBook";
import { getSupabaseServerClient } from "@/lib/db/supabase";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to view saved notes." }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const bookKey = req.nextUrl.searchParams.get("bookId")?.trim();

  let query = supabase
    .from("saved_notes")
    .select(
      "id, book_id, message_id, question, answer, answer_mode, citations, note, created_at, books(id, slug, title, author)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (bookKey) {
    const book = await resolveBookRow(supabase, bookKey);
    if (book) {
      query = query.eq("book_id", book.id);
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notes = (data ?? []).map((row) => {
    const book = Array.isArray(row.books) ? row.books[0] : row.books;
    return {
      id: row.id as string,
      bookId: (book?.slug || book?.id || row.book_id) as string | null,
      bookTitle: (book?.title as string | undefined) ?? "Book Note",
      bookAuthor: (book?.author as string | undefined) ?? "",
      messageId: row.message_id as string | null,
      question: (row.question as string | null) ?? "",
      answer: (row.answer as string | null) ?? "",
      answerMode: (row.answer_mode as string | null) ?? null,
      citations: Array.isArray(row.citations) ? row.citations : [],
      note: (row.note as string | null) ?? "",
      createdAt: row.created_at as string,
    };
  });

  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to save notes." }, { status: 401 });
  }

  let body: {
    bookId?: string;
    messageId?: string;
    question?: string;
    answer?: string;
    answerMode?: string;
    citations?: unknown[];
    note?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const answer = body.answer?.trim();
  if (!answer) {
    return NextResponse.json({ error: "Answer text is required." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const book = body.bookId ? await resolveBookRow(supabase, body.bookId) : null;
  const messageId =
    body.messageId && UUID_RE.test(body.messageId) ? body.messageId : null;

  const { data, error } = await supabase
    .from("saved_notes")
    .insert({
      user_id: user.id,
      book_id: book?.id ?? null,
      message_id: messageId,
      question: body.question?.trim() || null,
      answer,
      answer_mode: body.answerMode || null,
      citations: Array.isArray(body.citations) ? body.citations : [],
      note: body.note?.trim() || null,
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Failed to save note." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: data.id, createdAt: data.created_at });
}
