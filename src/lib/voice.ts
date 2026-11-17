export interface VoiceMetrics {
  durationMs: number;
  sampleRate: number | null;
  amplitudeRms: number;
}

export const VOICE_PROMPT =
  "Say “ahhh” steadily for a few seconds, then read this line out loud: “The quick brown fox jumps over the lazy dog.”";

/**
 * DEMO MODE ONLY — plausible-looking but random score.
 * Never rendered without the Demo Mode badge and disclaimer.
 */
export function generateVoiceDemoScore() {
  const probability = Math.round((10 + Math.random() * 48) * 10) / 10;
  const confidence = Math.round((70 + Math.random() * 24) * 10) / 10;
  return { probability, confidence };
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Best-effort recorder mime type for the current browser. */
export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function extensionFor(mimeType: string | undefined): string {
  if (!mimeType) return "webm";
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}
