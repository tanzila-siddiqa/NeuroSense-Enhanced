import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { statusTone } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [profiles, sessions, datasets, jobs, models, recent] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("screening_sessions").select("id", { count: "exact", head: true }),
        supabase.from("dataset_versions").select("id", { count: "exact", head: true }),
        supabase
          .from("training_jobs")
          .select("id", { count: "exact", head: true })
          .in("status", ["queued", "running"]),
        supabase.from("model_versions").select("modality, version, status").eq("status", "active"),
        supabase
          .from("admin_audit_logs")
          .select("id, action, target_type, created_at")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      for (const r of [profiles, sessions, datasets, jobs, models, recent]) if (r.error) throw r.error;
      return {
        users: profiles.count ?? 0,
        sessions: sessions.count ?? 0,
        datasets: datasets.count ?? 0,
        activeJobs: jobs.count ?? 0,
        activeModels: models.data ?? [],
        recent: recent.data ?? [],
      };
    },
  });

  const stats = [
    { label: "Members", value: data?.users },
    { label: "Screening sessions", value: data?.sessions },
    { label: "Dataset versions", value: data?.datasets },
    { label: "Jobs in progress", value: data?.activeJobs },
  ];

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A snapshot of members, data and models. Real inference stays in Demo Mode until a model
          is explicitly activated for each modality.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-28 w-full rounded-3xl" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="surface-card p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-display text-3xl font-semibold">{s.value ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface-card p-5">
          <h2 className="font-display text-base font-semibold">Active models</h2>
          <ul className="mt-3 space-y-2">
            {(["drawing", "voice"] as const).map((modality) => {
              const active = data?.activeModels.find((m) => m.modality === modality);
              return (
                <li
                  key={modality}
                  className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 text-sm"
                >
                  <span className="capitalize">{modality}</span>
                  {active ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone("active")}`}>
                      v{active.version} active
                    </span>
                  ) : (
                    <span className="rounded-full bg-lavender/12 px-2 py-0.5 text-xs font-medium text-lavender">
                      Demo Mode
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <Link
            to="/admin/models"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary"
          >
            Open model registry <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </section>

        <section className="surface-card p-5">
          <h2 className="font-display text-base font-semibold">Recent admin activity</h2>
          {data?.recent.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {data.recent.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    <span className="font-medium">{log.action.replaceAll("_", " ")}</span>
                    {log.target_type && (
                      <span className="text-muted-foreground"> · {log.target_type}</span>
                    )}
                  </span>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No admin actions recorded yet.</p>
          )}
        </section>
      </div>
    </>
  );
}
