import path from "node:path";
import * as cheerio from "cheerio";
import JSZip from "jszip";
import { extractText } from "unpdf";
import { parseChaptersFromTxt, type ParsedChapter } from "./chunk";

export interface ParsedBook {
  title: string;
  author: string;
  chapters: ParsedChapter[];
}

function fallbackTitleFromFile(fileName: string): string {
  return (
    path
      .basename(fileName, path.extname(fileName))
      .replace(/[_-]+/g, " ")
      .trim() || "Untitled Book"
  );
}

function resolveZipPath(baseDir: string, href: string): string {
  const cleanHref = href.split("#")[0].replace(/^\/+/, "");
  if (!baseDir) return cleanHref;
  const parts = `${baseDir}/${cleanHref}`.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

async function parseEpub(
  buffer: Buffer,
  fileName: string
): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(buffer);
  const containerXml = await zip
    .file("META-INF/container.xml")
    ?.async("text");

  let opfPath = "";
  if (containerXml) {
    const $c = cheerio.load(containerXml, { xmlMode: true });
    opfPath = $c("rootfile").attr("full-path") || "";
  }
  if (!opfPath) {
    const found = Object.keys(zip.files).find((k) => k.endsWith(".opf"));
    if (!found) {
      throw new Error("Invalid EPUB: missing OPF package document.");
    }
    opfPath = found;
  }

  const opfText = await zip.file(opfPath)?.async("text");
  if (!opfText) {
    throw new Error("Invalid EPUB: unable to read OPF metadata.");
  }

  const $opf = cheerio.load(opfText, { xmlMode: true });
  const title =
    $opf("metadata dc\\:title, metadata title").first().text().trim() ||
    fallbackTitleFromFile(fileName);
  const author =
    $opf("metadata dc\\:creator, metadata creator").first().text().trim() ||
    "Unknown author";

  const opfDir = path.posix.dirname(opfPath) === "." ? "" : path.posix.dirname(opfPath);
  const manifest = new Map<string, { href: string; mediaType: string }>();
  $opf("manifest item").each((_, el) => {
    const id = $opf(el).attr("id");
    const href = $opf(el).attr("href");
    const mediaType = $opf(el).attr("media-type") || "";
    if (id && href) {
      manifest.set(id, { href: decodeURIComponent(href), mediaType });
    }
  });

  const spineIds: string[] = [];
  $opf("spine itemref").each((_, el) => {
    const idref = $opf(el).attr("idref");
    if (idref) spineIds.push(idref);
  });

  const chapters: ParsedChapter[] = [];
  let idx = 1;

  for (const idref of spineIds) {
    const item = manifest.get(idref);
    if (!item) continue;
    const fullPath = resolveZipPath(opfDir, item.href);
    const html = await zip.file(fullPath)?.async("text");
    if (!html) continue;

    const $ = cheerio.load(html);
    $("script, style, nav").remove();
    const heading =
      $("h1, h2, h3").first().text().replace(/\s+/g, " ").trim() ||
      $("title").first().text().replace(/\s+/g, " ").trim();
    const text = $("body")
      .text()
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (text.length < 120) continue;

    chapters.push({
      idx,
      title: heading || `Chapter ${idx}`,
      text,
    });
    idx++;
  }

  if (chapters.length === 0) {
    throw new Error("Could not extract readable text from this EPUB.");
  }

  return { title, author, chapters };
}

async function parsePdf(buffer: Buffer, fileName: string): Promise<ParsedBook> {
  const { text: pages } = await extractText(new Uint8Array(buffer), {
    mergePages: false,
  });

  const pageList = Array.isArray(pages) ? pages : [String(pages ?? "")];
  const combined = pageList.join("\n\n").trim();

  if (combined.length < 100) {
    throw new Error(
      "This PDF appears to be scanned (image-only) and has no extractable text."
    );
  }

  // Try chapter-heading splitting first; if only 1 chapter is found on a multi-page PDF,
  // group into ~10-page sections so spoiler filtering remains useful.
  const detected = parseChaptersFromTxt(combined);
  if (detected.length > 1 || pageList.length <= 12) {
    return {
      title: fallbackTitleFromFile(fileName),
      author: "Unknown author",
      chapters: detected,
    };
  }

  const PAGES_PER_SECTION = 10;
  const chapters: ParsedChapter[] = [];
  for (let i = 0; i < pageList.length; i += PAGES_PER_SECTION) {
    const slice = pageList
      .slice(i, i + PAGES_PER_SECTION)
      .join("\n\n")
      .trim();
    if (!slice) continue;
    const startPage = i + 1;
    const endPage = Math.min(i + PAGES_PER_SECTION, pageList.length);
    chapters.push({
      idx: chapters.length + 1,
      title: `Pages ${startPage}–${endPage}`,
      text: slice,
    });
  }

  return {
    title: fallbackTitleFromFile(fileName),
    author: "Unknown author",
    chapters,
  };
}

export async function parseBookBuffer(
  buffer: Buffer,
  fileName: string
): Promise<ParsedBook> {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".txt") {
    const raw = buffer.toString("utf-8");
    const chapters = parseChaptersFromTxt(raw);
    if (chapters.length === 0 || chapters.every((c) => c.text.length < 40)) {
      throw new Error("This TXT file does not contain enough readable text.");
    }
    return {
      title: fallbackTitleFromFile(fileName),
      author: "Unknown author",
      chapters,
    };
  }

  if (ext === ".epub") {
    return parseEpub(buffer, fileName);
  }

  if (ext === ".pdf") {
    return parsePdf(buffer, fileName);
  }

  throw new Error("Unsupported file type. Please upload an EPUB, PDF, or TXT.");
}
