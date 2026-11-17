import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const startSchema = z
  .object({
    datasetVersionId: z.string().uuid(),
    modality: z.enum(["drawing", "voice"]),
    architecture: z.string().min(1).max(64),
    epochs: z.number().int().min(1).max(500),
    batchSize: z.number().int().min(1).max(1024),
    trainSplit: z.number().min(0.1).max(0.95),
    valSplit: z.number().min(0).max(0.5),
    testSplit: z.number().min(0).max(0.5),
    augmentation: z.boolean(),
    classBalancing: z.enum(["none", "class_weights", "oversample", "undersample"]),
  })
  .refine((d) => Math.abs(d.trainSplit + d.valSplit + d.testSplit - 1) < 0.001, {
    message: "Train, validation and test splits must add up to 100%",
  });

/**
 * Creates a training job row and hands it to the external training service.
 * No metrics are ever produced here — the external service reports them back
 * through /api/public/training-callback.
 */
export const startTrainingJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => startSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: dataset, error: datasetError } = await supabase
      .from("dataset_versions")
      .select("id, modality, version, status, storage_path")
      .eq("id", data.datasetVersionId)
      .single();
    if (datasetError || !dataset) throw new Error("Dataset version not found");
    if (dataset.modality !== data.modality) throw new Error("Dataset modality does not match");
    if (dataset.status !== "ready") throw new Error("Dataset version is not ready for training");

    const { data: job, error: insertError } = await supabase
      .from("training_jobs")
      .insert({
        dataset_version_id: dataset.id,
        modality: data.modality,
        architecture: data.architecture,
        epochs: data.epochs,
        batch_size: data.batchSize,
        train_split: data.trainSplit,
        val_split: data.valSplit,
        test_split: data.testSplit,
        augmentation: data.augmentation,
        class_balancing: data.classBalancing,
        status: "queued",
        created_by: userId,
      })
      .select("id")
      .single();
    if (insertError || !job) throw new Error(insertError?.message ?? "Could not create job");

    await supabase.from("admin_audit_logs").insert({
      actor_id: userId,
      action: "training_started",
      target_type: "training_job",
      target_id: job.id,
      details: {
        modality: data.modality,
        architecture: data.architecture,
        dataset_version: dataset.version,
        epochs: data.epochs,
      },
    });

    const webhookUrl = process.env["TRAINING_WEBHOOK_URL"];
    const callbackSecret = process.env["TRAINING_CALLBACK_SECRET"];
    if (!webhookUrl) {
      await supabase
        .from("training_jobs")
        .update({
          error_message:
            "No training service configured yet. Add TRAINING_WEBHOOK_URL to dispatch jobs to your external trainer.",
        })
        .eq("id", job.id);
      return { ok: true as const, jobId: job.id, dispatched: false as const };
    }

    const origin = process.env["APP_ORIGIN"] ?? "";
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(callbackSecret ? { "x-neurosense-secret": callbackSecret } : {}),
        },
        body: JSON.stringify({
          job_id: job.id,
          modality: data.modality,
          architecture: data.architecture,
          dataset: {
            id: dataset.id,
            version: dataset.version,
            bucket: "datasets",
            storage_path: dataset.storage_path,
          },
          hyperparameters: {
            epochs: data.epochs,
            batch_size: data.batchSize,
            train_split: data.trainSplit,
            val_split: data.valSplit,
            test_split: data.testSplit,
            augmentation: data.augmentation,
            class_balancing: data.classBalancing,
          },
          callback_url: `${origin}/api/public/training-callback`,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Training service responded ${res.status}`);
      let externalJobId: string | null = null;
      try {
        const body = (await res.json()) as { job_id?: string; id?: string };
        externalJobId = body.job_id ?? body.id ?? null;
      } catch {
        /* service may respond without a body */
      }
      await supabase
        .from("training_jobs")
        .update({ external_job_id: externalJobId, error_message: null })
        .eq("id", job.id);
      return { ok: true as const, jobId: job.id, dispatched: true as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not reach training service";
      await supabase
        .from("training_jobs")
        .update({ status: "failed", error_message: message })
        .eq("id", job.id);
      return { ok: false as const, jobId: job.id, error: message };
    }
  });

/** Explicit, admin-only model activation. Exactly one active model per modality. */
export const activateModelVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ modelVersionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: model, error } = await supabase
      .from("model_versions")
      .select("id, modality, version, status")
      .eq("id", data.modelVersionId)
      .single();
    if (error || !model) throw new Error("Model version not found");
    if (model.status === "active") return { ok: true as const };

    const { data: previous } = await supabase
      .from("model_versions")
      .select("id, version")
      .eq("modality", model.modality)
      .eq("status", "active");
    for (const p of previous ?? []) {
      const { error: e } = await supabase
        .from("model_versions")
        .update({ status: "inactive" })
        .eq("id", p.id);
      if (e) throw new Error(e.message);
    }
    const { error: activateError } = await supabase
      .from("model_versions")
      .update({ status: "active", activated_at: new Date().toISOString() })
      .eq("id", model.id);
    if (activateError) throw new Error(activateError.message);

    await supabase.from("admin_audit_logs").insert({
      actor_id: userId,
      action: "model_activated",
      target_type: "model_version",
      target_id: model.id,
      details: {
        modality: model.modality,
        version: model.version,
        replaced: (previous ?? []).map((p) => p.version),
      },
    });
    return { ok: true as const };
  });
