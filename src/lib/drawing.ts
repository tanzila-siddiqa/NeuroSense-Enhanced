export type DrawingTask = "spiral" | "circle" | "meander";

export const DRAWING_TASKS = [
  {
    task: "spiral" as const,
    label: "Spiral",
    emoji: "🌀",
    instruction:
      "Trace the spiral naturally, following the faint guide.",
  },
  {
    task: "circle" as const,
    label: "Circle",
    emoji: "⭕",
    instruction:
      "Trace the circle naturally, following the faint guide.",
  },
  {
    task: "meander" as const,
    label: "Meander",
    emoji: "▣",
    instruction:
      "Trace the rectangular meander naturally, following the faint guide.",
  },
];

export interface StrokePoint {
  x: number;
  y: number;
  t: number;
}

export interface DrawingMetrics {
  durationMs: number;
  pointCount: number;
  strokeCount: number;

  // Movement
  pathLength: number;
  avgSpeed: number;
  speedVariability: number;

  // Acceleration
  avgAcceleration: number;
  accelerationVariability: number;

  // Jerk
  avgJerk: number;
  maxJerk: number;
  jerkVariability: number;

  // Pauses
  pauseCount: number;
  pauseDurationMs: number;

  // Path quality
  straightness: number;

  // Experimental movement index
  movementIrregularity: number;
}

function safeMean(values: number[]): number {
  if (values.length === 0) return 0;

  return (
    values.reduce(
      (sum, value) => sum + value,
      0,
    ) / values.length
  );
}

function safeStd(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = safeMean(values);

  const variance = safeMean(
    values.map((value) =>
      Math.pow(value - mean, 2),
    ),
  );

  return Math.sqrt(variance);
}

