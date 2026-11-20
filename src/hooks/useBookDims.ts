"use client";

import { useEffect, useState } from "react";

export type BookOrientation = "horizontal" | "vertical";

export interface BookDims {
  vw: number;
  vh: number;
  /** Size of ONE page (half of the open spread). */
  pageW: number;
  pageH: number;
  /** horizontal = opens left/right (desktop), vertical = cover flips up (mobile) */
  orientation: BookOrientation;
}

const DESKTOP_BREAKPOINT = 768;
const PAGE_RATIO = 1.35; // height / width of a portrait page

function compute(): BookDims {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (vw >= DESKTOP_BREAKPOINT) {
    let pageW = Math.min(vw * 0.4, 440);
    let pageH = pageW * PAGE_RATIO;
    const maxH = vh * 0.8;
    if (pageH > maxH) {
      pageH = maxH;
      pageW = pageH / PAGE_RATIO;
    }
    return { vw, vh, pageW, pageH, orientation: "horizontal" };
  }

  // Mobile: two pages stacked vertically, each takes ~43% of the viewport height.
  const pageW = Math.min(vw * 0.9, 480);
  const pageH = Math.min(vh * 0.43, pageW * 1.25);
  return { vw, vh, pageW, pageH, orientation: "vertical" };
}

/** Measures the viewport and returns book page dimensions (null until mounted). */
export function useBookDims(): BookDims | null {
  const [dims, setDims] = useState<BookDims | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setDims(compute()));
    };
    setDims(compute());
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
    };
  }, []);

  return dims;
}
