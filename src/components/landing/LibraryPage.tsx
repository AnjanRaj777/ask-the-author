"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { CATALOG, toSelectedBook, type SelectedBook } from "@/lib/catalog";
import type { BookSearchResult } from "@/app/api/books/search/route";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED = /\.(epub|pdf|txt)$/i;

type LibraryTab = "find" | "upload" | "paste" | "no_file";

/** Step 6 (left page): find, import, paste, upload, or enter a book. */
export function LibraryPage({
  selected,
  onSelect,
}: {
  selected: SelectedBook | null;
  onSelect: (book: SelectedBook) => void;
}) {
  const [tab, setTab] = useState<LibraryTab>("find");
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Search tab state
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);

  // Paste / URL tab state
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteAuthor, setPasteAuthor] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");

  // No-file tab state
  const [noFileTitle, setNoFileTitle] = useState("");
  const [noFileAuthor, setNoFileAuthor] = useState("");

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/books/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        const data = (await res.json()) as { results?: BookSearchResult[] };
        if (res.ok) {
          setSearchResults(data.results ?? []);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setSearchResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 320);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    if (!ALLOWED.test(file.name)) {
      setError("Please choose an EPUB, PDF or TXT file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That file is over 20 MB.");
      return;
    }
    if (!ownershipConfirmed) {
      setError("Please check the personal-use ownership box below first.");
      return;
    }

    setError(null);
    setBusy(true);
    setStatusMsg(`Parsing & indexing "${file.name}"…`);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("ownershipConfirmed", "true");

      const res = await fetch("/api/books/upload", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        error?: string;
        bookId?: string;
        title?: string;
        author?: string;
        personaName?: string;
      };
      if (!res.ok || !data.bookId) {
        throw new Error(data.error || "Upload failed.");
      }

      setStatusMsg(null);
      onSelect({
        kind: "upload",
        id: data.bookId,
        title: data.title || file.name.replace(ALLOWED, ""),
        author: data.author || "Unknown author",
        personaName: data.personaName || "The Author",
        fileName: file.name,
      });
    } catch (err) {
      setStatusMsg(null);
      setError(err instanceof Error ? err.message : "Failed to upload book.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleImportPublicDomain(item: BookSearchResult) {
    if (busy) return;
    if (item.alreadyIngested && item.bookId) {
      onSelect({
        kind: "library",
        id: item.bookId,
        title: item.title,
        author: item.author,
        personaName: item.author || "The Author",
      });
      return;
    }

    setError(null);
    setBusy(true);
    setStatusMsg(`Importing "${item.title}"…`);
    try {
      const res = await fetch("/api/books/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalId: item.externalId,
          title: item.title,
          author: item.author,
          downloadUrl: item.downloadUrl,
          format: item.format,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        bookId?: string;
        title?: string;
        author?: string;
        personaName?: string;
      };
      if (!res.ok || !data.bookId) {
        throw new Error(data.error || "Failed to import book.");
      }
      setStatusMsg(null);
      onSelect({
        kind: "library",
        id: data.bookId,
        title: data.title || item.title,
        author: data.author || item.author,
        personaName: data.personaName || item.author,
      });
    } catch (err) {
      setStatusMsg(null);
      setError(err instanceof Error ? err.message : "Failed to import book.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePasteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    setStatusMsg("Indexing text…");
    try {
      const res = await fetch("/api/books/from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pasteTitle,
          author: pasteAuthor,
          text: pasteText,
          url: pasteUrl,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        bookId?: string;
        title?: string;
        author?: string;
        personaName?: string;
      };
      if (!res.ok || !data.bookId) {
        throw new Error(data.error || "Failed to index text.");
      }
      setStatusMsg(null);
      onSelect({
        kind: "upload",
        id: data.bookId,
        title: data.title || pasteTitle || "Pasted Text",
        author: data.author || pasteAuthor || "Unknown author",
        personaName: data.personaName || "The Author",
      });
    } catch (err) {
      setStatusMsg(null);
      setError(err instanceof Error ? err.message : "Failed to index text.");
    } finally {
      setBusy(false);
    }
  }

  async function handleNoFileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    setStatusMsg("Opening author chat…");
    try {
      const res = await fetch("/api/books/no-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: noFileTitle,
          author: noFileAuthor,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        bookId?: string;
        title?: string;
        author?: string;
        personaName?: string;
      };
      if (!res.ok || !data.bookId) {
        throw new Error(data.error || "Failed to start chat.");
      }
      setStatusMsg(null);
      onSelect({
        kind: "library",
        id: data.bookId,
        title: data.title || noFileTitle,
        author: data.author || noFileAuthor,
        personaName: data.personaName || noFileAuthor,
      });
    } catch (err) {
      setStatusMsg(null);
      setError(err instanceof Error ? err.message : "Failed to start chat.");
    } finally {
      setBusy(false);
    }
  }

  const tabs: Array<{ id: LibraryTab; label: string; Icon: typeof Search }> = [
    { id: "find", label: "Find", Icon: Search },
    { id: "upload", label: "Upload", Icon: Upload },
    { id: "paste", label: "Paste / URL", Icon: FileText },
    { id: "no_file", label: "No File", Icon: Sparkles },
  ];

  return (
    <div className="flex h-full flex-col p-5 sm:p-7">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-ink-soft">
          Chapter one
        </p>
        <h2 className="mt-1 font-serif text-3xl font-semibold text-ink">
          Choose a book
        </h2>
      </header>

      <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl border border-ink/10 bg-ink/[0.04] p-1">
        {tabs.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setError(null);
              }}
              className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                active
                  ? "bg-page text-ink shadow-xs"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <Icon className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {tab === "find" && (
        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search public-domain books by title or author…"
              className="w-full rounded-full border border-ink/15 bg-page/80 py-2 pl-8 pr-3 text-xs text-ink placeholder:text-ink-soft/75 focus:border-leather focus:outline-none"
            />
          </div>

          <ul className="quiet-scroll mt-2.5 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {query.trim().length >= 2 ? (
              searching ? (
                <li className="flex items-center gap-2 px-2 py-4 text-xs text-ink-soft">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Searching libraries…
                </li>
              ) : searchResults.length === 0 ? (
                <li className="px-2 py-4 text-xs text-ink-soft">
                  No public-domain matches found. Try the{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setNoFileTitle(query.trim());
                      setTab("no_file");
                    }}
                    className="font-medium text-leather underline underline-offset-2"
                  >
                    No File
                  </button>{" "}
                  tab to chat by title &amp; author.
                </li>
              ) : (
                searchResults.map((item) => {
                  const isSelected = selected?.id === item.bookId;
                  return (
                    <li key={item.externalId}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleImportPublicDomain(item)}
                        className={`group flex w-full items-center gap-3 rounded-lg border p-2 text-left transition disabled:opacity-60 ${
                          isSelected
                            ? "border-leather/30 bg-page shadow-xs"
                            : "border-transparent hover:border-ink/10 hover:bg-page/70"
                        }`}
                      >
                        <span className="grid h-10 w-8 shrink-0 place-items-center rounded-[3px] border border-ink/15 bg-leather/10 text-leather">
                          <BookOpen className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-serif text-base font-semibold leading-tight text-ink">
                            {item.title}
                          </span>
                          <span className="block truncate text-xs text-ink-soft">
                            {item.author}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-leather/10 px-2.5 py-0.5 text-[10px] font-medium text-leather">
                          {item.alreadyIngested ? "Open" : "Import"}
                        </span>
                      </button>
                    </li>
                  );
                })
              )
            ) : (
              CATALOG.map((b) => {
                const isSelected =
                  selected?.kind === "library" && selected.id === b.id;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      disabled={!b.available || busy}
                      onClick={() => onSelect(toSelectedBook(b))}
                      className={`group flex w-full items-center gap-3 rounded-lg border p-2 text-left transition focus-visible:border-ink/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-transparent disabled:hover:bg-transparent ${
                        isSelected
                          ? "border-leather/30 bg-page shadow-xs"
                          : "border-transparent hover:border-ink/10 hover:bg-page/70"
                      }`}
                    >
                      <span
                        className="relative h-11 w-8 shrink-0 overflow-hidden rounded-[3px] border border-black/15 shadow-[2px_2px_4px_rgba(42,34,29,0.28)]"
                        style={{ background: b.coverColor }}
                        aria-hidden
                      >
                        <span className="absolute inset-y-0 left-0 w-1 bg-black/25" />
                        <span className="absolute inset-1 rounded-[1px] border border-gold/35" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-serif text-lg font-semibold leading-tight text-ink">
                          {b.title}
                        </span>
                        <span className="block truncate text-xs text-ink-soft">
                          {b.author} · {b.year}
                        </span>
                      </span>
                      {b.available ? (
                        <ArrowRight className="h-4 w-4 shrink-0 text-ink-soft transition group-hover:translate-x-0.5 group-hover:text-ink" />
                      ) : (
                        <span className="shrink-0 rounded-full bg-ink/[0.06] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-soft">
                          Soon
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {tab === "upload" && (
        <div className="mt-4 flex flex-1 flex-col justify-center">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload your own eBook"
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`cursor-pointer rounded-xl border border-dashed px-4 py-8 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
              dragOver
                ? "border-leather bg-leather/5"
                : "border-ink/25 hover:border-ink/40 hover:bg-page/60"
            }`}
          >
            <Upload className="mx-auto h-5 w-5 text-ink-soft" aria-hidden />
            <p className="mt-2 text-sm font-medium text-ink">
              {busy ? "Indexing your book…" : "Upload your own eBook"}
            </p>
            <p className="mt-1 text-[11px] text-ink-soft">
              {statusMsg || "EPUB, PDF or TXT · up to 20 MB · personal use"}
            </p>
            <input
              ref={fileRef}
              type="file"
              disabled={busy}
              accept=".epub,.pdf,.txt,application/epub+zip,application/pdf,text/plain"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
            <input
              type="checkbox"
              checked={ownershipConfirmed}
              disabled={busy}
              onChange={(e) => {
                setOwnershipConfirmed(e.target.checked);
                if (e.target.checked) setError(null);
              }}
              className="h-3.5 w-3.5 accent-leather"
            />
            <span>I own this copy and it&apos;s for personal use.</span>
          </label>
        </div>
      )}

      {tab === "paste" && (
        <form
          onSubmit={handlePasteSubmit}
          className="quiet-scroll mt-3 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1"
        >
          <input
            type="text"
            value={pasteTitle}
            onChange={(e) => setPasteTitle(e.target.value)}
            placeholder="Book or article title"
            className="w-full rounded-lg border border-ink/15 bg-page/80 px-3 py-2 text-xs text-ink placeholder:text-ink-soft/75 focus:border-leather focus:outline-none"
          />
          <input
            type="text"
            value={pasteAuthor}
            onChange={(e) => setPasteAuthor(e.target.value)}
            placeholder="Author name (optional)"
            className="w-full rounded-lg border border-ink/15 bg-page/80 px-3 py-2 text-xs text-ink placeholder:text-ink-soft/75 focus:border-leather focus:outline-none"
          />
          <input
            type="url"
            value={pasteUrl}
            onChange={(e) => setPasteUrl(e.target.value)}
            placeholder="Public article / essay URL (or paste text below)"
            className="w-full rounded-lg border border-ink/15 bg-page/80 px-3 py-2 text-xs text-ink placeholder:text-ink-soft/75 focus:border-leather focus:outline-none"
          />
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
            placeholder="Or paste chapter text / excerpt here…"
            className="w-full flex-1 resize-none rounded-lg border border-ink/15 bg-page/80 px-3 py-2 text-xs text-ink placeholder:text-ink-soft/75 focus:border-leather focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper transition hover:bg-leather disabled:opacity-50"
          >
            {busy ? "Indexing…" : "Index text & open chat"}
          </button>
        </form>
      )}

      {tab === "no_file" && (
        <form
          onSubmit={handleNoFileSubmit}
          className="mt-4 flex flex-1 flex-col gap-3"
        >
          <p className="text-xs leading-relaxed text-ink-soft">
            Don&apos;t have an EPUB or PDF? Enter the title and author to talk
            directly using AI memory (without passage citations).
          </p>
          <input
            type="text"
            required
            value={noFileTitle}
            onChange={(e) => setNoFileTitle(e.target.value)}
            placeholder="Book title (e.g. Atomic Habits)"
            className="w-full rounded-lg border border-ink/15 bg-page/80 px-3 py-2 text-xs text-ink placeholder:text-ink-soft/75 focus:border-leather focus:outline-none"
          />
          <input
            type="text"
            required
            value={noFileAuthor}
            onChange={(e) => setNoFileAuthor(e.target.value)}
            placeholder="Author name (e.g. James Clear)"
            className="w-full rounded-lg border border-ink/15 bg-page/80 px-3 py-2 text-xs text-ink placeholder:text-ink-soft/75 focus:border-leather focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-auto rounded-full bg-ink px-4 py-2.5 text-xs font-medium text-paper transition hover:bg-leather disabled:opacity-50"
          >
            {busy ? "Opening…" : "Talk to author without file"}
          </button>
        </form>
      )}

      {statusMsg && tab !== "upload" && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-leather">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {statusMsg}
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
