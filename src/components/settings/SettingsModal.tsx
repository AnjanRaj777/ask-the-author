"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, RotateCcw, X } from "lucide-react";
import {
  DEFAULT_APPEARANCE,
  THEME_OPTIONS,
  loadAppearanceSettings,
  saveAppearanceSettings,
  type AppearanceSettings,
  type FontChoice,
  type TextSizeChoice,
} from "@/lib/appearance";

export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [settings, setSettings] =
    useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  useEffect(() => {
    if (open) {
      setSettings(loadAppearanceSettings());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const update = (patch: Partial<AppearanceSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveAppearanceSettings(next);
  };

  const reset = () => {
    setSettings(DEFAULT_APPEARANCE);
    saveAppearanceSettings(DEFAULT_APPEARANCE);
  };

  const fonts: Array<{ id: FontChoice; label: string; sample: string }> = [
    { id: "serif", label: "Classic Serif", sample: "Aa" },
    { id: "sans", label: "Modern Sans", sample: "Aa" },
    { id: "mono", label: "Typewriter", sample: "Aa" },
  ];

  const sizes: Array<{ id: TextSizeChoice; label: string }> = [
    { id: "compact", label: "Compact" },
    { id: "comfortable", label: "Comfortable" },
    { id: "large", label: "Large" },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Appearance settings"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.16 }}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-ink/15 bg-page p-6 text-ink shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-ink/10 pb-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-soft">
                  Customize look
                </p>
                <h2 className="font-serif text-2xl font-semibold">Settings</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition hover:bg-ink/5 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {/* Theme */}
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-soft">
                  Theme
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                  {THEME_OPTIONS.map((t) => {
                    const active = settings.theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => update({ theme: t.id })}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                          active
                            ? "border-leather bg-leather/10"
                            : "border-ink/15 bg-paper/60 hover:border-ink/30"
                        }`}
                      >
                        <span
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-ink/20"
                          style={{ backgroundColor: t.paper, color: t.accent }}
                        >
                          {active ? <Check className="h-3.5 w-3.5" /> : null}
                        </span>
                        <span className="text-xs font-medium">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font */}
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-soft">
                  Reading font
                </p>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {fonts.map((f) => {
                    const active = settings.font === f.id;
                    const fontClass =
                      f.id === "serif"
                        ? "font-serif"
                        : f.id === "mono"
                          ? "font-mono"
                          : "font-sans";
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => update({ font: f.id })}
                        className={`rounded-xl border px-2.5 py-2 text-center transition ${
                          active
                            ? "border-leather bg-leather/10"
                            : "border-ink/15 bg-paper/60 hover:border-ink/30"
                        }`}
                      >
                        <span className={`block text-lg font-semibold ${fontClass}`}>
                          {f.sample}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-ink-soft">
                          {f.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Text Size */}
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-soft">
                  Text size
                </p>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {sizes.map((s) => {
                    const active = settings.textSize === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => update({ textSize: s.id })}
                        className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                          active
                            ? "border-leather bg-leather/10 text-ink"
                            : "border-ink/15 bg-paper/60 text-ink-soft hover:border-ink/30 hover:text-ink"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Paper Texture */}
              <div className="flex items-center justify-between rounded-xl border border-ink/10 bg-paper/50 px-3.5 py-2.5">
                <div>
                  <p className="text-sm font-medium">Paper texture</p>
                  <p className="text-[11px] text-ink-soft">
                    Subtle grain across reading surfaces
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.paperTexture}
                  onClick={() =>
                    update({ paperTexture: !settings.paperTexture })
                  }
                  className={`relative h-6 w-11 rounded-full transition ${
                    settings.paperTexture ? "bg-leather" : "bg-ink/20"
                  }`}
                >
                  <span
                    className={`block h-5 w-5 translate-y-0.5 rounded-full bg-page shadow transition ${
                      settings.paperTexture ? "translate-x-5.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-ink/10 pt-4">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft transition hover:text-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to default
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-ink px-5 py-2 text-xs font-medium text-paper transition hover:bg-leather"
              >
                Done
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
