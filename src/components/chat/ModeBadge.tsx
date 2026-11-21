import { BookOpenCheck, Brain, Lightbulb, SearchX, Sparkles } from "lucide-react";
import type { AnswerMode } from "@/lib/types";

export type BadgeMode = AnswerMode | "preview";

const STYLES: Record<
  BadgeMode,
  { label: string; className: string; Icon: typeof Sparkles }
> = {
  grounded: {
    label: "From the book",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    Icon: BookOpenCheck,
  },
  speculation: {
    label: "Speculation",
    className: "border-amber-200 bg-amber-50 text-amber-900",
    Icon: Lightbulb,
  },
  not_in_book: {
    label: "Not in the book",
    className: "border-stone-300 bg-stone-100 text-stone-700",
    Icon: SearchX,
  },
  memory: {
    label: "AI memory · no citations",
    className: "border-sky-200 bg-sky-50 text-sky-900",
    Icon: Brain,
  },
  preview: {
    label: "Design preview",
    className: "border-indigo-200 bg-indigo-50 text-indigo-800",
    Icon: Sparkles,
  },
};

export function ModeBadge({ mode }: { mode: BadgeMode }) {
  const { label, className, Icon } = STYLES[mode];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
