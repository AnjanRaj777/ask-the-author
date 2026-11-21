"use client";

import { useEffect } from "react";
import {
  applyAppearanceSettings,
  loadAppearanceSettings,
} from "@/lib/appearance";

export function AppearanceLoader() {
  useEffect(() => {
    applyAppearanceSettings(loadAppearanceSettings());
  }, []);

  return null;
}
