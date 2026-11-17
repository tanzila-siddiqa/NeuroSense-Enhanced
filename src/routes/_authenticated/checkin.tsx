import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Mic, PenLine, Route as RouteIcon } from "lucide-react";
import { PageHeader } from "@/components/neuro/PageHeader";
import { Disclaimer } from "@/components/neuro/Disclaimer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/checkin")({
  head: () => ({
    meta: [
      { title: "Check-in — NeuroSense" },
      { name: "description", content: "Start a short drawing and voice check-in. Screening support only — not a diagnosis." },
      { property: "og:title", content: "Check-in — NeuroSense" },
      { property: "og:description", content: "Start a short drawing and voice check-in. Screening support only — not a diagnosis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckIn,
});

const activities: {
  icon: typeof PenLine;
  emoji: string;
  title: string;
  body: string;
  duration: string;
  to: "/drawing" | "/voice";
}[] = [
  {
    icon: PenLine,
    emoji: "✍️",
    title: "Drawing check-in",
    body: "Three short tracings — spiral, circle and meander — with a live speed graph while you draw.",
    duration: "~3 minutes",
    to: "/drawing",
  },
  {
    icon: Mic,
    emoji: "🎤",
    title: "Voice check-in",
    body: "A short in-app recording with a live waveform, level meter, live voice graph and replay before you submit.",
    duration: "~1 minute",
    to: "/voice",
  },
];

function CheckIn() {
  return (
    <main>
      <PageHeader
        eyebrow="Today's check-in"
        title="Two calm activities 🧠"
        subtitle="Draw naturally, speak normally. There's nothing to get right."
      />

      <section className="mx-auto w-full max-w-2xl space-y-3 px-5">
        <article className="surface-card border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
              <RouteIcon aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold">
                <span aria-hidden="true">🧩 </span>
                Full guided assessment
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                One calm flow: drawing check, then voice check, then both results are fused into a single final estimate.
              </p>
              <p className="mt-2 text-xs font-medium text-primary">~4 minutes</p>
            </div>
          </div>
          <Button asChild className="mt-4 h-11 w-full rounded-xl">
            <Link to="/drawing" search={{ flow: "assessment" }}>
              Start full assessment
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </article>

        {activities.map(({ icon: Icon, emoji, title, body, duration, to }) => (
          <article key={title} className="surface-card p-5">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold">
                  <span aria-hidden="true">{emoji} </span>
                  {title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
                <p className="mt-2 text-xs font-medium text-primary">{duration}</p>
              </div>
            </div>
            <Button asChild className="mt-4 h-11 w-full rounded-xl">
              <Link to={to}>Start {title.split(" ")[0]?.toLowerCase()} activity</Link>
            </Button>
          </article>
        ))}

        <Disclaimer text="Check-in results are AI screening estimates for education and self-tracking — never a medical diagnosis." />
      </section>
    </main>
  );
}
