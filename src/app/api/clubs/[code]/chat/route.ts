import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_CHAT_MODEL, getMuseClient } from "@/lib/ai/muse";
import { buildNoFileSystemPrompt, buildSystemPrompt } from "@/lib/ai/prompts";
import { getCurrentUser } from "@/lib/db/auth";
import { getSupabaseServerClient } from "@/lib/db/supabase";
import { retrieveChunks } from "@/lib/rag/retrieve";
import { validateAnswer } from "@/lib/rag/validate";
import type { AnswerMode, Persona, PersonaMode } from "@/lib/types";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { code } = await context.params;
  const inviteCode = code.trim().toUpperCase();

  let body: { content?: string; askAuthor?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json({ error: "Message content is required." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: club } = await supabase
    .from("book_clubs")
    .select(
      "id, books(id, title, author, chapter_count, persona_mode, source)"
    )
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (!club) {
    return NextResponse.json({ error: "Book club not found." }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("book_club_members")
    .select("display_name, spoiler_limit")
    .eq("club_id", club.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "Join the book club before posting." },
      { status: 403 }
    );
  }

  const book = Array.isArray(club.books) ? club.books[0] : club.books;
  if (!book) {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  // Always save the member's message first
  const { data: memberMsg, error: msgErr } = await supabase
    .from("book_club_messages")
    .insert({
      club_id: club.id,
      user_id: user.id,
      author_name: membership.display_name,
      role: "member",
      content,
      spoiler_limit_used: membership.spoiler_limit,
    })
    .select("id, created_at")
    .single();

  if (msgErr || !memberMsg) {
    return NextResponse.json(
      { error: msgErr?.message || "Failed to post message." },
      { status: 500 }
    );
  }

  if (!body.askAuthor) {
    return NextResponse.json({ ok: true, memberMessageId: memberMsg.id });
  }

  // Retrieve & answer strictly filtered by THIS member's own spoiler_limit
  const spoilerLimit = Math.max(
    1,
    Math.min(membership.spoiler_limit, (book.chapter_count as number) || 1)
  );
  const isNoFile = book.source === "no_file";

  const { data: persona } = await supabase
    .from("personas")
    .select("*")
    .eq("book_id", book.id)
    .maybeSingle();

  const chunks = isNoFile
    ? []
    : await retrieveChunks({
        bookId: book.id as string,
        question: content,
        spoilerLimit,
        matchCount: 8,
      });

  const systemPrompt = isNoFile
    ? buildNoFileSystemPrompt({
        title: book.title as string,
        author: book.author as string,
        persona: (persona as Persona | null) ?? null,
        spoilerLimit,
      })
    : buildSystemPrompt({
        title: book.title as string,
        author: book.author as string,
        personaMode: book.persona_mode as PersonaMode,
        persona: (persona as Persona | null) ?? null,
        spoilerLimit,
        chunks,
      });

  const muse = getMuseClient();
  const completion = await muse.chat.completions.create({
    model: DEFAULT_CHAT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content },
    ],
  });

  const rawText = completion.choices[0]?.message?.content ?? "";
  const modeMatch = rawText.match(/<mode>\s*([\s\S]*?)\s*<\/mode>/i);
  const answerMatch = rawText.match(/<answer>([\s\S]*?)<\/answer>/i);
  const rawMode = (modeMatch?.[1] ?? "not_in_book").trim().toLowerCase();
  const detectedMode: AnswerMode =
    rawMode === "grounded" || rawMode === "speculation" || rawMode === "memory"
      ? rawMode
      : "not_in_book";
  const rawAnswer = (answerMatch?.[1] ?? rawText).trim();

  const validated = isNoFile
    ? {
        mode: "memory" as AnswerMode,
        answer: rawAnswer.replace(/\[\d+\]/g, "").trim(),
        citations: [],
      }
    : validateAnswer({
        rawAnswer,
        mode: detectedMode,
        chunks,
        spoilerLimit,
      });

  const assistantName =
    (persona as Persona | null)?.display_name || (book.author as string) || "The Author";

  const { data: aiMsg } = await supabase
    .from("book_club_messages")
    .insert({
      club_id: club.id,
      user_id: null,
      author_name: assistantName,
      role: "assistant",
      content: validated.answer,
      answer_mode: validated.mode,
      citations: validated.citations,
      spoiler_limit_used: spoilerLimit,
    })
    .select("id")
    .single();

  return NextResponse.json({
    ok: true,
    memberMessageId: memberMsg.id,
    assistantMessageId: aiMsg?.id ?? null,
  });
}
