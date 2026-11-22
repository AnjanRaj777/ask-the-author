"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  Download,
  FileText,
  Printer,
  Save,
  Trash2,
} from "lucide-react";

interface SavedNoteItem {
  id: string;
  bookId: string | null;
  bookTitle: string;
  bookAuthor: string;
  question: string;
  answer: string;
  answerMode: string | null;
  citations: Array<{ n: number; label?: string; quote?: string; passage?: string }>;
  note: string;
  createdAt: string;
}

export function NotesClient() {
  const [notes, setNotes] = useState<SavedNoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<string>("all");
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notes")
      .then(async (res) => {
        if (res.status === 401) {
          setAuthError("Sign in to view and export your saved notes.");
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { notes?: SavedNoteItem[]; error?: string };
        if (data.error) {
          setAuthError(data.error);
        } else {
          const list = data.notes ?? [];
          setNotes(list);
          const drafts: Record<string, string> = {};
          for (const n of list) drafts[n.id] = n.note || "";
          setDraftNotes(drafts);
        }
        setLoading(false);
      })
      .catch(() => {
        setAuthError("Could not load saved notes.");
        setLoading(false);
      });
  }, []);

  const books = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of notes) {
      map.set(n.bookTitle, n.bookAuthor);
    }
    return Array.from(map.entries());
  }, [notes]);

  const filtered = useMemo(() => {
    if (selectedBook === "all") return notes;
    return notes.filter((n) => n.bookTitle === selectedBook);
  }, [notes, selectedBook]);

  async function savePersonalNote(id: string) {
    setSavingId(id);
    const noteText = draftNotes[id] ?? "";
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: noteText }),
    });
    if (res.ok) {
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, note: noteText } : n))
      );
    }
    setSavingId(null);
  }

  async function deleteNote(id: string) {
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
    }
  }

  function exportMarkdown() {
    const lines: string[] = [
      "# Ask the Author — Saved Notes",
      "",
      `Exported on ${new Date().toLocaleDateString()}`,
      "",
    ];

    for (const item of filtered) {
      lines.push(`## ${item.bookTitle}${item.bookAuthor ? ` (${item.bookAuthor})` : ""}`);
      if (item.question) lines.push(`**Question:** ${item.question}`);
      lines.push("");
      lines.push(item.answer);
      if (item.note) {
        lines.push("");
        lines.push(`> **My Note:** ${item.note}`);
      }
      if (item.citations.length > 0) {
        lines.push("");
        lines.push("**Citations:**");
        for (const c of item.citations) {
          const text = c.quote || c.passage || "";
          lines.push(`- [${c.n}] ${c.label ? `${c.label}: ` : ""}${text}`);
        }
      }
      lines.push("");
      lines.push("---");
      lines.push("");
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ask-the-author-notes.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    window.print();
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-edge pb-5 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/#library"
            className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink/40"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Library
          </Link>
          <div>
            <h1 className="font-display text-2xl font-medium text-ink">
              Saved Notes
            </h1>
            <p className="text-xs text-ink-muted">
              Your bookmarked Q&As, personal study notes, and citations
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportMarkdown}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink/40 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Export Markdown
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            <Printer className="h-3.5 w-3.5" />
            Export PDF
          </button>
        </div>
      </header>

      <div className="hidden print:mb-6 print:block">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Ask the Author — Saved Notes
        </h1>
      </div>

      {!loading && books.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
          <span className="text-xs font-medium text-ink-muted">Filter by book:</span>
          <button
            type="button"
            onClick={() => setSelectedBook("all")}
            className={`rounded-full px-3 py-1 text-xs transition ${
              selectedBook === "all"
                ? "bg-ink text-paper"
                : "border border-edge bg-surface text-ink hover:border-ink/40"
            }`}
          >
            All ({notes.length})
          </button>
          {books.map(([title]) => (
            <button
              key={title}
              type="button"
              onClick={() => setSelectedBook(title)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                selectedBook === title
                  ? "bg-ink text-paper"
                  : "border border-edge bg-surface text-ink hover:border-ink/40"
              }`}
            >
              {title}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading saved notes…</p>
      ) : authError ? (
        <div className="rounded-xl border border-edge bg-surface p-6 text-center">
          <Bookmark className="mx-auto mb-2 h-6 w-6 text-ink-muted" />
          <p className="text-sm text-ink">{authError}</p>
          <Link
            href="/login?next=/notes"
            className="mt-4 inline-flex rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white"
          >
            Sign in
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-edge bg-surface p-8 text-center">
          <FileText className="mx-auto mb-2 h-6 w-6 text-ink-muted" />
          <p className="text-sm text-ink">No saved notes yet.</p>
          <p className="mt-1 text-xs text-ink-muted">
            Click the bookmark icon on any answer in chat to save it here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-edge bg-surface p-5 shadow-xs print:break-inside-avoid print:border-black/20"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                    {item.bookTitle}
                  </span>
                  {item.bookAuthor && (
                    <span className="ml-2 text-xs text-ink-muted">
                      by {item.bookAuthor}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => deleteNote(item.id)}
                  title="Delete note"
                  className="text-ink-muted transition hover:text-red-600 print:hidden"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {item.question && (
                <p className="mb-2 text-sm font-medium text-ink">
                  Q: {item.question}
                </p>
              )}

              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
                {item.answer}
              </p>

              {item.citations.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.citations.map((c) => (
                    <span
                      key={c.n}
                      className="rounded border border-edge bg-paper px-2 py-0.5 text-[11px] text-ink-muted"
                    >
                      [{c.n}] {c.label || ""}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 border-t border-edge pt-3">
                <label className="mb-1 block text-[11px] font-medium text-ink-muted">
                  Personal note
                </label>
                <div className="flex gap-2 print:hidden">
                  <textarea
                    rows={2}
                    value={draftNotes[item.id] ?? ""}
                    onChange={(e) =>
                      setDraftNotes((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    placeholder="Add your thoughts or essay outline…"
                    className="w-full rounded-lg border border-edge bg-paper px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => savePersonalNote(item.id)}
                    disabled={savingId === item.id}
                    className="inline-flex shrink-0 items-center gap-1 self-end rounded-lg border border-edge bg-paper px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink/40"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingId === item.id ? "Saving…" : "Save"}
                  </button>
                </div>
                {item.note && (
                  <p className="hidden text-xs italic text-ink/80 print:block">
                    {item.note}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
