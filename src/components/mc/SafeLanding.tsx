import { useState } from "react";
import { PlaneLanding } from "lucide-react";

import { useMission } from "@/lib/twin/store";
import {
  DIVERT_SITES,
  isReachable,
  minutesToDistance,
  haversineDistance,
  calculateBearing,
} from "@/lib/twin/selfheal";
import { Chip, Panel } from "./primitives";
import { cn } from "@/lib/utils";

function LandingCameraSequence({
  siteName,
  altFt,
}: {
  siteName: string;
  altFt: number;
}) {
  // Convert feet to meters for display
  const altM = Math.round(altFt * 0.3048);
  const scale = Math.max(1, 600 / (altFt * 0.3048 + 50));
  const descentRate = altFt > 10 ? -4.2 : 0;

  const isDown = altM <= 5;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[190px] rounded-sm border border-emerald-500/30 bg-[#0a101d] overflow-hidden font-mono flex flex-col mb-4">
      {/* Scanning line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500/50 animate-[scan_2s_linear_infinite]" />
      <style>{`
          @keyframes scan {
            0% { transform: translateY(-10px); }
            100% { transform: translateY(200px); }
          }
       `}</style>

      {/* Crosshairs */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-emerald-500/30" />
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-emerald-500/30" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 border border-emerald-500/50 rounded-full" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-emerald-500/30 rounded-full animate-[spin_4s_linear_infinite]"
        style={{
          borderTopColor: "transparent",
          borderBottomColor: "transparent",
        }}
      />

      {/* Fake Runway Graphics (Scales up) */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-100 ease-linear"
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <div className="w-6 h-24 bg-zinc-800 border border-zinc-600 flex flex-col items-center justify-center opacity-80">
          <div
            className="w-[1px] h-full"
            style={{ borderLeft: "1px dashed rgba(255,255,255,0.5)" }}
          />
        </div>
      </div>

      {/* HUD Overlays */}
      <div className="absolute top-1 left-1 text-[8px] text-emerald-500 flex flex-col leading-tight">
        <span className="font-bold">OPTICAL FLOW</span>
        <span>TGT: {siteName.substring(0, 8)}</span>
        <span>RATE: {descentRate.toFixed(1)} m/s</span>
      </div>

      <div className="absolute bottom-1 right-1 text-sm font-bold text-emerald-500 flex items-end drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        {altM}{" "}
        <span className="text-[8px] ml-0.5 mb-0.5 text-emerald-500/70">
          M AGL
        </span>
      </div>

      <div className="absolute bottom-1 left-1 text-[8px] text-emerald-500 font-bold bg-emerald-500/20 px-1 rounded-sm">
        {isDown ? "TOUCHDOWN" : "AUTOLAND"}
      </div>
    </div>
  );
}

export function SafeLanding() {
  const { rul, commandSafeLanding, divert, navMode, displayed } = useMission();

  let worstRul = Object.values(rul).reduce<number | null>(
    (min, v) =>
      v === null || v === undefined ? min : min === null ? v : Math.min(min, v),
    null,
  );

  const pinnRul =
    typeof displayed?.sample.physics?.rul_seconds === "number"
      ? displayed.sample.physics.rul_seconds / 60.0
      : null;
  if (pinnRul !== null) {
    worstRul = worstRul === null ? pinnRul : Math.min(worstRul, pinnRul);
  }

  const [pending, setPending] = useState<string | null>(null);
  const [committed, setCommitted] = useState<string | null>(null);

  // Use real GPS coordinates from telemetry (sample.gps, not params which has engine data)
  const currentLat = displayed?.sample.gps?.lat ?? 28.6139; // Default: New Delhi area
  const currentLon = displayed?.sample.gps?.lon ?? 77.209;

  // Real altitude from physics engine
  const altFt = displayed?.sample.physics?.altitude_ft ?? 0;

  // Show optical flow camera ONLY when landing mode is active (gears deploying, approaching FOB)
  // This is driven by the physics engine, not by a button press
  const landingMode = displayed?.sample.physics?.landing_mode === true;
  const isLanded = displayed?.sample.physics?.landed === true;
  const showCamera = committed !== null && landingMode;

  if (isLanded) {
    return (
      <Panel title="Safe landing planner" bodyClassName="p-4 text-center">
        <PlaneLanding className="mx-auto mb-2 size-8 text-green-500" />
        <h3 className="text-lg font-bold text-green-500">VEHICLE ON GROUND</h3>
        <p className="text-sm text-muted-foreground">
          UAV has successfully executed emergency landing sequence at the
          designated divert airbase.
        </p>
        <button
          onClick={() => window.dispatchEvent(new Event("open-pfr"))}
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
          ? "No degradation trend — all fields reachable"
          : `Worst remaining life ${worstRul > 120 ? (worstRul / 60).toFixed(1) + " hours" : worstRul.toFixed(0) + " min"}`
      }
      right={
        <Chip tone={navMode === "gnss" ? "ok" : "warn"}>NAV {navMode}</Chip>
      }
      bodyClassName="space-y-2 p-3"
    >
      {showCamera ? (
        <LandingCameraSequence
          siteName={
            DIVERT_SITES.find((s) => s.id === committed)?.name || "RUNWAY"
          }
          altFt={altFt}
        />
      ) : (
        <div className="relative mx-auto aspect-square w-full max-w-[190px] rounded-full border border-border/70 bg-muted/15">
          <div className="absolute inset-[22%] rounded-full border border-border/50" />
          <div className="absolute inset-[44%] rounded-full border border-border/40" />
          <div className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)] animate-pulse z-10" />

          <svg className="absolute inset-0 size-full pointer-events-none">
            {DIVERT_SITES.map((site) => {
              if (committed !== site.id) return null;
              const distKm = haversineDistance(
                currentLat,
                currentLon,
                site.lat,
                site.lon,
              );
              const bearing = calculateBearing(
                currentLat,
                currentLon,
                site.lat,
                site.lon,
              );
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
            const distKm = haversineDistance(
              currentLat,
              currentLon,
              site.lat,
              site.lon,
            );
            const bearing = calculateBearing(
              currentLat,
              currentLon,
              site.lat,
              site.lon,
            );
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
      )}

      <div className="space-y-1">
        {DIVERT_SITES.map((site) => {
          const distKm = haversineDistance(
            currentLat,
            currentLon,
            site.lat,
            site.lon,
          );
          const ok = isReachable(distKm, worstRul);
          return (
            <button
              key={site.id}
              onClick={() => {
                if (pending === site.id) {
                  commandSafeLanding(site.name);
                  divert(site.lat, site.lon);
                  setCommitted(site.id);
                  setPending(null);
                  // Camera will auto-show when physics.landing_mode becomes true
                } else {
                  setPending(site.id);
                }
              }}
              className={cn(
                "w-full rounded-sm border p-2 text-left transition-colors",
                ok
                  ? "border-border/50 hover:bg-muted/30"
                  : "border-crit/30 bg-crit/10 hover:border-crit/50",
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
                  <p
                    className={cn(
                      "text-[0.65rem]",
                      ok ? "text-muted-foreground" : "text-crit font-bold",
                    )}
                  >
                    ETA{" "}
                    {minutesToDistance(distKm) > 120
                      ? (minutesToDistance(distKm) / 60).toFixed(1) + "h"
                      : minutesToDistance(distKm).toFixed(0) + "m"}
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
    </Panel>
  );
}
