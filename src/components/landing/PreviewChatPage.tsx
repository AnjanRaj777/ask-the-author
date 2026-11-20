import { ArrowUp, User } from "lucide-react";
import type { SelectedBook } from "@/lib/catalog";
import { ModeBadge } from "@/components/chat/ModeBadge";

/** Step 6/7 (right page): a sample of the chatbot, before a book is chosen. */
export function PreviewChatPage({ book }: { book: SelectedBook | null }) {
  return (
    <div className="flex h-full flex-col p-5 sm:p-7">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-ink-soft">
          {book ? "Ready when you are" : "A sample conversation"}
        </p>
        <h2 className="mt-1 truncate font-serif text-3xl font-semibold text-ink">
          {book ? book.personaName : "Ask anything"}
        </h2>
      </header>

      <div className="mt-4 min-h-0 flex-1 overflow-hidden">
        {book ? (
          <p className="font-serif text-lg italic leading-snug text-ink-soft">
            Read the note on the facing page. The conversation opens once
            you&apos;re ready.
          </p>
        ) : (
          <SampleExchange />
        )}
      </div>

      <div
        aria-hidden
        className="mt-3 flex items-center gap-2 rounded-full border border-ink/10 bg-[#f7f2e8] py-1.5 pl-4 pr-1.5 shadow-[0_6px_18px_-6px_rgba(42,34,29,0.22),inset_0_1px_1px_rgba(255,255,255,0.9)]"
      >
        <span className="flex-1 truncate text-sm text-ink-soft/85">
          {book ? `Ask ${book.personaName}…` : "Pick a book to start asking…"}
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-paper shadow-xs">
          <ArrowUp className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-center text-[10px] text-ink-soft">
        AI can make mistakes
      </p>
    </div>
  );
}

function SampleExchange() {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink/[0.08] text-ink-soft"
          aria-hidden
        >
          <User className="h-3.5 w-3.5" />
        </span>
        <div className="rounded-2xl bg-ink/[0.06] px-3.5 py-2 text-[13px] text-ink">
          Why does Mr. Bennet tease his wife so?
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="font-serif text-sm font-semibold text-ink">
            Jane Austen
          </span>
          <ModeBadge mode="grounded" />
        </div>
        <p className="font-serif text-[17px] leading-snug text-ink">
          Because it amuses him, I fear, and because after three-and-twenty
          years she still cannot tell when he is joking.
        </p>
        <div>
          <span className="inline-block rounded bg-leather/10 px-1.5 py-0.5 font-sans text-[11px] font-medium text-leather">
            Ch. 1
          </span>
        </div>
      </div>
    </div>
  );
}
