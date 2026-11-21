"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import {
  getOrCreateUserId,
  loadUserChats,
  setActiveUserId,
  type SavedBookChat,
} from "@/lib/userHistory";

export function LoginClient() {
  const [userId, setUserId] = useState("");
  const [inputId, setInputId] = useState("");
  const [chats, setChats] = useState<SavedBookChat[]>([]);

  useEffect(() => {
    const uid = getOrCreateUserId();
    setUserId(uid);
    setInputId(uid);
    setChats(loadUserChats(uid));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputId.trim()) return;
    const next = setActiveUserId(inputId);
    setUserId(next);
    setInputId(next);
    setChats(loadUserChats(next));
  };

  return (
    <div className="relative w-full max-w-md rounded-3xl border border-ink/10 bg-paper/85 p-8 text-center shadow-[0_24px_60px_-20px_rgba(42,34,29,0.45)] backdrop-blur-md">
      <Link href="/" className="font-serif text-2xl font-semibold text-ink">
        Ask the Author
      </Link>
      <h1 className="mt-5 font-serif text-4xl font-semibold">Your User ID</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Use a User ID to keep and revisit your previous chat books.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3 text-left">
        <label
          htmlFor="user-id"
          className="block text-xs font-medium uppercase tracking-[0.16em] text-ink-soft"
        >
          Active User ID
        </label>
        <input
          id="user-id"
          type="text"
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
          placeholder="e.g. reader-alice"
          className="w-full rounded-full border border-ink/15 bg-page/85 px-4 py-2.5 font-mono text-sm text-ink placeholder:text-ink-soft/70 focus:border-leather focus:outline-none"
        />
        <button
          type="submit"
          className="w-full rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-leather"
        >
          Use this User ID
        </button>
      </form>

      <div className="mt-6 border-t border-ink/10 pt-5 text-left">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-soft">
          Previous chat books for{" "}
          <span className="font-mono text-ink">{userId || "…"}</span>
        </p>

        {chats.length === 0 ? (
          <p className="mt-2 text-xs text-ink-soft">
            No previous chat books for this User ID yet.
          </p>
        ) : (
          <ul className="quiet-scroll mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
            {chats.map((chat) => (
              <li key={chat.bookId}>
                <Link
                  href={`/chat/${chat.bookId}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-page/65 px-3.5 py-2.5 transition hover:border-leather/40 hover:bg-page"
                >
                  <div className="min-w-0">
                    <p className="truncate font-serif text-sm font-semibold text-ink">
                      {chat.title}
                    </p>
                    <p className="truncate text-[11px] text-ink-soft">
                      {chat.personaName} · {chat.messages.length}{" "}
                      {chat.messages.length === 1 ? "message" : "messages"}
                    </p>
                  </div>
                  <BookOpen className="h-4 w-4 shrink-0 text-leather" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href="/#library"
        className="mt-6 inline-block text-sm text-ink underline underline-offset-4 hover:text-leather"
      >
        Browse the library
      </Link>
    </div>
  );
}
