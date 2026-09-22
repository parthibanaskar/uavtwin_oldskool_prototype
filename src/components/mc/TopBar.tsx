import { Activity, Radio, ShieldAlert } from "lucide-react";

import { useMission } from "@/lib/twin/store";
import { FLIGHT_PROFILES, SCENARIO_BY_KEY } from "@/lib/twin/profiles";
import { SUBSYSTEMS } from "@/lib/twin/types";
import { Chip, healthTone, toneText } from "./primitives";
import { cn } from "@/lib/utils";

function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const SUB_LABEL: Record<string, string> = {
  engine: "ENG",
  vibration: "VIB",
  lubrication: "OIL",
  fuel: "FUEL",
  electrical: "ELEC",
  nav: "NAV",
};

export function TopBar() {
  const { isDiverted, displayed, missionId, profile, cursor, navMode, fuelPath, sessionId, alerts, resolvedAlerts, clearAllFaults, selectAlert } = useMission();
  const health = displayed?.health;
  const tone = healthTone(health?.overall ?? 100);
  const activeCriticals = alerts.filter((a) => a.severity === "critical" && !resolvedAlerts.has(a.id));
  const activeWarnings = alerts.filter((a) => a.severity === "warning" && !resolvedAlerts.has(a.id));
  const criticalCount = activeCriticals.length;
  
  const rul = displayed?.sample.physics?.rul_seconds ?? 99999;
  let liveStatus = "LIVE STATUS: NOMINAL • MISSION PROCEEDING";
  let statusColor = "text-muted-foreground";
  const historyCount = displayed?.sample.physics?.fault_history_count ?? 0;

  if (historyCount > 0) {
    liveStatus = `LIVE STATUS: PROCEEDING WITH CAUTION • PAST ANOMALIES LOGGED (${historyCount})`;
    statusColor = "text-yellow-500/80 font-bold";
  }

  if (displayed?.sample.physics?.crashed) {
    liveStatus = "LIVE STATUS: HULL LOSS • CRASHED";
    statusColor = "text-destructive font-bold";
  } else if (displayed?.sample.physics?.landed) {
    liveStatus = "LIVE STATUS: SAFELY LANDED";
    statusColor = "text-emerald-500 font-bold";
  } else if (isDiverted) {
    const dist = displayed?.sample.physics?.mission_distance_km ?? 0;
    const etaSec = displayed?.sample.physics?.mission_time_seconds ?? 0;
    const etaStr = etaSec > 99999 ? "UNKNOWN" : etaSec < 120 ? `${Math.ceil(etaSec)}s` : `${Math.ceil(etaSec/60)}m`;
    liveStatus = `LIVE STATUS: DIVERTED TO FOB • DIST: ${dist.toFixed(1)}km • ETA: ${etaStr}`;
    statusColor = "text-amber-500 font-bold animate-pulse";
  } else if (rul < (displayed?.sample.physics?.mission_time_seconds ?? 0)) {
    liveStatus = "LIVE STATUS: CATASTROPHIC HULL LOSS PREDICTED • INSUFFICIENT RUL • DIVERT IMMEDIATELY";
    statusColor = "text-destructive font-bold animate-pulse";
  } else if (criticalCount > 0 || rul < 3600) {
    liveStatus = "LIVE STATUS: HEAVILY DAMAGED • CANNOT COMPLETE MISSION";
    statusColor = "text-destructive font-bold animate-pulse";
  } else if (activeWarnings.length > 0 || rul < 7200) {
    liveStatus = "LIVE STATUS: DEGRADED • PROCEED WITH CAUTION";
    statusColor = "text-amber-500 font-bold";
  }

  return (
    <header className="panel-surface flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded-sm border border-primary/40 bg-primary/10">
          <Activity className="size-4 text-primary" />
        </div>
          <div title={displayed?.sample.physics?.fault_history?.map(k => SCENARIO_BY_KEY[k]?.label || k).join("\n") || ""}>
            <h1 className="text-base leading-none font-semibold">UAV ENGINE MISSION CONTROL</h1>
            <p className={cn("text-[0.65rem] uppercase tracking-wider mt-1 cursor-help", statusColor)}>{liveStatus}</p>
          </div>
      </div>

      <div className="flex items-center gap-4 font-mono text-xs">
        <div>
          <p className="label-xs">Mission</p>
          <p className="text-foreground">{missionId}</p>
        </div>
        <div>
          <p className="label-xs">Mission time</p>
          <p className="text-foreground">{clock(displayed?.sample.t ?? 0)}</p>
        </div>
        <div>
          <p className="label-xs">Phase</p>
          <p className="text-foreground flex items-center gap-2">
            {displayed?.sample.physics?.crashed ? (
              <span className="text-destructive font-bold">CRASHED</span>
            ) : displayed?.sample.physics?.landed ? (
              <span className="text-emerald-500 font-bold">SAFELY LANDED</span>
            ) : isDiverted ? (
              <span className="text-amber-500 font-bold">
                {(displayed?.sample.physics?.mission_distance_km ?? 0) < 0.2 ? "LANDING GEARS DEPLOYED" :
                 (displayed?.sample.physics?.mission_distance_km ?? 0) < 1.0 ? "APPROACHING FOB" :
                 "DIVERTED TO FOB"}
              </span>
            ) : (
              FLIGHT_PROFILES[profile].label
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-center">
          <p className="label-xs">Fleet health</p>
          <p className={cn("font-mono text-2xl leading-none font-semibold", toneText[tone])}>
            {health?.overall ?? "--"}
            <span className="text-xs text-muted-foreground">/100</span>
          </p>
        </div>
        <div className="hidden gap-1 md:flex">
          {SUBSYSTEMS.map((sub) => {
            const v = health?.subsystems[sub] ?? 100;
            const t = healthTone(v);
            return (
              <div key={sub} className="rounded-sm border border-border bg-muted/40 px-1.5 py-1 text-center">
                <p className="label-xs leading-none">{SUB_LABEL[sub]}</p>
                <p className={cn("font-mono text-xs font-semibold", toneText[t])}>{v}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <button
          onClick={clearAllFaults}
          className="rounded-sm border border-border/50 bg-muted/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          Reset Twin
        </button>
        {criticalCount > 0 ? (
          <button 
            onClick={() => selectAlert(activeCriticals[0].id)}
            className="transition-transform hover:scale-105 active:scale-95"
            title="Click to view critical alerts"
          >
            <Chip tone="crit">
              <ShieldAlert className="size-3" /> {criticalCount} critical
            </Chip>
          </button>
        ) : null}
        <Chip tone={navMode === "gnss" ? "ok" : "warn"}>
          <Radio className="size-3" /> NAV {navMode === "gnss" ? "GNSS" : "INERTIAL DR"}
        </Chip>
        <Chip tone={fuelPath === "primary" ? "ok" : "warn"}>FUEL {fuelPath}</Chip>
        <Chip tone={cursor === null ? "ok" : "info"}>{cursor === null ? "LIVE" : "REPLAY"}</Chip>
      </div>
    </header>
  );
}
