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
    L: any;
  }
}

function RealisticBackground() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: any = null;
    let interval: any = null;

    const initMap = () => {
      if (!window.L || !mapRef.current) return;

      map = window.L.map(mapRef.current, {
        center: [34.9, -117.88],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
      });

      window.L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 },
      ).addTo(map);

      let lng = -117.88;
      let lat = 34.9;

      interval = setInterval(() => {
        // Pan map south continuously so ground appears to move down relative to container.
        // This creates forward flight illusion for a drone pointing UP.
        lat -= 0.00004;
        if (map) {
          map.panTo([lat, lng], {
            animate: true,
            duration: 0.1,
            easeLinearity: 1,
          });
        }
      }, 100);
    };

    if (window.L) {
      initMap();
    } else {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = initMap;
      document.head.appendChild(script);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (map) map.remove();
    };
  }, []);

  return (
    <div
      ref={mapRef}
      className="absolute inset-0 z-0 pointer-events-none opacity-90"
    />
  );
}

export function UavTwin() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const apiRef = useRef<any>(null);

  const { displayed, focusHotspot, setFocusHotspot } = useMission();
  const [ready, setReady] = useState(false);
  const idxToId = useRef<Record<number, string>>({});

  const [heading, setHeading] = useState(0);
  const dragRef = useRef({ isDragging: false, lastX: 0 });

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

          api.pause();
          api.seekTo(0);
          api.setFov(65);

          // Force perfect top-down view (camera on +Z axis looking at origin)
          // The slight -0.01 on Y prevents gimbal lock
          api.setCameraLookAt([0, -0.01, 22], [0, 0, 0], 0);

          ANNOTATIONS.forEach(({ id, position, eye }) => {
            const label = HOTSPOTS[id]?.label ?? id;
            api.addAnnotation(
              position,
              eye,
              label,
              "",
              (_err: any, idx: number) => {
                idxToId.current[idx] = id;
              },
            );
          });

          api.addEventListener("annotationSelect", (idx: number) => {
            const id = idxToId.current[idx];
            if (id) setFocusHotspot(id);
          });
          api.addEventListener("annotationUnselect", () =>
            setFocusHotspot(null),
          );

          setTimeout(() => setReady(true), 1500);
        });
      },
      error: () => {
        console.error("Viewer error");
        setReady(true);
      },
      ui_animations: 0,
      animation_autoplay: 0,
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
    const tick = () => {
      timer = requestAnimationFrame(tick);

      const state = stateRef.current;
      const vib = state?.trustedVibration ?? 0;
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
    timer = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(timer);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current = { isDragging: true, lastX: e.clientX };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragRef.current.isDragging) {
      const delta = e.clientX - dragRef.current.lastX;
      setHeading((h) => h + delta * 0.4);
      dragRef.current.lastX = e.clientX;
    }
  };

  const handlePointerUp = () => {
    dragRef.current.isDragging = false;
  };

  return (
    <div
      className="absolute inset-0 overflow-hidden flex flex-col cursor-grab active:cursor-grabbing bg-[#020813]"
      style={{ perspective: "1000px" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Massive spinning background to prevent edges from showing during rotation */}
      <div
        className="absolute top-1/2 left-1/2 w-[250vw] h-[250vh] -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none"
        style={{ transform: `translate(-50%, -50%) rotate(${heading}deg)` }}
      >
        <RealisticBackground />
      </div>

      <div
        ref={wrapperRef}
        className="absolute top-[-17.5%] left-[-17.5%] w-[135%] h-[135%] origin-center z-10 pointer-events-none"
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

      {ready && (
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 pointer-events-none z-20">
          {ANNOTATIONS.map(({ id }) => {
            const subsystem = HOTSPOTS[id]?.subsystem;
            const val =
              subsystem && health ? (health.subsystems[subsystem] ?? 100) : 100;
            const tone = healthTone(val);
            const color = TONE_HEX[tone] || TONE_HEX.nominal;
            const isActive = focusHotspot === id;
            return (
              <button
                key={id}
                className="pointer-events-auto flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all"
                style={{
                  borderColor: color,
                  backgroundColor: isActive ? color + "33" : "#030712cc",
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