function distance(
  a: StrokePoint,
  b: StrokePoint,
): number {
  return Math.hypot(
    b.x - a.x,
    b.y - a.y,
  );
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

/**
 * Calculate movement characteristics from the
 * actual drawing trajectory.
 *
 * These features are engineering measurements.
 * They are NOT individually clinically validated
 * Parkinson's diagnostic biomarkers.
 */
export function computeMetrics(
  strokes: StrokePoint[][],
): DrawingMetrics {
  const validStrokes = strokes.filter(
    (stroke) => stroke.length >= 2,
  );

  const allPoints = validStrokes.flat();

  if (allPoints.length < 2) {
    return {
      durationMs: 0,
      pointCount: allPoints.length,
      strokeCount: validStrokes.length,

      pathLength: 0,
      avgSpeed: 0,
      speedVariability: 0,

      avgAcceleration: 0,
      accelerationVariability: 0,

      avgJerk: 0,
      maxJerk: 0,
      jerkVariability: 0,

      pauseCount: 0,
      pauseDurationMs: 0,

      straightness: 0,
      movementIrregularity: 0,
    };
  }

  let totalPathLength = 0;

  const speeds: number[] = [];
  const accelerations: number[] = [];
  const jerks: number[] = [];

  let pauseCount = 0;
  let pauseDurationMs = 0;

  // --------------------------------------------------
  // PROCESS TRAJECTORY
  // --------------------------------------------------

  for (const stroke of validStrokes) {
    const strokeSpeeds: number[] = [];
    const strokeAccelerations: number[] = [];

    // ----------------------------------------------
    // VELOCITY
    // ----------------------------------------------

    for (
      let i = 1;
      i < stroke.length;
      i++
    ) {
      const previous = stroke[i - 1];
      const current = stroke[i];

      if (!previous || !current) continue;

      const dtMs = Math.max(
        current.t - previous.t,
        1,
      );

      const dt = dtMs / 1000;

      const d = distance(
        previous,
        current,
      );

      totalPathLength += d;

      const speed = d / dt;

      speeds.push(speed);
      strokeSpeeds.push(speed);

      // --------------------------------------------
      // PAUSE DETECTION
      // --------------------------------------------

      if (speed < 5) {
        pauseCount++;
        pauseDurationMs += dtMs;
      }
    }

    // ----------------------------------------------
    // ACCELERATION
    // ----------------------------------------------

    for (
      let i = 1;
      i < strokeSpeeds.length;
      i++
    ) {
      const previousSpeed =
        strokeSpeeds[i - 1];

      const currentSpeed =
        strokeSpeeds[i];

      const previousPoint =
        stroke[i];

      const currentPoint =
        stroke[i + 1];

      if (
        previousSpeed === undefined ||
        currentSpeed === undefined ||
        !previousPoint ||
        !currentPoint
      ) {
        continue;
      }

      const dt = Math.max(
        (currentPoint.t -
          previousPoint.t) /
          1000,
        0.001,
      );

      /*
       * IMPORTANT:
       * We keep the acceleration SIGN.
       *
       * Positive = speeding up
       * Negative = slowing down
       *
       * This is required before calculating jerk.
       */

      const acceleration =
        (currentSpeed -
          previousSpeed) /
        dt;

      accelerations.push(
        acceleration,
      );

      strokeAccelerations.push(
        acceleration,
      );
    }

    // ----------------------------------------------
    // JERK
    // ----------------------------------------------

    for (
      let i = 1;
      i < strokeAccelerations.length;
      i++
    ) {
      const previousAcceleration =
        strokeAccelerations[i - 1];

      const currentAcceleration =
        strokeAccelerations[i];

      const previousPoint =
        stroke[i + 1];

      const currentPoint =
        stroke[i + 2];

      if (
        previousAcceleration ===
          undefined ||
        currentAcceleration ===
          undefined ||
        !previousPoint ||
        !currentPoint
      ) {
        continue;
      }

      const dt = Math.max(
        (currentPoint.t -
          previousPoint.t) /
          1000,
        0.001,
      );

      const jerk =
        (currentAcceleration -
          previousAcceleration) /
        dt;

      jerks.push(
        Math.abs(jerk),
      );
    }
  }

  // --------------------------------------------------
  // DURATION
  // --------------------------------------------------

  const firstPoint = allPoints[0];
  const lastPoint =
    allPoints[allPoints.length - 1];

  const durationMs =
    firstPoint && lastPoint
      ? Math.max(
          lastPoint.t -
            firstPoint.t,
          0,
        )
      : 0;

  // --------------------------------------------------
  // SPEED
  // --------------------------------------------------

  const avgSpeed =
    safeMean(speeds);

  const speedStd =
    safeStd(speeds);

  const speedVariability =
    avgSpeed > 0
      ? speedStd / avgSpeed
      : 0;

  // --------------------------------------------------
  // ACCELERATION
  // --------------------------------------------------

  const absoluteAccelerations =
    accelerations.map(Math.abs);

  const avgAcceleration =
    safeMean(
      absoluteAccelerations,
    );

  const accelerationVariability =
    avgAcceleration > 0
      ? safeStd(
          absoluteAccelerations,
        ) /
        avgAcceleration
      : 0;

  // --------------------------------------------------
  // JERK
  // --------------------------------------------------

  const avgJerk =
    safeMean(jerks);

  const maxJerk =
    jerks.length > 0
      ? Math.max(...jerks)
      : 0;

  const jerkVariability =
    avgJerk > 0
      ? safeStd(jerks) /
        avgJerk
      : 0;

  // --------------------------------------------------
  // STRAIGHTNESS
  // --------------------------------------------------

  let totalDirectDistance = 0;

  for (const stroke of validStrokes) {
    const first = stroke[0];
    const last =
      stroke[stroke.length - 1];

    if (!first || !last) continue;

    totalDirectDistance +=
      distance(first, last);
  }

  const straightness =
    totalPathLength > 0
      ? clamp(
          totalDirectDistance /
            totalPathLength,
          0,
          1,
        )
      : 0;

  // --------------------------------------------------
  // PAUSE RATIO
  // --------------------------------------------------

  const pauseRatio =
    durationMs > 0
      ? clamp(
          pauseDurationMs /
            durationMs,
          0,
          1,
        )
      : 0;

  // --------------------------------------------------
  // MOVEMENT IRREGULARITY
  // --------------------------------------------------
  //
  // Engineering index only.
  //
  // It combines:
  //   speed variability
  //   acceleration variability
  //   jerk variability
  //   pauses
  //
  // It is NOT a medical diagnosis.
  // --------------------------------------------------

  const speedScore =
    clamp(
      speedVariability / 1.5,
      0,
      1,
    );

  const accelerationScore =
    clamp(
      accelerationVariability / 2,
      0,
      1,
    );

  const jerkScore =
    clamp(
      jerkVariability / 2,
      0,
      1,
    );

  const movementScore =
    speedScore * 25 +
    accelerationScore * 25 +
    jerkScore * 30 +
    pauseRatio * 20;

  const movementIrregularity =
    Math.round(
      movementScore * 100,
    ) / 100;

  return {
    durationMs,
    pointCount: allPoints.length,
    strokeCount: validStrokes.length,

    pathLength: totalPathLength,
    avgSpeed,

    speedVariability,

    avgAcceleration,
    accelerationVariability,

    avgJerk,
    maxJerk,
    jerkVariability,

    pauseCount,
    pauseDurationMs,

    straightness,
    movementIrregularity,
  };
}

// --------------------------------------------------
// RECENT SPEED
// --------------------------------------------------

export function recentSpeed(
  strokes: StrokePoint[][],
): number {
  const points = strokes.flat();

  if (points.length < 2) return 0;

  const recent =
    points.slice(-10);

  let distanceTotal = 0;
  let timeTotal = 0;

  for (
    let i = 1;
    i < recent.length;
    i++
  ) {
    const previous =
      recent[i - 1];

    const current =
      recent[i];

    if (!previous || !current)
      continue;

    distanceTotal +=
      distance(
        previous,
        current,
      );

    timeTotal += Math.max(
      current.t -
        previous.t,
      1,
    );
  }

  if (timeTotal <= 0)
    return 0;

  return (
    distanceTotal /
    (timeTotal / 1000)
  );
}

// --------------------------------------------------
// GUIDE PATH
// --------------------------------------------------

export function guidePath(
  task: DrawingTask,
  width: number,
  height: number,
): string {
  const cx = width / 2;
  const cy = height / 2;

  // ------------------------------------------------
  // CIRCLE
  // ------------------------------------------------

  if (task === "circle") {
    const radius =
      Math.min(
        width,
        height,
      ) * 0.32;

    return [
      `M ${cx + radius} ${cy}`,
      `A ${radius} ${radius} 0 1 1 ${
        cx - radius
      } ${cy}`,
      `A ${radius} ${radius} 0 1 1 ${
        cx + radius
      } ${cy}`,
    ].join(" ");
  }

  // ------------------------------------------------
  // SPIRAL
  // ------------------------------------------------

  if (task === "spiral") {
    const points: string[] =
      [];

    const turns = 3.5;

    const maxRadius =
      Math.min(
        width,
        height,
      ) * 0.40;

    const steps = 220;

    for (
      let i = 0;
      i <= steps;
      i++
    ) {
      const progress =
        i / steps;

      const angle =
        progress *
        turns *
        Math.PI *
        2;

      const radius =
        maxRadius *
        progress;

      const x =
        cx +
        radius *
          Math.cos(angle);

      const y =
        cy +
        radius *
          Math.sin(angle);

      points.push(
        i === 0
          ? `M ${x} ${y}`
          : `L ${x} ${y}`,
      );
    }

    return points.join(" ");
  }

  // ------------------------------------------------
  // MEANDER
  // Rectangular inward path
  // ------------------------------------------------

  const margin = 35;

  let left = margin;
  let right =
    width - margin;

  let top = margin;
  let bottom =
    height - margin;

  const step = 22;

  const points: string[] =
    [];

  points.push(
    `M ${left} ${top}`,
  );

  while (
    right - left > 40 &&
    bottom - top > 40
  ) {
    points.push(
      `L ${right} ${top}`,
    );

    points.push(
      `L ${right} ${bottom}`,
    );

    points.push(
      `L ${left} ${bottom}`,
    );

    left += step;
    bottom -= step;

    if (
      bottom - top <= 20
    ) {
      break;
    }

    points.push(
      `L ${left} ${
        top + step
      }`,
    );

    top += step;
    right -= step;

    if (
      right - left <= 20
    ) {
      break;
    }

    points.push(
      `L ${right} ${top}`,
    );
  }

  return points.join(" ");
}

// --------------------------------------------------
// RISK CATEGORY
// --------------------------------------------------

export function riskCategory(
  score: number,
): "normal" | "mild" | "high" {
  if (score < 35)
    return "normal";

  if (score < 65)
    return "mild";

  return "high";
}

// --------------------------------------------------
// LEGACY FUNCTION
// --------------------------------------------------

export function generateDemoScore(
  metrics: DrawingMetrics,
): number {
  return clamp(
    metrics.movementIrregularity,
    0,
    100,
  );
}