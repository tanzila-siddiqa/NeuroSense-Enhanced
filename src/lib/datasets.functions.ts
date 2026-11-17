import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const processDatasetVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { datasetVersionId: string }) => {
    if (!input?.datasetVersionId) throw new Error("datasetVersionId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: version, error: versionError } = await supabase
      .from("dataset_versions")
      .select("id, modality, storage_path")
      .eq("id", data.datasetVersionId)
      .single();
    if (versionError || !version) throw new Error("Dataset version not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { inventoryZip } = await import("./datasets.server");

    try {
      const download = await supabaseAdmin.storage.from("datasets").download(version.storage_path);
      if (download.error || !download.data) throw new Error("Could not read the uploaded file");

      const bytes = new Uint8Array(await download.data.arrayBuffer());
      const report = await inventoryZip(bytes, version.modality as "drawing" | "voice");

      if (report.samples.length > 0) {
        const rows = report.samples.map((s) => ({
          dataset_version_id: version.id,
          file_name: s.fileName,
          class_label: s.classLabel,
          file_size: s.fileSize,
          file_hash: s.fileHash,
          status: s.status,
        }));
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabaseAdmin.from("dataset_samples").insert(rows.slice(i, i + 500));
          if (error) throw error;
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from("dataset_versions")
        .update({
          status: "ready",
          total_files: report.total,
          valid_files: report.valid,
          invalid_files: report.invalid,
          duplicate_files: report.duplicate,
          class_counts: report.classCounts,
          error_message: null,
        })
        .eq("id", version.id);
      if (updateError) throw updateError;

      return {
        ok: true as const,
        total: report.total,
        valid: report.valid,
        invalid: report.invalid,
        duplicate: report.duplicate,
        classCounts: report.classCounts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Validation failed";
      await supabaseAdmin
        .from("dataset_versions")
        .update({ status: "failed", error_message: message })
        .eq("id", version.id);
      return { ok: false as const, error: message };
    }
  });
