/**
 * Shared plumbing for the guided assessment flow:
 * Start → Drawing check → Voice check → Fusion analysis → Final result.
 *
 * A single screening_sessions row ties the drawing and voice parts together,
 * so the final result is always fused from both model outputs of the SAME
 * assessment — never an independent one-off estimate.
 */

export interface AssessmentSearch {
  /** Present when the user is inside the guided end-to-end assessment. */
  flow?: "assessment" | undefined;
  /** The screening_sessions row shared by every step of this assessment. */
  session?: string | undefined;
}

export function validateAssessmentSearch(search: Record<string, unknown>): AssessmentSearch {
  const out: AssessmentSearch = {};
  if (search["flow"] === "assessment") out.flow = "assessment";
  if (typeof search["session"] === "string" && search["session"]) out.session = search["session"];
  return out;
}

export interface FusionWeights {
  drawingWeight: number;
  voiceWeight: number;
}

export const DEFAULT_FUSION_WEIGHTS: FusionWeights = { drawingWeight: 0.75,voiceWeight: 0.25,};

const WEIGHTS_KEY = "neurosense.fusionWeights";

/** Weights are configurable; today they are stored locally and default to equal weighting. */
export function getFusionWeights(): FusionWeights {
  if (typeof window === "undefined") return DEFAULT_FUSION_WEIGHTS;
  try {
    const raw = window.localStorage.getItem(WEIGHTS_KEY);
    if (!raw) return DEFAULT_FUSION_WEIGHTS;
    const parsed = JSON.parse(raw) as Partial<FusionWeights>;
    const d = Number(parsed.drawingWeight);
    const v = Number(parsed.voiceWeight);
    if (!Number.isFinite(d) || !Number.isFinite(v) || d < 0 || v < 0 || d + v === 0)
      return DEFAULT_FUSION_WEIGHTS;
    return { drawingWeight: d / (d + v), voiceWeight: v / (d + v) };
  } catch {
    return DEFAULT_FUSION_WEIGHTS;
  }
}

export function setFusionWeights(weights: FusionWeights): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
}

export const ASSESSMENT_STEPS = ["Drawing check", "Voice check", "Fusion analysis", "Result"] as const;
