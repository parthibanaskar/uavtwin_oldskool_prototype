import { useEffect, useRef, useState, useCallback } from "react";

import { useMission } from "@/lib/twin/store";
import { HOTSPOTS } from "@/lib/twin/profiles";
import { healthTone } from "../primitives";

const MODEL_UID = "67703aedf76945ce872fc576be6a4321";
const TONE_HEX = { ok: "#2fd39a", warn: "#f2c14e", crit: "#ef4444" } as const;

/** Annotation positions in Sketchfab model space (eye, target, title, body).
 *  Positions were estimated from MQ-1C geometry; the API will snap them to the surface. */
const ANNOTATIONS: Array<{
  id: string;
  position: [number, number, number];
  eye: [number, number, number];
}> = [
  { id: "propeller",  position: [ 0.00,  0.05, -1.80], eye: [ 0.0,  0.4, -3.5] },
  { id: "bearing",    position: [ 0.00,  0.05, -0.60], eye: [ 0.0,  0.8, -2.5] },
  { id: "hotSection", position: [ 0.40, -0.05,  0.20], eye: [ 1.2, -0.3,  0.5] },
  { id: "oilSystem",  position: [ 0.00, -0.30,  0.10], eye: [ 0.0, -1.2,  0.5] },
  { id: "fuelSystem", position: [ 0.00, -0.16,  0.80], eye: [ 0.0, -0.8,  1.5] },
  { id: "electrical", position: [ 0.00,  0.26,  0.30], eye: [ 0.0,  1.0,  0.8] },
  { id: "avionics",   position: [ 0.00,  0.22,  1.50], eye: [ 0.0,  0.5,  3.0] },
];

// Declare Sketchfab as global (loaded via CDN script tag)
declare global {
  interface Window { Sketchfab: new (iframe: HTMLIFrameElement) => SketchfabClient; }
}
interface SketchfabClient {
  init(uid: string, opts: {
    success: (api: SketchfabAPI) => void;
    error?: () => void;
    ui_controls?: number;
    ui_infos?: number;
    ui_watermark?: number;
    ui_annotations?: number;
    autostart?: number;
    preload?: number;
    camera?: number;
  }): void;
}
interface SketchfabAPI {
  start(): void;
  addEventListener(event: string, cb: (...args: unknown[]) => void): void;
  addAnnotation(
    pos: [number, number, number],
    eye: [number, number, number],
    title: string,
    body: string,
    cb: (err: unknown, idx: number) => void
  ): void;
  setAnnotationCameraTransition(enabled: boolean): void;
  showAnnotationTooltips(v: boolean): void;
}

export function UavTwin() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const apiRef = useRef<SketchfabAPI | null>(null);
  const { displayed, focusHotspot, setFocusHotspot } = useMission();
  const [ready, setReady] = useState(false);
  // map annotation index → hotspot id
  const idxToId = useRef<Record<number, string>>({});
  const idToIdx = useRef<Record<string, number>>({});

  const health = displayed?.health;

  // Show UI immediately — don't block on viewerready (model loads in background)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(t);
  }, []);

  // Load Sketchfab SDK script once
  useEffect(() => {
    if (document.getElementById("sf-sdk")) {
      // Script already loaded from a previous mount
      if (window.Sketchfab && !apiRef.current) initViewer();
      return;
    }
    const s = document.createElement("script");
    s.id = "sf-sdk";
    s.src = "https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js";
    s.onload = () => initViewer();
    document.head.appendChild(s);
    return () => {};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initViewer = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !window.Sketchfab) return;

    const client = new window.Sketchfab(iframe);
    client.init(MODEL_UID, {
      success: (api) => {
        apiRef.current = api;
        api.start();
        api.addEventListener("viewerready", () => {
          api.setAnnotationCameraTransition(false);
          api.showAnnotationTooltips(false);

          // Add all annotations after model is ready
          ANNOTATIONS.forEach(({ id, position, eye }) => {
            const label = HOTSPOTS[id]?.label ?? id;
            api.addAnnotation(position, eye, label, "", (_err, idx) => {
              idxToId.current[idx] = id;
              idToIdx.current[id] = idx;
            });
          });

          api.addEventListener("annotationSelect", (idx) => {
            const id = idxToId.current[idx as number];

            if (id) setFocusHotspot(id);
          });
          api.addEventListener("annotationUnselect", () => setFocusHotspot(null));

          setReady(true);
        });
      },
      error: () => console.error("[VayuTwin] Sketchfab viewer failed to load"),
      ui_controls: 0,
      ui_infos: 0,
      ui_watermark: 0,
      ui_annotations: 1,
      autostart: 1,
      preload: 1,
      camera: 0,
    });
  }, [setFocusHotspot]);

  // Re-init if SDK was already loaded when component mounts
  useEffect(() => {
    if (window.Sketchfab && !apiRef.current) initViewer();
  }, [initViewer]);

  return (
    <div className="relative w-full h-full bg-[#101720]">
      {/* ── Sketchfab iframe — always visible from the start ── */}
      <iframe
        ref={iframeRef}
        title="MQ-1C Gray Eagle Digital Twin"
        src=""
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
        className="w-full h-full border-0"
        style={{ display: "block" }}
      />

      {/* ── Loading overlay (transparent, non-blocking) ── */}
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 rounded-lg bg-black/60 px-6 py-4 backdrop-blur-sm">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs text-muted-foreground">Loading MQ-1C Gray Eagle…</span>
          </div>
        </div>
      )}


      {/* ── XAI Health badge overlay ── */}
      {ready && (
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 pointer-events-none">
          {ANNOTATIONS.map(({ id }) => {
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
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
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
