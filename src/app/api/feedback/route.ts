import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/db/auth";
import { resolveBookRow } from "@/lib/db/resolveBook";
import { getSupabaseServerClient } from "@/lib/db/supabase";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAdminUser(email: string | undefined): boolean {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return true; // In local/dev when ADMIN_EMAILS isn't configured, allow signed-in review
  if (!email) return false;
  const allow = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!isAdminUser(user.email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const ratingFilter = req.nextUrl.searchParams.get("rating");
  const reasonFilter = req.nextUrl.searchParams.get("reason");

  const supabase = getSupabaseServerClient();
  let query = supabase
    .from("feedback")
    .select(
      "id, message_id, user_id, book_id, question, answer, rating, reason, created_at, books(title, author, slug)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (ratingFilter === "1" || ratingFilter === "-1") {
    query = query.eq("rating", Number(ratingFilter));
  }
  if (reasonFilter && reasonFilter !== "all") {
    query = query.eq("reason", reasonFilter);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data ?? []).map((row) => {
    const book = Array.isArray(row.books) ? row.books[0] : row.books;
    return {
      id: (row.id as string | null) ?? `${row.message_id}-${row.user_id}`,
      messageId: row.message_id as string,
      bookTitle: (book?.title as string | undefined) ?? "Unknown book",
      bookAuthor: (book?.author as string | undefined) ?? "",
      question: (row.question as string | null) ?? "",
      answer: (row.answer as string | null) ?? "",
      rating: row.rating as number,
      reason: (row.reason as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to submit feedback." },
      { status: 401 }
    );
  }

  let body: {
    messageId?: string;
    bookId?: string;
    question?: string;
    answer?: string;
    rating?: number;
    reason?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.rating !== 1 && body.rating !== -1) {
    return NextResponse.json(
      { error: "rating must be 1 or -1." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const book = body.bookId ? await resolveBookRow(supabase, body.bookId) : null;

  // feedback table PK is (message_id, user_id); if client messageId isn't a UUID, generate a deterministic/random UUID
  let messageId =
    body.messageId && UUID_RE.test(body.messageId) ? body.messageId : null;
  if (!messageId) {
    // Check if there's an existing message in DB or generate a fallback UUID
    messageId = crypto.randomUUID();
  }

  // Note: feedback.message_id has FK to messages(id). If messageId isn't in messages,
  // we look up the most recent assistant message in the user's conversation for this book, or skip FK if none.
  const { data: msgExists } = await supabase
    .from("messages")
    .select("id")
    .eq("id", messageId)
    .maybeSingle();

  if (!msgExists && book) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", book.id)
      .maybeSingle();
    if (conv) {
      const { data: latestMsg } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conv.id)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestMsg?.id) {
        messageId = latestMsg.id as string;
      }
    }
  }

  const { error } = await supabase.from("feedback").upsert(
    {
      message_id: messageId,
      user_id: user.id,
      book_id: book?.id ?? null,
      question: body.question?.trim() || null,
      answer: body.answer?.trim() || null,
      rating: body.rating,
      reason: body.reason?.trim() || null,
    },
    { onConflict: "message_id,user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
