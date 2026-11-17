import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pause, Play, RotateCcw, Shuffle } from "lucide-react";
import { PageHeader } from "@/components/neuro/PageHeader";
import { Disclaimer } from "@/components/neuro/Disclaimer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/simulation")({
  head: () => ({
    meta: [
      { title: "Simulation — NeuroSense" },
      { name: "description", content: "Educational animated drawing simulations. Examples only — not diagnostic." },
      { property: "og:title", content: "Simulation — NeuroSense" },
      { property: "og:description", content: "Educational animated drawing simulations. Examples only — not diagnostic." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Simulation,
});

type Shape = "spiral" | "circle" | "meander";

function buildPath(shape: Shape, jitter: number, seed: number) {
  const rand = (i: number) => {
    const x = Math.sin(seed * 9301 + i * 49297) * 233280;
    return (x - Math.floor(x)) * 2 - 1;
  };
  const points: string[] = [];
  const steps = 320;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let x: number;
    let y: number;
    if (shape === "spiral") {
      const angle = t * Math.PI * 6;
      const radius = 8 + t * 70;
      x = 100 + Math.cos(angle) * radius;
      y = 100 + Math.sin(angle) * radius;
    } else if (shape === "circle") {
      const angle = t * Math.PI * 2;
      x = 100 + Math.cos(angle) * 72;
      y = 100 + Math.sin(angle) * 72;
    } else {
      x = 18 + t * 164;
      y = 100 + Math.sin(t * Math.PI * 5) * 46;
    }
    x += rand(i) * jitter;
    y += rand(i + 500) * jitter;
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(" ");
}

function Simulation() {
  const [shape, setShape] = useState<Shape>("spiral");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [seed, setSeed] = useState(1);
  const [runKey, setRunKey] = useState(0);
  const smoothRef = useRef<SVGPathElement>(null);
  const irregularRef = useRef<SVGPathElement>(null);

  const smooth = useMemo(() => buildPath(shape, 0, seed), [shape, seed]);
  const irregular = useMemo(() => buildPath(shape, 3.4, seed + 7), [shape, seed]);

  useEffect(() => {
    for (const ref of [smoothRef, irregularRef]) {
      const path = ref.current;
      if (!path) continue;
      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      path.style.transition = "none";
      // force reflow so the new dashoffset applies before animating
      void path.getBoundingClientRect();
      if (playing) {
        path.style.transition = `stroke-dashoffset ${(6 / speed).toFixed(2)}s linear`;
        path.style.strokeDashoffset = "0";
      }
    }
  }, [smooth, irregular, playing, speed, runKey]);

  const panels: { label: string; note: string; path: string; ref: typeof smoothRef }[] = [
    {
      label: "Steadier example",
      note: "Even spacing, consistent curvature.",
      path: smooth,
      ref: smoothRef,
    },
    {
      label: "More irregular example",
      note: "Small wobbles and uneven spacing.",
      path: irregular,
      ref: irregularRef,
    },
  ];

  return (
    <main>
      <PageHeader
        eyebrow="Simulation"
        title="See the difference 🧪"
        subtitle="Procedurally generated example tracings — nobody's real data."
      />

      <section className="mx-auto w-full max-w-2xl space-y-4 px-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a shape">
          {(["spiral", "circle", "meander"] as Shape[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={shape === s ? "default" : "outline"}
              className="rounded-xl capitalize"
              onClick={() => {
                setShape(s);
                setRunKey((k) => k + 1);
              }}
            >
              {s}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {panels.map((panel) => (
            <figure key={panel.label} className="surface-card p-4">
              <svg viewBox="0 0 200 200" className="w-full" role="img" aria-label={panel.label}>
                <path
                  ref={panel.ref}
                  d={panel.path}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
              <figcaption className="mt-2">
                <span className="block font-display text-sm font-semibold">{panel.label}</span>
                <span className="block text-xs text-muted-foreground">{panel.note}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="surface-card flex flex-wrap items-center gap-2 p-4">
          <Button
            size="sm"
            className="rounded-xl"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
          >
            {playing ? (
              <Pause aria-hidden="true" className="size-4" />
            ) : (
              <Play aria-hidden="true" className="size-4" />
            )}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => setRunKey((k) => k + 1)}
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Replay
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              setSeed((s) => s + 1);
              setRunKey((k) => k + 1);
            }}
          >
            <Shuffle aria-hidden="true" className="size-4" />
            Randomize
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl"
            onClick={() => setSpeed((v) => (v >= 2 ? 0.5 : v * 2))}
          >
            Speed {speed}×
          </Button>
        </div>

        <Disclaimer text="Educational simulation only. These examples are generated by code and are not diagnostic." />
      </section>
    </main>
  );
}
