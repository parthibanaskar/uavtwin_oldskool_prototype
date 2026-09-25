import { useEffect, useState } from "react";
import { CheckCircle2, Wrench, Zap, Activity, AlertTriangle, X, PlaneLanding } from "lucide-react";
import { useMission } from "@/lib/twin/store";
import { cn } from "@/lib/utils";
import { PARAM_SPECS, FLIGHT_PROFILES } from "@/lib/twin/profiles";
import { DIVERT_SITES, haversineDistance } from "@/lib/twin/selfheal";
import type { Alert } from "@/lib/twin/types";

interface FixStep {
  id: string;
  label: string;
  detail: string;
  sensorKey?: string;
  sensorBefore?: string;
  sensorAfter?: string;
  status: "pending" | "running" | "done";
}

interface FixSession {
  alertTitle: string;
  alertKey: string;
  severity: string;
  steps: FixStep[];
  startedAt: number;
}

/** Build a rich real-time fix plan from the alert + current live telemetry */
function buildFixPlan(alert: Alert, live: ReturnType<typeof useMission>["live"]): FixStep[] {
  const p = live?.sample?.params;
  const phys = live?.sample?.physics;
  const fmt = (v: number, decimals = 1) => v.toFixed(decimals);

  const plans: Record<string, FixStep[]> = {
    bearingWear: [
      {
        id: "bw1",
        label: "Feathering propeller & derating to 82% power",
        detail: `Current RPM: ${p ? fmt(p.rpm, 0) : "—"} RPM → Target: ${p ? fmt(p.rpm * 0.82, 0) : "—"} RPM (-18%). Reduces radial bearing load and halts BPFO spall growth.`,
        sensorKey: "rpm",
        sensorBefore: p ? `${fmt(p.rpm, 0)} RPM` : "—",
        sensorAfter: p ? `${fmt(p.rpm * 0.82, 0)} RPM` : "—",
        status: "pending",
      },
      {
        id: "bw2",
        label: "Engaging active vibration dampeners",
        detail: `Vibration RMS currently at ${p ? fmt(p.vibration, 2) : "—"} g. Dampeners and gyroscopic stabilizer engaged to eliminate harmonic feedback to the bearing race.`,
        sensorKey: "vibration",
        sensorBefore: p ? `${fmt(p.vibration, 2)} g` : "—",
        sensorAfter: p ? `${fmt(Math.max(0.5, p.vibration * 0.4), 2)} g` : "—",
        status: "pending",
      },
      {
        id: "bw3",
        label: "Raising accelerometer sampling rate to 4 Hz",
        detail: "Finer BPFO trend resolution enabled. Edge controller will monitor for spall acceleration.",
        status: "pending",
      },
    ],
    icingLoad: [
      {
        id: "ice1",
        label: "Activating induction anti-ice bleed heat",
        detail: `EGT currently at ${p ? fmt(p.egt, 0) : "—"} °C. Bleed air from compressor stage being routed to intake, raising intake temp above 0°C to melt ice accumulation.`,
        sensorKey: "egt",
        sensorBefore: p ? `${fmt(p.egt, 0)} °C` : "—",
        sensorAfter: p ? `${fmt(p.egt - 120, 0)} °C` : "—",
        status: "pending",
      },
      {
        id: "ice2",
        label: "Commanding centrifugal propeller ice shedding",
        detail: `RPM surge to ${p ? fmt((p.rpm || 5000) * 1.08, 0) : "—"} RPM for 3 seconds to shed ice centrifugally from blade leading edges. RPM will return to cruise after shed.`,
        sensorKey: "rpm",
        sensorBefore: p ? `${fmt(p.rpm, 0)} RPM (dragged by ice)` : "—",
        sensorAfter: p ? `${fmt((p.rpm || 5000) * 1.0, 0)} RPM (restored)` : "—",
        status: "pending",
      },
    ],
    oilStarvation: [
      {
        id: "oil1",
        label: "Switching to auxiliary electric oil scavenger pump",
        detail: `Primary pump output detected at ${p ? fmt(p.oilPressure, 1) : "—"} kPa (below ${FLIGHT_PROFILES[live?.sample?.profile || "cruise"].nominal.oilPressure} kPa nominal). Aux pump engaged to restore gallery pressure.`,
        sensorKey: "oilPressure",
        sensorBefore: p ? `${fmt(p.oilPressure, 1)} kPa` : "—",
        sensorAfter: `${FLIGHT_PROFILES[live?.sample?.profile || "cruise"].nominal.oilPressure} kPa (target)`,
        status: "pending",
      },
      {
        id: "oil2",
        label: "Reducing power to loiter RPM to limit heat generation",
        detail: `Oil temp is ${p ? fmt(p.oilTemp, 1) : "—"} °C. Reducing to loiter profile (5400 RPM) to cut thermal load on oil circuit while aux pump catches up.`,
        sensorKey: "oilTemp",
        sensorBefore: p ? `${fmt(p.oilTemp, 1)} °C` : "—",
        sensorAfter: "Cooling toward nominal",
        status: "pending",
      },
    ],
    fuelDelivery: [
      {
        id: "fuel1",
        label: "Isolating degraded primary fuel pump",
        detail: `Fuel flow at ${p ? fmt(p.fuelFlow, 2) : "—"} L/h — ${p ? ((1 - p.fuelFlow / FLIGHT_PROFILES[live?.sample?.profile || "cruise"].nominal.fuelFlow) * 100).toFixed(0) : "—"}% below nominal. Closing primary pump isolation valve.`,
        sensorKey: "fuelFlow",
        sensorBefore: p ? `${fmt(p.fuelFlow, 2)} L/h` : "—",
        sensorAfter: `${FLIGHT_PROFILES[live?.sample?.profile || "cruise"].nominal.fuelFlow} L/h (target on secondary)`,
        status: "pending",
      },
      {
        id: "fuel2",
        label: "Opening secondary fuel path & re-trimming governor",
        detail: "Secondary delivery line bypasses the failed pump and restricted filter. ECU governor re-trimmed for backup path flow characteristics.",
        status: "pending",
      },
    ],
    egtOvertemp: [
      {
        id: "egt1",
        label: "Enriching fuel mixture by 6%",
        detail: `EGT at ${p ? fmt(p.egt, 0) : "—"} °C (nominal ${FLIGHT_PROFILES[live?.sample?.profile || "cruise"].nominal.egt} °C). Richer mixture shifts combustion away from peak EGT, cooling turbine section by ~${p ? fmt((p.egt - FLIGHT_PROFILES[live?.sample?.profile || "cruise"].nominal.egt) * 0.6, 0) : "—"} °C.`,
        sensorKey: "egt",
        sensorBefore: p ? `${fmt(p.egt, 0)} °C` : "—",
        sensorAfter: p ? `~${fmt(FLIGHT_PROFILES[live?.sample?.profile || "cruise"].nominal.egt + (p.egt - FLIGHT_PROFILES[live?.sample?.profile || "cruise"].nominal.egt) * 0.4, 0)} °C` : "—",
        status: "pending",
      },
      {
        id: "egt2",
        label: "Derating to 88% continuous power",
        detail: `RPM reduced to reduce combustion gas temperature. Thermal protection clamped at 88% max continuous.`,
        sensorKey: "rpm",
        sensorBefore: p ? `${fmt(p.rpm, 0)} RPM` : "—",
        sensorAfter: p ? `${fmt(p.rpm * 0.88, 0)} RPM` : "—",
        status: "pending",
      },
    ],
    propImbalance: [
      {
        id: "prop1",
        label: "Avoiding 5,900–6,300 RPM resonant band",
        detail: `Current RPM: ${p ? fmt(p.rpm, 0) : "—"}. Governor limit re-programmed to skip the resonant band and hold at ${p ? (p.rpm > 5900 ? "5,800" : "6,400") : "5,800"} RPM where imbalance harmonics do not amplify.`,
        sensorKey: "rpm",
        sensorBefore: p ? `${fmt(p.rpm, 0)} RPM (in resonant band)` : "—",
        sensorAfter: "5,800 or 6,400 RPM (skip band)",
        status: "pending",
      },
    ],
    busSag: [
      {
        id: "bus1",
        label: "Shedding non-essential electrical loads",
        detail: `Bus voltage at ${p ? fmt(p.busVoltage, 1) : "—"} V (nominal ${FLIGHT_PROFILES[live?.sample?.profile || "cruise"].nominal.busVoltage} V). Payload heaters, downlink amplifier, and nav display dimmed to reduce draw by ~8A.`,
        sensorKey: "busVoltage",
        sensorBefore: p ? `${fmt(p.busVoltage, 1)} V` : "—",
        sensorAfter: `${FLIGHT_PROFILES[live?.sample?.profile || "cruise"].nominal.busVoltage} V (target)`,
        status: "pending",
      },
      {
        id: "bus2",
        label: "Transferring avionics to backup battery bus",
        detail: "Flight computer and autopilot transferred to isolated 24V battery bus. Generator output drop no longer affects flight-critical systems.",
        status: "pending",
      },
    ],
    prescriptiveThrottle: [
      {
        id: "thr1",
        label: "Reducing fly-by-wire throttle by 15%",
        detail: `Current RPM: ${p ? fmt(p.rpm, 0) : "—"} RPM → Target: ${p ? fmt(p.rpm * 0.85, 0) : "—"} RPM. Cubic stress law: 15% RPM drop = ${((1 - 0.85 ** 3) * 100).toFixed(0)}% reduction in shaft stress → RUL extended.`,
        sensorKey: "rpm",
        sensorBefore: p ? `${fmt(p.rpm, 0)} RPM` : "—",
        sensorAfter: p ? `${fmt(p.rpm * 0.85, 0)} RPM (−15%)` : "—",
        status: "pending",
      },
      {
        id: "thr2",
        label: "Recalculating mission RUL projection",
        detail: `Hypothetical RUL at reduced throttle: ${phys?.hypo_rul_seconds ? fmt(phys.hypo_rul_seconds / 60, 1) : "—"} min. Mission time remaining: ${phys?.mission_time_seconds ? fmt(phys.mission_time_seconds / 60, 1) : "—"} min. Safety margin recalculated.`,
        status: "pending",
      },
    ],
    gpsSpoof: [
      {
        id: "gps1",
        label: "Rejecting GNSS feed — switching to inertial navigation",
        detail: "GNSS fix flagged as spoofed (signal anomaly confirmed by dual-antenna phase comparison). Navigation now relying on IMU dead reckoning + terrain elevation matching.",
        status: "pending",
      },
      {
        id: "gps2",
        label: "Freezing waypoint updates from satellite",
        detail: "Autopilot waypoint buffer locked. Spoofed position data cannot redirect the aircraft. Ground Control Station notified via encrypted black-box entry.",
        status: "pending",
      },
    ],
    prescriptiveDivert: [
      {
        id: "div1",
        label: "Locking in divert target: Safdarjung Airport (VDSJ)",
        detail: `RUL: ${phys?.rul_seconds ? fmt(phys.rul_seconds / 60, 1) : "—"} min. Mission time: ${phys?.mission_time_seconds ? fmt(phys.mission_time_seconds / 60, 1) : "—"} min. Mission is physically unachievable. Aborting primary waypoints.`,
        status: "pending",
      },
      {
        id: "div2",
        label: "Commanding autonomous divert trajectory",
        detail: "Flight director computing shortest-path intercept to VDSJ. Ailerons and rudder deploying for coordinated turn. Engine transitioning to descent profile.",
        status: "pending",
      },
    ],
  };

  if (alert.key.startsWith("suddenShift_")) {
    const paramKey = alert.key.replace("suddenShift_", "");
    const val = p ? (p as any)[paramKey] : 0;
    
    if (paramKey === "fuelFlow") {
      return [
        {
          id: "ss_f1",
          label: "Isolating primary fuel pump & engaging secondary path",
          detail: `Anomaly detected in fuel flow signature. Rerouting delivery through auxiliary lines to bypass potential blockage or pump degradation.`,
          sensorKey: "fuelFlow",
          sensorBefore: p ? `${fmt(p.fuelFlow, 1)} L/h` : "—",
          sensorAfter: p ? `${fmt(p.fuelFlow * 1.05, 1)} L/h` : "—",
          status: "pending",
        },
        {
          id: "ss_f2",
          label: "Re-trimming governor for new fuel flow dynamics",
          detail: `Recalibrating electronic governor to maintain target RPM on the secondary path. Mixture enriched to prevent lean blowout during transition.`,
          status: "pending",
        },
      ];
    }
    
    return [
      {
        id: "ss_g1",
        label: `Re-calibrating ${alert.subsystem} actuator setpoints`,
        detail: `XAI identified a deviation in ${paramKey} (${val ? val.toFixed(1) : "—"}). Reverting PID controller limits to nominal profiles to arrest exponential divergence.`,
        status: "pending",
      },
      {
        id: "ss_g2",
        label: "Isolating affected sensor bus & resetting edge model",
        detail: "Switching to redundant sensor polling and clearing corrupted state from the physics-informed neural network.",
        status: "pending",
      }
    ];
  }

  return plans[alert.key] ?? [
    {
      id: "generic1",
      label: `Clearing ${alert.key} fault from edge controller`,
      detail: `Subsystem: ${alert.subsystem}. Fault key "${alert.key}" will be purged from the active fault register. All physical actuator states will be restored to nominal.`,
      status: "pending",
    },
  ];
}

