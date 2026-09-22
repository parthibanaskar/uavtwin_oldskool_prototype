import { useState } from "react";
import { ShieldCheck, ShieldX } from "lucide-react";

import { useMission } from "@/lib/twin/store";
import { verifyChain, type VerifyResult } from "@/lib/twin/blackbox";
import { Chip, Panel } from "./primitives";

export function BlackBoxPanel() {
  const { blackbox } = useMission();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const verify = async () => {
    setBusy(true);
    setResult(await verifyChain(blackbox));
    setBusy(false);
  };

  const exportLog = () => {
    const blob = new Blob([JSON.stringify(blackbox, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blackbox-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const visibleLogs = showAll ? [...blackbox].reverse() : [...blackbox].reverse().slice(0, 10);

  return (
    <Panel
      title="Tamper-evident black box"
      subtitle="SHA-256 hash chain • append only"
      right={
        <div className="flex items-center gap-1">
          {result ? (
            <Chip tone={result.ok ? "ok" : "crit"}>
              {result.ok ? (
                <ShieldCheck className="size-3" />
              ) : (
                <ShieldX className="size-3" />
              )}
              {result.ok ? `${result.checked} verified` : `broken @ ${result.brokenAt}`}
            </Chip>
          ) : null}
          <button
            onClick={exportLog}
            className="rounded-sm border border-border px-2 py-1 font-mono text-[0.65rem] uppercase hover:bg-accent"
          >
            Export
          </button>
          <button
            onClick={() => void verify()}
            disabled={busy}
            className="rounded-sm border border-border px-2 py-1 font-mono text-[0.65rem] uppercase hover:bg-accent disabled:opacity-50"
          >
            {busy ? "checking" : "verify chain"}
          </button>
        </div>
      }
      bodyClassName="min-h-0 flex-1 overflow-auto p-2 flex flex-col"
    >
      <table className="w-full font-mono text-[0.65rem]">
        <tbody>
          {visibleLogs.map((e) => (
            <tr key={e.seq} className="border-b border-border/50 align-top">
              <td className="py-1 pr-2 text-muted-foreground">#{e.seq}</td>
              <td className="py-1 pr-2 text-primary">{e.kind}</td>
              <td className="py-1 pr-2 break-all text-muted-foreground">
                {JSON.stringify(e.payload).slice(0, 70)}
              </td>
              <td className="py-1 text-right text-muted-foreground">{e.hash.slice(0, 10)}…</td>
            </tr>
          ))}
        </tbody>
      </table>
      {blackbox.length === 0 ? (
        <p className="p-2 text-xs text-muted-foreground">Chain initialising…</p>
      ) : (
        blackbox.length > 10 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-2 w-full rounded-sm border border-border/50 bg-muted/20 py-1.5 font-mono text-[0.65rem] uppercase text-muted-foreground hover:bg-muted/40"
          >
            {showAll ? "Show Less" : `View All (${blackbox.length - 10} more)`}
          </button>
        )
      )}
    </Panel>
  );
}
