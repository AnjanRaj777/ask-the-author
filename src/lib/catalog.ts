/**
 * Static book catalog used by the frontend until the library is served
 * from Supabase (Phase 1/2).
 */

export interface CatalogBook {
  id: string;
  title: string;
  author: string;
  year: number;
  chapterCount: number;
  chapterLabel: string;
  available: boolean;
  noFilePreset?: boolean;
  coverColor: string;
  personaName: string;
  greeting: string;
  starterQuestions: string[];
}

export interface SelectedBook {
  kind: "library" | "upload";
  id: string;
  title: string;
  author: string;
  personaName: string;
  fileName?: string;
}

export interface ChatBook {
  kind: "library" | "upload";
  id: string;
  title: string;
  author: string;
  personaName: string;
  chapterCount: number | null;
  chapterLabel: string;
  greeting: string;
  starterQuestions: string[];
}

export const UPLOAD_STORAGE_KEY = "ata:pending-upload";

export const CATALOG: CatalogBook[] = [
  {
    id: "meditations",
    title: "Meditations",
    author: "Marcus Aurelius",
    year: 180,
    chapterCount: 12,
    chapterLabel: "Book",
    available: true,
    noFilePreset: true,
    coverColor: "linear-gradient(160deg, #6d2a2a, #3f1414)",
    personaName: "Marcus Aurelius",
    greeting: "What shall we reflect upon?",
    starterQuestions: [
      "How do I stay calm when others are unreasonable?",
      "What does it mean to control only my own mind?",
      "How should I think about mortality and time?",
    ],
  },
  {
    id: "the-great-gatsby",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    year: 1925,
    chapterCount: 9,
    chapterLabel: "Chapter",
    available: true,
    noFilePreset: true,
    coverColor: "linear-gradient(160deg, #23324a, #121a28)",
    personaName: "F. Scott Fitzgerald",
    greeting: "What shall we talk about?",
    starterQuestions: [
      "What does the green light symbolize to Gatsby?",
      "Why does Nick say Gatsby turned out all right in the end?",
      "What is the significance of the Valley of Ashes?",
    ],
  },
  {
    id: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    year: 2018,
    chapterCount: 20,
    chapterLabel: "Chapter",
    available: true,
    noFilePreset: true,
    coverColor: "linear-gradient(160deg, #2f3d3a, #18201f)",
    personaName: "James Clear",
    greeting: "Which habit or system would you like to explore?",
    starterQuestions: [
      "What are the Four Laws of Behavior Change?",
      "Why do identity-based habits last longer than goal-based ones?",
      "How does the 1% rule work in practice?",
    ],
  },
  {
    id: "thinking-fast-and-slow",
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    year: 2011,
    chapterCount: 38,
    chapterLabel: "Chapter",
    available: true,
    noFilePreset: true,
    coverColor: "linear-gradient(160deg, #4a3a22, #2a2012)",
    personaName: "Daniel Kahneman",
    greeting: "What aspect of judgment or decision-making shall we examine?",
    starterQuestions: [
      "What is the difference between System 1 and System 2?",
      "How does loss aversion distort our choices?",
      "What is the planning fallacy?",
    ],
  },
];

export function getCatalogBook(id: string): CatalogBook | undefined {
  return CATALOG.find((b) => b.id === id);
}

export function toSelectedBook(b: CatalogBook): SelectedBook {
  return {
    kind: "library",
    id: b.id,
    title: b.title,
    author: b.author,
    personaName: b.personaName,
  };
}

export function toChatBook(b: CatalogBook): ChatBook {
  return {
    kind: "library",
    id: b.id,
    title: b.title,
    author: b.author,
    personaName: b.personaName,
    chapterCount: b.chapterCount,
    chapterLabel: b.chapterLabel,
    greeting: b.greeting,
    starterQuestions: b.starterQuestions,
  };
}

export function uploadToChatBook(s: SelectedBook): ChatBook {
  const hasAuthor =
    Boolean(s.author) && !/^unknown author$/i.test(s.author.trim());
  const personaName =
    s.personaName && s.personaName !== "Book Guide"
      ? s.personaName
      : hasAuthor
        ? s.author
        : "The Author";

  return {
    kind: "upload",
    id: "upload",
    title: s.title,
    author: s.author,
    personaName,
    chapterCount: null,
    chapterLabel: "Chapter",
    greeting: `What would you like to know about ${s.title}?`,
    starterQuestions: [
      "What is this book about?",
      "Who are the main characters?",
      "What happens in the first chapter?",
    ],
  };
}
