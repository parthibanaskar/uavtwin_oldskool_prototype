import { useState } from "react";

import { useMission } from "@/lib/twin/store";
import { PARAM_SPECS } from "@/lib/twin/profiles";
import { PARAM_KEYS, type ParamKey } from "@/lib/twin/types";
import { Panel } from "./primitives";
import { cn } from "@/lib/utils";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-5)"];

export function TrendChart() {
  const { frames, cursor } = useMission();
  const [selected, setSelected] = useState<ParamKey[]>(["vibration", "egt", "oilPressure"]);

  const toggle = (key: ParamKey) =>
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev.slice(-3), key],
    );

  // If in replay mode, we must only plot up to the cursor so the graph correctly rewinds!
  const upToCursor = cursor !== null ? frames.slice(0, cursor + 1) : frames;
  const window = upToCursor.slice(-160);
  const H = 120;

  return (
    <Panel
      title="Parameter trends"
      subtitle={`${window.length} samples · normalised to channel range`}
      right={
        <div className="flex flex-wrap justify-end gap-1">
          {PARAM_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={cn(
                "rounded-sm border px-1 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider transition-colors",
                selected.includes(key)
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {key}
            </button>
          ))}
        </div>
      }
    >
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="h-[120px] w-full">
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1="0"
            x2="100"
            y1={H * g}
            y2={H * g}
            stroke="var(--grid)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {selected.map((key, idx) => {
          if (window.length < 2) return null;
          const series = window.map((f) => f.sample.params[key]);
          const lo = Math.min(...series);
          const hi = Math.max(...series);
          const span = hi - lo || 1;
          const pts = series
            .map((raw, i) => {
              const v = (raw - lo) / span;
              const x = (i / (series.length - 1)) * 100;
              const y = H - Math.min(1, Math.max(0, v)) * (H - 12) - 6;
              return `${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(" ");
          return (
            <polyline
              key={key}
              points={pts}
              fill="none"
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3">
        {selected.map((key, idx) => (
          <span key={key} className="flex items-center gap-1 font-mono text-[0.65rem]">
            <span
              className="inline-block h-0.5 w-4"
              style={{ backgroundColor: COLORS[idx % COLORS.length] }}
            />
            {PARAM_SPECS[key].label}
          </span>
        ))}
      </div>
    </Panel>
  );
}
