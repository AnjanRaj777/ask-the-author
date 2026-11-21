import type { AnswerMode, Citation } from "@/lib/types";
import type { RetrievedChunk } from "@/lib/rag/retrieve";

const CITATION_RE = /\[(\d+)\]/g;
const QUOTE_RE = /[""\u201c]([^""\u201d\n]{20,})[""\u201d]/g;

function normalizeForQuoteMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, "'")
    .replace(/[\u201c\u201d"]/g, '"')
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strip quotation marks from quoted spans >= 20 chars that do not appear
 * verbatim in the retrieved passages, so paraphrases aren't shown as quotes.
 */
function verifyQuotes(answer: string, chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return answer.replace(QUOTE_RE, "$1");
  }
  const corpus = normalizeForQuoteMatch(chunks.map((c) => c.content).join(" "));
  return answer.replace(QUOTE_RE, (full, inner: string) => {
    const normalized = normalizeForQuoteMatch(inner);
    if (normalized.length < 12) return full;
    return corpus.includes(normalized) ? full : inner;
  });
}

/**
 * Validate `[n]` citations in the generated answer against the retrieved chunks.
 * - Drops any `[n]` that does not correspond to a retrieved chunk or violates spoilerLimit.
 * - Verifies quoted spans >= 20 chars against retrieved chunks.
 * - Downgrades `grounded` to `speculation` if zero valid citations remain.
 */
export function validateAnswer(params: {
  rawAnswer: string;
  mode: AnswerMode;
  chunks: RetrievedChunk[];
  spoilerLimit: number;
}): {
  answer: string;
  mode: AnswerMode;
  citations: Citation[];
} {
  const { rawAnswer, chunks, spoilerLimit } = params;
  let mode = params.mode;

  const citedIndices = new Set<number>();
  const cleanedAnswer = rawAnswer.replace(CITATION_RE, (match, numStr) => {
    const n = Number(numStr);
    const chunk = chunks[n - 1];
    if (!chunk || chunk.chapter_idx > spoilerLimit) {
      return "";
    }
    citedIndices.add(n);
    return match;
  });

  const citations: Citation[] = [...citedIndices]
    .sort((a, b) => a - b)
    .map((n) => {
      const chunk = chunks[n - 1];
      const preview =
        chunk.content.length > 260
          ? `${chunk.content.slice(0, 257).trimEnd()}…`
          : chunk.content;
      return {
        n,
        chunkId: chunk.id,
        chapterIdx: chunk.chapter_idx,
        chapterTitle: chunk.chapter_title,
        page: chunk.page,
        quote: preview,
      };
    });

  if (mode === "grounded" && citations.length === 0) {
    mode = "speculation";
  }

  const quoteChecked = verifyQuotes(cleanedAnswer, chunks);

  return {
    answer: quoteChecked
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    mode,
    citations,
  };
}
