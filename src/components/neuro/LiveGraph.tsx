interface LiveGraphProps {
  values: number[];
  max?: number;
  label: string;
  unit?: string;
  height?: number;
  accent?: "primary" | "lavender";
}

/** Rolling live line chart. Purely a visualisation of raw signal — no medical meaning. */
export function LiveGraph({
  values,
  max,
  label,
  unit = "",
  height = 96,
  accent = "primary",
}: LiveGraphProps) {
  const width = 300;
  const peak = Math.max(max ?? 0, ...values, 1);
  const count = Math.max(values.length, 2);
  const points = values.map((v, i) => {
    const x = (i / (count - 1)) * width;
    const y = height - (Math.min(v, peak) / peak) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = points.join(" ");
  const area = points.length
    ? `0,${height} ${line} ${width},${height}`
    : `0,${height} ${width},${height}`;
  const stroke = accent === "lavender" ? "text-lavender" : "text-primary";
  const latest = values[values.length - 1] ?? 0;

  return (
    <div className="surface-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {Math.round(latest)}
          {unit}
        </p>
      </div>
      <svg
        role="img"
        aria-label={`${label}, latest value ${Math.round(latest)}${unit}`}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="mt-3 block h-24 w-full"
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0}
            x2={width}
            y1={height * f}
            y2={height * f}
            stroke="currentColor"
            strokeWidth={1}
            className="text-muted-foreground/20"
          />
        ))}
        {values.length > 1 && (
          <>
            <polygon points={area} fill="currentColor" className={`${stroke} opacity-10`} />
            <polyline
              points={line}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className={stroke}
            />
          </>
        )}
      </svg>
    </div>
  );
}
