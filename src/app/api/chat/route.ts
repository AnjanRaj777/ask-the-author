import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_CHAT_MODEL, getMuseClient } from "@/lib/ai/muse";
import { buildNoFileSystemPrompt, buildSystemPrompt } from "@/lib/ai/prompts";
import { getSupabaseServerClient } from "@/lib/db/supabase";
import { retrieveChunks } from "@/lib/rag/retrieve";
import { rewriteFollowUpQuery } from "@/lib/rag/rewrite";
import { validateAnswer } from "@/lib/rag/validate";
import type { AnswerMode, Persona, PersonaMode } from "@/lib/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ChatRequestBody {
  bookId?: string;
  question?: string;
  spoilerLimit?: number;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

function sseLine(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function parseMode(raw: string): AnswerMode {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "grounded") return "grounded";
  if (normalized === "speculation") return "speculation";
  if (normalized === "memory") return "memory";
  return "not_in_book";
}

export async function POST(req: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const bookKey = body.bookId?.trim();
  const question = body.question?.trim();
  if (!bookKey || !question) {
    return NextResponse.json(
      { error: "bookId and question are required." },
      { status: 400 }
    );
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.MUSE_API_KEY ||
    !(process.env.VOYAGE_API_KEY || process.env.OPENAI_API_KEY)
  ) {
    return NextResponse.json(
      {
        error:
          "Server is missing API keys. Copy .env.example to .env.local, add Supabase, Muse Wonder (MUSE_API_KEY), and Voyage/OpenAI keys, and ingest a book.",
      },
      { status: 503 }
    );
  }

  const supabase = getSupabaseServerClient();
  const bookQuery = supabase
    .from("books")
    .select("id, title, author, chapter_count, persona_mode, source, status")
    .limit(1);

  const { data: book, error: bookErr } = UUID_RE.test(bookKey)
    ? await bookQuery.eq("id", bookKey).maybeSingle()
    : await bookQuery.eq("slug", bookKey).maybeSingle();

  if (bookErr) {
    return NextResponse.json({ error: bookErr.message }, { status: 500 });
  }
  if (!book) {
    return NextResponse.json(
      {
        error:
          "This book has not been ingested into the database yet. Run `npm run ingest` first.",
      },
      { status: 404 }
    );
  }
  if (book.status !== "ready") {
    return NextResponse.json(
      { error: `Book is not ready yet (status: ${book.status}).` },
      { status: 409 }
    );
  }

  const spoilerLimit = Math.max(
    1,
    Math.min(
      Number(body.spoilerLimit ?? 1),
      book.chapter_count || Number(body.spoilerLimit ?? 1)
    )
  );

  const { data: persona } = await supabase
    .from("personas")
    .select("*")
    .eq("book_id", book.id)
    .maybeSingle();

  const history = (body.history ?? []).slice(-8).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const isNoFile = book.source === "no_file";

  let chunks: Awaited<ReturnType<typeof retrieveChunks>> = [];
  if (!isNoFile) {
    const searchQuery = await rewriteFollowUpQuery({
      question,
      history,
      bookTitle: book.title,
    });

    try {
      chunks = await retrieveChunks({
        bookId: book.id,
        question: searchQuery,
        spoilerLimit,
        matchCount: 8,
      });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Failed to retrieve passages.",
        },
        { status: 500 }
      );
    }
  }

  const systemPrompt = isNoFile
    ? buildNoFileSystemPrompt({
        title: book.title,
        author: book.author,
        persona: (persona as Persona | null) ?? null,
        spoilerLimit,
      })
    : buildSystemPrompt({
        title: book.title,
        author: book.author,
        personaMode: book.persona_mode as PersonaMode,
        persona: (persona as Persona | null) ?? null,
        spoilerLimit,
        chunks,
      });

  const muse = getMuseClient();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = "";
      let modeSent = false;
      let detectedMode: AnswerMode = "speculation";
      let inAnswer = false;
      let rawAnswer = "";

      try {
        const messageStream = await muse.chat.completions.create({
          model: DEFAULT_CHAT_MODEL,
          max_tokens: 2048,
          reasoning_effort: "low",
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: question },
          ],
        });

        for await (const event of messageStream) {
          const deltaText = event.choices[0]?.delta?.content;
          if (deltaText) {
            buffer += deltaText;

            if (!modeSent) {
              const modeMatch = /<mode>([^<]+)<\/mode>/i.exec(buffer);
              if (modeMatch) {
                detectedMode = parseMode(modeMatch[1]);
                modeSent = true;
                controller.enqueue(
                  sseLine({ type: "mode", value: detectedMode })
                );
                buffer = buffer.slice(modeMatch.index + modeMatch[0].length);
              }
            }

            if (modeSent && !inAnswer) {
              const ansStart = /<answer>/i.exec(buffer);
              if (ansStart) {
                inAnswer = true;
                buffer = buffer.slice(ansStart.index + ansStart[0].length);
              }
            }

            if (inAnswer && buffer.length > 0) {
              // Hold back a short tail so we don't stream a partial `</answer>` tag
              const closingIdx = buffer.indexOf("</answer>");
              if (closingIdx !== -1) {
                const finalPiece = buffer.slice(0, closingIdx);
                if (finalPiece) {
                  rawAnswer += finalPiece;
                  controller.enqueue(
                    sseLine({ type: "token", value: finalPiece })
                  );
                }
                buffer = "";
              } else if (buffer.length > 12) {
                const safeLen = buffer.length - 12;
                const chunk = buffer.slice(0, safeLen);
                rawAnswer += chunk;
                controller.enqueue(sseLine({ type: "token", value: chunk }));
                buffer = buffer.slice(safeLen);
              }
            }
          }
        }

        // Flush any remaining buffered text
        if (buffer) {
          const cleanedTail = buffer.replace(/<\/?answer>/gi, "");
          if (cleanedTail) {
            if (!modeSent) {
              controller.enqueue(
                sseLine({ type: "mode", value: detectedMode })
              );
            }
            rawAnswer += cleanedTail;
            controller.enqueue(sseLine({ type: "token", value: cleanedTail }));
          }
        }

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

        controller.enqueue(
          sseLine({ type: "citations", value: validated.citations })
        );
        controller.enqueue(
          sseLine({
            type: "done",
            mode: validated.mode,
            answer: validated.answer,
          })
        );
      } catch (err) {
        controller.enqueue(
          sseLine({
            type: "error",
            error:
              err instanceof Error ? err.message : "Streaming response failed.",
          })
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
