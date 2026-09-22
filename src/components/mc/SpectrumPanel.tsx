import { useMission } from "@/lib/twin/store";
import { Chip, Panel } from "./primitives";

export function SpectrumPanel() {
  const { displayed } = useMission();
  const spec = displayed?.spectrum ?? [];
  const rotHz = displayed?.rotHz ?? 0;
  const visible = spec.filter((p) => p.freq <= 520);
  const max = Math.max(0.001, ...visible.map((p) => p.mag));
  const H = 108;

  const bearingDominant =
    (displayed?.bearingEnergy ?? 0) > (displayed?.imbalanceEnergy ?? 0) * 0.55;

  return (
    <Panel
      title="Vibration spectrum (FFT)"
      subtitle={`Hann window · 256 pt @ 1024 Hz · shaft ${rotHz.toFixed(0)} Hz`}
      right={
        <Chip tone={bearingDominant ? "warn" : "ok"}>
          {bearingDominant ? "BEARING ORDER" : "1X DOMINANT"}
        </Chip>
      }
    >
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="h-[108px] w-full">
        {[1, 3.57, 7.14].map((mult) => {
          const x = ((rotHz * mult) / 520) * 100;
          if (x > 100) return null;
          return (
            <line
              key={mult}
              x1={x}
              x2={x}
              y1="0"
              y2={H}
              stroke={mult === 1 ? "var(--info)" : "var(--warn)"}
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {visible.map((p, i) => {
          const x = (p.freq / 520) * 100;
          const h = (p.mag / max) * (H - 4);
          return (
            <line
              key={i}
              x1={x}
              x2={x}
              y1={H}
              y2={H - h}
              stroke="var(--chart-1)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[0.7rem]">
        <Band label="1x imbalance" value={displayed?.imbalanceEnergy ?? 0} />
        <Band label="Bearing bands" value={displayed?.bearingEnergy ?? 0} />
        <Band label="Broadband" value={displayed?.broadbandEnergy ?? 0} />
      </div>
    </Panel>
  );
}

function Band({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm border border-border/70 bg-muted/20 px-2 py-1">
      <p className="label-xs">{label}</p>
      <p className="font-mono text-sm">{value.toFixed(2)}</p>
    </div>
  );
}
