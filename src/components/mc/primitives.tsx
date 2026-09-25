import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/twin/types";

export function healthTone(value: number) {
  if (value >= 80) return "ok" as const;
  if (value >= 55) return "warn" as const;
  return "crit" as const;
}

export const toneText: Record<"ok" | "warn" | "crit" | "info", string> = {
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
  info: "text-info",
};

export const toneBg: Record<"ok" | "warn" | "crit" | "info", string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  crit: "bg-crit",
  info: "bg-info",
};

export function severityTone(severity: Severity) {
  if (severity === "critical") return "crit" as const;
  if (severity === "warning") return "warn" as const;
  if (severity === "advisory") return "info" as const;
  return "ok" as const;
}

export function Panel({
  title,
  subtitle,
  right,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel-surface flex min-h-0 flex-col", className)}>
      <header className="flex items-center justify-between gap-2 border-b border-border/80 px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-[0.82rem] font-semibold uppercase tracking-[0.14em] text-foreground">
            {title}
          </h2>
          {subtitle ? <p className="label-xs truncate">{subtitle}</p> : null}
        </div>
        {right}
      </header>
      <div className={cn("min-h-0 flex-1 p-3", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Chip({
  children,
  tone = "info",
  className,
}: {
  children: ReactNode;
  tone?: "ok" | "warn" | "crit" | "info" | "muted";
  className?: string;
}) {
  const map = {
    ok: "border-ok/50 text-ok bg-ok/10",
    warn: "border-warn/50 text-warn bg-warn/10",
    crit: "border-crit/60 text-crit bg-crit/10",
    info: "border-info/50 text-info bg-info/10",
    muted: "border-border text-muted-foreground bg-muted/40",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.12em]",
        map[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Sparkline({
  values,
  tone = "info",
  height = 26,
}: {
  values: number[];
  tone?: "ok" | "warn" | "crit" | "info";
  height?: number;
}) {
  if (values.length < 2) return <div style={{ height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = height - ((v - min) / span) * (height - 3) - 1.5;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const stroke = {
    ok: "var(--ok)",
    warn: "var(--warn)",
    crit: "var(--crit)",
    info: "var(--primary)",
  }[tone];
  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function Meter({
  value,
  tone,
}: {
  value: number;
  tone: "ok" | "warn" | "crit" | "info";
}) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          toneBg[tone],
        )}
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  );
}
