import { Check } from "lucide-react";
import { ASSESSMENT_STEPS } from "@/lib/assessment";
import { cn } from "@/lib/utils";

/** Small progress rail shown at the top of every guided assessment step. */
export function AssessmentSteps({ current }: { current: number }) {
  return (
    <ol className="mx-auto flex w-full max-w-2xl items-center gap-2 px-5" aria-label="Assessment progress">
      {ASSESSMENT_STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              className={cn(
                "h-1.5 w-full rounded-full transition-colors",
                done || active ? "bg-primary" : "bg-muted",
              )}
            />
            <span
              className={cn(
                "flex items-center gap-1 truncate text-[11px]",
                active ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {done && <Check aria-hidden="true" className="size-3 shrink-0" />}
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
