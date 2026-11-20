export interface ParsedChapter {
  idx: number;
  title: string;
  text: string;
}

export interface BookChunk {
  chapterIdx: number;
  chapterTitle: string;
  seq: number;
  charStart: number;
  charEnd: number;
  content: string;
  tokenCount: number;
}

const TARGET_TOKENS = 520;
const MAX_TOKENS = 700;
const OVERLAP_PARAGRAPHS = 1;

/** Rough token estimate (~4 chars per token for English prose). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Remove Project Gutenberg header/footer boilerplate if present. */
export function stripGutenbergBoilerplate(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n");
  const startMatch = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i.exec(
    text
  );
  if (startMatch) {
    text = text.slice(startMatch.index + startMatch[0].length);
  }
  const endMatch = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i.exec(
    text
  );
  if (endMatch) {
    text = text.slice(0, endMatch.index);
  }
  return text.trim();
}

const CHAPTER_HEADING_RE =
  /^(?:CHAPTER|Chapter|LETTER|Letter|BOOK|Book|PART|Part)\s+[IVXLC\d]+[^\n]*$/gm;

/** Split plain text into 1-based chapters without crossing chapter boundaries. */
export function parseChaptersFromTxt(raw: string): ParsedChapter[] {
  const cleaned = stripGutenbergBoilerplate(raw);
  const matches = [...cleaned.matchAll(CHAPTER_HEADING_RE)];

  if (matches.length === 0) {
    return [{ idx: 1, title: "Chapter 1", text: cleaned }];
  }

  const chapters: ParsedChapter[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? cleaned.length) : cleaned.length;
    const block = cleaned.slice(start, end).trim();
    const firstNewline = block.indexOf("\n");
    const heading =
      firstNewline === -1 ? block : block.slice(0, firstNewline).trim();
    const body =
      firstNewline === -1 ? "" : block.slice(firstNewline + 1).trim();

    if (!body) continue;
    chapters.push({
      idx: chapters.length + 1,
      title: heading.replace(/\.$/, ""),
      text: body,
    });
  }

  return chapters;
}

/**
 * Pack paragraphs into chapter-scoped chunks (~400-700 tokens) with 1-paragraph overlap.
 * Never crosses chapter boundaries so spoiler filtering by chapter_idx is exact.
 */
export function chunkChapters(chapters: ParsedChapter[]): BookChunk[] {
  const chunks: BookChunk[] = [];
  let globalSeq = 0;

  for (const chapter of chapters) {
    const paragraphs = chapter.text
      .split(/\n\s*\n+/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    if (paragraphs.length === 0) continue;

    // Track approximate character offsets within the chapter body.
    const offsets: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    for (const p of paragraphs) {
      offsets.push({ start: cursor, end: cursor + p.length });
      cursor += p.length + 2;
    }

    let i = 0;
    while (i < paragraphs.length) {
      const selected: number[] = [];
      let tokens = 0;

      while (i < paragraphs.length) {
        const pTokens = estimateTokens(paragraphs[i]);
        if (selected.length > 0 && tokens + pTokens > MAX_TOKENS) {
          break;
        }
        selected.push(i);
        tokens += pTokens;
        i++;
        if (tokens >= TARGET_TOKENS) {
          break;
        }
      }

      const firstIdx = selected[0];
      const lastIdx = selected[selected.length - 1];
      const content = selected.map((idx) => paragraphs[idx]).join("\n\n");

      chunks.push({
        chapterIdx: chapter.idx,
        chapterTitle: chapter.title,
        seq: globalSeq++,
        charStart: offsets[firstIdx].start,
        charEnd: offsets[lastIdx].end,
        content,
        tokenCount: estimateTokens(content),
      });

      // Step back for overlap only if we haven't reached the end of the chapter.
      if (i < paragraphs.length && selected.length > OVERLAP_PARAGRAPHS) {
        i -= OVERLAP_PARAGRAPHS;
      }
    }
  }

  return chunks;
}
