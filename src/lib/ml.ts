
const ML_API_URL =
  import.meta.env["VITE_ML_API_URL"] || "http://127.0.0.1:8000";
const VOICE_API_URL = "https://neurosense-voice.onrender.com";

export interface MLPrediction {
  modality: "drawing" | "voice";
  task?: string;

  // Values returned to the frontend are percentages: 0–100
  probability: number;
  confidence?: number;

  // Screening score shown in the UI: 0–100
  screening_score?: number;

  screening_band?: {
    key: "lower" | "intermediate" | "higher" | string;
    label: string;
  };

  label: string;
  is_demo: boolean;
  disclaimer: string;
}

/**
 * Render can take a while to wake up after being idle.
 * We allow enough time for the first request, but automatically retry
 * temporary/network failures so the user does not have to repeat the task.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  timeoutMs = 90_000,
  retries = 2,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();

    const timeout = window.setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      window.clearTimeout(timeout);

      // Retry temporary server errors.
      if (
        (response.status === 502 ||
          response.status === 503 ||
          response.status === 504 ||
          response.status === 429) &&
        attempt < retries
      ) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, 1000 * (attempt + 1)),
        );
        continue;
      }

      return response;
    } catch (error) {
      window.clearTimeout(timeout);
      lastError = error;

      if (attempt < retries) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, 1000 * (attempt + 1)),
        );
        continue;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to connect to the NeuroSense ML service.");
}

async function parseResponse(res: Response) {
  const text = await res.text();

  console.log("[ML DEBUG] status:", res.status);
  console.log("[ML DEBUG] response body:", text);

  if (!res.ok) {
    let data: any = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // ignore JSON parse failure
    }

    throw new Error(
      data?.detail ||
        text ||
        `ML API error (${res.status})`,
    );
  }

  if (!text.trim()) {
    throw new Error(
      "ML API returned HTTP 200 but the response body is empty.",
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `ML API returned invalid JSON: ${text.slice(0, 500)}`,
    );
  }
}
/**
 * Wake up the Render ML service before the user reaches analysis.
 * This is intentionally fire-and-forget.
 */
export function warmUpML() {
  if (!ML_API_URL) return;

  void fetch(`${ML_API_URL}/health`, {
    method: "GET",
    cache: "no-store",
  }).catch(() => {
    // Warm-up failure should never block the app.
  });
}

export async function predictDrawing(
  blob: Blob,
  task: "spiral" | "circle" | "meander",
): Promise<MLPrediction> {
  const form = new FormData();

  form.append(
    "file",
    blob,
    `${task}.png`,
  );

  const res = await fetchWithRetry(
    `${ML_API_URL}/predict/drawing?task=${encodeURIComponent(task)}`,
    {
      method: "POST",
      body: form,
    },
  );

  const data = await parseResponse(res);

  const probability = Number(data.probability);
  const confidence = Number(data.confidence);

  return {
    ...data,
    modality: "drawing",
    task,
    probability: Number.isFinite(probability)
      ? probability * 100
      : 0,
    confidence: Number.isFinite(confidence)
      ? confidence * 100
      : undefined,
    label: String(data.label ?? data.prediction ?? "unknown"),
    is_demo: Boolean(data.is_demo),
    disclaimer:
      data.disclaimer ??
      "AI screening estimate only — not a medical diagnosis.",
  };
}

export async function predictVoice(
  blob: Blob,
): Promise<MLPrediction> {
  if (!blob || blob.size === 0) {
    throw new Error("Voice recording is empty.");
  }

  const form = new FormData();

  const extension = blob.type.includes("mp4")
    ? "m4a"
    : blob.type.includes("ogg")
      ? "ogg"
      : "webm";

  form.append("file", blob, `voice.${extension}`);

  const res = await fetchWithRetry(
    `${VOICE_API_URL}/predict/voice`,
    {
      method: "POST",
      body: form,
    },
    300000,
    0,
  );

  const data = await parseResponse(res);

  if (!data || typeof data !== "object") {
    throw new Error(
      "Voice ML service returned an empty prediction.",
    );
  }

  const rawProbability = Number(data.probability);

  if (!Number.isFinite(rawProbability)) {
    throw new Error("Voice ML returned an invalid probability.");
  }

  const probability = rawProbability * 100;

  const rawScreeningScore = Number(
    data.screening_score ?? rawProbability,
  );

  const screeningScore = Number.isFinite(rawScreeningScore)
    ? rawScreeningScore * 100
    : probability;

  const rawConfidence = Number(data.confidence);

  const screeningBand =
    data.screening_band ??
    (screeningScore < 70
      ? {
          key: "lower",
          label: "Lower screening score",
        }
      : screeningScore < 90
        ? {
            key: "intermediate",
            label: "Intermediate screening score",
          }
        : {
            key: "higher",
            label: "Higher screening score",
          });

  return {
    ...data,

    modality: "voice",

    label: String(
      data.label ??
        data.prediction ??
        "unknown",
    ),

    probability,

    confidence: Number.isFinite(rawConfidence)
      ? rawConfidence * 100
      : Math.max(
          rawProbability,
          1 - rawProbability,
        ) * 100,

    screening_score: screeningScore,

    screening_band: screeningBand,

    is_demo: Boolean(data.is_demo),

    disclaimer:
      data.disclaimer ??
      "AI screening estimate only — not a medical diagnosis.",
  };
}
