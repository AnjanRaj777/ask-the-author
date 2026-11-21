import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

interface NoFileBody {
  title?: string;
  author?: string;
}

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json(
      { error: "Server is missing Supabase configuration in .env.local." },
      { status: 503 }
    );
  }

  let body: NoFileBody;
  try {
    body = (await req.json()) as NoFileBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = body.title?.trim();
  const author = body.author?.trim();

  if (!title || !author) {
    return NextResponse.json(
      { error: "Both book title and author name are required." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: bookRow, error: bookErr } = await supabase
    .from("books")
    .insert({
      title,
      author,
      source: "no_file",
      status: "ready",
      chapter_count: 0,
      persona_mode: "author",
      rights_note: "No-file AI memory mode (no book text stored).",
    })
    .select("id")
    .single();

  if (bookErr || !bookRow) {
    return NextResponse.json(
      { error: bookErr?.message || "Failed to create book entry." },
      { status: 500 }
    );
  }

  const bookId = bookRow.id as string;
  const starterQuestions = [
    `What inspired you to write "${title}"?`,
    `What central theme or idea should I pay attention to first in "${title}"?`,
    `How did you approach the main character's journey?`,
  ];

  const { error: personaErr } = await supabase.from("personas").insert({
    book_id: bookId,
    display_name: author,
    voice_notes: `Speak in the first person as ${author} about "${title}".`,
    themes: [],
    bio_facts: null,
    style_samples: [],
    starter_questions: starterQuestions,
  });

  if (personaErr) {
    return NextResponse.json({ error: personaErr.message }, { status: 500 });
  }

  return NextResponse.json({
    bookId,
    title,
    author,
    chapterCount: 0,
    personaName: author,
    starterQuestions,
  });
}
