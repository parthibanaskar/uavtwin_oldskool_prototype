import { Wrench } from "lucide-react";

import { useMission } from "@/lib/twin/store";
import { Chip, Panel } from "./primitives";

const TONE = { applied: "ok", monitoring: "info", recommended: "warn" } as const;

export function SelfHealPanel({ className }: { className?: string }) {
  const { healActions } = useMission();
  return (
    <Panel
      title="Autonomous self-healing"
      subtitle="Deterministic mitigation playbooks"
      right={<Chip tone="info">{healActions.length} actions</Chip>}
      className={className}
      bodyClassName="min-h-0 flex-1 overflow-auto p-2 space-y-1.5"
    >
      {healActions.length === 0 ? (
        <p className="p-2 text-xs text-muted-foreground">
          No mitigation required. Actions appear here the moment a fault is diagnosed.
        </p>
      ) : null}
      {healActions.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-2 rounded-sm border border-border/70 bg-muted/20 p-2"
        >
          <Wrench className="mt-0.5 size-3 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs font-semibold">{a.action}</p>
            <p className="text-[0.7rem] text-muted-foreground">{a.detail}</p>
          </div>
          <Chip tone={TONE[a.status]} className="ml-auto shrink-0">
            {a.status}
          </Chip>
        </div>
      ))}
    </Panel>
  );
}
