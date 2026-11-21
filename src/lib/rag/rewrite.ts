import { FAST_MODEL, getMuseClient } from "@/lib/ai/muse";

const FOLLOWUP_HINT_RE =
  /\b(he|she|they|it|him|her|them|his|hers|their|this|that|these|those|why|how so|what about)\b/i;

/**
 * Rewrites follow-up questions with pronouns or implicit references into a
 * standalone search query for better RAG retrieval. Falls back to the
 * original question on any error.
 */
export async function rewriteFollowUpQuery(params: {
  question: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  bookTitle: string;
}): Promise<string> {
  const { question, history, bookTitle } = params;
  if (history.length === 0) return question;
  if (question.length > 90 && !FOLLOWUP_HINT_RE.test(question)) {
    return question;
  }

  try {
    const recent = history
      .slice(-4)
      .map((m) => `${m.role === "user" ? "Reader" : "Assistant"}: ${m.content}`)
      .join("\n");

    const muse = getMuseClient();
    const resp = await muse.chat.completions.create({
      model: FAST_MODEL,
      max_tokens: 150,
      stream: false,
      reasoning_effort: "minimal",
      messages: [
        {
          role: "system",
          content:
            `Rewrite the reader's latest question about "${bookTitle}" into a concise, standalone search query using the conversation context. Do not answer the question and do not add facts not present in the conversation. Output ONLY the rewritten query.`,
        },
        {
          role: "user",
          content: `Conversation:\n${recent}\n\nLatest question: ${question}`,
        },
      ],
    });

    const rewritten = resp.choices[0]?.message?.content?.trim();
    if (!rewritten || rewritten.length > 300) return question;
    return rewritten;
  } catch {
    return question;
  }
}
