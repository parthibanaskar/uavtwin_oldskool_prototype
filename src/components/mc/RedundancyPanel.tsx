import { useMission } from "@/lib/twin/store";
import { Chip, Panel } from "./primitives";

const STATUS_TONE = { ok: "ok", drift: "warn", fail: "crit" } as const;

export function RedundancyPanel() {
  const { displayed, navMode, fuelPath } = useMission();
  const rows = displayed?.redundancy ?? [];

  return (
    <Panel
      title="Sensor redundancy & voting"
      subtitle="Dual-channel disagreement detector"
      bodyClassName="p-3 space-y-2"
    >
      <table className="w-full font-mono text-[0.7rem]">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left font-normal">Channel</th>
            <th className="text-right font-normal">A</th>
            <th className="text-right font-normal">B</th>
            <th className="text-right font-normal">Δ</th>
            <th className="text-right font-normal">Vote</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.channel} className="border-t border-border/60">
              <td className="py-1">{r.channel}</td>
              <td className="text-right">{r.a.toFixed(2)}</td>
              <td className="text-right">{r.b.toFixed(2)}</td>
              <td className="text-right">
                {r.delta.toFixed(2)}
                <span className="text-muted-foreground"> /{r.tolerance}</span>
              </td>
              <td className="py-1 text-right">
                <Chip tone={STATUS_TONE[r.status]}>{r.status}</Chip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
        <Chip tone={navMode === "gnss" ? "ok" : "warn"}>
          GNSS split {(displayed?.gpsErrorMetres ?? 0).toFixed(0)} m
        </Chip>
        <Chip tone="info">Sats {displayed?.sample.gpsSats ?? "--"}</Chip>
        <Chip tone={fuelPath === "primary" ? "ok" : "warn"}>Fuel path {fuelPath}</Chip>
        <Chip tone="info">Trusted vib {(displayed?.trustedVibration ?? 0).toFixed(2)} mm/s</Chip>
      </div>
    </Panel>
  );
}
