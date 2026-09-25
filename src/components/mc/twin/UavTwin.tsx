import { useEffect, useState } from "react";

import { useMission } from "@/lib/twin/store";
import { HOTSPOTS } from "@/lib/twin/profiles";
import { healthTone } from "../primitives";

const MODEL_UID = "67703aedf76945ce872fc576be6a4321";
const TONE_HEX = { ok: "#2fd39a", warn: "#f2c14e", crit: "#ef4444" } as const;

// Direct embed URL — no JS SDK needed, params strip all Sketchfab chrome
const EMBED_SRC =
  `https://sketchfab.com/models/${MODEL_UID}/embed` +
  `?autostart=1` +
  `&ui_infos=0` +        // hide title / author bar
  `&ui_controls=0` +     // hide bottom toolbar
  `&ui_stop=0` +         // hide stop button
  `&ui_hint=0` +         // hide interaction hint
  `&ui_annotations=0` +  // hide any built-in annotation UI
  `&ui_theme=dark` +
  `&dnt=1`;              // do-not-track

const HOTSPOT_IDS = [
  "propeller", "bearing", "hotSection",
  "oilSystem", "fuelSystem", "electrical", "avionics",
] as const;

export function UavTwin() {
  const { displayed, focusHotspot, setFocusHotspot } = useMission();
  const [ready, setReady] = useState(false);
  const health = displayed?.health;

  // Show badges 1.5 s after mount (iframe loads in background)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative w-full h-full bg-[#101720]">
      {/* ── Clean Sketchfab iframe — no chrome ── */}
      <iframe
        title="MQ-1C Gray Eagle Digital Twin"
        src={EMBED_SRC}
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
        className="w-full h-full border-0"
        style={{ display: "block" }}
      />

      {/* ── XAI health badge overlay ── */}
      {ready && (
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 pointer-events-none">
          {HOTSPOT_IDS.map((id) => {
            const subsystem = HOTSPOTS[id]?.subsystem;
            const val = subsystem && health ? (health.subsystems[subsystem] ?? 100) : 100;
            const tone = healthTone(val);
            const color = TONE_HEX[tone];
            const isActive = focusHotspot === id;
            return (
              <button
                key={id}
                className="pointer-events-auto flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all"
                style={{
                  borderColor: color,
                  backgroundColor: isActive ? color + "33" : "#101720cc",
                  color: color,
                  boxShadow: isActive ? `0 0 8px ${color}66` : "none",
                }}
                onClick={() => setFocusHotspot(isActive ? null : id)}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                {HOTSPOTS[id]?.label ?? id}
                <span className="opacity-70">{val}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
