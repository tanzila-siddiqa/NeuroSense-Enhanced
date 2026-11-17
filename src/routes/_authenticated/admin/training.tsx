import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Play, RefreshCw } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { startTrainingJob } from "@/lib/training.functions";
import { ARCHITECTURES, BALANCING, pct, statusTone, type Modality } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/training")({
  component: TrainingPage,
  head: () => ({
    meta: [
      { title: "Training — NeuroSense Admin" },
      {
        name: "description",
        content: "Configure and monitor NeuroSense model training runs on uploaded datasets.",
      },
    ],
  }),
});

type Job = Tables<"training_jobs">;
type Curve = {
  epoch: number;
  train_loss?: number;
  val_loss?: number;
  train_accuracy?: number;
  val_accuracy?: number;
};
type Metrics = Record<string, unknown>;

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function TrainingPage() {
  const queryClient = useQueryClient();
  const startJob = useServerFn(startTrainingJob);
  const [modality, setModality] = useState<Modality>("drawing");
  const [datasetVersionId, setDatasetVersionId] = useState<string>("");
  const [architecture, setArchitecture] = useState<string>(ARCHITECTURES.drawing[0]!.value);
  const [epochs, setEpochs] = useState(20);
  const [batchSize, setBatchSize] = useState(32);
  const [trainSplit, setTrainSplit] = useState(70);
  const [valSplit, setValSplit] = useState(15);
  const [testSplit, setTestSplit] = useState(15);
  const [augmentation, setAugmentation] = useState(true);
  const [classBalancing, setClassBalancing] = useState("none");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const datasetsQuery = useQuery({
    queryKey: ["dataset-versions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dataset_versions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const jobsQuery = useQuery({
    queryKey: ["training-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Job[];
    },
    refetchInterval: (query) =>
      (query.state.data ?? []).some((j) => j.status === "queued" || j.status === "running")
        ? 10_000
        : false,
  });

  const readyDatasets = useMemo(
    () => (datasetsQuery.data ?? []).filter((d) => d.modality === modality && d.status === "ready"),
    [datasetsQuery.data, modality],
  );
  const jobs = useMemo(
    () => (jobsQuery.data ?? []).filter((j) => j.modality === modality),
    [jobsQuery.data, modality],
  );
  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? jobs[0] ?? null;

  const splitTotal = trainSplit + valSplit + testSplit;

  const start = useMutation({
    mutationFn: async () => {
      if (!datasetVersionId) throw new Error("Choose a dataset version first");
      if (splitTotal !== 100) throw new Error("Splits must add up to 100%");
      return startJob({
        data: {
          datasetVersionId,
          modality,
          architecture,
          epochs,
          batchSize,
          trainSplit: trainSplit / 100,
          valSplit: valSplit / 100,
          testSplit: testSplit / 100,
          augmentation,
          classBalancing: classBalancing as "none",
        },
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["training-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      setSelectedJobId(result.jobId);
      if ("dispatched" in result && result.dispatched) {
        toast.success("Training job sent to your training service");
      } else if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.warning("Job created, but no training service is connected yet");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const metrics = (selectedJob?.metrics ?? null) as Metrics | null;
  const curves = (selectedJob?.curves ?? null) as Curve[] | null;
  const confusion = Array.isArray(metrics?.["confusion_matrix"])
    ? (metrics["confusion_matrix"] as number[][])
    : null;
  const classLabels = Array.isArray(metrics?.["class_labels"])
    ? (metrics["class_labels"] as string[])
    : null;

  const trainAcc = num(metrics?.["train_accuracy"]);
  const valAcc = num(metrics?.["accuracy"]);
  const overfitting =
    trainAcc !== null && valAcc !== null ? trainAcc - valAcc > 0.15 : false;

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold">Training</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure a run and hand it to your external training service. Metrics only ever come
          back from that service — nothing is simulated here.
        </p>
      </div>

      <Tabs value={modality} onValueChange={(v) => {
        const next = v as Modality;
        setModality(next);
        setArchitecture(ARCHITECTURES[next][0]!.value);
        setDatasetVersionId("");
        setSelectedJobId(null);
      }}>
        <TabsList>
          <TabsTrigger value="drawing">Drawing</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
        </TabsList>
      </Tabs>

      <section className="surface-card space-y-4 p-5">
        <h2 className="font-display text-base font-semibold">New training run</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Dataset version</Label>
            <Select value={datasetVersionId} onValueChange={setDatasetVersionId}>
              <SelectTrigger>
                <SelectValue placeholder={readyDatasets.length ? "Choose a version" : "No ready datasets"} />
              </SelectTrigger>
              <SelectContent>
                {readyDatasets.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    v{d.version} · {d.valid_files} usable files
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Architecture</Label>
            <Select value={architecture} onValueChange={setArchitecture}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ARCHITECTURES[modality].map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="epochs">Epochs</Label>
            <Input
              id="epochs"
              type="number"
              min={1}
              max={500}
              value={epochs}
              onChange={(e) => setEpochs(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="batch">Batch size</Label>
            <Input
              id="batch"
              type="number"
              min={1}
              max={1024}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Split ratios (%)</Label>
            <div className="grid grid-cols-3 gap-3">
              <Input
                aria-label="Train split percent"
                type="number"
                value={trainSplit}
                onChange={(e) => setTrainSplit(Number(e.target.value))}
              />
              <Input
                aria-label="Validation split percent"
                type="number"
                value={valSplit}
                onChange={(e) => setValSplit(Number(e.target.value))}
              />
              <Input
                aria-label="Test split percent"
                type="number"
                value={testSplit}
                onChange={(e) => setTestSplit(Number(e.target.value))}
              />
            </div>
            <p className={`text-xs ${splitTotal === 100 ? "text-muted-foreground" : "text-destructive"}`}>
              Train / validation / test — currently {splitTotal}%.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Class balancing</Label>
            <Select value={classBalancing} onValueChange={setClassBalancing}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BALANCING.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5">
            <Label htmlFor="augmentation" className="text-sm">
              Data augmentation
            </Label>
            <Switch id="augmentation" checked={augmentation} onCheckedChange={setAugmentation} />
          </div>
        </div>

        <Button onClick={() => start.mutate()} disabled={start.isPending}>
          <Play aria-hidden="true" className="size-4" />
          {start.isPending ? "Starting…" : "Start training"}
        </Button>
      </section>

      <section className="surface-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Recent jobs</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["training-jobs"] })}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
        </div>

        {jobsQuery.isLoading ? (
          <Skeleton className="mt-3 h-24 w-full rounded-2xl" />
        ) : jobs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No training runs for this modality yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {jobs.map((job) => (
              <li key={job.id}>
                <button
                  type="button"
                  onClick={() => setSelectedJobId(job.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    selectedJob?.id === job.id ? "bg-primary/10" : "bg-muted/50 hover:bg-muted"
                  }`}
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{job.architecture}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {job.epochs} epochs · {new Date(job.created_at).toLocaleString()}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(job.status)}`}>
                    {job.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedJob && (
        <section className="surface-card space-y-4 p-5">
          <h2 className="font-display text-base font-semibold">Run details</h2>

          {selectedJob.error_message && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {selectedJob.error_message}
            </p>
          )}

          {overfitting && (
            <p className="flex items-start gap-2 rounded-xl bg-lavender/12 px-3 py-2.5 text-sm text-lavender">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Training accuracy is far above validation accuracy — this run looks overfitted. Try
              more data, augmentation, or fewer epochs.
            </p>
          )}

          {metrics ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ["Accuracy", "accuracy"],
                ["Precision", "precision"],
                ["Recall", "recall"],
                ["F1", "f1"],
                ["ROC-AUC", "roc_auc"],
              ].map(([label, key]) => (
                <div key={key} className="rounded-xl bg-muted/50 px-3 py-2.5">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-0.5 font-display text-xl font-semibold">
                    {pct(num(metrics[key as string]))}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Metrics appear here once your training service reports back.
            </p>
          )}

          {curves && curves.length > 0 && (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curves} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="epoch" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="train_loss" stroke="hsl(var(--primary))" dot={false} />
                  <Line type="monotone" dataKey="val_loss" stroke="hsl(var(--accent))" dot={false} />
                  <Line type="monotone" dataKey="train_accuracy" stroke="hsl(var(--primary))" strokeDasharray="4 4" dot={false} />
                  <Line type="monotone" dataKey="val_accuracy" stroke="hsl(var(--accent))" strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {confusion && (
            <div>
              <h3 className="text-sm font-medium">Confusion matrix</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="text-sm">
                  <tbody>
                    {confusion.map((row, i) => (
                      <tr key={i}>
                        <th scope="row" className="pr-3 text-left text-xs text-muted-foreground">
                          {classLabels?.[i] ?? `class ${i}`}
                        </th>
                        {row.map((cell, j) => (
                          <td key={j} className="rounded-md bg-muted/60 px-3 py-1.5 text-center">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
