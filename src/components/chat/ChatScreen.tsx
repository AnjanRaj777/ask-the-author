"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUp,
  BookOpen,
  Bookmark,
  BookMarked,
  Check,
  Copy,
  Library,
  PanelLeft,
  PanelLeftClose,
  Settings,
  SquarePen,
  User,
  X,
} from "lucide-react";
import { SettingsModal } from "@/components/settings/SettingsModal";
import {
  UPLOAD_STORAGE_KEY,
  uploadToChatBook,
  type ChatBook,
  type SelectedBook,
} from "@/lib/catalog";
import {
  getOrCreateUserId,
  loadBookChat,
  loadUserChats,
  saveBookChat,
  setActiveUserId,
  type SavedBookChat,
} from "@/lib/userHistory";
import type { Citation } from "@/lib/types";
import { ModeBadge, type BadgeMode } from "./ModeBadge";

interface DisplayCitation {
  n: number;
  chunkId?: string;
  label: string;
  passage: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: BadgeMode;
  citations?: DisplayCitation[];
  error?: string;
}

/** Step 8: the main chat screen. */
export function ChatScreen({ book: initialBook }: { book: ChatBook | null }) {
  const [book, setBook] = useState<ChatBook | null>(initialBook);
  const [missing, setMissing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [readTo, setReadTo] = useState(1);
  const [userId, setUserId] = useState("");
  const [userChats, setUserChats] = useState<SavedBookChat[]>([]);
  const [drawerCitation, setDrawerCitation] = useState<DisplayCitation | null>(
    null
  );
  const listRef = useRef<HTMLDivElement>(null);

  // Initialize userId and restore previous chat for this book.
  useEffect(() => {
    const uid = getOrCreateUserId();
    setUserId(uid);
    setUserChats(loadUserChats(uid));
  }, []);

  useEffect(() => {
    if (!userId || !book) return;
    const saved = loadBookChat(userId, book.id);
    if (saved) {
      setMessages(saved.messages);
      setReadTo(saved.readTo || 1);
    } else {
      setMessages([]);
      setReadTo(1);
    }
  }, [userId, book?.id]);

  // Persist non-empty messages for the active userId and book.
  useEffect(() => {
    if (!userId || !book || pending) return;
    const cleanMessages = messages.filter(
      (m) => !m.error && m.content.trim().length > 0
    );
    if (cleanMessages.length === 0) return;

    const updated = saveBookChat(userId, {
      bookId: book.id,
      title: book.title,
      author: book.author,
      personaName: book.personaName,
      kind: book.kind,
      chapterCount: book.chapterCount,
      chapterLabel: book.chapterLabel,
      readTo,
      updatedAt: new Date().toISOString(),
      messages: cleanMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        mode: m.mode,
        citations: m.citations,
      })),
    });
    setUserChats(updated);
  }, [messages, readTo, pending, userId, book]);

  // Uploaded books are handed over from the landing page via sessionStorage.
  useEffect(() => {
    if (initialBook) return;
    const raw = sessionStorage.getItem(UPLOAD_STORAGE_KEY);
    if (!raw) {
      setMissing(true);
      return;
    }
    try {
      setBook(uploadToChatBook(JSON.parse(raw) as SelectedBook));
    } catch {
      setMissing(true);
    }
  }, [initialBook]);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  if (missing) {
    return (
      <main className="grid min-h-svh place-items-center px-6 text-center">
        <div>
          <p className="font-serif text-3xl font-semibold">No book is open</p>
          <Link
            href="/#library"
            className="mt-4 inline-block text-sm underline underline-offset-4"
          >
            Choose a book
          </Link>
        </div>
      </main>
    );
  }
  if (!book) return <div className="min-h-svh" />;

  const sendQuestion = async (text: string) => {
    const question: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const assistantId = crypto.randomUUID();
    const history = messages
      .filter((m) => !m.error && m.content.trim().length > 0)
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((m) => [...m, question]);
    setPending(true);

    const upsertAssistant = (updater: (prev: Message) => Message) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === assistantId);
        if (idx === -1) {
          return [
            ...prev,
            updater({ id: assistantId, role: "assistant", content: "" }),
          ];
        }
        const next = [...prev];
        next[idx] = updater(next[idx]);
        return next;
      });
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book.id,
          question: text,
          spoilerLimit: book.chapterCount ? readTo : 999,
          history,
        }),
      });

      if (!res.ok || !res.body) {
        let errMsg = `Request failed (${res.status}).`;
        try {
          const json = (await res.json()) as { error?: string };
          if (json.error) errMsg = json.error;
        } catch {
          // ignore JSON parse error
        }
        upsertAssistant((m) => ({ ...m, error: errMsg }));
        setPending(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        const events = sseBuffer.split("\n\n");
        sseBuffer = events.pop() ?? "";

        for (const rawEvent of events) {
          const dataLine = rawEvent
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!dataLine) continue;

          const event = JSON.parse(dataLine.slice(6)) as
            | { type: "mode"; value: BadgeMode }
            | { type: "token"; value: string }
            | { type: "citations"; value: Citation[] }
            | { type: "done"; mode?: BadgeMode; answer?: string }
            | { type: "error"; error: string };

          if (event.type === "mode") {
            setPending(false);
            upsertAssistant((m) => ({ ...m, mode: event.value }));
          } else if (event.type === "token") {
            setPending(false);
            upsertAssistant((m) => ({
              ...m,
              content: m.content + event.value,
            }));
          } else if (event.type === "citations") {
            const mapped: DisplayCitation[] = event.value.map((c) => ({
              n: c.n,
              chunkId: c.chunkId,
              label:
                c.chapterTitle ??
                `${book.chapterLabel} ${c.chapterIdx}${c.page ? `, p. ${c.page}` : ""}`,
              passage: c.quote,
            }));
            upsertAssistant((m) => ({ ...m, citations: mapped }));
          } else if (event.type === "done") {
            upsertAssistant((m) => ({
              ...m,
              mode: event.mode ?? m.mode,
              content: event.answer ?? m.content,
            }));
          } else if (event.type === "error") {
            upsertAssistant((m) => ({ ...m, error: event.error }));
          }
        }
      }
    } catch (err) {
      upsertAssistant((m) => ({
        ...m,
        error: err instanceof Error ? err.message : "Network error.",
      }));
    } finally {
      setPending(false);
    }
  };

  const isEmpty = messages.length === 0;
  const composer = (
    <Composer
      book={book}
      readTo={readTo}
      onReadToChange={setReadTo}
      onSend={sendQuestion}
      disabled={pending}
      autoFocus
    />
  );

  const handleSwitchUserId = (nextId: string) => {
    const active = setActiveUserId(nextId);
    setUserId(active);
    setUserChats(loadUserChats(active));
  };

  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={() => {
          setMessages([]);
          setSidebarOpen(false);
        }}
        userId={userId}
        onSwitchUserId={handleSwitchUserId}
        userChats={userChats}
        currentBookId={book.id}
        onOpenSettings={() => {
          setSidebarOpen(false);
          setSettingsOpen(true);
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-2 px-3 pt-3 sm:px-4">
        {!sidebarOpen && (
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft transition hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
        )}
        <AnimatePresence>
          {!isEmpty && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-w-0"
            >
              <p className="truncate font-serif text-lg font-semibold leading-tight">
                {book.title}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          type="button"
          aria-label="Customize look"
          title="Settings"
          onClick={() => setSettingsOpen(true)}
          className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-ink-soft transition hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        >
          <Settings className="h-5 w-5" />
        </button>
      </header>

      {isEmpty ? (
        <main className="flex flex-1 flex-col items-center justify-center px-4 pb-6">
          <motion.div
            className="w-full max-w-2xl"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <p className="text-center text-[11px] font-medium uppercase tracking-[0.3em] text-ink-soft">
              {book.title} · with {book.personaName}
            </p>
            <h1 className="mt-2 text-center font-serif text-4xl font-semibold sm:text-5xl">
              {book.greeting}
            </h1>
            <div className="mt-8">{composer}</div>
            {book.starterQuestions.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {book.starterQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendQuestion(q)}
                    className="rounded-full border border-ink/15 bg-page/75 px-3.5 py-1.5 text-xs text-ink-soft transition hover:border-ink/30 hover:bg-page hover:text-ink"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </main>
      ) : (
        <>
          <main
            ref={listRef}
            className="quiet-scroll flex-1 overflow-y-auto px-4"
          >
            <div className="mx-auto max-w-2xl space-y-7 py-6">
              {messages.map((m) =>
                m.role === "user" ? (
                  <UserBubble key={m.id} text={m.content} />
                ) : (
                  <AssistantMessage
                    key={m.id}
                    message={m}
                    personaName={book.personaName}
                    onOpenContext={setDrawerCitation}
                  />
                )
              )}
              {pending && <Thinking personaName={book.personaName} />}
            </div>
          </main>
          <div className="px-4">
            <div className="mx-auto max-w-2xl">{composer}</div>
          </div>
        </>
      )}

      <footer className="px-4 pb-3 pt-2 text-center text-[11px] text-ink-soft">
        AI simulation
        {book.kind === "library" ? ` of ${book.author}` : ""}, not the real
        author · AI can make mistakes. Check the citations.
      </footer>

      <CitationContextDrawer
        citation={drawerCitation}
        spoilerLimit={readTo}
        onClose={() => setDrawerCitation(null)}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Composer({
  book,
  readTo,
  onReadToChange,
  onSend,
  disabled,
  autoFocus,
}: {
  book: ChatBook;
  readTo: number;
  onReadToChange: (n: number) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const [progressOpen, setProgressOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };

  const total = book.chapterCount;
  const finished = total !== null && readTo >= total;
  const shortLabel =
    total === null ? "Whole book" : finished ? "Finished" : `Ch. ${readTo}`;

  return (
    <div className="relative">
      <AnimatePresence>
        {progressOpen && total !== null && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-2xl border border-ink/10 bg-page p-4 shadow-[0_20px_40px_-16px_rgba(42,34,29,0.35)]"
          >
            <label
              htmlFor="read-to"
              className="text-xs font-medium uppercase tracking-[0.2em] text-ink-soft"
            >
              I&apos;ve read up to
            </label>
            <p className="mt-1 font-serif text-2xl font-semibold">
              {finished ? "The end" : `${book.chapterLabel} ${readTo}`}
            </p>
            <input
              id="read-to"
              type="range"
              min={1}
              max={total}
              value={readTo}
              onChange={(e) => onReadToChange(Number(e.target.value))}
              className="mt-3 w-full accent-leather"
            />
            <div className="flex justify-between text-[10px] text-ink-soft">
              <span>{book.chapterLabel} 1</span>
              <span>Finished</span>
            </div>
            <p className="mt-3 text-xs leading-snug text-ink-soft">
              Answers won&apos;t use or hint at anything past this point.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 rounded-3xl border border-ink/15 bg-page/90 p-2 shadow-[0_10px_30px_-14px_rgba(42,34,29,0.3)] transition focus-within:border-ink/30"
      >
        <button
          type="button"
          onClick={() => setProgressOpen((o) => !o)}
          disabled={total === null}
          aria-expanded={progressOpen}
          aria-label={`Spoiler limit: ${shortLabel}`}
          title="How far you've read"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-ink-soft transition hover:bg-ink/5 hover:text-ink disabled:cursor-default disabled:hover:bg-transparent"
        >
          <BookMarked className="h-4 w-4" />
          <span>{shortLabel}</span>
        </button>
        <label htmlFor="composer" className="sr-only">
          Ask a question
        </label>
        <textarea
          id="composer"
          ref={ref}
          rows={1}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setProgressOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={`Ask ${book.personaName} anything…`}
          className="max-h-[200px] min-w-0 flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-ink placeholder:text-ink-soft/70 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          aria-label="Send"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-paper transition hover:bg-leather disabled:bg-ink/20"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-ink/[0.06] px-4 py-2.5 text-[15px] text-ink">
        {text}
      </div>
    </div>
  );
}

function AssistantMessage({
  message,
  personaName,
  onOpenContext,
}: {
  message: Message;
  personaName: string;
  onOpenContext: (citation: DisplayCitation) => void;
}) {
  const [openCitation, setOpenCitation] = useState<number | null>(null);
  const active = message.citations?.find((c) => c.n === openCitation);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <div className="flex items-center gap-2">
        <span className="font-serif text-base font-semibold">
          {personaName}
        </span>
        {message.mode && <ModeBadge mode={message.mode} />}
      </div>
      {message.error ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50/90 px-3.5 py-2.5 text-sm text-amber-950">
          {message.error}
        </p>
      ) : (
        <div
          className="space-y-3.5 leading-relaxed text-ink"
          style={{
            fontFamily: "var(--chat-font)",
            fontSize: "var(--chat-size)",
          }}
        >
          {message.content
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((paragraph, idx) => (
              <p key={idx} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
        </div>
      )}
      {message.citations && message.citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.citations.map((c) => (
            <button
              key={c.n}
              type="button"
              onClick={() => setOpenCitation((o) => (o === c.n ? null : c.n))}
              aria-expanded={openCitation === c.n}
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                openCitation === c.n
                  ? "bg-leather text-paper"
                  : "bg-leather/10 text-leather hover:bg-leather/20"
              }`}
            >
              [{c.n}] {c.label}
            </button>
          ))}
        </div>
      )}
      <AnimatePresence initial={false}>
        {active && (
          <motion.blockquote
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-l-2 border-leather/50 pl-4 font-serif text-base italic text-ink-soft"
          >
            <p className="py-1">&ldquo;{active.passage}&rdquo;</p>
            <div className="flex items-center justify-between gap-2 pb-1 font-sans text-[11px] not-italic">
              <span>{active.label}</span>
              {active.chunkId && (
                <button
                  type="button"
                  onClick={() => onOpenContext(active)}
                  className="inline-flex items-center gap-1 font-medium text-leather underline underline-offset-2 hover:opacity-80"
                >
                  <BookOpen className="h-3 w-3" />
                  Open in context
                </button>
              )}
            </div>
          </motion.blockquote>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Thinking({ personaName }: { personaName: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-soft">
      <span className="font-serif text-base font-semibold text-ink">
        {personaName}
      </span>
      <span className="flex gap-1" aria-label="Thinking">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-ink-soft"
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
          />
        ))}
      </span>
    </div>
  );
}

function Sidebar({
  open,
  onClose,
  onNewChat,
  userId,
  onSwitchUserId,
  userChats,
  currentBookId,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  userId: string;
  onSwitchUserId: (nextId: string) => void;
  userChats: SavedBookChat[];
  currentBookId: string;
  onOpenSettings: () => void;
}) {
  const [editingId, setEditingId] = useState(false);
  const [draftId, setDraftId] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const item =
    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-ink transition hover:bg-ink/5";

  const copyId = async () => {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  const submitUserId = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftId.trim()) return;
    onSwitchUserId(draftId.trim());
    setEditingId(false);
    setDraftId("");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-30 bg-black/35 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-ink/10 bg-paper-dark p-3 shadow-[inset_-14px_0_24px_-20px_rgba(0,0,0,0.35)] md:static md:z-auto"
            initial={{ x: -288 }}
            animate={{ x: 0 }}
            exit={{ x: -288 }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            aria-label="Sidebar"
          >
            <div className="flex items-center justify-between pl-2.5">
              <span className="font-serif text-xl font-semibold">
                Ask the Author
              </span>
              <button
                type="button"
                aria-label="Close sidebar"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-ink/5 hover:text-ink"
              >
                <PanelLeftClose className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-4 space-y-0.5">
              <button type="button" onClick={onNewChat} className={item}>
                <SquarePen className="h-4 w-4" /> New chat
              </button>
              <Link href="/#library" className={item}>
                <Library className="h-4 w-4" /> Library
              </Link>
              <button type="button" onClick={onOpenSettings} className={item}>
                <Settings className="h-4 w-4" /> Settings
              </button>
              <span className={`${item} cursor-default opacity-50 hover:bg-transparent`}>
                <Bookmark className="h-4 w-4" /> Saved notes
                <span className="ml-auto text-[10px] uppercase tracking-wider">
                  Soon
                </span>
              </span>
            </nav>

            <div className="mt-5 rounded-xl border border-ink/10 bg-page/65 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-soft">
                  <User className="h-3 w-3" /> User ID
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={copyId}
                    aria-label="Copy User ID"
                    className="rounded px-1.5 py-0.5 text-[11px] text-ink-soft hover:bg-ink/5 hover:text-ink"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-leather" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftId(userId);
                      setEditingId((v) => !v);
                    }}
                    className="rounded px-1.5 py-0.5 text-[11px] font-medium text-leather hover:bg-leather/10"
                  >
                    {editingId ? "Cancel" : "Switch"}
                  </button>
                </div>
              </div>
              {editingId ? (
                <form onSubmit={submitUserId} className="mt-2 flex gap-1.5">
                  <input
                    type="text"
                    value={draftId}
                    onChange={(e) => setDraftId(e.target.value)}
                    placeholder="Enter user ID"
                    className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-page px-2 py-1 text-xs text-ink focus:border-leather focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-ink px-2.5 py-1 text-xs font-medium text-paper hover:bg-leather"
                  >
                    Save
                  </button>
                </form>
              ) : (
                <p className="mt-1 truncate font-mono text-xs text-ink">
                  {userId || "Loading…"}
                </p>
              )}
            </div>

            <p className="mt-5 px-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-soft">
              Previous chat books
            </p>
            <div className="quiet-scroll mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {userChats.length === 0 ? (
                <p className="px-2.5 text-xs leading-relaxed text-ink-soft">
                  No previous chat books yet. Ask a question to save your
                  conversation here.
                </p>
              ) : (
                userChats.map((chat) => {
                  const isActive = chat.bookId === currentBookId;
                  return (
                    <Link
                      key={chat.bookId}
                      href={`/chat/${chat.bookId}`}
                      onClick={onClose}
                      className={`block rounded-lg px-2.5 py-2 transition ${
                        isActive
                          ? "bg-leather/12 text-ink"
                          : "text-ink hover:bg-ink/5"
                      }`}
                    >
                      <p className="truncate font-serif text-sm font-semibold">
                        {chat.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-ink-soft">
                        {chat.personaName} · {chat.messages.length}{" "}
                        {chat.messages.length === 1 ? "message" : "messages"}
                      </p>
                    </Link>
                  );
                })
              )}
            </div>

            <Link
              href="/login"
              className="mt-3 rounded-full bg-ink px-4 py-2.5 text-center text-sm font-medium text-paper transition hover:bg-leather"
            >
              Manage User ID
            </Link>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

interface ContextChunk {
  id: string;
  seq: number;
  page: number | null;
  content: string;
  isTarget: boolean;
}

function CitationContextDrawer({
  citation,
  spoilerLimit,
  onClose,
}: {
  citation: DisplayCitation | null;
  spoilerLimit: number;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chunks, setChunks] = useState<ContextChunk[]>([]);
  const [heading, setHeading] = useState<string>("");

  useEffect(() => {
    if (!citation?.chunkId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setChunks([]);

    fetch(
      `/api/chunks/${citation.chunkId}/context?spoilerLimit=${encodeURIComponent(spoilerLimit)}`
    )
      .then(async (res) => {
        const data = (await res.json()) as {
          error?: string;
          chapterIdx?: number;
          chapterTitle?: string | null;
          page?: number | null;
          chunks?: ContextChunk[];
        };
        if (!res.ok) throw new Error(data.error || "Failed to load passage.");
        if (cancelled) return;
        const chLabel = data.chapterTitle
          ? `Ch. ${data.chapterIdx} · ${data.chapterTitle}`
          : `Chapter ${data.chapterIdx}`;
        setHeading(data.page ? `${chLabel}, p. ${data.page}` : chLabel);
        setChunks(data.chunks ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load passage."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [citation, spoilerLimit]);

  return (
    <AnimatePresence>
      {citation && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px]"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-ink/10 bg-paper p-5 shadow-xl"
            aria-label="Citation context"
          >
            <div className="flex items-start justify-between gap-3 border-b border-ink/10 pb-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-leather">
                  Citation [{citation.n}]
                </p>
                <h2 className="mt-0.5 font-serif text-lg font-semibold text-ink">
                  {heading || citation.label}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close citation drawer"
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition hover:bg-ink/5 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="quiet-scroll mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
              {loading && (
                <p className="text-sm text-ink-soft">Loading passage context…</p>
              )}
              {error && (
                <p className="rounded-xl border border-amber-300 bg-amber-50/90 px-3.5 py-2.5 text-sm text-amber-950">
                  {error}
                </p>
              )}
              {!loading &&
                !error &&
                chunks.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-xl px-4 py-3 font-serif text-[16px] leading-relaxed ${
                      c.isTarget
                        ? "border border-leather/40 bg-leather/[0.08] text-ink"
                        : "text-ink-soft"
                    }`}
                  >
                    {c.content}
                  </div>
                ))}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
