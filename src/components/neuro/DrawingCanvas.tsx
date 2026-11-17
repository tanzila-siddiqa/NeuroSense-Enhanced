
import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveGraph } from "@/components/neuro/LiveGraph";
import {
  computeMetrics,
  guidePath,
  recentSpeed,
  type DrawingMetrics,
  type DrawingTask,
  type StrokePoint,
} from "@/lib/drawing";

export function DrawingCanvas({
  task,
  onFinish,
  busy = false,
}: {
  task: DrawingTask;
  onFinish: (metrics: DrawingMetrics, blob: Blob) => void;
  busy?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<StrokePoint[][]>([]);
  const drawingRef = useRef(false);

  const [size, setSize] = useState({ w: 320, h: 380 });

  const [metrics, setMetrics] = useState<DrawingMetrics>(() =>
    computeMetrics([]),
  );

  const [speed, setSpeed] = useState(0);
  const [speedTrace, setSpeedTrace] = useState<number[]>([]);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const h = Math.max(
        300,
        Math.min(560, Math.round(window.innerHeight * 0.5)),
      );

      setSize({
        w: Math.round(rect.width),
        h,
      });
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "oklch(0.55 0.07 176)";

    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;

      ctx.beginPath();
      ctx.moveTo(stroke[0]!.x, stroke[0]!.y);

      for (let i = 1; i < stroke.length; i += 1) {
        ctx.lineTo(stroke[i]!.x, stroke[i]!.y);
      }

      ctx.stroke();
    }
  }, [size]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const point = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ): StrokePoint => {
    const rect = e.currentTarget.getBoundingClientRect();

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: performance.now(),
    };
  };

  const sync = () => {
    const currentMetrics = computeMetrics(strokesRef.current);
    setMetrics(currentMetrics);

    const currentSpeed = recentSpeed(strokesRef.current);

    setSpeed(currentSpeed);

    setSpeedTrace((prev) =>
      [...prev, currentSpeed].slice(-120),
    );
  };

  const handleDown = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    if (busy) return;

    e.currentTarget.setPointerCapture(e.pointerId);

    drawingRef.current = true;

    strokesRef.current.push([point(e)]);

    setHasInk(true);

    sync();
  };

  const handleMove = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    if (!drawingRef.current) return;

    strokesRef.current[
      strokesRef.current.length - 1
    ]?.push(point(e));

    redraw();
    sync();
  };

  const handleUp = () => {
    drawingRef.current = false;
    setSpeed(0);
    sync();
  };

  const clear = () => {
    strokesRef.current = [];

    setHasInk(false);
    setSpeedTrace([]);
    setSpeed(0);

    setMetrics(computeMetrics([]));

    redraw();
  };

  const undo = () => {
    strokesRef.current.pop();

    setHasInk(strokesRef.current.length > 0);

    sync();
    redraw();
  };

  const finish = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const final = computeMetrics(strokesRef.current);

    const exportCanvas = document.createElement("canvas");

    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;

    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    // White background.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(
      0,
      0,
      exportCanvas.width,
      exportCanvas.height,
    );

    // Match the coordinate system used by the visible canvas.
    const dpr = window.devicePixelRatio || 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Dark drawing for ML input.
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#111111";

    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;

      ctx.beginPath();
      ctx.moveTo(stroke[0]!.x, stroke[0]!.y);

      for (let i = 1; i < stroke.length; i += 1) {
        ctx.lineTo(
          stroke[i]!.x,
          stroke[i]!.y,
        );
      }

      ctx.stroke();
    }

    exportCanvas.toBlob((blob) => {
      if (blob) {
        onFinish(final, blob);
      }
    }, "image/png");
  };

  return (
    <div className="space-y-3">
      <div
        ref={wrapRef}
        className="surface-card relative overflow-hidden p-0"
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          width={size.w}
          height={size.h}
        >
          <path
            d={guidePath(task, size.w, size.h)}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray="6 8"
            className="text-primary/20"
          />
        </svg>

        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Drawing area for the ${task} tracing task`}
          className="relative block touch-none"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        />
      </div>

      <div className="surface-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Live movement visualization
        </p>

        <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
          {[
            [
              "Duration",
              `${(metrics.durationMs / 1000).toFixed(1)}s`,
            ],
            ["Strokes", `${metrics.strokeCount}`],
            ["Points", `${metrics.pointCount}`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl bg-muted/60 px-2 py-2"
            >
              <dt className="text-[11px] text-muted-foreground">
                {label}
              </dt>

              <dd className="font-display text-base font-semibold tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Speed</span>

            <span className="tabular-nums">
              {speed || metrics.avgSpeed} px/s
            </span>
          </div>

          <div
            className="mt-1 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Current drawing speed"
            aria-valuenow={Math.min(
              100,
              Math.round((speed / 900) * 100),
            )}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150 motion-reduce:transition-none"
              style={{
                width: `${Math.min(
                  100,
                  (speed / 900) * 100,
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      <LiveGraph
        values={speedTrace}
        label="Live speed graph"
        unit=" px/s"
      />

      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          className="h-11 rounded-xl"
          onClick={clear}
          disabled={!hasInk || busy}
        >
          <Eraser
            aria-hidden="true"
            className="size-4"
          />
          Clear
        </Button>

        <Button
          variant="outline"
          className="h-11 rounded-xl"
          onClick={undo}
          disabled={!hasInk || busy}
        >
          <RotateCcw
            aria-hidden="true"
            className="size-4"
          />
          Undo
        </Button>

        <Button
          className="h-11 rounded-xl"
          onClick={finish}
          disabled={!hasInk || busy}
        >
          <Check
            aria-hidden="true"
            className="size-4"
          />
          Finish
        </Button>
      </div>
    </div>
  );
}
