"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  backOut,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ChevronDown } from "lucide-react";
import { useBookDims, type BookDims } from "@/hooks/useBookDims";
import { UPLOAD_STORAGE_KEY, type SelectedBook } from "@/lib/catalog";
import { BookCover } from "./BookCover";
import { LibraryPage } from "./LibraryPage";
import { DisclaimerPage } from "./DisclaimerPage";

/**
 * Scroll timeline (0 → 1 across the tall scroll container).
 * Matches the sketch steps in docs/DESIGN.md.
 */
const HERO_OUT: [number, number] = [0, 0.07]; // Step 1 → fades away
const DROP: [number, number] = [0.03, 0.3]; // Step 2–3: book drops in from the top
const SLIDE: [number, number] = [0.32, 0.46]; // Step 4: book slides to make room
const OPEN: [number, number] = [0.44, 0.7]; // Step 5: cover swings open
const CONTENT: [number, number] = [0.66, 0.76]; // Step 6: pages fill in
const BG_SHIFT: [number, number] = [0.15, 0.58]; // Step 1 linen → Step 6 wooden desk
const INTERACTIVE_AT = 0.74;
const SCROLL_HEIGHT = "460svh";

type Flow =
  | { stage: "browse"; book: SelectedBook | null }
  | { stage: "expanding"; book: SelectedBook; rect: DOMRect };

