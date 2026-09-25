import { useMission } from "@/lib/twin/store";
import { PARAM_SPECS, FLIGHT_PROFILES } from "@/lib/twin/profiles";
import { PARAM_KEYS } from "@/lib/twin/types";
import { Panel, Sparkline, Meter, healthTone, toneText } from "./primitives";
import { cn } from "@/lib/utils";

export function ParamGrid() {
  const { frames, displayed, profile, cursor } = useMission();
  const nominal = FLIGHT_PROFILES[profile].nominal;

  return (
    <Panel
      title="Live engine parameters"
      subtitle="8 channels · 0.75 s cadence · shared telemetry bus"
      bodyClassName="grid grid-cols-2 gap-2 overflow-auto"
    >
      {PARAM_KEYS.map((key) => {
        const spec = PARAM_SPECS[key];
        const value = displayed?.sample.params[key];
        const dev = displayed?.deviations[key] ?? 0;
        const tone = healthTone(
          Math.round(100 * (1 - Math.min(1, dev * 0.95))),
        );

        // Only show history up to the cursor for accurate replays
        const upToCursor =
          cursor !== null ? frames.slice(0, cursor + 1) : frames;
        const history = upToCursor.slice(-90).map((f) => f.sample.params[key]);

        const pct =
          value === undefined
            ? 0
            : ((value - spec.min) / (spec.max - spec.min)) * 100;
        return (
          <div
            key={key}
            className="rounded-sm border border-border/70 bg-muted/20 p-2"
          >
            <div className="flex items-baseline justify-between gap-1">
              <p className="label-xs truncate">{spec.label}</p>
              <span className={cn("font-mono text-[0.625rem]", toneText[tone])}>
                {tone === "ok"
                  ? "NOMINAL"
                  : tone === "warn"
                    ? "CAUTION"
                    : "EXCEED"}
              </span>
            </div>
            <p className="font-mono text-lg leading-tight font-semibold">
              {value === undefined ? "--" : value.toFixed(spec.decimals)}
              <span className="ml-1 text-[0.65rem] text-muted-foreground">
                {spec.unit}
              </span>
            </p>
            <Sparkline values={history} tone={tone} height={22} />
            <Meter value={pct} tone={tone} />
            <p className="label-xs mt-1">
              nom {nominal[key].toFixed(spec.decimals)} · lim {spec.limit}
            </p>
          </div>
        );
      })}
    </Panel>
  );
}
