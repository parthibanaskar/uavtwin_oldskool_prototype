import { useState } from "react";
import { PlaneLanding } from "lucide-react";

import { useMission } from "@/lib/twin/store";
import { DIVERT_SITES, isReachable, minutesToDistance, haversineDistance, calculateBearing } from "@/lib/twin/selfheal";
import { Chip, Panel } from "./primitives";
import { cn } from "@/lib/utils";

export function SafeLanding() {
  const { rul, commandSafeLanding, divert, navMode, displayed } = useMission();
  
  // Calculate worst RUL from the heuristic linear regression
  let worstRul = Object.values(rul).reduce<number | null>(
    (min, v) => (v === null || v === undefined ? min : min === null ? v : Math.min(min, v)),
    null,
  );
  
  // Also factor in the PyTorch PINN physics engine RUL if it's available!
  const pinnRul = typeof displayed?.sample.physics?.rul_seconds === "number" ? displayed.sample.physics.rul_seconds / 60.0 : null;
  if (pinnRul !== null) {
    worstRul = worstRul === null ? pinnRul : Math.min(worstRul, pinnRul);
  }

  const [pending, setPending] = useState<string | null>(null);
  const [committed, setCommitted] = useState<string | null>(null);
  
  const currentLat = displayed?.sample.gps.lat ?? 28.6139;
  const currentLon = displayed?.sample.gps.lon ?? 77.2090;

  if (displayed?.sample.physics?.crashed) {
    return (
      <Panel title="Mission Terminated" subtitle="CATASTROPHIC FAILURE" bodyClassName="grid place-items-center p-6 text-center border-red-500/50 bg-red-950/20">
        <PlaneLanding className="size-8 text-red-500 mb-2 rotate-90" />
        <h3 className="font-bold text-lg text-red-500 uppercase tracking-widest">AIRCRAFT CRASHED</h3>
        <p className="text-xs text-muted-foreground mt-2">Unmitigated fatigue led to structural failure. The UAV has suffered a hull loss.</p>
      </Panel>
    );
  }

  if (displayed?.sample.physics?.landed) {
    return (
      <Panel title="Safe landing planner" subtitle="Mission Terminated" bodyClassName="grid place-items-center p-6 text-center">
        <PlaneLanding className="size-8 text-green-400 mb-2" />
        <h3 className="font-bold text-lg text-green-400 uppercase tracking-widest">Landed & Grounded</h3>
        <p className="text-xs text-muted-foreground mt-2">The UAV has successfully diverted and is safely grounded at the designated divert airbase.</p>
          <button 
            onClick={() => window.dispatchEvent(new Event('open-pfr'))}
            className="mt-6 px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-sm text-xs font-mono uppercase tracking-widest hover:bg-green-500/30 transition-colors"
          >
            Open Post-Flight Review
          </button>
      </Panel>
    );
  }

  return (
    <Panel
      title="Safe landing planner"
      subtitle={
        worstRul === null
          ? "No degradation trend · all fields reachable"
          : `Worst remaining life ${worstRul > 120 ? (worstRul / 60).toFixed(1) + " hours" : worstRul.toFixed(0) + " min"}`
      }
      right={<Chip tone={navMode === "gnss" ? "ok" : "warn"}>NAV {navMode}</Chip>}
      bodyClassName="space-y-2 p-3"
    >
      <div className="relative mx-auto aspect-square w-full max-w-[190px] rounded-full border border-border/70 bg-muted/15">
        <div className="absolute inset-[22%] rounded-full border border-border/50" />
        <div className="absolute inset-[44%] rounded-full border border-border/40" />
        <div className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)] animate-pulse z-10" />
        
        <svg className="absolute inset-0 size-full pointer-events-none">
          {DIVERT_SITES.map((site) => {
            if (committed !== site.id) return null;
            const distKm = haversineDistance(currentLat, currentLon, site.lat, site.lon);
            const bearing = calculateBearing(currentLat, currentLon, site.lat, site.lon);
            const r = Math.min(0.46, (distKm / 100) * 0.46);
            const rad = ((bearing - 90) * Math.PI) / 180;
            return (
              <line
                key={`line-${site.id}`}
                x1="50%"
                y1="50%"
                x2={`${50 + Math.cos(rad) * r * 100}%`}
                y2={`${50 + Math.sin(rad) * r * 100}%`}
                className="stroke-primary stroke-2 opacity-70"
                strokeDasharray="4 3"
              />
            );
          })}
        </svg>

        {DIVERT_SITES.map((site) => {
          const distKm = haversineDistance(currentLat, currentLon, site.lat, site.lon);
          const bearing = calculateBearing(currentLat, currentLon, site.lat, site.lon);
          const r = Math.min(0.46, (distKm / 100) * 0.46); // 100km radar radius
          const rad = ((bearing - 90) * Math.PI) / 180;
          const ok = isReachable(distKm, worstRul);
          return (
            <button
              key={site.id}
              onClick={() => setPending(site.id)}
              className={cn(
                "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm",
                ok ? "bg-ok" : "bg-crit",
                committed === site.id && "ring-2 ring-primary",
              )}
              style={{
                left: `${50 + Math.cos(rad) * r * 100}%`,
                top: `${50 + Math.sin(rad) * r * 100}%`,
              }}
              title={site.name}
            />
          );
        })}
      </div>

      <div className="space-y-1">
        {DIVERT_SITES.map((site) => {
          const distKm = haversineDistance(currentLat, currentLon, site.lat, site.lon);
          const ok = isReachable(distKm, worstRul);
          return (
            <button
              key={site.id}
              onClick={() => {
                if (pending === site.id) {
                  commandSafeLanding(site.id);
                  divert(site.lat, site.lon);
                  setCommitted(site.id);
                  setPending(null);
                } else {
                  setPending(site.id);
                }
              }}
              className={cn(
                "w-full rounded-sm border p-2 text-left transition-colors",
                ok ? "border-border/50 hover:bg-muted/30" : "border-crit/30 bg-crit/10 hover:border-crit/50",
                committed === site.id && "border-primary bg-primary/10",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlaneLanding
                    className={cn(
                      "size-4",
                      ok ? "text-muted-foreground" : "text-crit",
                      committed === site.id && "text-primary",
                    )}
                  />
                  <div>
                    <p className="text-xs font-semibold">{site.name}</p>
                    <p className="text-[0.65rem] text-muted-foreground uppercase tracking-widest">
                      {site.surface} • {site.lengthM}m
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono">{distKm.toFixed(1)} km</p>
                  <p className={cn("text-[0.65rem]", ok ? "text-muted-foreground" : "text-crit font-bold")}>
                    ETA {minutesToDistance(distKm) > 120 ? (minutesToDistance(distKm) / 60).toFixed(1) + "h" : minutesToDistance(distKm).toFixed(0) + "m"}
                  </p>
                </div>
              </div>
              {pending === site.id && (
                <div className="mt-2 flex gap-2">
                  <span className="flex-1 rounded-sm bg-primary py-1 text-center text-xs font-bold text-primary-foreground">
                    CONFIRM DIVERT
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {pending ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
          <div className="panel-surface w-full max-w-sm space-y-3 p-4">
            <div className="flex items-center gap-2">
              <PlaneLanding className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">Confirm safe-landing sequence</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {DIVERT_SITES.find((s) => s.id === pending)?.name} will be uploaded as the active
              divert field. Power is derated for glide reserve and the command is written to the
              tamper-evident black box.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPending(null)}
                className="rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const site = DIVERT_SITES.find((s) => s.id === pending);
                  if (site) {
                    commandSafeLanding(site.name);
                    divert(site.lat, site.lon);
                    setCommitted(site.id);
                  }
                  setPending(null);
                }}
                className="rounded-sm bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Commit landing
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
