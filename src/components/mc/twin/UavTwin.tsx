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

function AirspaceBackground() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-[#020813]">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, #10b981 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#020813] via-[#020813]/50 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#020813_100%)]" />
    </div>
  );
}

export function UavTwin() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const apiRef = useRef<any>(null);

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

    if (apiRef.current) return;

    const client = new window.Sketchfab(iframe);
    client.init(MODEL_UID, {
      success: (api: any) => {
        apiRef.current = api;
        api.start();
        api.addEventListener("viewerready", () => {
          api.setAnnotationCameraTransition(false);
          api.showAnnotationTooltips(false);
          api.setFov(65);

          api.pause();
          api.seekTo(0);
          setTimeout(() => setReady(true), 1500);
        });
      },
      error: () => {
        console.error("Viewer error");
        setReady(true);
      },
      ui_animations: 0,
      animation_autoplay: 0,
      ui_controls: 1, // Crucial: Re-enable free 3D orbiting for the user!
      ui_infos: 0,
      ui_watermark: 0,
      ui_annotations: 0,
      autostart: 1,
      preload: 1,
      camera: 0,
      transparent: 1, // Leaves Sketchfab background transparent so our CSS gradient shows
    });
  }, [setFocusHotspot]);

  useEffect(() => {
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

  useEffect(() => {
    let timer: number;
    let trackTimer: number;

    const tick = () => {
      timer = requestAnimationFrame(tick);

      const state = stateRef.current;
      const vib = state?.trustedVibration ?? 0;
      const rpm = state?.sample.params.rpm ?? 0;
      const t = performance.now() / 1000;

      const bank = Math.sin(t * 0.5) * 1.5;
      const pitch = Math.cos(t * 0.3) * 0.5;

      const shakeAmt = Math.max(0, vib - 20) * 0.08;
      const shakeX = (Math.random() - 0.5) * shakeAmt;
      const shakeY = (Math.random() - 0.5) * shakeAmt;

      if (wrapperRef.current) {
        wrapperRef.current.style.transform = `translate(${shakeX}px, ${shakeY}px) rotateZ(${bank}deg) rotateX(${pitch}deg)`;
      }
    };

    // Poll the 3D-to-2D coordinates of the annotations at ~30 FPS
    trackTimer = window.setInterval(() => {
      if (!apiRef.current) return;
      ANNOTATIONS.forEach(({ id, position }) => {
        apiRef.current.getWorldToWindowCoordinates(
          position,
          (err: any, coords: [number, number]) => {
            const el = document.getElementById(`marker-${id}`);
            if (el && coords && coords.length === 2) {
              el.style.left = `${coords[0]}px`;
              el.style.top = `${coords[1]}px`;
              el.style.opacity = "1";
            }
          },
        );
      });
    }, 33);

    timer = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(timer);
      clearInterval(trackTimer);
    };
  }, []);

  return (
    <div
      className="absolute inset-0 overflow-hidden flex flex-col bg-[#020813]"
      style={{ perspective: "1000px" }}
    >
      <AirspaceBackground />

      <div
        ref={wrapperRef}
        className="absolute top-[-17.5%] left-[-17.5%] w-[135%] h-[135%] origin-center z-10"
      >
        <iframe
          ref={iframeRef}
          title="UAV Digital Twin"
          allow="autoplay; fullscreen; xr-spatial-tracking"
          className="w-full h-full border-0 outline-none"
        />
      </div>

      <div
        className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-[#030712] transition-opacity duration-1000 pointer-events-none"
        style={{
          opacity: ready ? 0 : 1,
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
          <div className="text-center">
            <h3 className="text-sm font-bold tracking-widest text-emerald-500 mb-1">
              VAYUTWIN ENGINE
            </h3>
            <p className="text-xs text-emerald-500/50 animate-pulse">
              Establishing secure link to 3D asset...
            </p>
          </div>
        </div>
      </div>

      {/* Custom 3D Tracking Markers */}
      {ready &&
        ANNOTATIONS.map(({ id }) => {
          const info = HOTSPOTS[id];
          const subsystem = info?.subsystem;
          const val =
            subsystem && health ? (health.subsystems[subsystem] ?? 100) : 100;
          const tone = healthTone(val);
          const color = TONE_HEX[tone] || TONE_HEX.nominal;
          const isActive = focusHotspot === id;

          return (
            <div
              key={id}
              id={`marker-${id}`}
              className="absolute pointer-events-auto cursor-pointer group flex flex-col items-center justify-center z-20"
              style={{
                opacity: 0,
                transform: "translate(-50%, -50%)",
                transition: "opacity 0.2s ease-in-out",
              }}
              onMouseEnter={() => setFocusHotspot(id)}
              onMouseLeave={() => setFocusHotspot(null)}
              onClick={() => {
                if (apiRef.current) {
                  const pos = ANNOTATIONS.find((a) => a.id === id)?.position;
                  const eye = ANNOTATIONS.find((a) => a.id === id)?.eye;
                  if (pos && eye) apiRef.current.setCameraLookAt(eye, pos, 1);
                }
              }}
            >
              {/* Outer Glow Ring */}
              <div
                className="absolute inset-[-4px] rounded-full animate-ping opacity-30"
                style={{ backgroundColor: color }}
              />
              {/* Inner Dot */}
              <div
                className="w-4 h-4 rounded-full border border-white/50 shadow-[0_0_10px_rgba(0,0,0,0.8)] relative z-10 transition-colors"
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 10px ${color}`,
                }}
              />
              {/* Hover Label */}
              <div
                className={`absolute top-5 px-2 py-0.5 rounded-sm bg-black/80 border text-[10px] font-mono whitespace-nowrap transition-opacity pointer-events-none ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                style={{ borderColor: color, color: color }}
              >
                {info?.label ?? id}{" "}
                <span className="text-white/70">[{val.toFixed(0)}]</span>
              </div>
            </div>
          );
        })}
    </div>
  );
}
