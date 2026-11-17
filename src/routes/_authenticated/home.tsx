import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BookOpen, Bot, FlaskConical, LineChart, Mic, PenLine, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/neuro/PageHeader";
import { Disclaimer } from "@/components/neuro/Disclaimer";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — NeuroSense" },
      { name: "description", content: "Your calm dashboard for drawing and voice check-ins, progress and companion chat." },
      { property: "og:title", content: "Home — NeuroSense" },
      { property: "og:description", content: "Your calm dashboard for drawing and voice check-ins, progress and companion chat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const cards = [
  {
    to: "/drawing",
    emoji: "✍️",
    icon: PenLine,
    title: "Drawing Check-In",
    body: "Spiral, circle and meander tracing.",
  },
  {
    to: "/voice",
    emoji: "🎤",
    icon: Mic,
    title: "Voice Check-In",
    body: "Record a short voice sample.",
  },
  {
    to: "/results",
    emoji: "🧩",
    icon: Sparkles,
    title: "Combined Results",
    body: "Drawing + voice fused, with tips.",
  },

  {
    to: "/progress",
    emoji: "📊",
    icon: LineChart,
    title: "Progress",
    body: "See how your check-ins change over time.",
  },
  {
    to: "/companion",
    emoji: "🤖",
    icon: Bot,
    title: "Companion",
    body: "Ask questions, get calm explanations.",
  },
  {
    to: "/simulation",
    emoji: "🧪",
    icon: FlaskConical,
    title: "Simulation",
    body: "See the difference between example patterns.",
  },
  {
    to: "/learn",
    emoji: "📚",
    icon: BookOpen,
    title: "Learn",
    body: "Plain-language articles about screening.",
  },
] as const;

function HomePage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  useEffect(() => {
    if (!loading && profile && !profile.onboarding_completed) {
      void navigate({ to: "/onboarding" });
    }
  }, [loading, profile, navigate]);

  return (
    <main>
      <PageHeader
        eyebrow="NeuroSense"
        title={`Good to see you, ${firstName} 👋`}
        subtitle="Ready for today's check-in?"
      />

      <section className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-3 px-5">
        {cards.map(({ to, emoji, icon: Icon, title, body }) => (
          <Link
            key={title}
            to={to}
            className="surface-card group flex min-h-[132px] flex-col justify-between p-4 transition-transform hover:-translate-y-0.5 hover:shadow-lift"
          >
            <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block font-display text-sm font-semibold">
                <span aria-hidden="true">{emoji} </span>
                {title}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {body}
              </span>
            </span>
          </Link>
        ))}
      </section>

      <div className="mx-auto mt-6 w-full max-w-2xl px-5">
        <Disclaimer text="NeuroSense offers AI screening estimates for education and self-tracking. It never provides a medical diagnosis." />
      </div>
    </main>
  );
}
