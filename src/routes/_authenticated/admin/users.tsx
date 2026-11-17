import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
  head: () => ({
    meta: [
      { title: "Members — NeuroSense Admin" },
      {
        name: "description",
        content: "Browse NeuroSense members, their roles and screening activity.",
      },
    ],
  }),
});

function UsersPage() {
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profiles, roles, sessions] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("screening_sessions").select("user_id, created_at"),
      ]);
      for (const r of [profiles, roles, sessions]) if (r.error) throw r.error;

      const roleMap = new Map<string, string>();
      for (const r of roles.data ?? []) {
        if (r.role === "admin") roleMap.set(r.user_id, "admin");
        else if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, r.role);
      }
      const counts = new Map<string, { count: number; last: string | null }>();
      for (const s of sessions.data ?? []) {
        const entry = counts.get(s.user_id) ?? { count: 0, last: null };
        entry.count += 1;
        if (!entry.last || s.created_at > entry.last) entry.last = s.created_at;
        counts.set(s.user_id, entry);
      }

      return (profiles.data ?? []).map((p) => ({
        ...p,
        role: roleMap.get(p.id) ?? "user",
        sessions: counts.get(p.id)?.count ?? 0,
        lastSession: counts.get(p.id)?.last ?? null,
      }));
    },
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold">Members</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone using NeuroSense, with their role and screening activity. Individual check-in
          content stays private to each member.
        </p>
      </div>

      <div className="surface-card p-5">
        <div className="relative max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search members"
            placeholder="Search by name or email"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {isLoading ? (
          <Skeleton className="mt-4 h-40 w-full rounded-2xl" />
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No members match that search.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead>Last check-in</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.role === "admin"
                            ? "bg-lavender/12 text-lavender"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{u.sessions}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.lastSession ? new Date(u.lastSession).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
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
