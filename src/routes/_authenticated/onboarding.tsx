import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Lock, Mic, PenLine, Sparkles, Waves } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AmbientBackground } from "@/components/neuro/AmbientBackground";
import { Logo } from "@/components/neuro/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Get started — NeuroSense" },
      { name: "description", content: "A short walkthrough of drawing and voice check-ins, privacy and what results mean." },
      { property: "og:title", content: "Get started — NeuroSense" },
      { property: "og:description", content: "A short walkthrough of drawing and voice check-ins, privacy and what results mean." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

const steps = [
  {
    icon: Sparkles,
    title: "Welcome to NeuroSense",
    body: "A calm space to explore subtle patterns in how you draw and speak. Everything here is educational — never a diagnosis.",
  },
  {
    icon: Waves,
    title: "How it works",
    body: "You complete two short activities. NeuroSense visualises what it sees and shares an AI-estimated screening score with plain-language context.",
  },
  {
    icon: PenLine,
    title: "The drawing activity",
    body: "Trace a spiral, a circle and a meander with your finger, stylus or mouse. Draw naturally — there's no perfect result.",
  },
  {
    icon: Mic,
    title: "The voice activity",
    body: "Record a short voice sample in the app. You'll see a live waveform while you speak, and you can re-record any time.",
  },
  {
    icon: Lock,
    title: "Your privacy",
    body: "Drawings and recordings are stored privately in your account. Only you can see them, and you can delete your screening history whenever you like.",
  },
];

function Onboarding() {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const step = steps[index]!;
  const Icon = step.icon;
  const isLast = index === steps.length - 1;

  const finish = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error("Something went wrong while saving your setup. Please try again.");
      return;
    }
    await refreshProfile();
    void navigate({ to: "/checkin" });
  };

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden px-5 pb-10 pt-8">
      <AmbientBackground />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col">
        <Logo />

        <div
          className="mt-6 flex gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
          aria-label={`Step ${index + 1} of ${steps.length}`}
        >
          {steps.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= index ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>

        <div key={step.title} className="glass mt-8 flex-1 rounded-3xl p-7 shadow-lift animate-rise">
          <span className="grid size-14 place-items-center rounded-3xl gradient-mint text-primary-foreground shadow-glow">
            <Icon aria-hidden="true" className="size-6" />
          </span>
          <h1 className="mt-6 font-display text-2xl font-semibold leading-tight">{step.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        </div>

        <div className="mt-6 flex items-center gap-3">
          {index > 0 && (
            <Button
              variant="ghost"
              className="h-12 rounded-xl"
              onClick={() => setIndex((i) => i - 1)}
            >
              Back
            </Button>
          )}
          <Button
            className="h-12 flex-1 rounded-xl shadow-glow"
            disabled={busy}
            onClick={() => (isLast ? void finish() : setIndex((i) => i + 1))}
          >
            {isLast ? "Start check-in" : "Continue"}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>

        <button
          type="button"
          onClick={() => void finish()}
          className="mx-auto mt-4 rounded text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
        >
          Skip introduction
        </button>
      </div>
    </main>
  );
}
