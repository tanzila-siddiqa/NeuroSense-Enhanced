import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AmbientBackground } from "@/components/neuro/AmbientBackground";
import { Logo } from "@/components/neuro/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password | NeuroSense" },
      { name: "description", content: "Set a new password for your NeuroSense account." },
      { property: "og:title", content: "Choose a new password | NeuroSense" },
      { property: "og:description", content: "Set a new password for your NeuroSense account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error("We couldn't update your password. Try requesting a new reset link.");
      return;
    }
    toast.success("Password updated");
    void navigate({ to: "/home" });
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5">
      <AmbientBackground />
      <Logo />
      <form onSubmit={submit} className="relative w-full max-w-md glass rounded-3xl p-6 shadow-lift">
        <h1 className="font-display text-2xl font-semibold">Choose a new password</h1>
        <div className="mt-6 space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl bg-card"
          />
        </div>
        <Button type="submit" disabled={busy} className="mt-6 h-12 w-full rounded-xl">
          {busy && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
          Update password
        </Button>
      </form>
    </main>
  );
}
