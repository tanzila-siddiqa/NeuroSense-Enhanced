import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditPage,
  head: () => ({
    meta: [
      { title: "Audit log — NeuroSense Admin" },
      {
        name: "description",
        content: "A record of every administrative action taken in NeuroSense.",
      },
    ],
  }),
});

function AuditPage() {
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const [logs, profiles] = await Promise.all([
        supabase
          .from("admin_audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(300),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      for (const r of [logs, profiles]) if (r.error) throw r.error;
      const names = new Map(
        (profiles.data ?? []).map((p) => [p.id, p.full_name ?? p.email ?? "Unknown"]),
      );
      return (logs.data ?? []).map((l) => ({
        ...l,
        actor: l.actor_id ? (names.get(l.actor_id) ?? "Unknown") : "Training service",
      }));
    },
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        (l.target_type ?? "").toLowerCase().includes(q) ||
        l.actor.toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every dataset upload, training run and model activation is recorded here with who did it
          and when.
        </p>
      </div>

      <div className="surface-card p-5">
        <Input
          aria-label="Search audit log"
          placeholder="Filter by action, type or person"
          className="max-w-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {isLoading ? (
          <Skeleton className="mt-4 h-40 w-full rounded-2xl" />
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{log.actor}</TableCell>
                    <TableCell className="font-medium">{log.action.replaceAll("_", " ")}</TableCell>
                    <TableCell className="text-muted-foreground">{log.target_type ?? "—"}</TableCell>
                    <TableCell className="max-w-[22rem] truncate text-xs text-muted-foreground">
                      {Object.entries((log.details ?? {}) as Record<string, unknown>)
                        .map(([k, v]) => `${k.replaceAll("_", " ")}: ${String(v)}`)
                        .join(" · ") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
