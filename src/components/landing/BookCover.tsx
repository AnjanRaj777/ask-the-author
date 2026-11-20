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
      className={`leather relative h-full w-full overflow-hidden shadow-[0_30px_60px_-20px_rgba(40,24,14,0.65)] ${
        horizontal ? "rounded-l-sm rounded-r-md" : "rounded-t-sm rounded-b-md"
      }`}
    >
      {/* Hinge / spine shading + leather crease */}
      <div
        className={`absolute ${
          horizontal
            ? "inset-y-0 left-0 w-7 bg-linear-to-r"
            : "inset-x-0 top-0 h-7 bg-linear-to-b"
        } from-black/55 via-black/20 to-transparent`}
      />
      <div
        className={`absolute bg-black/25 ${
          horizontal ? "inset-y-0 left-5 w-px" : "inset-x-0 top-5 h-px"
        }`}
      />
      <div
        className={`absolute bg-white/10 ${
          horizontal ? "inset-y-0 left-[21px] w-px" : "inset-x-0 top-[21px] h-px"
        }`}
      />

      {/* Gold silk ribbon bookmark */}
      <div
        aria-hidden
        className="absolute left-9 top-0 z-10 h-12 w-5 drop-shadow-[0_3px_4px_rgba(0,0,0,0.45)] sm:left-11 sm:h-14 sm:w-6"
        style={{
          background:
            "linear-gradient(135deg, #f3dc99 0%, #c89d47 55%, #9e7529 100%)",
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)",
        }}
      />

      {/* Gold double frame + ornate corner flourishes */}
      <div className="absolute inset-4 rounded-[3px] border border-gold/65 sm:inset-6">
        <div className="absolute inset-1.5 rounded-[2px] border border-gold/30" />
        <CornerFlourish className="left-0.5 top-0.5" />
        <CornerFlourish className="right-0.5 top-0.5 -scale-x-100" />
        <CornerFlourish className="bottom-0.5 left-0.5 -scale-y-100" />
        <CornerFlourish className="bottom-0.5 right-0.5 -scale-x-100 -scale-y-100" />
      </div>

      <div className="relative flex h-full flex-col items-center justify-center px-10 text-center">
        <Ornament />
        <h2
          className="mt-4 font-serif font-semibold leading-[0.95] tracking-wide text-gold drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
          style={{ fontSize: titleSize }}
        >
          Ask the
          <br />
          Author
        </h2>
        <div className="my-4 h-px w-14 bg-gold/55" />
        <p
          className="font-serif italic text-gold/85 drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]"
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
