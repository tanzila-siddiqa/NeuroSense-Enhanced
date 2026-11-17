import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Boxes,
  Database,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/neuro/Logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const sections = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/datasets", label: "Datasets", icon: Database },
  { to: "/admin/training", label: "Training", icon: FlaskConical },
  { to: "/admin/models", label: "Models", icon: Boxes },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/audit", label: "Audit logs", icon: ScrollText },
] as const;

function AdminLayout() {
  const { role, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && role !== null && role !== "admin") void navigate({ to: "/home" });
  }, [loading, role, navigate]);

  if (loading || role === null) {
    return (
      <div className="min-h-screen bg-secondary/40 p-8">
        <Skeleton className="mx-auto h-40 w-full max-w-5xl rounded-3xl" />
      </div>
    );
  }
  if (role !== "admin") return null;

  return (
    <div className="min-h-screen bg-secondary/40">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/90 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="font-display text-sm font-semibold">NeuroSense Admin</span>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link to="/home">User app</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/" });
            }}
          >
            <LogOut aria-hidden="true" className="size-4" />
            Log out
          </Button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-6 sm:px-5 md:grid-cols-[210px_1fr] md:py-8">
        <nav
          aria-label="Admin navigation"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0"
        >
          {sections.map(({ to, label, icon: Icon, ...rest }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: "exact" in rest && rest.exact }}
              className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-card/70 hover:text-foreground"
              activeProps={{ className: "bg-card font-medium text-foreground shadow-soft" }}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <main className="min-w-0 space-y-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
