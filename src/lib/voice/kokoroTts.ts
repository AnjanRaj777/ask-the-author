"use client";

export type TtsState = "idle" | "loading" | "synthesizing" | "playing";

interface KokoroAudio {
  audio: Float32Array;
  sampling_rate: number;
}

interface KokoroInstance {
  generate: (
    text: string,
    options?: { voice?: string; speed?: number }
  ) => Promise<KokoroAudio>;
}

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

let ttsPromise: Promise<KokoroInstance> | null = null;
let sharedCtx: AudioContext | null = null;
let activeSource: AudioBufferSourceNode | null = null;
let activeCancel: (() => void) | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctx();
  }
  if (sharedCtx.state === "suspended") {
    void sharedCtx.resume();
  }
  return sharedCtx;
}

async function getKokoro(): Promise<KokoroInstance> {
  if (!ttsPromise) {
    ttsPromise = (async () => {
      const origError = console.error;
      console.error = (...args: unknown[]) => {
        const first = typeof args[0] === "string" ? args[0] : "";
        if (first.includes("onnxruntime:")) return;
        origError(...args);
      };
      try {
        const { KokoroTTS } = await import("kokoro-js");
        return (await KokoroTTS.from_pretrained(MODEL_ID, {
          dtype: "q8",
          device: "wasm",
        })) as unknown as KokoroInstance;
      } finally {
        console.error = origError;
      }
    })();
  }
  return ttsPromise;
}

export function stopTts() {
  if (activeCancel) {
    activeCancel();
    activeCancel = null;
  }
  if (activeSource) {
    try {
      activeSource.onended = null;
      activeSource.stop();
      activeSource.disconnect();
    } catch {
      // ignore if already stopped
    }
    activeSource = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function splitSentences(text: string): string[] {
  const parts = text
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g);
  if (!parts) return [text];
  // Merge very short fragments so prosody stays natural
  const merged: string[] = [];
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    if (merged.length > 0 && merged[merged.length - 1].length < 40) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${p}`;
    } else {
      merged.push(p);
    }
  }
  return merged.length > 0 ? merged : [text];
}

function playBuffer(
  ctx: AudioContext,
  samples: Float32Array,
  sampleRate: number
): Promise<void> {
  return new Promise((resolve) => {
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    activeSource = source;
    source.onended = () => {
      if (activeSource === source) activeSource = null;
      resolve();
    };
    source.start(0);
  });
}

function speakFallback(
  text: string,
  onStateChange: (s: TtsState) => void
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onStateChange("idle");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const standardVoice =
    voices.find((v) => v.lang.startsWith("en") && v.localService) ||
    voices.find((v) => v.lang.startsWith("en"));
  if (standardVoice) utterance.voice = standardVoice;
  utterance.rate = 1;
  utterance.onend = () => onStateChange("idle");
  utterance.onerror = () => onStateChange("idle");
  onStateChange("playing");
  window.speechSynthesis.speak(utterance);
}

export async function speakNatural(
  rawText: string,
  onStateChange: (state: TtsState) => void,
  voice = "af_heart"
): Promise<void> {
  stopTts();
  const cleanText = rawText.replace(/\[\d+\]/g, "").trim();
  if (!cleanText) {
    onStateChange("idle");
    return;
  }

  // Unlock AudioContext synchronously during the user click gesture
  const ctx = getAudioContext();
  if (!ctx) {
    speakFallback(cleanText, onStateChange);
    return;
  }

  let cancelled = false;
  activeCancel = () => {
    cancelled = true;
  };

  try {
    onStateChange(ttsPromise ? "synthesizing" : "loading");
    const tts = await getKokoro();
    if (cancelled) return;

    const sentences = splitSentences(cleanText);
    for (let i = 0; i < sentences.length; i++) {
      if (cancelled) return;
      if (i === 0) onStateChange("synthesizing");

      const result = await tts.generate(sentences[i], { voice, speed: 1.0 });
      if (cancelled) return;

      if (!result?.audio || result.audio.length === 0) continue;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      onStateChange("playing");
      await playBuffer(ctx, result.audio, result.sampling_rate || 24000);
    }

    if (!cancelled) {
      onStateChange("idle");
    }
  } catch (err) {
    console.warn("[TTS] Kokoro failed, falling back to browser voice:", err);
    if (cancelled) return;
    ttsPromise = null;
    speakFallback(cleanText, onStateChange);
  }
}
