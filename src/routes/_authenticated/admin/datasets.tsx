import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, FileArchive, History, RotateCcw, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { processDatasetVersion } from "@/lib/datasets.functions";
import { logAudit, statusTone, type Modality } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/datasets")({
  head: () => ({
    meta: [
      { title: "Datasets — NeuroSense admin" },
      { name: "description", content: "Upload and version screening datasets with per-class inventory and validation." },
      { property: "og:title", content: "Datasets — NeuroSense admin" },
      { property: "og:description", content: "Upload and version screening datasets with per-class inventory and validation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DatasetsPage,
});

type DatasetVersion = Tables<"dataset_versions">;
const MAX_ZIP_MB = 200;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

function DatasetsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const runInventory = useServerFn(processDatasetVersion);
  const [modality, setModality] = useState<Modality>("drawing");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "validating">("idle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const versionsQuery = useQuery({
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

  const versions = useMemo(
    () => (versionsQuery.data ?? []).filter((v) => v.modality === modality),
    [versionsQuery.data, modality],
  );
  const selected = versions.find((v) => v.id === selectedId) ?? versions[0] ?? null;

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !user) throw new Error("Choose a ZIP file first");
      if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Only .zip files are accepted");
      if (file.size > MAX_ZIP_MB * 1024 * 1024)
        throw new Error(`ZIP must be under ${MAX_ZIP_MB} MB for in-app validation`);

      setPhase("uploading");
      const nextVersion = Math.max(0, ...versions.map((v) => v.version)) + 1;
      const safeName = file.name.replace(/[^\w.-]+/g, "_");
      const storagePath = `${modality}/v${nextVersion}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("datasets")
        .upload(storagePath, file, { contentType: "application/zip", upsert: false });
      if (uploadError) throw uploadError;

      const { data: row, error: insertError } = await supabase
        .from("dataset_versions")
        .insert({
          modality,
          version: nextVersion,
          storage_path: storagePath,
          original_filename: file.name,
          notes: notes.trim() || null,
          status: "processing",
          uploaded_by: user.id,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      await logAudit(user.id, "dataset_uploaded", "dataset_version", row.id, {
        modality,
        version: nextVersion,
        filename: file.name,
        size: file.size,
      });

      setPhase("validating");
      const result = await runInventory({ data: { datasetVersionId: row.id } });
      return { id: row.id, version: nextVersion, result };
    },
    onSuccess: ({ id, version, result }) => {
      setSelectedId(id);
      setFile(null);
      setNotes("");
      if (fileInput.current) fileInput.current.value = "";
      if (result.ok) {
        toast.success(`v${version} validated: ${result.valid} valid of ${result.total} files`);
      } else {
        toast.error(`v${version} failed validation: ${result.error}`);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
    onSettled: () => {
      setPhase("idle");
      void queryClient.invalidateQueries({ queryKey: ["dataset-versions"] });
    },
  });

  const rollback = useMutation({
    mutationFn: async (target: DatasetVersion) => {
      if (!user) return;
      const { error: clearError } = await supabase
        .from("dataset_versions")
        .update({ is_current: false })
        .eq("modality", target.modality)
        .eq("is_current", true);
      if (clearError) throw clearError;
      const { error } = await supabase
        .from("dataset_versions")
        .update({ is_current: true })
        .eq("id", target.id);
      if (error) throw error;
      await logAudit(user.id, "dataset_rollback", "dataset_version", target.id, {
        modality: target.modality,
        version: target.version,
      });
    },
    onSuccess: () => {
      toast.success("Current dataset version updated");
      void queryClient.invalidateQueries({ queryKey: ["dataset-versions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not roll back"),
  });

  const busy = upload.isPending;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Datasets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every upload creates a new immutable version. Counts below are computed from the actual
            ZIP contents.
          </p>
        </div>
        <Tabs value={modality} onValueChange={(v) => { setModality(v as Modality); setSelectedId(null); }}>
          <TabsList>
            <TabsTrigger value="drawing">✍️ Drawing</TabsTrigger>
            <TabsTrigger value="voice">🎤 Voice</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <section className="surface-card p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <Upload aria-hidden="true" className="size-4 text-primary" />
          Upload new {modality} dataset
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          ZIP with one folder per class (e.g. <code>healthy/</code>, <code>parkinson/</code>).{" "}
          {modality === "drawing" ? "PNG, JPG, WEBP or BMP images." : "WAV, MP3, OGG, FLAC, M4A or WEBM audio."}{" "}
          Max {MAX_ZIP_MB} MB.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dataset-zip">ZIP file</Label>
            <Input
              id="dataset-zip"
              ref={fileInput}
              type="file"
              accept=".zip,application/zip"
              disabled={busy}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileArchive aria-hidden="true" className="size-3.5" />
                {file.name} · {formatBytes(file.size)}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dataset-notes">Notes (optional)</Label>
            <Textarea
              id="dataset-notes"
              rows={2}
              placeholder="Source, collection date, licence…"
              value={notes}
              disabled={busy}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        {busy && (
          <div className="mt-4 space-y-1.5">
            <Progress value={phase === "uploading" ? 40 : 80} />
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {phase === "uploading" ? "Uploading ZIP…" : "Inventorying files, checking validity and duplicates…"}
            </p>
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button disabled={!file || busy} onClick={() => upload.mutate()}>
            {busy ? "Working…" : `Upload as v${Math.max(0, ...versions.map((v) => v.version)) + 1}`}
          </Button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="surface-card p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <History aria-hidden="true" className="size-4 text-primary" />
            Versions
          </h2>
          {versionsQuery.isLoading ? (
            <Skeleton className="mt-3 h-24 rounded-2xl" />
          ) : versions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No {modality} datasets uploaded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {versions.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(v.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                      selected?.id === v.id
                        ? "border-primary/40 bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <span>
                      <span className="font-medium">v{v.version}</span>
                      {v.is_current && (
                        <span className="ml-2 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          current
                        </span>
                      )}
                      <span className="block text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleString()} · {v.valid_files} valid
                      </span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusTone(v.status)}`}>
                      {v.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-card p-5">
          {selected ? (
            <VersionReport
              version={selected}
              onRollback={() => rollback.mutate(selected)}
              rollingBack={rollback.isPending}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Select a version to see its validation report.</p>
          )}
        </section>
      </div>
    </>
  );
}

