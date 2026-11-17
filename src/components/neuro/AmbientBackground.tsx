/**
 * Soft animated ambient background: gradient blobs + faint neural-network lines.
 * Purely decorative, hidden from assistive tech, respects prefers-reduced-motion
 * (animations are neutralised globally in styles.css).
 */
export function AmbientBackground({ dense = false }: { dense?: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-24 -top-32 h-72 w-72 rounded-full bg-primary/25 blur-3xl animate-float-slow sm:h-96 sm:w-96" />
      <div className="absolute -right-28 top-24 h-64 w-64 rounded-full bg-lavender/20 blur-3xl animate-float-slower sm:h-80 sm:w-80" />
      <div className="absolute bottom-[-6rem] left-1/3 h-72 w-72 rounded-full bg-primary/15 blur-3xl animate-breathe" />
      {dense && (
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.16]"
          viewBox="0 0 400 400"
          preserveAspectRatio="xMidYMid slice"
        >
          <g stroke="currentColor" className="text-primary" strokeWidth="0.4" fill="none">
            <path d="M20 60 L110 120 L190 80 L280 150 L370 100" />
            <path d="M40 300 L120 240 L210 290 L300 220 L380 270" />
            <path d="M110 120 L120 240" />
            <path d="M190 80 L210 290" />
            <path d="M280 150 L300 220" />
          </g>
          <g className="text-primary" fill="currentColor">
            {[
              [20, 60],
              [110, 120],
              [190, 80],
              [280, 150],
              [370, 100],
              [40, 300],
              [120, 240],
              [210, 290],
              [300, 220],
              [380, 270],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" className="animate-breathe" />
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}
