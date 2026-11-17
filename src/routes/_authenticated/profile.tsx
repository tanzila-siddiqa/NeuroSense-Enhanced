import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/neuro/PageHeader";
import { Disclaimer } from "@/components/neuro/Disclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, role, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
  }, [profile?.full_name]);

  const { data: sessionCount } = useQuery({
    queryKey: ["session-count", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("screening_sessions")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  type ProfilePatch = {
    full_name?: string;
    notifications_enabled?: boolean;
    data_sharing_enabled?: boolean;
  };

  const updateProfile = async (patch: ProfilePatch, successMessage?: string) => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (error) {
      toast.error("Something went wrong while saving your settings. Please try again.");
      return;
    }
    await refreshProfile();
    if (successMessage) toast.success(successMessage);
  };

  const deleteHistory = async () => {
    if (!user) return;
    const { error } = await supabase.from("screening_sessions").delete().eq("user_id", user.id);
    if (error) {
      toast.error("We couldn't delete your history just now. Please try again.");
      return;
    }
    await queryClient.invalidateQueries();
    toast.success("Your screening history has been deleted.");
  };

  const deleteAccount = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").delete().eq("id", user.id);
    if (error) {
      toast.error("We couldn't delete your account data just now. Please try again.");
      return;
    }
    await supabase.auth.signOut();
    toast.success("Your account data has been deleted.");
    void navigate({ to: "/" });
  };

  return (
    <main>
      <PageHeader
        eyebrow="Profile"
        title={profile?.full_name ?? "Your profile"}
        subtitle={user?.email ?? ""}
      >
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <ShieldCheck aria-hidden="true" className="size-3.5" />
          {role === "admin" ? "Administrator" : "Member"}
        </p>
      </PageHeader>

      <section className="mx-auto w-full max-w-2xl space-y-4 px-5">
        <article className="surface-card p-5">
          <h2 className="font-display text-base font-semibold">Personal info</h2>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
          <Button
            className="mt-4 h-11 rounded-xl"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await updateProfile({ full_name: fullName }, "Profile updated");
              setSaving(false);
            }}
          >
            Save changes
          </Button>
        </article>

        <article className="surface-card p-5">
          <h2 className="font-display text-base font-semibold">Screening history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {sessionCount ?? 0} check-in{sessionCount === 1 ? "" : "s"} recorded in your account.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="mt-4 h-11 rounded-xl">
                <Trash2 aria-hidden="true" className="size-4" />
                Delete my screening history
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your screening history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes every check-in record from your account. This can't be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Keep it</AlertDialogCancel>
                <AlertDialogAction className="rounded-xl" onClick={() => void deleteHistory()}>
                  Delete history
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </article>

        <article className="surface-card space-y-4 p-5">
          <h2 className="font-display text-base font-semibold">Notifications & privacy</h2>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="notifications" className="text-sm font-normal">
              Check-in reminders
            </Label>
            <Switch
              id="notifications"
              checked={profile?.notifications_enabled ?? true}
              onCheckedChange={(checked) => void updateProfile({ notifications_enabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="sharing" className="text-sm font-normal">
              Contribute anonymised data to research
            </Label>
            <Switch
              id="sharing"
              checked={profile?.data_sharing_enabled ?? false}
              onCheckedChange={(checked) => void updateProfile({ data_sharing_enabled: checked })}
            />
          </div>
        </article>

        <article className="surface-card space-y-3 p-5">
          <h2 className="font-display text-base font-semibold">Account</h2>
          <Button
            variant="outline"
            className="h-11 w-full rounded-xl"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/" });
            }}
          >
            <LogOut aria-hidden="true" className="size-4" />
            Log out
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="h-11 w-full rounded-xl text-destructive">
                Delete my account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account data?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your profile, settings and screening history will be permanently removed and
                  you'll be signed out.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction className="rounded-xl" onClick={() => void deleteAccount()}>
                  Delete account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </article>

        <Disclaimer text="NeuroSense provides AI screening estimates and education only — it never provides a medical diagnosis." />
      </section>
    </main>
  );
}
