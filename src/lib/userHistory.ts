export interface SavedCitation {
  n: number;
  chunkId?: string;
  label: string;
  passage: string;
}

export interface SavedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "grounded" | "speculation" | "not_in_book" | "memory" | "preview";
  citations?: SavedCitation[];
}

export interface SavedBookChat {
  bookId: string;
  title: string;
  author: string;
  personaName: string;
  kind: "library" | "upload";
  chapterCount: number | null;
  chapterLabel: string;
  readTo: number;
  updatedAt: string;
  messages: SavedMessage[];
}

const USER_ID_KEY = "ata:user-id";
const CHATS_KEY_PREFIX = "ata:chats:";

function generateDefaultUserId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `reader-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `reader-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateUserId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(USER_ID_KEY)?.trim();
  if (existing) return existing;
  const created = generateDefaultUserId();
  window.localStorage.setItem(USER_ID_KEY, created);
  return created;
}

export function setActiveUserId(rawId: string): string {
  const cleaned = rawId.trim();
  if (!cleaned) return getOrCreateUserId();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(USER_ID_KEY, cleaned);
  }
  return cleaned;
}

export function loadUserChats(userId: string): SavedBookChat[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = window.localStorage.getItem(`${CHATS_KEY_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const sorted = (parsed as SavedBookChat[])
      .filter((c) => c && typeof c.bookId === "string" && Array.isArray(c.messages))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const seen = new Set<string>();
    return sorted.filter((c) => {
      if (seen.has(c.bookId)) return false;
      seen.add(c.bookId);
      return true;
    });
  } catch {
    return [];
  }
}

export function loadBookChat(
  userId: string,
  bookId: string
): SavedBookChat | null {
  const chats = loadUserChats(userId);
  return chats.find((c) => c.bookId === bookId) ?? null;
}

export function saveBookChat(userId: string, chat: SavedBookChat): SavedBookChat[] {
  if (typeof window === "undefined" || !userId) return [];
  const chats = loadUserChats(userId).filter((c) => c.bookId !== chat.bookId);
  const next = chat.messages.length > 0 ? [chat, ...chats] : chats;
  try {
    window.localStorage.setItem(
      `${CHATS_KEY_PREFIX}${userId}`,
      JSON.stringify(next)
    );
  } catch {
    // ignore storage quota errors
  }
  return next;
}