function VersionReport({
  version,
  onRollback,
  rollingBack,
}: {
  version: DatasetVersion;
  onRollback: () => void;
  rollingBack: boolean;
}) {
  const classCounts = (version.class_counts ?? {}) as Record<string, number>;
  const classEntries = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);
  const maxClass = Math.max(1, ...classEntries.map(([, n]) => n));

  const samplesQuery = useQuery({
    queryKey: ["dataset-samples", version.id],
    enabled: version.status === "ready",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dataset_samples")
        .select("id, file_name, class_label, file_size, status")
        .eq("dataset_version_id", version.id)
        .neq("status", "valid")
        .order("file_name")
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const stats = [
    { label: "Total", value: version.total_files, tone: "" },
    { label: "Valid", value: version.valid_files, tone: "text-primary" },
    { label: "Invalid / corrupted", value: version.invalid_files, tone: "text-destructive" },
    { label: "Duplicates", value: version.duplicate_files, tone: "text-accent" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold">
            v{version.version} validation report
          </h2>
          <p className="text-xs text-muted-foreground">
            {version.original_filename ?? version.storage_path}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusTone(version.status)}`}>
            {version.status}
          </span>
          {version.status === "ready" && !version.is_current && (
            <Button size="sm" variant="outline" disabled={rollingBack} onClick={onRollback}>
              <RotateCcw aria-hidden="true" className="size-3.5" />
              Make current
            </Button>
          )}
        </div>
      </div>

      {version.status === "failed" && version.error_message && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {version.error_message}
        </p>
      )}
      {version.status === "processing" && (
        <p className="text-sm text-muted-foreground">Validation still running…</p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-muted/50 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className={`font-display text-xl font-semibold ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold">Per-class counts (valid files)</h3>
        {classEntries.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No labelled classes found.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {classEntries.map(([label, n]) => (
              <li key={label} className="text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground">{n}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-lavender"
                    style={{ width: `${(n / maxClass) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        {classEntries.length >= 2 && (() => {
          const min = Math.min(...classEntries.map(([, n]) => n));
          const max = Math.max(...classEntries.map(([, n]) => n));
          return max / Math.max(1, min) >= 2 ? (
            <p className="mt-2 rounded-xl bg-accent/10 px-3 py-2 text-xs text-accent">
              Class imbalance detected ({max}:{min}). Consider class weights or resampling when training.
            </p>
          ) : null;
        })()}
      </div>

      {version.notes && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Notes:</span> {version.notes}
        </p>
      )}

      {version.status === "ready" && (
        <div>
          <h3 className="text-sm font-semibold">Flagged files</h3>
          {samplesQuery.isLoading ? (
            <Skeleton className="mt-2 h-16 rounded-xl" />
          ) : samplesQuery.data?.length ? (
            <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {samplesQuery.data.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="max-w-[220px] truncate text-xs" title={s.file_name}>
                        {s.file_name}
                      </TableCell>
                      <TableCell className="text-xs">{s.class_label}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusTone(s.status)}`}>
                          {s.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-primary">
              <CheckCircle2 aria-hidden="true" className="size-3.5" /> No invalid or duplicate files.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
