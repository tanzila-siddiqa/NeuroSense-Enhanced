import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface GaugeProps {
  value: number | null;
  label: string;
  size?: number;
  tone?: "primary" | "lavender" | "muted";
  className?: string;
}

/** Animated circular gauge. Respects prefers-reduced-motion via CSS transition utility. */
export function Gauge({ value, label, size = 108, tone = "primary", className }: GaugeProps) {
  const [shown, setShown] = useState(0);
  const target = value ?? 0;

  useEffect(() => {
    const id = window.setTimeout(() => setShown(target), 60);
    return () => window.clearTimeout(id);
  }, [target]);

  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(shown, 0), 100) / 100);
  const color =
    tone === "lavender" ? "text-lavender" : tone === "muted" ? "text-muted-foreground" : "text-primary";

  return (
    <figure className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${label}: ${value == null ? "no data" : `${value} percent`}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className={cn("stroke-current transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none", color)}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center">
          <span className="font-display text-xl font-semibold tabular-nums">
            {value == null ? "—" : `${value}%`}
          </span>
        </span>
      </div>
      <figcaption className="text-xs font-medium text-muted-foreground">{label}</figcaption>
    </figure>
  );
}
