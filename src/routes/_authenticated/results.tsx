import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  HeartHandshake,
  Lightbulb,
  Loader2,
  Sparkles,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/neuro/PageHeader";
import { Disclaimer } from "@/components/neuro/Disclaimer";
import { Gauge } from "@/components/neuro/Gauge";
import { AssessmentSteps } from "@/components/neuro/AssessmentSteps";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import {
  dailyTips,
  fuseScores,
  plainLanguageSummary,
  recommendationsFor,
} from "@/lib/fusion";

import {
  getFusionWeights,
  validateAssessmentSearch,
} from "@/lib/assessment";

export const Route = createFileRoute("/_authenticated/results")({
  validateSearch: validateAssessmentSearch,

  head: () => ({
    meta: [
      {
        title: "Your combined results — NeuroSense",
      },
      {
        name: "description",
        content:
          "See your drawing and voice check-ins combined into one AI screening estimate, with gentle recommendations and daily tips.",
      },
      {
        property: "og:title",
        content: "Your combined results — NeuroSense",
      },
      {
        property: "og:description",
        content:
          "Drawing and voice screening estimates fused into one overview — never a diagnosis.",
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

  component: ResultsPage,
});

interface ModalityScore {
  id: string;
  probability: number;
  confidence: number;
}

/**
 * Average the three drawing tasks into one
 * drawing-model score for the fusion step.
 */
function averageScores(
  rows: ModalityScore[]
): ModalityScore | null {
  if (rows.length === 0) {
    return null;
  }

  const probability =
    rows.reduce(
      (s, r) => s + r.probability,
      0
    ) / rows.length;

  const confidence =
    rows.reduce(
      (s, r) => s + r.confidence,
      0
    ) / rows.length;

  return {
    id: rows[0]!.id,
    probability:
      Math.round(probability * 10) / 10,
    confidence:
      Math.round(confidence * 10) / 10,
  };
}

function ResultsPage() {
  const { user } = useAuth();

  const { session: sessionId } =
    Route.useSearch();

  const savedFor =
    useRef<string | null>(null);

  const [analysing, setAnalysing] =
    useState(Boolean(sessionId));

  /*
   * ---------------------------------------------------------
   * LOAD DRAWING + VOICE RESULTS
   * ---------------------------------------------------------
   */

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "assessment-results",
      user?.id,
      sessionId ?? "latest",
    ],

    enabled: Boolean(user),

    queryFn: async () => {
      /*
       * GUIDED ASSESSMENT
       *
       * Use the exact screening session.
       */

      if (sessionId) {
        const [drawing, voice] =
          await Promise.all([
            supabase
              .from("drawing_results")
              .select(
                "id, probability, confidence, created_at, drawing_sessions!inner(screening_session_id)"
              )
              .eq(
                "drawing_sessions.screening_session_id",
                sessionId
              )
              .order("created_at", {
                ascending: true,
              }),

            supabase
              .from("voice_results")
              .select(
                "id, probability, confidence, created_at, voice_sessions!inner(screening_session_id)"
              )
              .eq(
                "voice_sessions.screening_session_id",
                sessionId
              )
              .order("created_at", {
                ascending: false,
              }),
          ]);

        if (drawing.error) {
          throw drawing.error;
        }

        if (voice.error) {
          throw voice.error;
        }

        const drawingRows =
          (drawing.data ?? []).map(
            (r) => ({
              id: r.id,
              probability:
                Number(r.probability),
              confidence:
                Number(r.confidence),
            })
          );

        const voiceRow =
          voice.data?.[0]
            ? {
                id: voice.data[0].id,
                probability:
                  Number(
                    voice.data[0]
                      .probability
                  ),
                confidence:
                  Number(
                    voice.data[0]
                      .confidence
                  ),
              }
            : null;

        return {
          drawing:
            averageScores(
              drawingRows
            ),

          voice: voiceRow,

          drawingCount:
            drawingRows.length,
        };
      }

      /*
       * NORMAL CHECK-IN
       *
       * Use the latest drawing and voice results.
       */

      const [drawing, voice] =
        await Promise.all([
          supabase
            .from("drawing_results")
            .select(
              "id, probability, confidence, created_at"
            )
            .order("created_at", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle(),

          supabase
            .from("voice_results")
            .select(
              "id, probability, confidence, created_at"
            )
            .order("created_at", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle(),
        ]);

      if (drawing.error) {
        throw drawing.error;
      }

      if (voice.error) {
        throw voice.error;
      }

      return {
        drawing: drawing.data
          ? {
              id: drawing.data.id,
              probability:
                Number(
                  drawing.data
                    .probability
                ),
              confidence:
                Number(
                  drawing.data
                    .confidence
                ),
            }
          : null,

        voice: voice.data
          ? {
              id: voice.data.id,
              probability:
                Number(
                  voice.data
                    .probability
                ),
              confidence:
                Number(
                  voice.data
                    .confidence
                ),
            }
          : null,

        drawingCount:
          drawing.data ? 1 : 0,
      };
    },
  });

  /*
   * ---------------------------------------------------------
   * CHECK WHETHER BOTH MODELS HAVE RESULTS
   * ---------------------------------------------------------
   */

  const hasBoth = Boolean(
    data?.drawing &&
      data?.voice
  );

  /*
   * ---------------------------------------------------------
   * FUSION
   * ---------------------------------------------------------
   */

  const fusion = useMemo(() => {
    if (!data) {
      return null;
    }

    /*
     * Guided assessment should only show the
     * final result after BOTH models have run.
     */
    if (
      sessionId &&
      !hasBoth
    ) {
      return null;
    }

    const weights =
      getFusionWeights();

    return fuseScores({
      drawingProbability:
        data.drawing
          ?.probability ?? null,

      voiceProbability:
        data.voice
          ?.probability ?? null,

      drawingConfidence:
        data.drawing
          ?.confidence ?? null,

      voiceConfidence:
        data.voice
          ?.confidence ?? null,

      drawingWeight:
        weights.drawingWeight,

      voiceWeight:
        weights.voiceWeight,
    });
  }, [
    data,
    sessionId,
    hasBoth,
  ]);

  /*
   * ---------------------------------------------------------
   * FUSION ANALYSIS ANIMATION
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!analysing) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          setAnalysing(false);
        },
        1800
      );

    return () =>
      window.clearTimeout(timer);
  }, [analysing]);

  /*
   * ---------------------------------------------------------
   * SAVE FUSION RESULT
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   * We now WAIT for Supabase and explicitly
   * check the error instead of using `void`.
   *
   * This makes sure the fusion result is actually
   * written to `fusion_results`.
   */

  useEffect(() => {
    if (
      !user ||
      !fusion ||
      !data
    ) {
      return;
    }

    const key = `${
      data.drawing?.id ??
      "none"
    }:${
      data.voice?.id ??
      "none"
    }`;

    if (
      savedFor.current === key
    ) {
      return;
    }

    savedFor.current = key;

    const saveFusionResult =
      async () => {
        console.log(
          "Saving NeuroSense fusion result..."
        );

        const {
          error: fusionError,
        } = await supabase
          .from("fusion_results")
          .insert({
            user_id: user.id,

            screening_session_id:
              sessionId ?? null,

            drawing_result_id:
              data.drawing?.id ??
              null,

            voice_result_id:
              data.voice?.id ??
              null,

            drawing_probability:
              data.drawing
                ?.probability ??
              null,

            voice_probability:
              data.voice
                ?.probability ??
              null,

            overall_probability:
              fusion.overallProbability,

            confidence:
              fusion.confidence,

            risk_category:
              fusion.category.toLowerCase(),

            drawing_weight:
              fusion.drawingWeight,

            voice_weight:
              fusion.voiceWeight,

            is_demo: false,
          });

        if (fusionError) {
          console.error(
            "FAILED TO SAVE FUSION RESULT:",
            fusionError
          );

          /*
           * Allow another attempt if the
           * insert failed.
           */
          savedFor.current = null;

          return;
        }

        console.log(
          "Fusion result saved successfully."
        );

        /*
         * Mark the screening session
         * as completed only after the
         * fusion result was successfully saved.
         */

        if (sessionId) {
          const {
            error: sessionError,
          } = await supabase
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

          if (sessionError) {
            console.error(
              "FAILED TO COMPLETE SCREENING SESSION:",
              sessionError
            );
          } else {
            console.log(
              "Screening session completed."
            );
          }
        }
      };

    void saveFusionResult();
  }, [
    user,
    fusion,
    data,
    sessionId,
  ]);

  /*
   * ---------------------------------------------------------
   * UI STATE
   * ---------------------------------------------------------
   */

  const tips = dailyTips();

  const showAnalysing =
    Boolean(sessionId) &&
    (analysing ||
      isLoading);

  /*
   * ---------------------------------------------------------
   * PAGE
   * ---------------------------------------------------------
   */

  return (
    <main>
      <PageHeader
        eyebrow={
          sessionId
            ? "Step 4 — Final result"
            : "Combined results"
        }
        title="Drawing + voice, together 🧩"
        subtitle="Your two check-ins are merged into one overall AI screening estimate."
      />

      {sessionId && (
        <AssessmentSteps
          current={
            showAnalysing
              ? 2
              : 3
          }
        />
      )}

      <section className="mx-auto w-full max-w-2xl space-y-4 px-5 pt-4">

        {/* FUSION PROCESSING */}

        {showAnalysing && (
          <div className="surface-card flex flex-col items-center gap-3 p-10 text-center">
            <Loader2
              aria-hidden="true"
              className="size-8 animate-spin text-primary motion-reduce:animate-none"
            />

            <p className="font-display text-base font-semibold">
              Fusing your drawing and voice results…
            </p>

            <p className="text-sm text-muted-foreground">
              Both model outputs are combined with your configured weighting.
            </p>
          </div>
        )}

        {/* LOADING */}

        {!showAnalysing &&
          isLoading && (
            <Skeleton className="h-56 w-full rounded-3xl" />
          )}

        {/* ERROR */}

        {!showAnalysing &&
          isError && (
            <p className="surface-card p-5 text-sm text-muted-foreground">
              Something went wrong while loading your results. Please try again in a moment.
            </p>
          )}

        {/* MISSING RESULT */}

        {!showAnalysing &&
          !isLoading &&
          !isError &&
          !fusion && (
            <div className="surface-card flex flex-col items-center gap-3 p-8 text-center">
              <span className="grid size-12 place-items-center rounded-3xl bg-primary/10 text-primary">
                <Sparkles
                  aria-hidden="true"
                  className="size-6"
                />
              </span>

              <h2 className="font-display text-base font-semibold">
                {sessionId
                  ? "One check still to go"
                  : "Nothing to combine yet"}
              </h2>

              <p className="max-w-sm text-sm text-muted-foreground">
                {sessionId &&
                data?.drawing &&
                !data.voice
                  ? "Your drawing check is saved. Finish the voice check and we'll combine both into your final result."
                  : sessionId &&
                    data?.voice &&
                    !data.drawing
                    ? "Your voice check is saved. Finish the drawing check and we'll combine both into your final result."
                    : "Complete a drawing and a voice check-in and your combined result will appear here."}
              </p>

              <Button
                asChild
                className="mt-1 h-11 rounded-xl"
              >
                {sessionId &&
                data?.drawing &&
                !data.voice ? (
                  <Link
                    to="/voice"
                    search={{
                      flow: "assessment",
                      session:
                        sessionId,
                    }}
                  >
                    Continue to voice check
                  </Link>
                ) : sessionId ? (
                  <Link
                    to="/drawing"
                    search={{
                      flow: "assessment",
                      session:
                        sessionId,
                    }}
                  >
                    Continue to drawing check
                  </Link>
                ) : (
                  <Link to="/checkin">
                    Start a check-in
                  </Link>
                )}
              </Button>
            </div>
          )}

        {/* FINAL RESULT */}

        {!showAnalysing &&
          fusion && (
            <>
              <div className="surface-card p-5">

                <div className="flex items-center justify-end">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {fusion.category} range
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap items-end justify-center gap-6">

                  <Gauge
                    value={
                      data?.drawing
                        ?.probability ??
                      null
                    }
                    label="Drawing"
                    size={92}
                    tone="muted"
                  />

                  <Gauge
                    value={
                      fusion.overallProbability
                    }
                    label="Overall"
                    size={132}
                  />

                  <Gauge
                    value={
                      data?.voice
                        ?.probability ??
                      null
                    }
                    label="Voice"
                    size={92}
                    tone="lavender"
                  />

                </div>

                <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                  {plainLanguageSummary(
                    fusion,
                    hasBoth
                  )}
                </p>

                <p className="mt-2 text-xs text-muted-foreground">
                  Confidence{" "}
                  {fusion.confidence}%
                  {" · "}
                  weighting drawing{" "}
                  {Math.round(
                    fusion.drawingWeight *
                      100
                  )}
                  % / voice{" "}
                  {Math.round(
                    fusion.voiceWeight *
                      100
                  )}
                  %
                  {data &&
                  data.drawingCount >
                    1
                    ? ` · drawing averaged over ${data.drawingCount} tasks`
                    : ""}
                  {hasBoth
                    ? ""
                    : " · only one activity completed so far"}
                </p>

              </div>

              <Disclaimer text="AI screening estimate only — not a medical diagnosis." />

              {/* RECOMMENDATIONS */}

              <div className="surface-card p-5">

                <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                  <HeartHandshake
                    aria-hidden="true"
                    className="size-4 text-primary"
                  />
                  What you can do next
                </h2>

                <ul className="mt-3 space-y-2">
                  {recommendationsFor(
                    fusion.category
                  ).map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                      />

                      <span>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-3 text-xs text-muted-foreground">
                  These are general wellbeing suggestions only — never medication or treatment advice.
                </p>

              </div>

              {/* DAILY TIPS */}

              <div className="surface-card p-5">

                <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                  <Lightbulb
                    aria-hidden="true"
                    className="size-4 text-lavender"
                  />
                  Today's tips
                </h2>

                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {tips.map(
                    (tip) => (
                      <li
                        key={
                          tip.title
                        }
                        className="rounded-2xl bg-muted/60 p-3"
                      >
                        <p className="text-sm font-semibold">
                          <span aria-hidden="true">
                            {tip.emoji}{" "}
                          </span>

                          {tip.title}
                        </p>

                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {tip.body}
                        </p>
                      </li>
                    )
                  )}
                </ul>

              </div>

              {/* NAVIGATION */}

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
                  asChild
                  className="h-11 rounded-xl"
                >
                  <Link to="/checkin">
                    New check-in
                  </Link>
                </Button>

              </div>
            </>
          )}
      </section>
    </main>
  );
}