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
    id: "pride-and-prejudice",
    title: "Pride and Prejudice",
    author: "Jane Austen",
    year: 1813,
    chapterCount: 61,
    chapterLabel: "Chapter",
    available: true,
    coverColor: "linear-gradient(160deg, #6d2a2a, #3f1414)",
    personaName: "Jane Austen",
    greeting: "What shall we talk about?",
    starterQuestions: [
      "What did you mean by the opening line?",
      "Why does Mr. Bennet tease his wife so?",
      "How do Mr. and Mrs. Bennet differ?",
    ],
  },
  {
    id: "frankenstein",
    title: "Frankenstein",
    author: "Mary Shelley",
    year: 1818,
    chapterCount: 24,
    chapterLabel: "Chapter",
    available: false,
    coverColor: "linear-gradient(160deg, #2f3d3a, #18201f)",
    personaName: "Mary Shelley",
    greeting: "What shall we talk about?",
    starterQuestions: [],
  },
  {
    id: "sherlock-holmes",
    title: "The Adventures of Sherlock Holmes",
    author: "Arthur Conan Doyle",
    year: 1892,
    chapterCount: 12,
    chapterLabel: "Story",
    available: false,
    coverColor: "linear-gradient(160deg, #23324a, #121a28)",
    personaName: "Arthur Conan Doyle",
    greeting: "What shall we talk about?",
    starterQuestions: [],
  },
  {
    id: "jane-eyre",
    title: "Jane Eyre",
    author: "Charlotte Brontë",
    year: 1847,
    chapterCount: 38,
    chapterLabel: "Chapter",
    available: false,
    coverColor: "linear-gradient(160deg, #4a3a22, #2a2012)",
    personaName: "Charlotte Brontë",
    greeting: "What shall we talk about?",
    starterQuestions: [],
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
