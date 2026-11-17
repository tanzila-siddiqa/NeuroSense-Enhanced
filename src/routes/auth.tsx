import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AmbientBackground } from "@/components/neuro/AmbientBackground";
import { Logo } from "@/components/neuro/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup", "forgot"]).catch("signin").optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in to NeuroSense" },
      {
        name: "description",
        content:
          "Create your NeuroSense account or sign in to continue your drawing and voice check-ins.",
      },
      { property: "og:title", content: "Sign in to NeuroSense" },
      {
        property: "og:description",
        content: "Access your NeuroSense check-ins, progress and companion.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function friendlyError(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email or password doesn't match.";
  if (/already registered|already exists/i.test(message))
    return "An account with that email already exists. Try signing in.";
  if (/password/i.test(message) && /least/i.test(message))
    return "Please choose a password with at least 6 characters.";
  return "Something went wrong. Please try again in a moment.";
}

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode ?? "signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/home" });
  }, [loading, user, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/home`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Welcome to NeuroSense", { description: "Your account is ready." });
        void navigate({ to: "/onboarding" });
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        void navigate({ to: "/home" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your inbox", {
          description: "If that email is registered, a reset link is on its way.",
        });
        setMode("signin");
      }
    } catch (error) {
      toast.error(friendlyError(error instanceof Error ? error.message : ""));
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
  setBusy(true);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/home`,
    },
  });

  if (error) {
    setBusy(false);
    toast.error("We couldn't start Google sign-in. Please try again.");
  }
};
  const titles: Record<Mode, string> = {
    signin: "Welcome back",
    signup: "Create your account",
    forgot: "Reset your password",
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-10">
      <AmbientBackground />

      <Link to="/" className="relative mb-6 rounded-xl">
        <Logo />
      </Link>

      <div className="relative w-full max-w-md glass rounded-3xl p-6 shadow-lift sm:p-8">
        <h1 className="font-display text-2xl font-semibold">{titles[mode]}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {mode === "forgot"
            ? "We'll email you a secure link to choose a new password."
            : "Screening support only — never a medical diagnosis."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Your name</Label>
              <Input
                id="fullName"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Rivera"
                required
                className="h-12 rounded-xl bg-card"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="h-12 rounded-xl bg-card"
            />
          </div>

          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="rounded text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                className="h-12 rounded-xl bg-card"
              />
            </div>
          )}

          <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl shadow-glow">
            {busy && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
            {mode === "signup" ? "Create account" : mode === "signin" ? "Sign in" : "Send reset link"}
          </Button>
        </form>

        {mode !== "forgot" && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={googleSignIn}
              disabled={busy}
              className="h-12 w-full rounded-xl bg-card"
            >
              <Mail aria-hidden="true" className="size-4" />
              Continue with Google
            </Button>
          </>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signup" ? "Already have an account?" : "New to NeuroSense?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="rounded font-semibold text-primary underline-offset-2 hover:underline"
          >
            {mode === "signup" ? "Sign in" : "Create one"}
          </button>
        </p>
      </div>
    </main>
  );
}