export default function Landing() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const secondPageRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const dims = useBookDims();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const alwaysOpen = useMotionValue(1);
  const progress = reduceMotion ? alwaysOpen : scrollYProgress;

  const heroBgOpacity = useTransform(progress, BG_SHIFT, [1, 0]);
  const deskBgOpacity = useTransform(progress, BG_SHIFT, [0, 1]);

  const [scrolledOpen, setScrolledOpen] = useState(false);
  const [heroActive, setHeroActive] = useState(true);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setScrolledOpen(v >= INTERACTIVE_AT);
    setHeroActive(v < 0.04);
  });
  const interactive = reduceMotion || scrolledOpen;

  const [flow, setFlow] = useState<Flow>({ stage: "browse", book: null });
  const selected = flow.book;

  function scrollToOpenBook(behavior: ScrollBehavior = "smooth") {
    const el = containerRef.current;
    if (!el) return;
    const top = el.offsetTop + (el.offsetHeight - window.innerHeight) * 0.82;
    window.scrollTo({ top, behavior });
  }

  // Deep link: /#library jumps straight to the open book.
  useEffect(() => {
    if (dims && window.location.hash === "#library") scrollToOpenBook("auto");
    // Only on first measurement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims === null]);

  // Freeze scrolling while the chat page expands to full screen.
  useEffect(() => {
    if (flow.stage !== "expanding") return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [flow.stage]);

  function handleAccept() {
    if (flow.stage !== "browse" || !flow.book) return;
    const book = flow.book;
    if (book.kind === "upload") {
      sessionStorage.setItem(UPLOAD_STORAGE_KEY, JSON.stringify(book));
    }
    const href = `/chat/${book.id}`;
    router.prefetch(href);
    const rect = secondPageRef.current?.getBoundingClientRect();
    if (!rect || reduceMotion) {
      router.push(href);
      return;
    }
    setFlow({ stage: "expanding", book, rect });
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: reduceMotion ? "100svh" : SCROLL_HEIGHT }}
    >
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* Step 1 background (linen tabletop with glasses & coffee) */}
        <motion.div
          aria-hidden
          style={{
            opacity: heroBgOpacity,
            backgroundImage: "url('/images/hero-bg.jpg')",
          }}
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
        >
          <div className="absolute inset-0 bg-paper/30" />
        </motion.div>

        {/* Step 6 background (sunlit wooden desk for the open book) */}
        <motion.div
          aria-hidden
          style={{
            opacity: deskBgOpacity,
            backgroundImage: "url('/images/desk-bg.jpg')",
          }}
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
        >
          <div className="absolute inset-0 bg-black/10" />
        </motion.div>

        {!reduceMotion && (
          <Hero
            progress={scrollYProgress}
            active={heroActive}
            onScrollCue={() => scrollToOpenBook()}
          />
        )}

        {dims && (
          <BookScene
            dims={dims}
            progress={progress}
            interactive={interactive && flow.stage !== "expanding"}
            secondPageRef={secondPageRef}
            selected={selected}
            onSelect={(book) => setFlow({ stage: "browse", book })}
            onAccept={handleAccept}
          />
        )}
      </div>

      {flow.stage === "expanding" && (
        <ExpandToChat
          rect={flow.rect}
          onDone={() => router.push(`/chat/${flow.book.id}`)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1: plain screen with sign-in + scroll cue                       */
/* ------------------------------------------------------------------ */

function Hero({
  progress,
  active,
  onScrollCue,
}: {
  progress: MotionValue<number>;
  active: boolean;
  onScrollCue: () => void;
}) {
  const opacity = useTransform(progress, HERO_OUT, [1, 0]);
  const y = useTransform(progress, HERO_OUT, [0, -48]);

  return (
    <motion.section
      style={{ opacity, y }}
      aria-hidden={!active}
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center ${
        active ? "" : "pointer-events-none"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-ink/80">
        An AI reading companion
      </p>
      <h1 className="mt-4 font-serif text-6xl font-semibold tracking-tight text-ink drop-shadow-[0_1px_12px_rgba(246,241,231,0.7)] sm:text-8xl">
        Ask the Author
      </h1>
      <p className="mt-4 max-w-md font-serif text-xl italic text-ink/80 sm:text-2xl">
        Questions about a book, answered from its pages.
      </p>

      <Link
        href="/login"
        tabIndex={active ? 0 : -1}
        className="mt-10 rounded-full bg-ink px-9 py-3 text-sm font-medium tracking-wide text-paper shadow-[0_10px_30px_-12px_rgba(42,34,29,0.65)] transition hover:bg-leather focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leather/50 focus-visible:ring-offset-4 focus-visible:ring-offset-paper"
      >
        Sign in
      </Link>

      <button
        type="button"
        onClick={onScrollCue}
        tabIndex={active ? 0 : -1}
        className="absolute bottom-8 flex flex-col items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-ink/80 transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
      >
        Scroll to open the book
        <motion.span
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
        >
          <ChevronDown className="h-5 w-5" />
        </motion.span>
      </button>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Steps 2–7: the book drops, slides, opens, and hosts the pages        */
/* ------------------------------------------------------------------ */

interface BookSceneProps {
  dims: BookDims;
  progress: MotionValue<number>;
  interactive: boolean;
  secondPageRef: RefObject<HTMLDivElement | null>;
  selected: SelectedBook | null;
  onSelect: (book: SelectedBook) => void;
  onAccept: () => void;
}

function BookScene({
  dims,
  progress,
  interactive,
  secondPageRef,
  selected,
  onSelect,
  onAccept,
}: BookSceneProps) {
  const { vh, pageW: W, pageH: H, orientation } = dims;
  const horizontal = orientation === "horizontal";
  const spreadW = horizontal ? W * 2 : W;
  const spreadH = horizontal ? H : H * 2;

  // Step 2–3: drop from above the viewport, with a little tilt that settles.
  const dropY = useTransform(progress, DROP, [-(vh / 2 + spreadH), 0], {
    ease: backOut,
  });
  const tilt = useTransform(progress, DROP, [-9, 0]);

  // Step 4: closed book is centred on the cover; it slides by half a page
  // so the open spread ends up centred.
  const slide = useTransform(progress, SLIDE, [1, 0]);
  const x = useTransform(() => (horizontal ? (-W / 2) * slide.get() : 0));
  const y = useTransform(
    () => dropY.get() + (horizontal ? 0 : (-H / 2) * slide.get())
  );

  // Step 5: the cover swings open around the spine.
  const coverAngle = useTransform(
    progress,
    OPEN,
    horizontal ? [0, -180] : [0, 180]
  );
  const foldShade = useTransform(
    progress,
    [OPEN[0], (OPEN[0] + OPEN[1]) / 2, OPEN[1]],
    [0, 0.28, 0]
  );

  // Step 6: page content fades in, along with the linen book-board backing.
  const contentOpacity = useTransform(progress, CONTENT, [0, 1]);

  const first = { left: 0, top: 0, width: W, height: H };
  const second = horizontal
    ? { left: W, top: 0, width: W, height: H }
    : { left: 0, top: H, width: W, height: H };

  // Soft curved-page lighting + rich center gutter shadow
  const gutterFirst = horizontal
    ? "linear-gradient(to left, rgba(58,38,20,0.22) 0%, rgba(58,38,20,0.06) 9%, rgba(255,255,255,0.25) 28%, transparent 55%)"
    : "linear-gradient(to top, rgba(58,38,20,0.22) 0%, rgba(58,38,20,0.06) 9%, rgba(255,255,255,0.25) 28%, transparent 55%)";
  const gutterSecond = horizontal
    ? "linear-gradient(to right, rgba(58,38,20,0.22) 0%, rgba(58,38,20,0.06) 9%, rgba(255,255,255,0.25) 28%, transparent 55%)"
    : "linear-gradient(to bottom, rgba(58,38,20,0.22) 0%, rgba(58,38,20,0.06) 9%, rgba(255,255,255,0.25) 28%, transparent 55%)";

  const firstRadius = horizontal ? "rounded-l-md" : "rounded-t-md";
  const secondRadius = horizontal ? "rounded-r-md" : "rounded-b-md";
  const titleSize = Math.round(Math.min(W, H) * 0.14);

  return (
    <motion.div
      className="absolute left-1/2 top-1/2 z-10"
      style={{
        width: spreadW,
        height: spreadH,
        marginLeft: -spreadW / 2,
        marginTop: -spreadH / 2,
        x,
        y,
        rotate: tilt,
      }}
    >
      {/* Linen hardcover board peeking out around the open spread */}
      <motion.div
        aria-hidden
        style={{ opacity: contentOpacity }}
        className="pointer-events-none absolute -inset-x-3 -inset-y-2.5 rounded-lg border border-[#a89e8e] bg-[#bfb5a4] shadow-[0_32px_65px_-16px_rgba(24,14,8,0.65)]"
      >
        <div
          className={`absolute ${
            horizontal
              ? "inset-y-0 left-1/2 w-6 -translate-x-1/2 bg-linear-to-r"
              : "inset-x-0 top-1/2 h-6 -translate-y-1/2 bg-linear-to-b"
          } from-black/15 via-black/30 to-black/15`}
        />
      </motion.div>

      {/* 3D layer: page block + swinging cover */}
      <div className="absolute inset-0" style={{ perspective: 2400 }}>
        <div
          className={`page-paper page-block-right absolute overflow-hidden ${secondRadius}`}
          style={second}
        >
          <motion.div
            className={`absolute inset-0 ${
              horizontal ? "bg-linear-to-r" : "bg-linear-to-b"
            } from-black/60 to-transparent`}
            style={{ opacity: foldShade }}
          />
        </div>

        <motion.div
          className="absolute"
          style={{
            ...second,
            transformOrigin: horizontal ? "left center" : "center top",
            transformStyle: "preserve-3d",
            rotateY: horizontal ? coverAngle : 0,
            rotateX: horizontal ? 0 : coverAngle,
          }}
        >
          <div className="backface-hidden absolute inset-0">
            <BookCover orientation={orientation} titleSize={titleSize} />
          </div>
          <div
            className={`page-paper backface-hidden absolute inset-0 ${secondRadius}`}
            style={{
              transform: horizontal ? "rotateY(180deg)" : "rotateX(180deg)",
            }}
          />
        </motion.div>
      </div>

      {/* Content layer (2D, on top of the open spread) */}
      <motion.div
        className={`page-paper page-block-left absolute z-10 overflow-hidden ${firstRadius} ${
          interactive ? "" : "pointer-events-none"
        }`}
        style={{
          ...first,
          opacity: contentOpacity,
          backgroundImage: `${gutterFirst}, var(--noise)`,
        }}
        aria-hidden={!interactive}
        inert={!interactive}
      >
        <LibraryPage selected={selected} onSelect={onSelect} />
      </motion.div>

      <motion.div
        ref={secondPageRef}
        className={`page-paper page-block-right absolute z-10 overflow-hidden ${secondRadius} ${
          interactive ? "" : "pointer-events-none"
        }`}
        style={{
          ...second,
          opacity: contentOpacity,
          backgroundImage: `${gutterSecond}, var(--noise)`,
        }}
        aria-hidden={!interactive}
        inert={!interactive}
      >
        <DisclaimerPage
          key={selected?.id ?? "none"}
          book={selected}
          onAccept={onAccept}
        />
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 7 → 8: the chat page grows to fill the screen                   */
/* ------------------------------------------------------------------ */

function ExpandToChat({
  rect,
  onDone,
}: {
  rect: DOMRect;
  onDone: () => void;
}) {
  return (
    <motion.div
      className="fixed z-50 overflow-hidden bg-paper"
      style={{ backgroundImage: "var(--noise)" }}
      initial={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        borderRadius: 6,
      }}
      animate={{
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        borderRadius: 0,
      }}
      transition={{ duration: 0.75, ease: [0.65, 0, 0.35, 1] }}
      onAnimationComplete={onDone}
    >
      <motion.div
        className="flex h-full items-center justify-center px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        <div className="h-14 w-full max-w-2xl rounded-3xl border border-ink/15 bg-white/80" />
      </motion.div>
    </motion.div>
  );
}