interface Props {
  alert: Alert;
  onDone: () => void;
}

function FixProgressPanel({ alert, onDone }: Props) {
  const { live, commandSafeLanding, divert } = useMission();
  const [steps, setSteps] = useState<FixStep[]>(() => buildFixPlan(alert, live));
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(100); // countdown bar 100→0
  const [diverted, setDiverted] = useState(false);
  const AUTO_DISMISS_MS = 12000; // 12 seconds to read before auto-dismiss

  // Divert-type alerts that should show the big DIVERT button
  const DIVERT_ALERTS = ["bearingPermanentDamage", "cascadingFailures", "prescriptiveDivert", "imminentCrash"];
  const isDivertAlert = DIVERT_ALERTS.includes(alert.key);

  // Nearest reachable divert site
  const lat = live?.sample?.gps?.lat ?? 28.6139;
  const lon = live?.sample?.gps?.lon ?? 77.2090;
  const nearestSite = DIVERT_SITES.reduce((best, site) => {
    const d = haversineDistance(lat, lon, site.lat, site.lon);
    const bd = haversineDistance(lat, lon, best.lat, best.lon);
    return d < bd ? site : best;
  }, DIVERT_SITES[0]);

  function handleDivertNow() {
    commandSafeLanding(nearestSite.name);
    divert(nearestSite.lat, nearestSite.lon);
    setDiverted(true);
    onDone();
  }

  useEffect(() => {
    if (done) return;

    const runStep = (index: number) => {
      if (index >= steps.length) {
        setDone(true);
        return;
      }

      setSteps(prev => prev.map((s, i) => i === index ? { ...s, status: "running" } : s));

      const delay = 700 + Math.random() * 400;
      const timer = setTimeout(() => {
        setSteps(prev => prev.map((s, i) => i === index ? { ...s, status: "done" } : s));
        setCurrentStep(index + 1);
        runStep(index + 1);
      }, delay);

      return () => clearTimeout(timer);
    };

    const cleanup = runStep(0);
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown progress bar: only starts after all steps are done
  useEffect(() => {
    if (!done) return;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p <= 0) { clearInterval(interval); onDone(); return 0; }
        return p - (100 / (AUTO_DISMISS_MS / 100));
      });
    }, 100);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const severityColor = alert.severity === "critical"
    ? "border-red-500/50 text-red-400"
    : alert.severity === "warning"
    ? "border-orange-500/50 text-orange-400"
    : "border-blue-500/50 text-blue-400";

  return (
    <div className={cn(
      "rounded border bg-black/80 backdrop-blur-md p-4 shadow-2xl w-full max-w-lg",
      severityColor
    )}>
      {/* Header */}
      <div className="flex items-start gap-2 mb-4 pb-3 border-b border-border/40">
        <Wrench className="size-4 mt-0.5 text-primary shrink-0 animate-pulse" />
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] text-muted-foreground uppercase tracking-widest mb-0.5">
            Executing Autonomous Fix
          </p>
          <p className="text-sm font-bold text-white truncate">{alert.title}</p>
          <p className="text-[0.65rem] text-muted-foreground mt-0.5">
            {steps.filter(s => s.status === "done").length} of {steps.length} actions complete
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {done && <CheckCircle2 className="size-5 text-green-400" />}
          {/* Close / dismiss button */}
          <button
            onClick={onDone}
            className="rounded p-0.5 text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
            title="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div
            key={step.id}
            className={cn(
              "rounded border p-3 transition-all duration-300",
              step.status === "done" ? "border-green-500/30 bg-green-500/5" :
              step.status === "running" ? "border-primary/50 bg-primary/5 shadow-[0_0_12px_rgba(99,102,241,0.15)]" :
              "border-border/20 bg-muted/5 opacity-50"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              {step.status === "done" ? (
                <CheckCircle2 className="size-3.5 text-green-400 shrink-0" />
              ) : step.status === "running" ? (
                <Activity className="size-3.5 text-primary shrink-0 animate-pulse" />
              ) : (
                <div className="size-3.5 rounded-full border border-border/40 shrink-0" />
              )}
              <span className={cn(
                "text-xs font-semibold",
                step.status === "done" ? "text-green-400" :
                step.status === "running" ? "text-primary" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
            <p className="text-[0.65rem] text-muted-foreground leading-snug pl-5">
              {step.detail}
            </p>
            {/* Before/after sensor values */}
            {(step.sensorBefore || step.sensorAfter) && (
              <div className="mt-2 ml-5 flex gap-4 font-mono text-[0.6rem]">
                {step.sensorBefore && (
                  <span className="text-red-400/80">
                    ← {step.sensorBefore}
                  </span>
                )}
                {step.sensorAfter && step.status !== "pending" && (
                  <span className={cn(
                    "transition-colors",
                    step.status === "done" ? "text-green-400" : "text-muted-foreground"
                  )}>
                    → {step.sensorAfter}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* BIG DIVERT BUTTON — shown for bearing/cascading/prescriptive divert alerts */}
      {isDivertAlert && (
        <div className="mt-4 pt-3 border-t border-red-500/30">
          {diverted ? (
            <div className="flex items-center gap-3 rounded bg-primary/10 border border-primary/30 px-4 py-3">
              <PlaneLanding className="size-5 text-primary shrink-0 animate-pulse" />
              <div>
                <p className="text-xs font-bold text-primary">Diverting to {nearestSite.name}</p>
                <p className="text-[0.65rem] text-muted-foreground mt-0.5">Landing sequence initiated — monitor Safe Landing Planner</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[0.65rem] text-red-400/80 text-center mb-2 uppercase tracking-wider font-semibold">
                ⚠ Immediate Action Required
              </p>
              <button
                onClick={handleDivertNow}
                className="w-full flex items-center justify-center gap-3 rounded bg-red-600 hover:bg-red-500 active:bg-red-700 px-4 py-3.5 text-white font-bold text-sm transition-colors shadow-lg shadow-red-900/40 animate-pulse"
              >
                <PlaneLanding className="size-5" />
                DIVERT NOW → {nearestSite.name}
                <span className="text-xs font-normal opacity-80">({haversineDistance(lat, lon, nearestSite.lat, nearestSite.lon).toFixed(1)} km)</span>
              </button>
            </>
          )}
        </div>
      )}

      {done && (
        <div className="mt-4 pt-3 border-t border-green-500/30">
          <p className="text-xs font-bold text-green-400 text-center">✓ All fixes applied successfully</p>
          <p className="text-[0.6rem] text-muted-foreground mt-0.5 text-center">
            Subsystem parameters returning to nominal. RUL recalculating.
          </p>
          {/* Auto-dismiss countdown bar */}
          <div className="mt-3 h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500/60 transition-all ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[0.55rem] text-muted-foreground/50 mt-1 text-right">
            Auto-dismissing — or press <span className="text-white/40">✕</span> to close
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Global fix progress overlay. Shows a live step-by-step breakdown of what's
 * being fixed with real sensor before/after values when Execute Fixes is clicked.
 */
export function FixProgressModal() {
  const { alerts, resolvedAlerts, silentlyResolvedAlerts, isDiverted } = useMission();
  const [fixQueue, setFixQueue] = useState<Alert[]>([]);
  const [shownIds] = useState(() => new Set<string>());

  // Watch for newly resolved alerts — show them in the fix panel
  // Only show the big popup for critical alerts or divert alerts (as requested)
  // And DO NOT show it if it was silently resolved (e.g. auto-cleared during landing)
  // And DO NOT show it if we are already diverted!
  useEffect(() => {
    for (const a of alerts) {
      if (
        resolvedAlerts.has(a.id) && 
        !silentlyResolvedAlerts?.has(a.id) &&
        !shownIds.has(a.id) && 
        !isDiverted &&
        (a.severity === "critical" || ["bearingPermanentDamage", "cascadingFailures", "prescriptiveDivert", "imminentCrash"].includes(a.key))
      ) {
        shownIds.add(a.id);
        setFixQueue(prev => [...prev, a]);
      }
    }
  }, [resolvedAlerts, silentlyResolvedAlerts, alerts, shownIds, isDiverted]);

  const current = fixQueue[0];

  if (!current) return null;

  return (
    <div className="fixed bottom-20 right-4 z-40 w-[420px] space-y-2 pointer-events-none">
      <div className="pointer-events-auto">
        <FixProgressPanel
          key={current.id}
          alert={current}
          onDone={() => setFixQueue(prev => prev.slice(1))}
        />
      </div>
    </div>
  );
}
