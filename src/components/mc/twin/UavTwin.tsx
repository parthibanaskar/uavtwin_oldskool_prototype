import { useCallback, useEffect, useRef, useState } from "react";
import { useMission } from "@/lib/twin/store";
import { HOTSPOTS } from "@/lib/twin/profiles";
import { healthTone } from "../primitives";

const MODEL_UID = "67703aedf76945ce872fc576be6a4321";

const ANNOTATIONS = [
  { id: 2, position: [-2.02, 0.11, -0.46], eye: [-2.72, 3.86, -5.92] },
  { id: 5, position: [0.66, 0.04, -0.09], eye: [-0.64, 4.25, -6.07] },
  { id: 4, position: [1.38, -0.17, -0.13], eye: [0.93, 2.92, -6.64] },
  { id: 6, position: [0.93, 0.17, -0.16], eye: [0.85, 4.41, -5.92] },
  { id: 7, position: [-0.3, -0.37, 0.19], eye: [-1.43, -0.58, 7.2] },
  { id: 8, position: [-1.22, -0.37, 0.11], eye: [-1.86, -0.99, 7.15] },
  { id: 10, position: [2.58, 0.13, 0.2], eye: [2.51, 3.99, 6.13] },
];

const TONE_HEX: Record<string, string> = {
  nominal: "#10b981",
  warning: "#f59e0b",
  critical: "#ef4444",
};

declare global {
  interface Window {
    Sketchfab: any;
  }
}

export function UavTwin() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const apiRef = useRef<any>(null);
  const propIdRef = useRef<string | null>(null);

  const { displayed, focusHotspot, setFocusHotspot } = useMission();
  const [ready, setReady] = useState(false);
  const idxToId = useRef<Record<number, string>>({});

  const health = displayed?.health;
  const stateRef = useRef(displayed);

  useEffect(() => {
    stateRef.current = displayed;
  }, [displayed]);

  const initViewer = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !window.Sketchfab) return;
    
    // Prevent double initialization
    if (apiRef.current) return;

    const client = new window.Sketchfab(iframe);
    client.init(MODEL_UID, {
      success: (api: any) => {
        apiRef.current = api;
        api.start();
        api.addEventListener("viewerready", () => {
          api.setAnnotationCameraTransition(false);
          api.showAnnotationTooltips(false);

          api.setCameraLookAt([9, 9, 3], [0, 0, 0], 0);

          ANNOTATIONS.forEach(({ id, position, eye }) => {
            const label = HOTSPOTS[id]?.label ?? id;
            api.addAnnotation(position, eye, label, "", (_err: any, idx: number) => {
              idxToId.current[idx] = id;
            });
          });

          api.addEventListener("annotationSelect", (idx: number) => {
            const id = idxToId.current[idx];
            if (id) setFocusHotspot(id);
          });
          api.addEventListener("annotationUnselect", () =>
            setFocusHotspot(null)
          );

          api.getSceneGraph((err: any, result: any) => {
            if (err) return;
            const findProp = (node: any) => {
              const name = (node.name || "").toLowerCase();
              if (
                name.includes("prop") ||
                name.includes("rotor") ||
                name.includes("blade") ||
                name.includes("engine")
              ) {
                propIdRef.current = node.instanceID;
              }
              if (node.children) node.children.forEach(findProp);
            };
            findProp(result);
          });

          setTimeout(() => setReady(true), 1500);
        });
      },
      error: () => {
        console.error("Viewer error");
        setReady(true);
      },
      ui_controls: 0,
      ui_infos: 0,
      ui_watermark: 0,
      ui_annotations: 1,
      autostart: 1,
      preload: 1,
      camera: 0,
      transparent: 1,
    });
  }, [setFocusHotspot]);

  useEffect(() => {
    // Ultimate failsafe: no matter what, drop the loading screen after 5 seconds
    const failsafe = setTimeout(() => setReady(true), 5000);

    if (document.getElementById("sf-sdk")) {
      if (window.Sketchfab && !apiRef.current) initViewer();
      return () => clearTimeout(failsafe);
    }
    const s = document.createElement("script");
    s.id = "sf-sdk";
    s.src = "https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js";
    s.onload = () => initViewer();
    document.head.appendChild(s);
    
    return () => clearTimeout(failsafe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      const bank = Math.sin(t * 0.5) * 1.5;
      const pitch = Math.cos(t * 0.3) * 0.5;

      const shakeAmt = Math.max(0, vib - 20) * 0.08;
      const shakeX = (Math.random() - 0.5) * shakeAmt;
      const shakeY = (Math.random() - 0.5) * shakeAmt;

      setPhysicsStyles({
        transform: `translate(${shakeX}px, ${shakeY}px) rotateZ(${bank}deg) rotateX(${pitch}deg)`,
        transition: "transform 0.05s ease-out",
      });

      if (!apiRef.current || !propIdRef.current) return;
      angle += (rpm / 60) * 0.25;
      apiRef.current.rotate(
        propIdRef.current,
        [angle, 0, 0, 1],
        { duration: 0 }
      );
    };
    timer = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(timer);
  }, []);

  return (
    <div
      className="absolute inset-0 bg-[#101720] overflow-hidden flex flex-col"
      style={{ perspective: "1000px" }}
    >
      <div
        className="absolute top-[-17.5%] left-[-17.5%] w-[135%] h-[135%] origin-center"
        style={physicsStyles}
      >
        <iframe
          ref={iframeRef}
          title="UAV Digital Twin"
          src=""
          allow="autoplay; fullscreen; xr-spatial-tracking"
          className="w-full h-full border-0 outline-none"
        />
      </div>

      <div
        className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-[#101720] transition-opacity duration-1000"
        style={{
          opacity: ready ? 0 : 1,
          pointerEvents: ready ? "none" : "auto",
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
          <div className="text-center">
            <h3 className="text-sm font-bold tracking-widest text-emerald-500 mb-1">
              VAYUTWIN ENGINE
            </h3>
            <p className="text-xs text-muted-foreground animate-pulse">
              Establishing secure link to 3D asset...
            </p>
          </div>
        </div>
      </div>

      {ready && (
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 pointer-events-none z-20">
          {ANNOTATIONS.map(({ id }) => {
            const subsystem = HOTSPOTS[id]?.subsystem;
            const val =
              subsystem && health
                ? (health.subsystems[subsystem] ?? 100)
                : 100;
            const tone = healthTone(val);
            const color = TONE_HEX[tone] || TONE_HEX.nominal;
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
