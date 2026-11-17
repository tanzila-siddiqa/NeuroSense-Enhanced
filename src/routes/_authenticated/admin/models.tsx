import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { activateModelVersion } from "@/lib/training.functions";
import { pct, statusTone, type Modality } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/models")({
  component: ModelsPage,
  head: () => ({
    meta: [
      { title: "Model registry — NeuroSense Admin" },
      {
        name: "description",
        content:
          "Review trained NeuroSense model versions and explicitly activate one model per modality.",
      },
    ],
  }),
});

type ModelVersion = Tables<"model_versions">;

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ModelsPage() {
  const queryClient = useQueryClient();
  const activate = useServerFn(activateModelVersion);
  const [modality, setModality] = useState<Modality>("drawing");
  const [pending, setPending] = useState<ModelVersion | null>(null);

  const modelsQuery = useQuery({
    queryKey: ["model-versions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("model_versions")
        .select("*")
        .order("version", { ascending: false });
      if (error) throw error;
      return data as ModelVersion[];
    },
  });

  const models = useMemo(
    () => (modelsQuery.data ?? []).filter((m) => m.modality === modality),
    [modelsQuery.data, modality],
  );
  const active = models.find((m) => m.status === "active") ?? null;

  const activation = useMutation({
    mutationFn: (modelVersionId: string) => activate({ data: { modelVersionId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["model-versions"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Model activated for this modality");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold">Model registry</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every trained model arrives inactive. Only a model you activate here can ever replace
          Demo Mode results, and only one model is active per modality.
        </p>
      </div>

      <Tabs value={modality} onValueChange={(v) => setModality(v as Modality)}>
        <TabsList>
          <TabsTrigger value="drawing">Drawing</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="surface-card flex items-start gap-3 p-5">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-medium">
            {active
              ? `v${active.version} is serving ${modality} estimates`
              : `No active ${modality} model — the app stays in Demo Mode`}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Results shown to members are always framed as an AI screening estimate, never a medical
            diagnosis.
          </p>
        </div>
      </div>

      {modelsQuery.isLoading ? (
        <Skeleton className="h-32 w-full rounded-3xl" />
      ) : models.length === 0 ? (
        <p className="surface-card p-5 text-sm text-muted-foreground">
          No trained models yet. Completed training runs appear here automatically.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {models.map((model) => {
            const metrics = (model.metrics ?? null) as Record<string, unknown> | null;
            return (
              <article key={model.id} className="surface-card space-y-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-base font-semibold">Version {model.version}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(model.status)}`}>
                    {model.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Trained {new Date(model.created_at).toLocaleString()}
                  {model.activated_at && ` · activated ${new Date(model.activated_at).toLocaleString()}`}
                </p>
                <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  {[
                    ["Accuracy", "accuracy"],
                    ["Precision", "precision"],
                    ["Recall", "recall"],
                    ["F1", "f1"],
                  ].map(([label, key]) => (
                    <div key={key} className="rounded-xl bg-muted/50 px-3 py-2">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="font-medium">{pct(num(metrics?.[key as string]))}</dd>
                    </div>
                  ))}
                </dl>
                {model.status === "active" ? (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                    <CheckCircle2 aria-hidden="true" className="size-4" />
                    Currently active
                  </p>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activation.isPending}
                    onClick={() => setPending(model)}
                  >
                    Activate this version
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate version {pending?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              This becomes the only {modality} model used for estimates, replacing any currently
              active version. You can switch back at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) activation.mutate(pending.id);
                setPending(null);
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
