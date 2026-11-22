"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  Send,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";

interface ClubInfo {
  id: string;
  name: string;
  inviteCode: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  chapterCount: number;
  personaName: string;
}

interface MemberInfo {
  displayName: string;
  spoilerLimit: number;
  isMe: boolean;
}

interface ClubMessage {
  id: string;
  authorName: string;
  role: "member" | "assistant";
  content: string;
  answerMode: string | null;
  citations: Array<{ n: number; label?: string }>;
  spoilerLimitUsed: number | null;
  createdAt: string;
  isOwn: boolean;
}

export function ClubRoomClient({ code }: { code: string }) {
  const [club, setClub] = useState<ClubInfo | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [myLimit, setMyLimit] = useState(1);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [joinLimit, setJoinLimit] = useState(1);
  const [joining, setJoining] = useState(false);

  const [draft, setDraft] = useState("");
  const [askAuthor, setAskAuthor] = useState(true);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});

  const loadRoom = useCallback(async () => {
    const res = await fetch(`/api/clubs/${code}`);
    if (res.status === 401) {
      setError("Sign in to access this book club.");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as {
      club?: ClubInfo;
      isMember?: boolean;
      mySpoilerLimit?: number;
      members?: MemberInfo[];
      messages?: ClubMessage[];
      error?: string;
    };
    if (!res.ok || !data.club) {
      setError(data.error || "Book club not found.");
      setLoading(false);
      return;
    }
    setClub(data.club);
    setIsMember(Boolean(data.isMember));
    setMyLimit(data.mySpoilerLimit ?? 1);
    setMembers(data.members ?? []);
    setMessages(data.messages ?? []);
    setLoading(false);
  }, [code]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoining(true);
    const res = await fetch(`/api/clubs/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: displayName.trim() || undefined,
        spoilerLimit: joinLimit,
      }),
    });
    setJoining(false);
    if (res.ok) {
      await loadRoom();
    }
  }

  async function updateMyLimit(next: number) {
    setMyLimit(next);
    await fetch(`/api/clubs/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spoilerLimit: next }),
    });
    await loadRoom();
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    const content = draft.trim();
    setDraft("");
    await fetch(`/api/clubs/${code}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, askAuthor }),
    });
    setSending(false);
    await loadRoom();
  }

  function copyInvite() {
    const url = `${window.location.origin}/clubs/${code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (loading) {
    return <div className="p-8 text-sm text-ink-muted">Loading book club…</div>;
  }

  if (error || !club) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-sm text-ink">{error || "Book club not found."}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Link
            href={`/login?next=/clubs/${code}`}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white"
          >
            Sign in
          </Link>
          <Link
            href="/clubs"
            className="rounded-lg border border-edge bg-surface px-4 py-2 text-xs font-medium text-ink"
          >
            All clubs
          </Link>
        </div>
      </div>
    );
  }

  const maxCh = Math.max(1, club.chapterCount || 1);

  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col px-4 py-6 sm:px-8">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-edge pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/clubs"
            className="inline-flex items-center gap-1 rounded-lg border border-edge bg-surface px-2.5 py-1.5 text-xs text-ink hover:border-ink/40"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Clubs
          </Link>
          <div>
            <h1 className="font-display text-xl font-medium text-ink">
              {club.name}
            </h1>
            <p className="text-xs text-ink-muted">
              {club.bookTitle} · {club.bookAuthor}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={copyInvite}
          className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:border-ink/40"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              Copied invite link
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Invite ({club.inviteCode})
            </>
          )}
        </button>
      </header>

      {!isMember ? (
        <form
          onSubmit={handleJoin}
          className="mx-auto my-12 w-full max-w-md rounded-xl border border-edge bg-surface p-6"
        >
          <h2 className="font-display text-lg font-medium text-ink">
            Join “{club.name}”
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            Set your current chapter so the author and room respect your spoiler
            limit.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">
                Your display name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Optional (defaults to email name)"
                className="w-full rounded-lg border border-edge bg-paper px-3 py-2 text-xs text-ink"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">
                I’ve read up to Chapter {joinLimit} (of {maxCh})
              </label>
              <input
                type="range"
                min={1}
                max={maxCh}
                value={joinLimit}
                onChange={(e) => setJoinLimit(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>
            <button
              type="submit"
              disabled={joining}
              className="w-full rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white"
            >
              {joining ? "Joining…" : "Join Book Club"}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid flex-1 gap-6 md:grid-cols-[240px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-xl border border-edge bg-surface p-4">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink">
                <span>Your spoiler limit</span>
                <span className="text-accent">Ch. {myLimit}</span>
              </div>
              <input
                type="range"
                min={1}
                max={maxCh}
                value={myLimit}
                onChange={(e) => updateMyLimit(Number(e.target.value))}
                className="w-full accent-accent"
              />
              <p className="mt-1.5 text-[11px] text-ink-muted">
                Questions you ask are retrieved strictly up to Ch. {myLimit}.
                Replies from higher chapters are shielded.
              </p>
            </div>

            <div className="rounded-xl border border-edge bg-surface p-4">
              <h2 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-ink">
                <Users className="h-3.5 w-3.5 text-accent" />
                Members ({members.length})
              </h2>
              <ul className="space-y-1.5">
                {members.map((m, idx) => (
                  <li
                    key={`${m.displayName}-${idx}`}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className={m.isMe ? "font-semibold text-ink" : "text-ink-muted"}>
                      {m.displayName} {m.isMe ? "(you)" : ""}
                    </span>
                    <span className="rounded bg-paper px-1.5 py-0.5 text-[11px] text-ink-muted">
                      Ch. {m.spoilerLimit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <section className="flex flex-col rounded-xl border border-edge bg-surface">
            <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              {messages.length === 0 ? (
                <p className="py-12 text-center text-xs text-ink-muted">
                  Start the discussion! Ask {club.personaName} a question or
                  share a thought with the group.
                </p>
              ) : (
                messages.map((m) => {
                  const isSpoiler =
                    m.spoilerLimitUsed !== null &&
                    m.spoilerLimitUsed > myLimit &&
                    !revealedIds[m.id];

                  return (
                    <div
                      key={m.id}
                      className={`rounded-lg border p-3.5 ${
                        m.role === "assistant"
                          ? "border-accent/25 bg-paper"
                          : "border-edge bg-surface"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-ink">
                          {m.role === "assistant" ? `✨ ${m.authorName}` : m.authorName}
                        </span>
                        {m.spoilerLimitUsed !== null && (
                          <span className="text-[11px] text-ink-muted">
                            Ch. {m.spoilerLimitUsed}
                          </span>
                        )}
                      </div>

                      {isSpoiler ? (
                        <div className="mt-1 flex items-center justify-between gap-2 rounded bg-surface px-3 py-2 text-xs text-ink-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                            Spoiler shield (Chapter {m.spoilerLimitUsed})
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedIds((prev) => ({
                                ...prev,
                                [m.id]: true,
                              }))
                            }
                            className="inline-flex items-center gap-1 text-accent hover:underline"
                          >
                            <Eye className="h-3 w-3" /> Reveal
                          </button>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink/90">
                          {m.content}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={handleSend}
              className="border-t border-edge p-3 sm:p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-ink-muted">
                  <input
                    type="checkbox"
                    checked={askAuthor}
                    onChange={(e) => setAskAuthor(e.target.checked)}
                    className="accent-accent"
                  />
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  Ask {club.personaName} to reply (filtered to Ch. {myLimit})
                </label>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Share a thought or ask the author…"
                  className="w-full rounded-lg border border-edge bg-paper px-3 py-2 text-xs text-ink outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
