export type RiskCategory = "Low" | "Moderate" | "Elevated";

export interface FusionInput {
  drawingProbability: number | null;
  voiceProbability: number | null;
  drawingConfidence: number | null;
  voiceConfidence: number | null;
  /** Equal weighting today; kept configurable so an admin can tune it later. */
  drawingWeight?: number;
  voiceWeight?: number;
}

export interface FusionOutput {
  overallProbability: number;
  confidence: number;
  category: RiskCategory;
  drawingWeight: number;
  voiceWeight: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export function riskCategory(probability: number): RiskCategory {
  if (probability < 60) return "Low";
  if (probability < 75) return "Moderate";
  return "Elevated";
}

/** Weighted average fusion of the drawing and voice screening estimates. */
export function fuseScores({
  drawingProbability,
  voiceProbability,
  drawingConfidence,
  voiceConfidence,
  drawingWeight = 0.5,
  voiceWeight = 0.5,
}: FusionInput): FusionOutput | null {
  const parts: { value: number; confidence: number; weight: number }[] = [];
  if (drawingProbability != null)
    parts.push({
      value: drawingProbability,
      confidence: drawingConfidence ?? 80,
      weight: drawingWeight,
    });
  if (voiceProbability != null)
    parts.push({ value: voiceProbability, confidence: voiceConfidence ?? 80, weight: voiceWeight });
  if (parts.length === 0) return null;

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0) || 1;
  const overall = parts.reduce((sum, p) => sum + p.value * p.weight, 0) / totalWeight;
  const confidence = parts.reduce((sum, p) => sum + p.confidence * p.weight, 0) / totalWeight;
  // A single modality is inherently less certain than both together.
  const penalty = parts.length === 1 ? 12 : 0;

  return {
    overallProbability: round1(overall),
    confidence: round1(Math.max(40, confidence - penalty)),
    category: riskCategory(overall),
    drawingWeight,
    voiceWeight,
  };
}

export function plainLanguageSummary(fusion: FusionOutput, hasBoth: boolean): string {
  const both = hasBoth ? "your drawing and voice activities" : "the activity you completed";
  if (fusion.category === "Low")
    return `Combining ${both}, the model produced a lower AI-estimated probability today. Patterns like these are common and vary from day to day.`;
  if (fusion.category === "Moderate")
    return `Combining ${both}, the model produced a middle-range AI-estimated probability today. Single check-ins move around a lot — trends over weeks are more informative than one result.`;
  return `Combining ${both}, the model produced a higher AI-estimated probability today. That is a signal to keep tracking and, if anything is worrying you, to talk it through with a qualified healthcare professional.`;
}

export function recommendationsFor(category: RiskCategory): string[] {
  const shared = [
    "Keep check-ins short and regular — a steady rhythm shows patterns better than one-off sessions.",
    "Do your check-in at a similar time of day, when you're rested rather than rushed.",
  ];
  if (category === "Low")
    return [
      ...shared,
      "Carry on with your usual healthy routines: movement, sleep and hydration.",
      "Repeat this screening in a week or two to build up your trend line.",
    ];
  if (category === "Moderate")
    return [
      ...shared,
      "Repeat the screening in a few days to see whether the estimate settles.",
      "Note anything that might affect the result — tiredness, caffeine, a cold, or a noisy room.",
      "If you have ongoing concerns about your movement or voice, consider speaking with a healthcare professional.",
    ];
  return [
    ...shared,
    "Repeat the screening soon under calm conditions to check whether the estimate repeats.",
    "Write down anything you've noticed in daily life — handwriting, tremor, quieter speech — so you can describe it accurately.",
    "Consider speaking with a qualified healthcare professional about what you've noticed. NeuroSense cannot diagnose anything.",
  ];
}

export interface DailyTip {
  emoji: string;
  title: string;
  body: string;
}

const DAILY_TIPS: DailyTip[] = [
  {
    emoji: "🚶",
    title: "Move a little, often",
    body: "A short daily walk supports balance and coordination more reliably than one long session a week.",
  },
  {
    emoji: "😴",
    title: "Protect your sleep",
    body: "Tiredness affects both fine motor control and voice. A consistent bedtime makes your check-ins more comparable.",
  },
  {
    emoji: "🗣️",
    title: "Use your voice",
    body: "Reading aloud for a couple of minutes a day exercises the muscles behind clear, strong speech.",
  },
  {
    emoji: "✍️",
    title: "Keep writing by hand",
    body: "A few handwritten lines each day is gentle practice for the small, precise movements of the hand.",
  },
  {
    emoji: "💧",
    title: "Stay hydrated",
    body: "Hydration helps your vocal cords, so recordings sound closer to your natural voice.",
  },
  {
    emoji: "🧘",
    title: "Unclench before you start",
    body: "Thirty seconds of slow breathing before a check-in reduces tension that can show up as shakiness.",
  },
  {
    emoji: "🧩",
    title: "Give your brain variety",
    body: "Puzzles, music or learning something new keep you engaged — good for mood as well as the mind.",
  },
];

/** Deterministic per-day pick so the tip feels like "today's tip", not a random shuffle. */
export function dailyTips(date = new Date(), count = 3): DailyTip[] {
  const dayIndex = Math.floor(date.getTime() / 86_400_000);
  return Array.from(
    { length: Math.min(count, DAILY_TIPS.length) },
    (_, i) => DAILY_TIPS[(dayIndex + i) % DAILY_TIPS.length]!,
  );
}
