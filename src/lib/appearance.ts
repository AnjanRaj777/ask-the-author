export type ThemeId = "warm" | "ivory" | "sage" | "midnight";
export type FontChoice = "serif" | "sans" | "mono";
export type TextSizeChoice = "compact" | "comfortable" | "large";

export interface AppearanceSettings {
  theme: ThemeId;
  font: FontChoice;
  textSize: TextSizeChoice;
  paperTexture: boolean;
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "warm",
  font: "serif",
  textSize: "comfortable",
  paperTexture: true,
};

export const THEME_OPTIONS: Array<{
  id: ThemeId;
  label: string;
  paper: string;
  ink: string;
  accent: string;
}> = [
  {
    id: "warm",
    label: "Warm Paper",
    paper: "#f6f1e7",
    ink: "#2a221d",
    accent: "#5e1b1b",
  },
  {
    id: "ivory",
    label: "Crisp Ivory",
    paper: "#fdfcfa",
    ink: "#1f2428",
    accent: "#2b4c7e",
  },
  {
    id: "sage",
    label: "Sage Folio",
    paper: "#eef2ec",
    ink: "#1f2922",
    accent: "#2f5d43",
  },
  {
    id: "midnight",
    label: "Midnight Ink",
    paper: "#181614",
    ink: "#ebe3d5",
    accent: "#c87d55",
  },
];

const STORAGE_KEY = "ata:appearance";

export function loadAppearanceSettings(): AppearanceSettings {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
    return {
      theme:
        parsed.theme && ["warm", "ivory", "sage", "midnight"].includes(parsed.theme)
          ? parsed.theme
          : DEFAULT_APPEARANCE.theme,
      font:
        parsed.font && ["serif", "sans", "mono"].includes(parsed.font)
          ? parsed.font
          : DEFAULT_APPEARANCE.font,
      textSize:
        parsed.textSize &&
        ["compact", "comfortable", "large"].includes(parsed.textSize)
          ? parsed.textSize
          : DEFAULT_APPEARANCE.textSize,
      paperTexture:
        typeof parsed.paperTexture === "boolean"
          ? parsed.paperTexture
          : DEFAULT_APPEARANCE.paperTexture,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function applyAppearanceSettings(settings: AppearanceSettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.font = settings.font;
  root.dataset.textSize = settings.textSize;
  root.dataset.texture = settings.paperTexture ? "on" : "off";
}

export function saveAppearanceSettings(settings: AppearanceSettings): void {
  applyAppearanceSettings(settings);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota errors
  }
}
