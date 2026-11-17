import type { ReactNode } from "react";
import { AmbientBackground } from "@/components/neuro/AmbientBackground";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden px-5 pb-8 pt-10">
      <AmbientBackground />
      <div className="relative mx-auto w-full max-w-2xl">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
        )}
        <h1 className="mt-1 font-display text-2xl font-semibold leading-tight sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        {children}
      </div>
    </header>
  );
}
