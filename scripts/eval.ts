import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CHAT_MODEL, getMuseClient } from "../src/lib/ai/muse";
import { buildSystemPrompt } from "../src/lib/ai/prompts";
import { getSupabaseServerClient } from "../src/lib/db/supabase";
import { retrieveChunks } from "../src/lib/rag/retrieve";
import { validateAnswer } from "../src/lib/rag/validate";
import type { AnswerMode, Persona, PersonaMode } from "../src/lib/types";

interface EvalCase {
  id: string;
  question: string;
  spoilerLimit: number;
  expectedChapters: number[];
  forbiddenChapters?: number[];
  expectedMode?: AnswerMode;
  type: "grounded" | "spoiler" | "abstention";
}

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  }
}

async function main() {
  loadEnvLocal();
  const slug = process.argv[2] || "pride-and-prejudice";
  const evalPath = path.resolve(process.cwd(), "evals", `${slug}.json`);
  if (!fs.existsSync(evalPath)) {
    console.error(`Eval file not found: ${evalPath}`);
    process.exit(1);
  }

  const cases = JSON.parse(fs.readFileSync(evalPath, "utf-8")) as EvalCase[];
  const supabase = getSupabaseServerClient();

  const { data: book, error } = await supabase
    .from("books")
    .select("id, title, author, persona_mode")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !book) {
    console.error(
      `Book "${slug}" not found in Supabase. Run \`npm run ingest\` first.`
    );
    process.exit(1);
  }

  const { data: persona } = await supabase
    .from("personas")
    .select("*")
    .eq("book_id", book.id)
    .maybeSingle();

  const muse = getMuseClient();
  let passed = 0;

  for (const c of cases) {
    const chunks = await retrieveChunks({
      bookId: book.id,
      question: c.question,
      spoilerLimit: c.spoilerLimit,
      matchCount: 8,
    });

    const retrievedChapters = new Set(chunks.map((ch) => ch.chapter_idx));
    const spoilerLeak = chunks.some((ch) => ch.chapter_idx > c.spoilerLimit);
    const hitExpected =
      c.expectedChapters.length === 0 ||
      c.expectedChapters.some((ch) => retrievedChapters.has(ch));

    const systemPrompt = buildSystemPrompt({
      title: book.title,
      author: book.author,
      personaMode: book.persona_mode as PersonaMode,
      persona: (persona as Persona | null) ?? null,
      spoilerLimit: c.spoilerLimit,
      chunks,
    });

    const resp = await muse.chat.completions.create({
      model: DEFAULT_CHAT_MODEL,
      max_tokens: 512,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: c.question },
      ],
    });

    const text = resp.choices[0]?.message?.content ?? "";

    const modeMatch = /<mode>([^<]+)<\/mode>/i.exec(text);
    const ansMatch = /<answer>([\s\S]*?)<\/answer>/i.exec(text);
    const rawMode = (modeMatch?.[1]?.trim().toLowerCase() ??
      "speculation") as AnswerMode;
    const rawAnswer = ansMatch?.[1]?.trim() ?? text;

    const validated = validateAnswer({
      rawAnswer,
      mode: rawMode,
      chunks,
      spoilerLimit: c.spoilerLimit,
    });

    const modeOk =
      !c.expectedMode ||
      validated.mode === c.expectedMode ||
      (c.type === "abstention" && validated.mode !== "grounded");

    const ok = !spoilerLeak && hitExpected && modeOk;
    if (ok) passed++;

    console.log(
      `[${ok ? "PASS" : "FAIL"}] ${c.id} (${c.type}) | mode=${validated.mode} | citations=${validated.citations.length} | spoilerLeak=${spoilerLeak}`
    );
  }

  console.log(`\nScore: ${passed}/${cases.length} passed`);
  if (passed < cases.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
