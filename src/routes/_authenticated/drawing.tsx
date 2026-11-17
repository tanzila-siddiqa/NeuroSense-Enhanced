import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/neuro/PageHeader";
import { Disclaimer } from "@/components/neuro/Disclaimer";
import { DrawingCanvas } from "@/components/neuro/DrawingCanvas";
import { AssessmentSteps } from "@/components/neuro/AssessmentSteps";
import { Button } from "@/components/ui/button";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import {
  validateAssessmentSearch,
} from "@/lib/assessment";

import { predictDrawing } from "@/lib/ml";

import {
  DRAWING_TASKS,
  riskCategory,
  type DrawingMetrics,
} from "@/lib/drawing";

export const Route = createFileRoute(
  "/_authenticated/drawing"
)({
  validateSearch: validateAssessmentSearch,

  head: () => ({
    meta: [
      {
        title: "Drawing Check-In — NeuroSense",
      },
      {
        name: "description",
        content:
          "Complete three short tracing activities — spiral, circle and meander — with movement analysis and AI screening estimates.",
      },
      {
        property: "og:title",
        content:
          "Drawing Check-In — NeuroSense",
      },
      {
        property: "og:description",
        content:
          "Three tracing activities with movement analysis. AI screening estimates only — never a diagnosis.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ],
  }),

  component: DrawingFlow,
});

interface TaskResult {
  task: string;
  label: string;
  metrics: DrawingMetrics;
  probability: number;
  confidence: number;
}

type Stage =
  | "draw"
  | "processing"
  | "result"
  | "summary";

function DrawingFlow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const inAssessment =
    search.flow === "assessment";

  const [index, setIndex] =
    useState(0);

  const [stage, setStage] =
    useState<Stage>("draw");

  const [results, setResults] =
    useState<TaskResult[]>([]);

  const [sessionId, setSessionId] =
    useState<string | null>(
      search.session ?? null
    );

  const current =
    DRAWING_TASKS[index]!;

  const latest =
    results[results.length - 1];

  // --------------------------------------------------
  // CREATE / GET SCREENING SESSION
  // --------------------------------------------------

  const ensureScreeningSession =
    async () => {
      if (sessionId) {
        return sessionId;
      }

      if (!user) {
        return null;
      }

      const { data, error } =
        await supabase
          .from("screening_sessions")
          .insert({
            user_id: user.id,
            session_type:
              inAssessment
                ? "combined"
                : "drawing",
            status: "in_progress",
          })
          .select("id")
          .single();

      if (error || !data) {
        console.error(
          "Unable to create screening session:",
          error
        );

        return null;
      }

      setSessionId(data.id);

      return data.id;
    };

  // --------------------------------------------------
  // FINISH DRAWING
  // --------------------------------------------------

  const handleFinish = async (
    metrics: DrawingMetrics,
    blob: Blob
  ) => {
    if (!user) {
      return;
    }

    setStage("processing");

    let score: {
      probability: number;
      confidence: number;
    };

    // ------------------------------------------------
    // REAL DRAWING ML PREDICTION
    // ------------------------------------------------

    try {
      const prediction =
        await predictDrawing(
          blob,
          current.task
        );

      console.log(
        "[DRAWING] prediction:",
        prediction
      );

      /*
       * probability and confidence come
       * directly from the ML API.
       *
       * Keep probability unchanged.
       * If confidence is missing/null, calculate
       * it from probability so Supabase never
       * receives a null confidence.
       */

      const probability =
        Number(prediction.probability);

      const rawConfidence =
        Number(prediction.confidence);

      const confidence =
        Number.isFinite(rawConfidence)
          ? rawConfidence
          : Math.max(
              probability,
              1 - probability
            );

      score = {
        probability:
          Math.round(
            probability * 10
          ) / 10,

        confidence:
          Math.round(
            confidence * 10
          ) / 10,
      };

      console.log(
        "[DRAWING] score:",
        score
      );
    } catch (error) {
      console.error(
        "Drawing ML prediction failed:",
        error
      );

      toast.error(
        "Unable to analyze the drawing.",
        {
          description:
            "Please make sure the NeuroSense ML service is running and try again.",
        }
      );

      setStage("draw");

      return;
    }

    // ------------------------------------------------
    // SAVE DRAWING + MOVEMENT DATA
    // ------------------------------------------------

    try {
      const screeningId =
        await ensureScreeningSession();

      if (!screeningId) {
        throw new Error(
          "Screening session was not created."
        );
      }

      const path =
        `${user.id}/${Date.now()}-${current.task}.png`;

      // ----------------------------------------------
      // SAVE DRAWING IMAGE
      // ----------------------------------------------

      const {
        error: uploadError,
      } = await supabase.storage
        .from("drawings")
        .upload(
          path,
          blob,
          {
            contentType:
              "image/png",
            upsert: false,
          }
        );

      if (uploadError) {
        throw uploadError;
      }

      // ----------------------------------------------
      // SAVE DRAWING SESSION
      // ----------------------------------------------

      const {
        data: drawingSession,
        error: sessionError,
      } = await supabase
        .from("drawing_sessions")
        .insert({
          user_id: user.id,

          screening_session_id:
            screeningId,

          task: current.task,

          image_path: path,

          duration_ms:
            Math.round(
              metrics.durationMs
            ),

          point_count:
            metrics.pointCount,

          stroke_count:
            metrics.strokeCount,

          avg_speed:
            metrics.avgSpeed,
        })
        .select("id")
        .single();

      if (
        sessionError ||
        !drawingSession
      ) {
        throw (
          sessionError ??
          new Error(
            "Drawing session was not created."
          )
        );
      }

      // ----------------------------------------------
      // SAVE REAL ML RESULT
      // ----------------------------------------------

      const {
        error: resultError,
      } = await supabase
        .from("drawing_results")
        .insert({
          user_id: user.id,

          drawing_session_id:
            drawingSession.id,

          probability:
            score.probability,

          /*
           * IMPORTANT:
           * Supabase requires confidence to be
           * NOT NULL.
           */
          confidence:
            score.confidence,

          // Real ML prediction
          is_demo: false,
        });

      if (resultError) {
        throw resultError;
      }

      console.log(
        "[DRAWING] result saved successfully"
      );
    } catch (error) {
      console.error(
        "Saving drawing result failed:",
        error
      );

      const details =
        error instanceof Error
          ? error.message
          : JSON.stringify(error);

      toast.error(
        "Drawing analyzed, but saving the result failed.",
        {
          description: details,
        }
      );
    }

    // ------------------------------------------------
    // SHOW RESULT
    // ------------------------------------------------

    window.setTimeout(() => {
      setResults((previous) => [
        ...previous,

        {
          task: current.task,

          label: current.label,

          metrics,

          ...score,
        },
      ]);

      setStage("result");
    }, 1600);
  };

  // --------------------------------------------------
  // GO TO VOICE
  // --------------------------------------------------

  const goToVoice = () => {
    void navigate({
      to: "/voice",

      search: {
        flow: "assessment",

        ...(sessionId
          ? {
              session: sessionId,
            }
          : {}),
      },
    });
  };

  // --------------------------------------------------
  // NEXT DRAWING
  // --------------------------------------------------

  const next = async () => {
    if (
      index <
      DRAWING_TASKS.length - 1
    ) {
      setIndex(
        (previous) =>
          previous + 1
      );

      setStage("draw");

      return;
    }

    // In standalone drawing mode,
    // complete the screening session.

    if (
      sessionId &&
      !inAssessment
    ) {
      await supabase
        .from("screening_sessions")
        .update({
          status: "completed",

          completed_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          sessionId
        );
    }

    setStage("summary");
  };

  // --------------------------------------------------
  // AUTOMATIC VOICE TRANSITION
  // --------------------------------------------------

  useEffect(() => {
    if (
      stage !== "summary" ||
      !inAssessment
    ) {
      return;
    }

    const timer =
      window.setTimeout(
        goToVoice,
        2600
      );

    return () =>
      window.clearTimeout(
        timer
      );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stage,
    inAssessment,
    sessionId,
  ]);

  // ==================================================
  // SUMMARY
  // ==================================================

  if (stage === "summary") {
    const averageProbability =
      results.reduce(
        (sum, result) =>
          sum +
          result.probability,
        0
      ) /
      Math.max(
        results.length,
        1
      );

    return (
      <main className="pb-8">
        <PageHeader
          eyebrow="Drawing summary"
          title="All three tracings done 🎉"
          subtitle={
            inAssessment
              ? "Next up: a short voice check. We'll combine both before showing your result."
              : "Here's what today's drawing check-in produced."
          }
        />

        {inAssessment && (
          <AssessmentSteps
            current={1}
          />
        )}

        <section className="mx-auto w-full max-w-2xl space-y-3 px-5 pt-4">

          {/* OVERALL DRAWING RESULT */}

          <div className="surface-card p-5">
            <p className="text-sm text-muted-foreground">
              Average estimated probability
            </p>

            <p className="font-display text-4xl font-semibold tabular-nums">
              {averageProbability.toFixed(
                1
              )}
              %
            </p>

            <p className="mt-1 text-sm font-medium text-primary">
              {riskCategory(
                averageProbability
              )}{" "}
              range
            </p>
          </div>

          {/* EACH DRAWING */}

          {results.map(
            (result) => (
              <article
                key={result.task}
                className="surface-card p-4"
              >
                <div className="flex items-center justify-between">

                  <div>
                    <p className="font-display text-sm font-semibold">
                      {result.label}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {(
                        result.metrics
                          .durationMs /
                        1000
                      ).toFixed(
                        1
                      )}
                      s ·{" "}
                      {
                        result.metrics
                          .strokeCount
                      }{" "}
                      strokes ·{" "}
                      {result.metrics.avgSpeed.toFixed(
                        1
                      )}{" "}
                      px/s
                    </p>
                  </div>

                  <p className="font-display text-lg font-semibold tabular-nums">
                    {result.probability.toFixed(
                      1
                    )}
                    %
                  </p>

                </div>

                {/* MOVEMENT FEATURES */}

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">

                  <div className="rounded-lg bg-muted/60 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">
                      Speed variation
                    </p>

                    <p className="text-sm font-semibold tabular-nums">
                      {result.metrics.speedVariability.toFixed(
                        2
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/60 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">
                      Acceleration
                    </p>

                    <p className="text-sm font-semibold tabular-nums">
                      {result.metrics.avgAcceleration.toFixed(
                        1
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/60 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">
                      Jerk
                    </p>

                    <p className="text-sm font-semibold tabular-nums">
                      {result.metrics.avgJerk.toFixed(
                        1
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/60 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">
                      Pauses
                    </p>

                    <p className="text-sm font-semibold tabular-nums">
                      {result.metrics.pauseCount}
                    </p>
                  </div>

                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">

                  <div className="rounded-lg bg-muted/60 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">
                      Jerk variation
                    </p>

                    <p className="text-sm font-semibold tabular-nums">
                      {result.metrics.jerkVariability.toFixed(
                        2
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/60 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">
                      Max jerk
                    </p>

                    <p className="text-sm font-semibold tabular-nums">
                      {result.metrics.maxJerk.toFixed(
                        1
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/60 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">
                      Pause time
                    </p>

                    <p className="text-sm font-semibold tabular-nums">
                      {(
                        result.metrics
                          .pauseDurationMs /
                        1000
                      ).toFixed(
                        1
                      )}
                      s
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/60 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">
                      Irregularity
                    </p>

                    <p className="text-sm font-semibold tabular-nums">
                      {result.metrics.movementIrregularity.toFixed(
                        1
                      )}
                    </p>
                  </div>

                </div>
              </article>
            )
          )}

          <Disclaimer text="AI screening estimates only — not a medical diagnosis. Movement features are experimental measurements and are not individually diagnostic." />

          {inAssessment ? (
            <Button
              className="h-12 w-full rounded-xl"
              onClick={goToVoice}
            >
              Continue to voice check

              <ArrowRight
                aria-hidden="true"
                className="size-4"
              />
            </Button>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">

              <Button
                asChild
                variant="outline"
                className="h-11 rounded-xl"
              >
                <Link to="/progress">
                  View progress
                </Link>
              </Button>

              <Button
                className="h-11 rounded-xl"
                onClick={() =>
                  void navigate({
                    to: "/checkin",
                  })
                }
              >
                Back to check-in
              </Button>

            </div>
          )}

        </section>
      </main>
    );
  }

  // ==================================================
  // DRAW / PROCESSING / RESULT
  // ==================================================

  return (
    <main className="pb-8">

      <PageHeader
        eyebrow={`Drawing ${
          index + 1
        } of ${
          DRAWING_TASKS.length
        }`}
        title={`${current.emoji} ${current.label}`}
        subtitle="Draw naturally. Don't worry about perfection."
      />

      {inAssessment && (
        <AssessmentSteps
          current={0}
        />
      )}

      <section className="mx-auto w-full max-w-2xl space-y-4 px-5 pt-4">

        {/* ==========================================
            DRAWING
            ========================================== */}

        {stage === "draw" && (
          <>
            <p className="text-sm text-muted-foreground">
              {current.instruction}
            </p>

            <DrawingCanvas
              key={current.task}
              task={current.task}
              onFinish={
                handleFinish
              }
            />

            <Disclaimer text="Movement is analyzed from the drawing trajectory. AI screening estimates only — not a medical diagnosis." />
          </>
        )}

        {/* ==========================================
            PROCESSING
            ========================================== */}

        {stage ===
          "processing" && (
          <div className="surface-card flex flex-col items-center gap-3 p-10 text-center">

            <Loader2
              aria-hidden="true"
              className="size-8 animate-spin text-primary motion-reduce:animate-none"
            />

            <p className="font-display text-base font-semibold">
              Analyzing your movement pattern…
            </p>

            <p className="text-sm text-muted-foreground">
              This only takes a moment.
            </p>

          </div>
        )}

        {/* ==========================================
            RESULT
            ========================================== */}

        {stage ===
          "result" &&
          latest && (
            <>
              <div className="surface-card p-6">

                <div className="flex items-center justify-end gap-3">
                  <Sparkles
                    aria-hidden="true"
                    className="size-5 text-lavender"
                  />
                </div>

                <p className="mt-4 text-sm text-muted-foreground">
                  {latest.label} —
                  estimated probability
                </p>

                <p className="font-display text-5xl font-semibold tabular-nums">
                  {latest.probability.toFixed(
                    1
                  )}
                  %
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Confidence{" "}
                  {latest.confidence.toFixed(
                    1
                  )}
                  % ·{" "}
                  {riskCategory(
                    latest.probability
                  )}{" "}
                  range
                </p>

                {/* BASIC METRICS */}

                <dl className="mt-4 grid grid-cols-3 gap-3 text-center">

                  <div className="rounded-xl bg-muted/60 px-2 py-2">
                    <dt className="text-[11px] text-muted-foreground">
                      Duration
                    </dt>

                    <dd className="font-display text-base font-semibold tabular-nums">
                      {(
                        latest.metrics
                          .durationMs /
                        1000
                      ).toFixed(
                        1
                      )}
                      s
                    </dd>
                  </div>

                  <div className="rounded-xl bg-muted/60 px-2 py-2">
                    <dt className="text-[11px] text-muted-foreground">
                      Strokes
                    </dt>

                    <dd className="font-display text-base font-semibold tabular-nums">
                      {
                        latest.metrics
                          .strokeCount
                      }
                    </dd>
                  </div>

                  <div className="rounded-xl bg-muted/60 px-2 py-2">
                    <dt className="text-[11px] text-muted-foreground">
                      Speed
                    </dt>

                    <dd className="font-display text-base font-semibold tabular-nums">
                      {latest.metrics.avgSpeed.toFixed(
                        1
                      )}
                      <span className="text-xs">
                        {" "}
                        px/s
                      </span>
                    </dd>
                  </div>

                </dl>

                {/* MOVEMENT FEATURES */}

                <div className="mt-4 grid grid-cols-2 gap-2">

                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground">
                      Speed variability
                    </p>

                    <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                      {latest.metrics.speedVariability.toFixed(
                        2
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground">
                      Acceleration
                    </p>

                    <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                      {latest.metrics.avgAcceleration.toFixed(
                        1
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground">
                      Average jerk
                    </p>

                    <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                      {latest.metrics.avgJerk.toFixed(
                        1
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground">
                      Maximum jerk
                    </p>

                    <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                      {latest.metrics.maxJerk.toFixed(
                        1
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground">
                      Jerk variability
                    </p>

                    <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                      {latest.metrics.jerkVariability.toFixed(
                        2
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground">
                      Pauses
                    </p>

                    <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                      {
                        latest.metrics
                          .pauseCount
                      }
                    </p>
                  </div>

                </div>

              </div>

              <Disclaimer text="AI screening estimate only — not a medical diagnosis. Movement features shown here are experimental measurements and are not individually diagnostic." />

              <Button
                className="h-12 w-full rounded-xl"
                onClick={() =>
                  void next()
                }
              >
                {index <
                DRAWING_TASKS.length -
                  1
                  ? "Next drawing"
                  : "See summary"}

                <ArrowRight
                  aria-hidden="true"
                  className="size-4"
                />
              </Button>
            </>
          )}

      </section>
    </main>
  );
}