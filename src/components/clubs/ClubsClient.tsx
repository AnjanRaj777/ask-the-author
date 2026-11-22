"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Plus, Users } from "lucide-react";

interface ClubSummary {
  id: string;
  name: string;
  inviteCode: string;
  spoilerLimit: number;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  chapterCount: number;
}

interface CatalogBook {
  id: string;
  title: string;
  author: string;
  chapterCount?: number | null;
}

export function ClubsClient() {
  const router = useRouter();
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(true);

  const [clubName, setClubName] = useState("");
  const [selectedBookId, setSelectedBookId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/clubs").then((r) => r.json()),
      fetch("/api/books/search?q=").then((r) => r.json()).catch(() => ({ local: [] })),
    ])
      .then(([clubsData, booksData]) => {
        if (clubsData.authenticated === false) {
          setAuthenticated(false);
        } else {
          setClubs(clubsData.clubs ?? []);
        }
        const localBooks = (booksData.local ?? []) as CatalogBook[];
        setBooks(localBooks);
        if (localBooks.length > 0) {
          setSelectedBookId(localBooks[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!clubName.trim() || !selectedBookId) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/clubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: clubName.trim(),
        bookId: selectedBookId,
      }),
    });
    const data = (await res.json()) as { inviteCode?: string; error?: string };
    setCreating(false);
    if (!res.ok || !data.inviteCode) {
      setError(data.error || "Could not create book club.");
      return;
    }
    router.push(`/clubs/${data.inviteCode}`);
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    router.push(`/clubs/${code}`);
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-edge pb-5">
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
              Book Clubs
            </h1>
            <p className="text-xs text-ink-muted">
              Shared reading rooms with per-member spoiler protection
            </p>
          </div>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading book clubs…</p>
      ) : !authenticated ? (
        <div className="rounded-xl border border-edge bg-surface p-6 text-center">
          <Users className="mx-auto mb-2 h-6 w-6 text-ink-muted" />
          <p className="text-sm text-ink">
            Sign in to create or join a book club room.
          </p>
          <Link
            href="/login?next=/clubs"
            className="mt-4 inline-flex rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-edge bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <Plus className="h-4 w-4 text-accent" />
              Create a Book Club
            </h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-ink-muted">
                  Club name
                </label>
                <input
                  type="text"
                  required
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="Sunday Classics Circle"
                  className="w-full rounded-lg border border-edge bg-paper px-3 py-2 text-xs text-ink outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-muted">
                  Book
                </label>
                {books.length > 0 ? (
                  <select
                    value={selectedBookId}
                    onChange={(e) => setSelectedBookId(e.target.value)}
                    className="w-full rounded-lg border border-edge bg-paper px-3 py-2 text-xs text-ink outline-none focus:border-accent"
                  >
                    {books.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} — {b.author}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={selectedBookId}
                    onChange={(e) => setSelectedBookId(e.target.value)}
                    placeholder="Book ID or slug (e.g. pride-and-prejudice)"
                    className="w-full rounded-lg border border-edge bg-paper px-3 py-2 text-xs text-ink outline-none focus:border-accent"
                  />
                )}
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create Club & Get Invite Link"}
              </button>
            </form>

            <form
              onSubmit={handleJoin}
              className="mt-6 border-t border-edge pt-4"
            >
              <label className="mb-1.5 block text-xs font-medium text-ink">
                Have an invite code?
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="e.g. A7K9P2"
                  className="w-full rounded-lg border border-edge bg-paper px-3 py-1.5 text-xs uppercase text-ink outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg border border-edge bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:border-ink/40"
                >
                  Open
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-edge bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <BookOpen className="h-4 w-4 text-accent" />
              Your Clubs ({clubs.length})
            </h2>
            {clubs.length === 0 ? (
              <p className="text-xs text-ink-muted">
                You haven’t joined any book clubs yet. Create one or enter an
                invite code.
              </p>
            ) : (
              <div className="space-y-2.5">
                {clubs.map((c) => (
                  <Link
                    key={c.id}
                    href={`/clubs/${c.inviteCode}`}
                    className="block rounded-lg border border-edge bg-paper p-3 transition hover:border-ink/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">
                        {c.name}
                      </span>
                      <span className="rounded bg-surface px-2 py-0.5 font-mono text-[11px] text-ink-muted">
                        {c.inviteCode}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      {c.bookTitle} · Your limit: Ch. {c.spoilerLimit}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
