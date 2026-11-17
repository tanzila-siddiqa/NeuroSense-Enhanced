import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

type FusionResult = {
  id: string;
  user_id: string;
  screening_session_id: string | null;
  drawing_result_id: string | null;
  voice_result_id: string | null;
  drawing_probability: number;
  voice_probability: number;
  overall_probability: number;
  confidence: number;
  risk_category: string;
  drawing_weight: number;
  voice_weight: number;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

type ProgressPoint = {
  assessment: string;
  date: string;
  drawing: number;
  voice: number;
  overall: number;
};

export const Route = createFileRoute("/_authenticated/progress")({
  component: Progress,
});

export default function Progress() {
  
  const [fusionResults, setFusionResults] = useState<FusionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setFusionResults([]);
          setLoading(false);
        }
        return;
      }

      const { data, error: queryError } = await supabase
        .from("fusion_results")
        .select(`
          id,
          user_id,
          screening_session_id,
          drawing_result_id,
          voice_result_id,
          drawing_probability,
          voice_probability,
          overall_probability,
          confidence,
          risk_category,
          drawing_weight,
          voice_weight,
          is_demo,
          created_at,
          updated_at
        `)
        .eq("user_id", user.id)
        .eq("is_demo", false)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (queryError) {
        console.error("FAILED TO LOAD PROGRESS:", queryError);
        setError("Unable to load your progress.");
        setFusionResults([]);
      } else {
        setFusionResults((data ?? []) as FusionResult[]);
      }

      setLoading(false);
    }

    void loadProgress();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Every completed fusion result becomes ONE graph point.
   *
   * Example:
   * 5 assessments on the same day = 5 separate points.
   *
   * We do not group or average results by day.
   */
  const progressData: ProgressPoint[] = fusionResults.map(
    (result, index) => ({
      assessment: `Assessment ${index + 1}`,
      date: new Date(result.created_at).toLocaleString(),
      drawing: Number(result.drawing_probability),
      voice: Number(result.voice_probability),
      overall: Number(result.overall_probability),
    }),
  );

  const latestResult =
    fusionResults.length > 0
      ? fusionResults[fusionResults.length - 1]
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Progress
        </h1>

        <p className="text-muted-foreground">
          Track your assessment results over time.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            Loading your progress...
          </p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <p className="text-sm text-destructive">
            {error}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && progressData.length === 0 && (
        <div className="rounded-xl border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">
            No progress data yet
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Complete a full drawing and voice assessment to
            start your progress graph.
          </p>
        </div>
      )}

      {/* Progress graph */}
      {!loading && !error && progressData.length > 0 && (
        <>
          <div className="rounded-xl border bg-card p-4 sm:p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold">
                Assessment progress
              </h2>

              <p className="text-sm text-muted-foreground">
                Each completed assessment is shown separately.
              </p>
            </div>

            <div className="h-[320px] w-full">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart
                  data={progressData}
                  margin={{
                    top: 10,
                    right: 20,
                    left: 0,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />

                  <XAxis
                    dataKey="assessment"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={20}
                  />

                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      `${value}%`
                    }
                  />

                  <Tooltip
                    formatter={(
                      value: number,
                      name: string,
                    ) => [
                      `${Number(value).toFixed(1)}%`,
                      name,
                    ]}
                    labelFormatter={(
                      label,
                      payload,
                    ) => {
                      const point =
                        payload?.[0]?.payload as
                          | ProgressPoint
                          | undefined;

                      return point?.date
                        ? `${label} — ${point.date}`
                        : label;
                    }}
                  />

                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="drawing"
                    name="Drawing"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="voice"
                    name="Voice"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="overall"
                    name="Overall"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Assessment history */}
          <div className="rounded-xl border bg-card">
            <div className="border-b p-4 sm:p-6">
              <h2 className="text-lg font-semibold">
                Assessment history
              </h2>

              <p className="text-sm text-muted-foreground">
                Every completed assessment is listed below.
              </p>
            </div>

            <div className="divide-y">
              {[...fusionResults]
                .reverse()
                .map((result, reverseIndex) => {
                  const assessmentNumber =
                    fusionResults.length - reverseIndex;

                  return (
                    <div
                      key={result.id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                    >
                      <div>
                        <p className="font-medium">
                          Assessment{" "}
                          {assessmentNumber}
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {new Date(
                            result.created_at,
                          ).toLocaleString()}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Drawing
                          </p>

                          <p className="font-semibold">
                            {Number(
                              result.drawing_probability,
                            ).toFixed(1)}
                            %
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Voice
                          </p>

                          <p className="font-semibold">
                            {Number(
                              result.voice_probability,
                            ).toFixed(1)}
                            %
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Overall
                          </p>

                          <p className="font-semibold">
                            {Number(
                              result.overall_probability,
                            ).toFixed(1)}
                            %
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Latest result */}
          {latestResult && (
            <div className="rounded-xl border bg-card p-4 sm:p-6">
              <h2 className="text-lg font-semibold">
                Latest assessment
              </h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Overall score
                  </p>

                  <p className="mt-1 text-2xl font-bold">
                    {Number(
                      latestResult.overall_probability,
                    ).toFixed(1)}
                    %
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    Confidence
                  </p>

                  <p className="mt-1 text-2xl font-bold">
                    {Number(
                      latestResult.confidence,
                    ).toFixed(1)}
                    %
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    Risk category
                  </p>

                  <p className="mt-1 text-2xl font-bold">
                    {latestResult.risk_category}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}