import { useEffect, useRef, useState, useCallback } from "react";
import { useMission } from "@/lib/twin/store";
import { HOTSPOTS } from "@/lib/twin/profiles";
import { healthTone } from "../primitives";

const MODEL_UID = "67703aedf76945ce872fc576be6a4321";
const TONE_HEX = { ok: "#2fd39a", warn: "#f2c14e", crit: "#ef4444" } as const;

/** Annotation positions in Sketchfab model space. */
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

declare global {
  interface Window { Sketchfab: new (iframe: HTMLIFrameElement) => SketchfabClient; }
}
interface SketchfabClient {
  init(uid: string, opts: any): void;
}
interface SketchfabAPI {
  start(): void;
  addEventListener(event: string, cb: (...args: any[]) => void): void;
  addAnnotation(pos: number[], eye: number[], title: string, body: string, cb: (err: any, idx: number) => void): void;
  setAnnotationCameraTransition(enabled: boolean): void;
  showAnnotationTooltips(v: boolean): void;
  getSceneGraph(cb: (err: any, result: any) => void): void;
  rotate(instanceID: string, angleAxis: number[], opts: any, cb?: () => void): void;
}

export function UavTwin() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const apiRef = useRef<SketchfabAPI | null>(null);
  const propIdRef = useRef<string | null>(null);
  const { displayed, focusHotspot, setFocusHotspot } = useMission();
  const [ready, setReady] = useState(false);
  const idxToId = useRef<Record<number, string>>({});
  
  const health = displayed?.health;
  const stateRef = useRef(displayed);

  // Keep stateRef in sync with React context
  useEffect(() => {
    stateRef.current = displayed;
  }, [displayed]);

  // Show badges early
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const initViewer = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !window.Sketchfab) return;

    const client = new window.Sketchfab(iframe);
    client.init(MODEL_UID, {
      success: (api: SketchfabAPI) => {
        apiRef.current = api;
        api.start();
        api.addEventListener("viewerready", () => {
          api.setAnnotationCameraTransition(false);
          api.showAnnotationTooltips(false);

          ANNOTATIONS.forEach(({ id, position, eye }) => {
            const label = HOTSPOTS[id]?.label ?? id;
            api.addAnnotation(position, eye, label, "", (_err, idx) => {
              idxToId.current[idx] = id;
            });
          });

          api.addEventListener("annotationSelect", (idx) => {
            const id = idxToId.current[idx as number];
            if (id) setFocusHotspot(id);
          });
          api.addEventListener("annotationUnselect", () => setFocusHotspot(null));

          // Find propeller node in the scene graph
          api.getSceneGraph((err, result) => {
            if (err) return;
            const findProp = (node: any) => {
              const name = (node.name || "").toLowerCase();
              if (name.includes("prop") || name.includes("rotor") || name.includes("blade") || name.includes("engine")) {
                propIdRef.current = node.instanceID;
              }
              if (node.children) node.children.forEach(findProp);
            };
            findProp(result);
          });
        });
      },
      error: () => console.error("Sketchfab failed to load"),
      ui_controls: 0, ui_infos: 0, ui_watermark: 0, ui_annotations: 1, autostart: 1, preload: 1, camera: 0,
    });
  }, [setFocusHotspot]);

  // Load SDK
  useEffect(() => {
    if (document.getElementById("sf-sdk")) {
      if (window.Sketchfab && !apiRef.current) initViewer();
      return;
    }
    const s = document.createElement("script");
    s.id = "sf-sdk";
    s.src = "https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js";
    s.onload = () => initViewer();
    document.head.appendChild(s);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live physics & propeller rotation loop
  const [physicsStyles, setPhysicsStyles] = useState({});

  useEffect(() => {
    let angle = 0;
    let timer: number;
    const tick = () => {
      timer = requestAnimationFrame(tick);
      
      const state = stateRef.current;
      const rpm = state?.sample.params.rpm ?? 0;
      const vib = state?.trustedVibration ?? 0;
      const t = performance.now() / 1000;

      // 1. CSS Physics for the whole iframe (banking and shaking)
      // We scale to 1.05 so that when the iframe shifts or rotates, we don't see black edges
      const bank = Math.sin(t * 0.5) * 1.5; // Gentle roll
      const pitch = Math.cos(t * 0.3) * 0.5; // Gentle pitch
      
      // High vibration = screen shake
      const shakeAmt = Math.max(0, vib - 20) * 0.08;
      const shakeX = (Math.random() - 0.5) * shakeAmt;
      const shakeY = (Math.random() - 0.5) * shakeAmt;

      setPhysicsStyles({
        transform: `scale(1.05) translate(${shakeX}px, ${shakeY}px) rotateZ(${bank}deg) rotateX(${pitch}deg)`,
        transition: "transform 0.05s ease-out",
      });

      // 2. Rotate the propeller inside the Sketchfab model
      if (!apiRef.current || !propIdRef.current) return;
      angle += (rpm / 60) * 0.25;
      apiRef.current.rotate(propIdRef.current, [angle, 0, 0, 1], { duration: 0 });
    };
    timer = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(timer);
  }, []);

  return (
    <div className="relative w-full h-full bg-[#101720] overflow-hidden" style={{ perspective: "1000px" }}>
      {/* ── Sketchfab iframe (Scaled slightly to allow shaking without black bars) ── */}
      <iframe
        ref={iframeRef}
        title="MQ-1C Gray Eagle"
        src=""
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
        className="absolute inset-0 w-full h-full border-0 origin-center"
        style={physicsStyles}
      />

      {/* ── Loading Overlay ── */}

      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
          <div className="flex flex-col items-center gap-2 rounded-lg bg-black/60 px-6 py-4 backdrop-blur-sm">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs text-muted-foreground">Loading MQ-1C Gray Eagle…</span>
          </div>
        </div>
      )}

      {/* ── XAI Health Badges ── */}
      {ready && (
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 pointer-events-none z-20">
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
