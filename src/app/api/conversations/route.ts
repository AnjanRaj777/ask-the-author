import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/db/auth";
import { getSupabaseServerClient } from "@/lib/db/supabase";
import type { SavedBookChat, SavedMessage } from "@/lib/userHistory";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, chats: [] });
  }

  const supabase = getSupabaseServerClient();
  const { data: convs, error } = await supabase
    .from("conversations")
    .select(
      "id, book_id, spoiler_limit, created_at, books(id, slug, title, author, source, chapter_count, personas(display_name))"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !convs) {
    return NextResponse.json({ authenticated: true, chats: [] });
  }

  const chats: SavedBookChat[] = [];
  const seenBookIds = new Set<string>();
  for (const row of convs) {
    const book = row.books as unknown as {
      id: string;
      slug: string | null;
      title: string;
      author: string;
      source: string;
      chapter_count: number | null;
      personas: { display_name: string } | Array<{ display_name: string }> | null;
    } | null;
    if (!book) continue;
    const resolvedBookId = book.slug || book.id;
    if (seenBookIds.has(resolvedBookId)) continue;
    seenBookIds.add(resolvedBookId);

    const { data: msgs } = await supabase
      .from("messages")
      .select("id, role, content, answer_mode, citations, created_at")
      .eq("conversation_id", row.id)
      .order("created_at", { ascending: true });

    const personaObj = Array.isArray(book.personas)
      ? book.personas[0]
      : book.personas;
    const rawPersona = personaObj?.display_name;
    const personaName =
      rawPersona && rawPersona !== "Book Guide"
        ? rawPersona
        : book.author && !/^unknown author$/i.test(book.author)
          ? book.author
          : "The Author";

    const mappedMessages: SavedMessage[] = (msgs ?? []).map((m) => ({
      id: m.id as string,
      role: m.role as "user" | "assistant",
      content: m.content as string,
      mode: (m.answer_mode as SavedMessage["mode"]) ?? undefined,
      citations: Array.isArray(m.citations)
        ? (m.citations as SavedMessage["citations"])
        : undefined,
    }));

    chats.push({
      bookId: book.slug || book.id,
      title: book.title,
      author: book.author,
      personaName,
      kind: book.source === "upload" ? "upload" : "library",
      chapterCount: book.chapter_count || null,
      chapterLabel: "Chapter",
      readTo: (row.spoiler_limit as number) || 1,
      updatedAt:
        (msgs?.[msgs.length - 1]?.created_at as string) ||
        (row.created_at as string),
      messages: mappedMessages,
    });
  }

  return NextResponse.json({ authenticated: true, chats });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: {
    bookId?: string;
    readTo?: number;
    messages?: SavedMessage[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const bookKey = body.bookId?.trim();
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!bookKey || messages.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const supabase = getSupabaseServerClient();
  const { data: bookRow } = UUID_RE.test(bookKey)
    ? await supabase.from("books").select("id").eq("id", bookKey).maybeSingle()
    : await supabase.from("books").select("id").eq("slug", bookKey).maybeSingle();

  if (!bookRow?.id) {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }
  const dbBookId = bookRow.id as string;

  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .eq("book_id", dbBookId)
    .maybeSingle();

  let conversationId = existingConv?.id as string | undefined;
  if (conversationId) {
    await supabase
      .from("conversations")
      .update({ spoiler_limit: body.readTo || 1 })
      .eq("id", conversationId);
    await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId);
  } else {
    const { data: created, error: convErr } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        book_id: dbBookId,
        spoiler_limit: body.readTo || 1,
      })
      .select("id")
      .single();
    if (convErr || !created?.id) {
      return NextResponse.json(
        { error: convErr?.message || "Failed to save conversation." },
        { status: 500 }
      );
    }
    conversationId = created.id as string;
  }

  const msgRows = messages.map((m) => ({
    conversation_id: conversationId,
    role: m.role,
    content: m.content,
    answer_mode:
      m.mode && m.mode !== "preview" && m.mode !== "memory" ? m.mode : null,
    citations: m.citations ?? [],
  }));

  const { error: msgErr } = await supabase.from("messages").insert(msgRows);
  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, conversationId });
}
