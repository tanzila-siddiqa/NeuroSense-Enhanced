import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import {
  ArrowRight,
  Loader2,
  Sparkles,
} from "lucide-react";

import { toast } from "sonner";

import { PageHeader } from "@/components/neuro/PageHeader";
import { Disclaimer } from "@/components/neuro/Disclaimer";
import { VoiceRecorder } from "@/components/neuro/VoiceRecorder";
import { AssessmentSteps } from "@/components/neuro/AssessmentSteps";
import { Button } from "@/components/ui/button";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import { riskCategory } from "@/lib/drawing";
import { validateAssessmentSearch } from "@/lib/assessment";

import {
  predictVoice,
  warmUpML,
} from "@/lib/ml";

import {
  VOICE_PROMPT,
  extensionFor,
  formatDuration,
  type VoiceMetrics,
} from "@/lib/voice";

export const Route = createFileRoute(
  "/_authenticated/voice"
)({
  validateSearch: validateAssessmentSearch,

  head: () => ({
    meta: [
      {
        title: "Voice Check-In — NeuroSense",
      },
      {
        name: "description",
        content:
          "Record a short voice sample in-app with a live waveform, level meter and live voice graph, then view an AI screening estimate.",
      },
      {
        property: "og:title",
        content:
          "Voice Check-In — NeuroSense",
      },
      {
        property: "og:description",
        content:
          "A calm in-app voice recording with live visualisation. AI screening estimates only — never a diagnosis.",
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

  component: VoiceFlow,
});

type Stage =
  | "record"
  | "processing"
  | "result";

function VoiceFlow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const inAssessment =
    search.flow === "assessment";

  const [stage, setStage] =
    useState<Stage>("record");

  const [sessionId, setSessionId] =
    useState<string | null>(
      search.session ?? null
    );

  const [result, setResult] =
    useState<
      (VoiceMetrics & {
        probability: number;
        confidence: number;
        screening_score: number;
        screening_band: {
          key:
            | "lower"
            | "intermediate"
            | "higher";
          label: string;
        };
      }) | null
    >(null);

  const analyzingRef =
    useRef(false);

  useEffect(() => {
    warmUpML();
  }, []);

  const handleAnalyze = async (
    metrics: VoiceMetrics,
    blob: Blob
  ) => {
    if (!user) {
      return;
    }

    if (analyzingRef.current) {
      return;
    }

    analyzingRef.current = true;
    setStage("processing");

    let score: {
      probability: number;
      confidence: number;
      screening_score: number;
      screening_band: {
        key:
          | "lower"
          | "intermediate"
          | "higher";
        label: string;
      };
    };

    try {
      const prediction =
        await predictVoice(blob);

      const probability =
        Number(prediction.probability);

      const predictionConfidence =
        Number(prediction.confidence);

      if (!Number.isFinite(probability)) {
        throw new Error(
          "Voice prediction returned an invalid probability."
        );
      }

      if (!Number.isFinite(predictionConfidence)) {
        throw new Error(
          "Voice prediction returned an invalid confidence."
        );
      }

      const screeningScore =
        Number(
          prediction.screening_score ??
            probability
        );

      if (
        !Number.isFinite(
          screeningScore
        )
      ) {
        throw new Error(
          "Voice prediction returned an invalid screening score."
        );
      }

      const screeningBand = (
        prediction.screening_band ??
        {
          key:
            screeningScore < 70
              ? "lower"
              : screeningScore < 90
                ? "intermediate"
                : "higher",
          label:
            screeningScore < 70
              ? "Lower screening score"
              : screeningScore < 90
                ? "Intermediate screening score"
                : "Higher screening score",
        }
      ) as {
        key:
          | "lower"
          | "intermediate"
          | "higher";
        label: string;
      };

      score = {
        probability:
          Math.round(
            probability * 10
          ) / 10,

        confidence:
          Math.round(
            predictionConfidence * 10
          ) / 10,

        screening_score:
          Math.round(
            screeningScore * 10
          ) / 10,

        screening_band:
          screeningBand,
      };
    } catch (error) {
      console.error(
        "Voice ML prediction failed:",
        error
      );

      toast.error(
        "Unable to analyze the voice recording.",
        {
          description:
            error instanceof Error
              ? error.message
              : "The ML service could not analyze the recording.",
        },
      );

      analyzingRef.current = false;
      setStage("record");

      return;
    }

    try {
      let screeningId =
        sessionId;

      if (!screeningId) {
        const {
          data: screening,
          error,
        } = await supabase
          .from(
            "screening_sessions"
          )
          .insert({
            user_id: user.id,

            session_type:
              inAssessment
                ? "combined"
                : "voice",

            status:
              "in_progress",
          })
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        screeningId =
          screening?.id ?? null;

        setSessionId(
          screeningId
        );
      }

      if (!screeningId) {
        throw new Error(
          "Screening session was not created."
        );
      }

      const path =
        `${user.id}/${Date.now()}-voice.${extensionFor(
          blob.type
        )}`;

      const uploadPromise =
        supabase.storage
          .from("recordings")
          .upload(
            path,
            blob,
            {
              contentType:
                blob.type ||
                "audio/webm",

              upsert: false,
            }
          );

      const voiceSessionPromise =
        supabase
          .from("voice_sessions")
          .insert({
            user_id: user.id,

            screening_session_id:
              screeningId,

            audio_path:
              path,

            duration_ms:
              metrics.durationMs,

            sample_rate:
              metrics.sampleRate,

            amplitude_rms:
              metrics.amplitudeRms,
          })
          .select("id")
          .single();

      const [
        {
          error:
            uploadError,
        },
        {
          data: session,
          error:
            sessionError,
        },
      ] =
        await Promise.all([
          uploadPromise,
          voiceSessionPromise,
        ]);

      if (uploadError) {
        throw uploadError;
      }

      if (
        sessionError ||
        !session
      ) {
        throw (
          sessionError ??
          new Error(
            "Voice session was not created."
          )
        );
      }

      const {
        error: resultError,
      } = await supabase
        .from("voice_results")
        .insert({
          user_id: user.id,

          voice_session_id:
            session.id,

          probability:
            score.probability,

          confidence:
            score.confidence,

          is_demo: false,
        });

      if (resultError) {
        throw resultError;
      }

      if (
        screeningId &&
        !inAssessment
      ) {
        await supabase
          .from(
            "screening_sessions"
          )
          .update({
            status:
              "completed",

            completed_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            screeningId
          );
      }
    } catch (error) {
      console.error(
        "Saving voice result failed:",
        error
      );

      toast.error(
        "Voice analyzed, but saving the result failed.",
        {
          description:
            "The current result will still be shown.",
        }
      );
    }

    setResult({
      ...metrics,
      ...score,
    });

    setStage("result");

    analyzingRef.current = false;
  };

  const goToFusion = () => {
    void navigate({
      to: "/results",

      search: sessionId
        ? {
            session:
              sessionId,
          }
        : {},
    });
  };

  return (
    <main className="pb-8">
      <PageHeader
        eyebrow={
          inAssessment
            ? "Step 2 — Voice check"
            : "Voice check-in"
        }
        title="🎤 Ready when you are."
        subtitle="Speak normally in a quiet spot. There's nothing to get right."
      />

      {inAssessment && (
        <AssessmentSteps
          current={
            stage === "result"
              ? 2
              : 1
          }
        />
      )}

      <section className="mx-auto w-full max-w-2xl space-y-4 px-5 pt-4">
        {stage === "record" && (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {VOICE_PROMPT}
            </p>

            <VoiceRecorder
              onAnalyze={
                handleAnalyze
              }
            />

            <Disclaimer text="Live voice visualisation only — no medical claims are made from this view." />
          </>
        )}

        {stage ===
          "processing" && (
          <div className="surface-card flex flex-col items-center gap-3 p-10 text-center">
            <Loader2
              aria-hidden="true"
              className="size-8 animate-spin text-primary motion-reduce:animate-none"
            />

            <p className="font-display text-base font-semibold">
              Analyzing your voice pattern…
            </p>

            <p className="text-sm text-muted-foreground">
              Your recording is being analyzed.
            </p>
          </div>
        )}

        {stage ===
          "result" &&
          result && (
            <>
              <div className="surface-card p-6">
                <div className="flex items-center justify-end gap-3">
                  <Sparkles
                    aria-hidden="true"
                    className="size-5 text-lavender"
                  />
                </div>

                <p className="mt-4 text-sm text-muted-foreground">
                  Voice — estimated probability
                </p>

                <p className="font-display text-5xl font-semibold tabular-nums">
                  {result.probability}%
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Confidence{" "}
                  {result.confidence}%
                  {" · "}
                  {result.screening_band?.label}
                </p>

                <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                  {[
                    [
                      "Length",
                      formatDuration(
                        result.durationMs
                      ),
                    ],
                    [
                      "Sample rate",
                      result.sampleRate
                        ? `${Math.round(
                            result.sampleRate /
                              1000
                          )}kHz`
                        : "—",
                    ],
                    [
                      "Avg level",
                      `${Math.round(
                        result.amplitudeRms *
                          100
                      )}`,
                    ],
                  ].map(
                    ([
                      label,
                      value,
                    ]) => (
                      <div
                        key={label}
                        className="rounded-xl bg-muted/60 px-2 py-2"
                      >
                        <dt className="text-[11px] text-muted-foreground">
                          {label}
                        </dt>

                        <dd className="font-display text-base font-semibold tabular-nums">
                          {value}
                        </dd>
                      </div>
                    )
                  )}
                </dl>
              </div>

              <Disclaimer text="AI screening estimate only — not a medical diagnosis." />

              {inAssessment ? (
                <Button
                  className="h-12 w-full rounded-xl"
                  onClick={
                    goToFusion
                  }
                >
                  Combine both checks

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
            </>
          )}
      </section>
    </main>
  );
}