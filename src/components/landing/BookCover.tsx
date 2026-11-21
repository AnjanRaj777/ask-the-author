import type { BookOrientation } from "@/hooks/useBookDims";

interface BookCoverProps {
  orientation: BookOrientation;
  /** Title font size in px, scaled to the page size. */
  titleSize: number;
}

/** Front cover of the book: oxblood leather, gold corner filigree, ribbon bookmark, and serif title. */
export function BookCover({ orientation, titleSize }: BookCoverProps) {
  const horizontal = orientation === "horizontal";

  return (
    <div
      className={`leather relative h-full w-full overflow-hidden shadow-[0_32px_65px_-16px_rgba(24,14,8,0.75),0_8px_18px_-6px_rgba(24,14,8,0.5)] ${
        horizontal ? "rounded-l-sm rounded-r-md" : "rounded-t-sm rounded-b-md"
      }`}
    >
      {/* Curved spine + hinge groove */}
      <div
        className={`absolute ${
          horizontal
            ? "inset-y-0 left-0 w-9 bg-linear-to-r"
            : "inset-x-0 top-0 h-9 bg-linear-to-b"
        } from-black/65 via-black/25 to-transparent`}
      />
      <div
        className={`absolute bg-black/35 ${
          horizontal ? "inset-y-0 left-6 w-[2px]" : "inset-x-0 top-6 h-[2px]"
        }`}
      />
      <div
        className={`absolute bg-white/15 ${
          horizontal ? "inset-y-0 left-[26px] w-px" : "inset-x-0 top-[26px] h-px"
        }`}
      />

      {/* Raised spine binding ribs */}
      {horizontal && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-8 left-0 flex w-6 flex-col justify-between"
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-2 w-full bg-linear-to-b from-white/12 via-black/15 to-black/45"
            />
          ))}
        </div>
      )}

      {/* Subtle bevel highlight along outer cover edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10"
      />

      {/* Gold silk ribbon bookmark */}
      <div
        aria-hidden
        className="absolute left-10 top-0 z-10 h-14 w-5 drop-shadow-[0_4px_6px_rgba(0,0,0,0.55)] sm:left-12 sm:h-16 sm:w-6"
        style={{
          background:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 2px), linear-gradient(135deg, #f5e2a8 0%, #c89d47 52%, #8f6720 100%)",
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)",
        }}
      />

      {/* Gold double frame + ornate corner flourishes */}
      <div className="absolute inset-4 rounded-[3px] border border-gold/65 shadow-[inset_0_0_24px_rgba(0,0,0,0.22)] sm:inset-6">
        <div className="absolute inset-1.5 rounded-[2px] border border-gold/30" />
        <CornerFlourish className="left-0.5 top-0.5" />
        <CornerFlourish className="right-0.5 top-0.5 -scale-x-100" />
        <CornerFlourish className="bottom-0.5 left-0.5 -scale-y-100" />
        <CornerFlourish className="bottom-0.5 right-0.5 -scale-x-100 -scale-y-100" />
      </div>

      <div className="relative flex h-full flex-col items-center justify-center px-10 text-center">
        <Ornament />
        <h2
          className="mt-4 font-serif font-semibold leading-[0.95] tracking-wide text-gold drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]"
          style={{ fontSize: titleSize }}
        >
          Ask the
          <br />
          Author
        </h2>
        <div className="my-4 h-px w-14 bg-gold/55" />
        <p
          className="font-serif italic text-gold/85 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]"
          style={{ fontSize: Math.max(13, titleSize * 0.28) }}
        >
          Conversations drawn from the page
        </p>
        <div className="mt-4">
          <Ornament />
        </div>
      </div>
    </div>
  );
}

function Ornament() {
  return (
    <div className="flex items-center gap-2 text-gold/85" aria-hidden>
      <span className="h-px w-8 bg-current" />
      <span className="h-1.5 w-1.5 rotate-45 bg-current" />
      <span className="h-px w-8 bg-current" />
    </div>
  );
}

function CornerFlourish({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={`pointer-events-none absolute h-9 w-9 text-gold/75 sm:h-11 sm:w-11 ${className}`}
    >
      <path
        d="M3 3h20M3 3v20M6 6c7 0 11 4 11 11M6 6c0 7 4 11 11 11M11 3c0 5 4 8 9 8M3 11c5 0 8 4 8 9"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <circle cx="17" cy="17" r="1.5" fill="currentColor" />
      <circle cx="25" cy="5.5" r="1" fill="currentColor" />
      <circle cx="5.5" cy="25" r="1" fill="currentColor" />
    </svg>
  );
}
