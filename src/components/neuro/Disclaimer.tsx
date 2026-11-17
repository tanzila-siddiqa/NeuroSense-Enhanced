import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Disclaimer({
  className,
  text = "This is an AI screening estimate and is not a medical diagnosis.",
}: {
  className?: string;
  text?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-xl bg-muted/70 px-3 py-2 text-xs leading-relaxed text-muted-foreground",
        className,
      )}
    >
      <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{text}</span>
    </p>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-lavender/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-lavender",
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-lavender" />
      Demo Mode
    </span>
  );
}
