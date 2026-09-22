import { AlertTriangle, TriangleAlert } from "lucide-react";
import { useMission } from "@/lib/twin/store";
import { PARAM_SPECS } from "@/lib/twin/profiles";
import type { ParamKey } from "@/lib/twin/types";

export function MasterAlarmBanner() {
  const { alerts, resolvedAlerts, setResolvedAlerts, live, clearFault, reduceThrottle, setFuelPath, commandSafeLanding, applyHealAction, divert } = useMission();

  // Find the highest severity active alert (critical or warning only)
  const activeAlerts = alerts.filter((a) => !resolvedAlerts.has(a.id) && (a.severity === "critical" || a.severity === "warning"));
  const hasCritical = activeAlerts.some((a) => a.severity === "critical");
  
  // Find the most severe alert to show in the banner
  const topAlert = [...activeAlerts].sort((a, b) => {
    const rank = { critical: 3, warning: 2, advisory: 1, nominal: 0 };
    return rank[b.severity] - rank[a.severity];
  })[0];

  // Find physical parameter deviations that are high but haven't necessarily triggered a full AI fault yet
  const activeDeviations: { key: ParamKey; dev: number }[] = [];
  if (live?.deviations) {
    for (const [k, v] of Object.entries(live.deviations)) {
      if (v > 0.4) activeDeviations.push({ key: k as ParamKey, dev: v });
    }
  }

  if (activeAlerts.length === 0 && activeDeviations.length === 0) {
    return null; // All green
  }

  const handleFixAll = () => {
    activeAlerts.forEach(a => {
      const clears: Record<string, string[]> = {
        bearingWear: ["bearingWear"],
        propImbalance: ["propImbalance"],
        oilPressureDrop: ["oilStarvation"],
        fuelDelivery: ["fuelBlockage", "fuelPumpDegrade"],
        electricalFault: ["busSag"],
        egtDrift: ["sensorDrift"],
        vibSensorFail: ["vibSensorFail"],
        gpsSpoofing: ["gpsSpoof"],
        icingLoad: ["icing"],
        hiddenRedundancy: ["sensorDrift", "vibSensorFail"],
      };
      
      const toClear = clears[a.key] || [a.key];
      const hasPhysicalFaults = activeAlerts.some(a => !["prescriptiveDivert", "imminentCrash", "prescriptiveThrottle", "landingApproach", "landingGears", "landingFlare", "landingTouchdown", "crashDetected", "cascadingFailures", "bearingPermanentDamage"].includes(a.key));

      if (a.key === "prescriptiveDivert" || a.key === "imminentCrash" || a.key === "cascadingFailures" || a.key === "bearingPermanentDamage") {
        if (!hasPhysicalFaults) {
          commandSafeLanding("Safdarjung Airport (VDSJ)");
          divert(28.58, 77.20);
        }
      } else if (a.key === "prescriptiveThrottle") {
        reduceThrottle();
      } else if (a.key === "fuelDelivery") {
        setFuelPath("secondary");
        toClear.forEach(c => clearFault(c));
      } else if (a.key === "gpsSpoof") {
        toClear.forEach(c => clearFault(c));
      } else {
        toClear.forEach(c => clearFault(c));
      }
      
      setResolvedAlerts((prev) => new Set(prev).add(a.id));
      applyHealAction(a.key);
    });
  };

  return (
    <div className="flex flex-col gap-1 shrink-0">
      {topAlert && (
        <div
          className={`flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm font-semibold uppercase tracking-wider shadow-[0_0_15px_rgba(239,68,68,0.2)] ${
            hasCritical
              ? "border-red-500/50 bg-red-500/20 text-red-400"
              : "border-orange-500/50 bg-orange-500/20 text-orange-400"
          }`}
        >
          <TriangleAlert className="size-4 shrink-0 animate-pulse" />
          <span className="truncate">
            MASTER CAUTION: {topAlert.title}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[0.65rem] text-muted-foreground mt-0.5">
              {activeAlerts.length} ACTIVE ANOMALIES
            </span>
            <button
              onClick={handleFixAll}
              className="px-2 py-0.5 rounded-sm bg-black/40 border border-white/20 text-white text-[0.65rem] hover:bg-white/20 transition-colors"
            >
              EXECUTE ALL FIXES
            </button>
          </div>
        </div>
      )}

      {activeDeviations.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-sm border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs text-yellow-500">
          <AlertTriangle className="size-3 shrink-0" />
          <span className="font-semibold uppercase tracking-wider mr-1">Abnormal Physical Symptoms:</span>
          {activeDeviations.map((d) => (
            <span key={d.key} className="rounded-sm bg-yellow-500/20 px-1.5 py-0.5 font-mono">
              {PARAM_SPECS[d.key].label} ({(d.dev * 100).toFixed(0)}% tolerance limit)
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

