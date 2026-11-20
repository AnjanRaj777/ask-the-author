"use client";

import { useRef, useState } from "react";
import { ArrowRight, Upload } from "lucide-react";
import { CATALOG, toSelectedBook, type SelectedBook } from "@/lib/catalog";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED = /\.(epub|pdf|txt)$/i;

/** Step 6 (left page): pick a library book or upload an eBook. */
export function LibraryPage({
  selected,
  onSelect,
}: {
  selected: SelectedBook | null;
  onSelect: (book: SelectedBook) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!ALLOWED.test(file.name)) {
      setError("Please choose an EPUB, PDF or TXT file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That file is over 20 MB.");
      return;
    }
    setError(null);
    const title = file.name
      .replace(ALLOWED, "")
      .replace(/[_-]+/g, " ")
      .trim();
    onSelect({
      kind: "upload",
      id: "upload",
      title: title || "Your book",
      author: "Unknown author",
      personaName: "Book Guide",
      fileName: file.name,
    });
  }

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

      <ul className="quiet-scroll mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {CATALOG.map((b) => {
          const isSelected = selected?.kind === "library" && selected.id === b.id;
          return (
          <li key={b.id}>
            <button
              type="button"
              disabled={!b.available}
              onClick={() => onSelect(toSelectedBook(b))}
              className={`group flex w-full items-center gap-3 rounded-lg border p-2 text-left transition focus-visible:border-ink/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-transparent disabled:hover:bg-transparent ${
                isSelected
                  ? "border-leather/30 bg-white/80 shadow-xs"
                  : "border-transparent hover:border-ink/10 hover:bg-white/60"
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
        })}
      </ul>

      <div className="my-3 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-ink-soft">
        <span className="h-px flex-1 bg-ink/15" />
        or
        <span className="h-px flex-1 bg-ink/15" />
      </div>

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
        className={`cursor-pointer rounded-lg border border-dashed px-4 py-3 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
          dragOver
            ? "border-leather bg-leather/5"
            : "border-ink/25 hover:border-ink/40 hover:bg-white/50"
        }`}
      >
        <Upload className="mx-auto h-4 w-4 text-ink-soft" aria-hidden />
        <p className="mt-1 text-sm font-medium text-ink">
          Upload your own eBook
        </p>
        <p className="text-[11px] text-ink-soft">
          EPUB, PDF or TXT · up to 20 MB · personal use
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".epub,.pdf,.txt,application/epub+zip,application/pdf,text/plain"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
