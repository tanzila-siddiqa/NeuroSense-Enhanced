import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { Json, TablesUpdate } from "@/integrations/supabase/types";

const metricsSchema = z
  .object({
    accuracy: z.number().min(0).max(1).optional(),
    precision: z.number().min(0).max(1).optional(),
    recall: z.number().min(0).max(1).optional(),
    f1: z.number().min(0).max(1).optional(),
    roc_auc: z.number().min(0).max(1).optional(),
    train_accuracy: z.number().min(0).max(1).optional(),
    train_loss: z.number().min(0).optional(),
    val_loss: z.number().min(0).optional(),
    confusion_matrix: z.array(z.array(z.number().int().min(0))).optional(),
    class_labels: z.array(z.string()).optional(),
  })
  .passthrough();

const curvesSchema = z
  .array(
    z.object({
      epoch: z.number().int().min(0),
      train_loss: z.number().optional(),
      val_loss: z.number().optional(),
      train_accuracy: z.number().optional(),
      val_accuracy: z.number().optional(),
    }),
  )
  .max(1000);

const payloadSchema = z.object({
  job_id: z.string().uuid(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  external_job_id: z.string().max(200).optional(),
  metrics: metricsSchema.optional(),
  curves: curvesSchema.optional(),
  error_message: z.string().max(2000).optional(),
});

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Called by the external training service to report progress and final metrics.
 * Authenticated with the shared TRAINING_CALLBACK_SECRET header.
 */
export const Route = createFileRoute("/api/public/training-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["TRAINING_CALLBACK_SECRET"];
        if (!secret) return new Response("Callback not configured", { status: 503 });
        const provided = request.headers.get("x-neurosense-secret") ?? "";
        if (!safeEqual(provided, secret)) return new Response("Unauthorized", { status: 401 });

        let payload: z.infer<typeof payloadSchema>;
        try {
          payload = payloadSchema.parse(await request.json());
        } catch (e) {
          const msg = e instanceof z.ZodError ? e.issues.map((i) => i.message).join("; ") : "Bad JSON";
          return Response.json({ error: msg }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: job, error: jobError } = await supabaseAdmin
          .from("training_jobs")
          .select("id, modality, dataset_version_id, status")
          .eq("id", payload.job_id)
          .single();
        if (jobError || !job) return new Response("Job not found", { status: 404 });
        if (job.status === "completed") {
          return Response.json({ ok: true, note: "already completed" });
        }

        const jobUpdate: TablesUpdate<"training_jobs"> = {
          status: payload.status,
          error_message:
            payload.status === "failed" ? (payload.error_message ?? "Training failed") : null,
        };
        if (payload.external_job_id) jobUpdate.external_job_id = payload.external_job_id;
        if (payload.metrics) jobUpdate.metrics = payload.metrics as Json;
        if (payload.curves) jobUpdate.curves = payload.curves as Json;

        const { error: updateError } = await supabaseAdmin
          .from("training_jobs")
          .update(jobUpdate)
          .eq("id", job.id);
        if (updateError) return new Response(updateError.message, { status: 500 });

        let modelVersionId: string | null = null;
        if (payload.status === "completed") {
          const { data: latest } = await supabaseAdmin
            .from("model_versions")
            .select("version")
            .eq("modality", job.modality)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();
          const { data: created, error: modelError } = await supabaseAdmin
            .from("model_versions")
            .insert({
              modality: job.modality,
              version: (latest?.version ?? 0) + 1,
              training_job_id: job.id,
              dataset_version_id: job.dataset_version_id,
              metrics: (payload.metrics ?? null) as Json,
              status: "inactive", // never auto-deploy
            })
            .select("id")
            .single();
          if (modelError) return new Response(modelError.message, { status: 500 });
          modelVersionId = created.id;
          await supabaseAdmin.from("admin_audit_logs").insert({
            actor_id: null,
            action: "training_completed",
            target_type: "training_job",
            target_id: job.id,
            details: { model_version_id: modelVersionId, modality: job.modality },
          });
        }

        return Response.json({ ok: true, model_version_id: modelVersionId });
      },
    },
  },
});
