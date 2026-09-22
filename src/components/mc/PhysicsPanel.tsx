import { useMission } from "@/lib/twin/store";
import { Panel } from "./primitives";
import { cn } from "@/lib/utils";

export function PhysicsPanel() {
  const { displayed } = useMission();
  const physics = displayed?.sample.physics;

  if (!physics) return null;

  return (
    <Panel
      title="Physics & Prognostics (PINN)"
      subtitle="Breguet, Woschni, Paris' Law, Kalman Filtering"
      bodyClassName="grid grid-cols-2 gap-2 overflow-auto"
    >
      <PhysicsMetric 
        label="Remaining Useful Life" 
        value={physics.rul_seconds} 
        unit="" 
        formatter={(v) => v > 7200 ? (v / 3600).toFixed(1) + " hours" : (v / 60).toFixed(1) + " min"} 
      />
      <PhysicsMetric label="Fatigue Crack Size" value={physics.fatigue_crack_m * 1000} unit="mm" formatter={(v) => v.toFixed(3)} />
      
      {physics.mission_time_seconds !== undefined && (
        <PhysicsMetric 
          label="Time to Complete Mission" 
          value={physics.mission_time_seconds} 
          unit="" 
          formatter={(v) => v > 800000 ? "IDLE" : v > 7200 ? (v / 3600).toFixed(1) + " hours" : (v / 60).toFixed(1) + " min"} 
          alert={physics.rul_seconds < physics.mission_time_seconds}
        />
      )}
      
      <PhysicsMetric label="BSFC" value={physics.BSFC} unit="kg/kWh" formatter={(v) => v.toFixed(3)} />
      <PhysicsMetric label="Thermodynamic Eff." value={physics.eta_th * 100} unit="%" formatter={(v) => v.toFixed(1)} />
      
      {physics.altitude_ft !== undefined && (
        <PhysicsMetric label="Altitude (Density)" value={physics.altitude_ft} unit="ft" formatter={(v) => v.toFixed(0)} />
      )}
      <PhysicsMetric label="Air Density (ISA)" value={physics.rho} unit="kg/m³" formatter={(v) => v.toFixed(3)} />
      <PhysicsMetric label="Lift/Drag Ratio" value={physics.LD} unit="" formatter={(v) => v.toFixed(1)} />
      {physics.cumulative_damage_pct !== undefined && (
        <div className={cn("rounded-sm border p-2", 
          physics.cumulative_damage_pct > 75 ? "bg-red-500/20 border-red-500/50" : 
          physics.cumulative_damage_pct > 40 ? "bg-amber-500/20 border-amber-500/40" : 
          "bg-muted/20 border-border/70")}>
          <p className={cn("label-xs truncate", physics.cumulative_damage_pct > 75 ? "text-red-400" : physics.cumulative_damage_pct > 40 ? "text-amber-400" : "")}>Cumulative Structural Damage</p>
          <p className={cn("font-mono text-lg leading-tight font-semibold mt-1", physics.cumulative_damage_pct > 75 ? "text-red-400" : physics.cumulative_damage_pct > 40 ? "text-amber-400" : "")}>
            {physics.cumulative_damage_pct.toFixed(1)}<span className="ml-1 text-[0.65rem] opacity-70">% of life consumed</span>
          </p>
        </div>
      )}
      {physics.bearing_permanently_damaged && (
        <div className="rounded-sm border p-2 bg-red-600/20 border-red-600/60 col-span-2 animate-pulse">
          <p className="label-xs text-red-400">⚠ Main Bearing — Permanently Spalled</p>
          <p className="font-mono text-xs text-red-300 mt-1">Non-repairable. Elevated vibration for remainder of flight. Divert mandatory.</p>
        </div>
      )}
      <div className={cn("rounded-sm border p-2 col-span-2", physics.gpsSpoofed ? "bg-red-500/20 border-red-500/50" : "bg-muted/20 border-border/70")}>
        <div className="flex justify-between">
          <p className="label-xs">GPS/INS Anti-Spoof</p>
          <span className={cn("font-mono text-xs", physics.gpsSpoofed ? "text-red-500 font-bold" : "text-green-500")}>
            {physics.gpsSpoofed ? "SPOOFING DETECTED" : "NOMINAL KINEMATICS"}
          </span>
        </div>
      </div>
    </Panel>
  );
}

function PhysicsMetric({ label, value, unit, formatter, alert }: { label: string, value: number, unit: string, formatter: (v: number) => string, alert?: boolean }) {
  return (
    <div className={cn("rounded-sm border p-2", alert ? "bg-red-500/20 border-red-500/50 text-red-500" : "bg-muted/20 border-border/70")}>
      <p className={cn("label-xs truncate", alert && "text-red-400")}>{label}</p>
      <p className="font-mono text-lg leading-tight font-semibold mt-1">
        {formatter(value)}
        {unit && <span className="ml-1 text-[0.65rem] opacity-70">{unit}</span>}
      </p>
    </div>
  );
}
