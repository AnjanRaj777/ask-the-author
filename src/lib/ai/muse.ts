import OpenAI from "openai";

export const DEFAULT_CHAT_MODEL =
  process.env.MUSE_MODEL || "muse-wonder-1.0";
export const FAST_MODEL =
  process.env.MUSE_FAST_MODEL || "muse-wonder-1.0";

const DEFAULT_BASE_URL = "https://api.meta.ai/v1";

/**
 * Returns an OpenAI-compatible client configured for Meta's Model API (Muse Wonder).
 */
export function getMuseClient(): OpenAI {
  const apiKey = process.env.MUSE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing MUSE_API_KEY. Copy .env.example to .env.local and set your Meta Model API key."
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.MUSE_BASE_URL || DEFAULT_BASE_URL,
  });
}
