import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/db/auth";
import { getSupabaseServerClient } from "@/lib/db/supabase";
import type { SavedBookChat } from "@/lib/userHistory";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { chats?: SavedBookChat[] };
  try {
    body = (await req.json()) as { chats?: SavedBookChat[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const chats = Array.isArray(body.chats) ? body.chats : [];
  if (chats.length === 0) {
    return NextResponse.json({ migrated: 0 });
  }

  const supabase = getSupabaseServerClient();
  let migrated = 0;

  for (const chat of chats) {
    if (!chat.bookId || !Array.isArray(chat.messages) || chat.messages.length === 0) {
      continue;
    }

    const { data: bookRow } = UUID_RE.test(chat.bookId)
      ? await supabase
          .from("books")
          .select("id")
          .eq("id", chat.bookId)
          .maybeSingle()
      : await supabase
          .from("books")
          .select("id")
          .eq("slug", chat.bookId)
          .maybeSingle();

    if (!bookRow?.id) continue;
    const dbBookId = bookRow.id as string;

    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", dbBookId)
      .maybeSingle();

    if (existingConv?.id) continue;

    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        book_id: dbBookId,
        spoiler_limit: chat.readTo || 1,
      })
      .select("id")
      .single();

    if (convErr || !conv?.id) continue;

    const msgRows = chat.messages.map((m) => ({
      conversation_id: conv.id,
      role: m.role,
      content: m.content,
      answer_mode:
        m.mode && m.mode !== "preview" && m.mode !== "memory" ? m.mode : null,
      citations: m.citations ?? [],
    }));

    const { error: msgErr } = await supabase.from("messages").insert(msgRows);
    if (!msgErr) migrated++;
  }

  return NextResponse.json({ migrated });
}
