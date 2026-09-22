import { useMission } from "@/lib/twin/store";
import { Panel, Chip, severityTone, toneText } from "./primitives";
import { ShieldAlert, ShieldCheck, Anchor } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThreatAssessment({ className }: { className?: string }) {
  const { alerts, resolvedAlerts, live } = useMission();

  // Find all major threats that were resolved
  const majorResolved = alerts.filter(
    (a) => resolvedAlerts.has(a.id) && (a.severity === "critical" || a.severity === "warning")
  );

  const phys = live?.sample.physics;
  const rulHours = phys ? phys.rul_seconds / 3600 : 0;
  
  // Calculate resilience
  const canSustain = rulHours > 1.5;
  const critical = rulHours < 0.5;

  return (
    <Panel title="Mission Resilience Assessment" subtitle="Structural capacity & threat history" className={className}>
      <div className="flex flex-col gap-3 p-3">
        {/* Threat History Summary */}
        <div className="border border-border/50 rounded-sm bg-accent/20 p-2">
          <h3 className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-wider mb-2">
            Threat History
          </h3>
          <div className="flex items-center justify-between text-xs font-mono">
            <span>Major faults resolved:</span>
            <span className={cn(majorResolved.length > 0 ? "text-crit font-bold" : "text-muted-foreground")}>
              {majorResolved.length}
            </span>
          </div>
          {majorResolved.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {majorResolved.map((a, i) => (
                <Chip key={i} className="bg-warn/10 text-warn border-warn/20 text-[0.6rem]">
                  {a.title}
                </Chip>
              ))}
            </div>
          )}
        </div>

        {/* Resilience Assessment */}
        <div className={cn("border border-border/50 rounded-sm p-3", critical ? "bg-crit/10 border-crit/30" : canSustain ? "bg-ok/10 border-ok/30" : "bg-warn/10 border-warn/30")}>
          <div className="flex items-center gap-2 mb-2">
            {critical ? <Anchor className="size-4 text-crit" /> : canSustain ? <ShieldCheck className="size-4 text-ok" /> : <ShieldAlert className="size-4 text-warn" />}
            <span className={cn("text-xs font-bold uppercase", critical ? "text-crit" : canSustain ? "text-ok" : "text-warn")}>
              {critical ? "Critical: Divert Immediately" : canSustain ? "Sufficient Resilience" : "Marginal Resilience"}
            </span>
          </div>
          
          <p className="text-[0.7rem] text-muted-foreground leading-relaxed">
            {critical ? (
              <>Airframe integrity has dropped below survivable thresholds. Structural capacity CANNOT sustain any further anomalies. Revert to safe base immediately.</>
            ) : canSustain ? (
              <>RUL ({rulHours.toFixed(1)} hrs) is sufficient to complete mission parameters. System CAN sustain an additional catastrophic fault and limp to base.</>
            ) : (
              <>RUL ({rulHours.toFixed(1)} hrs) is degraded. System may NOT sustain another major physical threat. Recommend monitoring for divert opportunities.</>
            )}
          </p>
        </div>
      </div>
    </Panel>
  );
}
