"use client";

import { useState } from "react";
import {
  CircleHelp,
  Quote,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { SelectedBook } from "@/lib/catalog";

/** Step 6/7 (right page): the disclaimer shown alongside the book library. */
export function DisclaimerPage({
  book,
  onAccept,
}: {
  book: SelectedBook | null;
  onAccept: () => void;
}) {
  const isUpload = book?.kind === "upload";
  const [ownsCopy, setOwnsCopy] = useState(false);
  const canContinue = Boolean(book) && (!isUpload || ownsCopy);

  const points = [
    {
      Icon: Sparkles,
      text: !book ? (
        <>
          You&apos;ll be talking to an <strong>AI simulation</strong> of the
          author (or a Book Guide for uploads), not the real author.
        </>
      ) : isUpload ? (
        <>
          You&apos;ll be talking to an <strong>AI Book Guide</strong>, not the
          author.
        </>
      ) : (
        <>
          You&apos;ll be talking to an <strong>AI simulation</strong> of{" "}
          {book.author}, not the real author.
        </>
      ),
    },
    {
      Icon: Quote,
      text: <>Answers come from the book&apos;s text and cite the chapter.</>,
    },
    {
      Icon: CircleHelp,
      text: (
        <>
          If the book doesn&apos;t say, you&apos;ll be told, or the answer will
          be marked as <em>speculation</em>.
        </>
      ),
    },
    {
      Icon: TriangleAlert,
      text: <>AI can make mistakes. Check the cited passages.</>,
    },
  ];

  return (
    <div className="flex h-full flex-col p-5 sm:p-7">
      <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-ink-soft">
        A note before we begin
      </p>
      <h2 className="mt-1 font-serif text-3xl font-semibold text-ink">
        Disclaimer
      </h2>
      <p className="mt-0.5 truncate font-serif text-base italic text-ink-soft">
        {book
          ? `${book.title}${!isUpload ? ` · ${book.author}` : ""}`
          : "Select a book on the left to begin"}
      </p>

      <ul className="quiet-scroll mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm leading-snug text-ink">
        {points.map(({ Icon, text }, i) => (
          <li key={i} className="flex gap-3">
            <Icon
              className="mt-0.5 h-4 w-4 shrink-0 text-leather"
              aria-hidden
            />
            <span>{text}</span>
          </li>
        ))}
      </ul>

      {isUpload && (
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-ink">
          <input
            type="checkbox"
            checked={ownsCopy}
            onChange={(e) => setOwnsCopy(e.target.checked)}
            className="mt-0.5 accent-leather"
          />
          I own this copy and I&apos;m uploading it for personal use.
        </label>
      )}

      <button
        type="button"
        disabled={!canContinue}
        onClick={onAccept}
        className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-leather focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leather/50 focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-ink"
      >
        {book ? "I understand, open the chat" : "Choose a book to continue"}
      </button>
    </div>
  );
}
