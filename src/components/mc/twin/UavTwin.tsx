import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Html, Lightformer, OrbitControls, Stars } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { useMission } from "@/lib/twin/store";
import { HOTSPOTS } from "@/lib/twin/profiles";
import { healthTone } from "../primitives";

const TONE_HEX = { ok: "#2fd39a", warn: "#f2c14e", crit: "#ef4444" } as const;

const HOTSPOT_POS: Record<string, [number, number, number]> = {
  propeller:  [ 0.00,  0.00, -2.80],
  bearing:    [ 0.00,  0.00, -1.40],
  hotSection: [ 0.55,  0.05,  0.30],
  oilSystem:  [ 0.00, -0.45,  0.20],
  fuelSystem: [ 0.00, -0.20,  1.00],
  electrical: [ 0.00,  0.40,  0.50],
  avionics:   [ 0.00,  0.30,  2.10],
};

/** Smooth MQ-1C fuselage profile using LatheGeometry.
 *  Points are [radius, y] pairs along the nose→tail axis. */
function useFuselageProfile() {
  return useMemo(() => [
    new THREE.Vector2(0.005, 3.10),   // nose tip
    new THREE.Vector2(0.08,  3.00),
    new THREE.Vector2(0.22,  2.80),
    new THREE.Vector2(0.38,  2.50),   // nose dome max width
    new THREE.Vector2(0.44,  2.15),
    new THREE.Vector2(0.46,  1.80),   // cockpit bump
    new THREE.Vector2(0.42,  1.30),
    new THREE.Vector2(0.36,  0.60),
    new THREE.Vector2(0.30,  0.00),
    new THREE.Vector2(0.24, -0.80),
    new THREE.Vector2(0.18, -1.60),
    new THREE.Vector2(0.12, -2.30),
    new THREE.Vector2(0.07, -2.80),
    new THREE.Vector2(0.02, -3.10),   // tail tip
  ], []);
}

function Airframe({ rpm, vibration }: { rpm: number; vibration: number }) {
  const drone   = useRef<THREE.Group>(null);
  const prop    = useRef<THREE.Group>(null);

  const fuselageProfile = useFuselageProfile();

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t  = state.clock.elapsedTime;

    // — Auto-rotate the whole drone on Y axis —
    if (drone.current) {
      drone.current.rotation.y += dt * 0.28;

      // Vibration shudder
      const a = Math.min(0.04, vibration * 0.003);
      drone.current.position.y = Math.sin(t * 22) * a;
    }

    // — Propeller spin driven by live RPM —
    if (prop.current) {
      prop.current.rotation.z += dt * (rpm / 60) * 2.5;
    }
  });

  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#d8dfe3", metalness: 0.15, roughness: 0.50,
  }), []);
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#1c2330", metalness: 0.55, roughness: 0.45,
  }), []);
  const propMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#0d0d12", metalness: 0.65, roughness: 0.35,
  }), []);
  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#080c10", metalness: 0.90, roughness: 0.05, transparent: true, opacity: 0.85,
  }), []);

  return (
    <group ref={drone}>
      {/* ===== FUSELAGE (smooth LatheGeometry profile) ===== */}
      <mesh material={bodyMat} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <latheGeometry args={[fuselageProfile, 48]} />
      </mesh>

      {/* ===== SENSOR BALL (MTS-B chin turret) ===== */}
      <group position={[0, -0.46, 2.2]}>
        <mesh material={darkMat}><sphereGeometry args={[0.18, 24, 24]} /></mesh>
        <mesh material={glassMat} position={[0, -0.12, 0]}><sphereGeometry args={[0.10, 16, 16]} /></mesh>
      </group>

      {/* ===== ENGINE INTAKE (top) ===== */}
      <mesh material={darkMat} position={[0, 0.40, -0.40]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.10, 0.55, 16]} />
      </mesh>
      <mesh material={darkMat} position={[0, 0.36, -0.70]}>
        <boxGeometry args={[0.24, 0.18, 0.42]} />
      </mesh>

      {/* ===== WINGS (high-aspect-ratio, thin) ===== */}
      {/* Left */}
      <mesh material={bodyMat} position={[-4.2, 0.12, 0.35]} castShadow>
        <boxGeometry args={[7.2, 0.055, 0.65]} />
      </mesh>
      <mesh material={bodyMat} position={[-7.7, 0.12, 0.30]}>
        <boxGeometry args={[0.55, 0.038, 0.30]} />
      </mesh>
      {/* Right */}
      <mesh material={bodyMat} position={[4.2, 0.12, 0.35]} castShadow>
        <boxGeometry args={[7.2, 0.055, 0.65]} />
      </mesh>
      <mesh material={bodyMat} position={[7.7, 0.12, 0.30]}>
        <boxGeometry args={[0.55, 0.038, 0.30]} />
      </mesh>

      {/* ===== WEAPON PYLONS + HELLFIRES ===== */}
      {([-1.8, 1.8] as number[]).map((x) => (
        <group key={x} position={[x, -0.08, 0.30]}>
          <mesh material={darkMat}><boxGeometry args={[0.04, 0.28, 0.36]} /></mesh>
          {[-0.10, 0.10].map((ox) => (
            <mesh key={ox} material={propMat} position={[ox, -0.28, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.058, 0.058, 1.1, 12]} />
            </mesh>
          ))}
        </group>
      ))}
      {([-2.9, 2.9] as number[]).map((x) => (
        <group key={x} position={[x, -0.06, 0.30]}>
          <mesh material={darkMat}><boxGeometry args={[0.04, 0.24, 0.30]} /></mesh>
          {[-0.10, 0.10].map((ox) => (
            <mesh key={ox} material={propMat} position={[ox, -0.24, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.058, 0.058, 1.1, 12]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ===== INVERTED V-TAIL (anhedral — points DOWN) ===== */}
      <mesh material={bodyMat} position={[-0.50, -0.52, -2.55]} rotation={[0.08, 0.04,  Math.PI / 4 + 0.12]}>
        <boxGeometry args={[1.55, 0.042, 0.55]} />
      </mesh>
      <mesh material={bodyMat} position={[ 0.50, -0.52, -2.55]} rotation={[0.08, -0.04, -(Math.PI / 4 + 0.12)]}>
        <boxGeometry args={[1.55, 0.042, 0.55]} />
      </mesh>

      {/* ===== VERTICAL FIN (UP) + SAT-COMM BLADE ===== */}
      <mesh material={bodyMat} position={[0, 0.60, -2.52]}>
        <boxGeometry args={[0.042, 1.0, 0.52]} />
      </mesh>
      <mesh material={bodyMat} position={[0, 1.12, -2.50]}>
        <boxGeometry args={[0.30, 0.042, 0.24]} />
      </mesh>
      <mesh material={darkMat} position={[0, 1.17, -2.50]}>
        <cylinderGeometry args={[0.022, 0.022, 0.16, 8]} />
      </mesh>

      {/* ===== PUSHER PROPELLER (4-blade) ===== */}
      <group position={[0, 0, -3.18]}>
        {/* Hub */}
        <mesh material={darkMat} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.11, 0.09, 0.28, 16]} />
        </mesh>
        {/* Spinner cone */}
        <mesh material={darkMat} position={[0, 0, -0.22]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.09, 0.22, 16]} />
        </mesh>
        {/* Blades */}
        <group ref={prop}>
          {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => (
            <mesh
              key={i}
              material={propMat}
              position={[Math.cos(a) * 0.68, Math.sin(a) * 0.68, 0]}
              rotation={[0, 0, a]}
            >
              <boxGeometry args={[1.38, 0.12, 0.028]} />
            </mesh>
          ))}
        </group>
      </group>

      {/* ===== FRONT LANDING GEAR ===== */}
      <group position={[0, -0.46, 1.85]}>
        <mesh material={darkMat} position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.44, 8]} />
        </mesh>
        <mesh material={propMat} position={[0, -0.44, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.10, 0.10, 0.07, 16]} />
        </mesh>
      </group>

      {/* ===== REAR LANDING GEAR ===== */}
      {([-0.35, 0.35] as number[]).map((x) => (
        <group key={x} position={[x, -0.30, 0.15]}>
          <mesh material={darkMat} position={[0, -0.30, 0]} rotation={[0, 0, x > 0 ? -0.14 : 0.14]}>
            <cylinderGeometry args={[0.030, 0.030, 0.60, 8]} />
          </mesh>
          <mesh material={propMat} position={[x > 0 ? 0.07 : -0.07, -0.60, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 0.08, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Hotspot({
  id, value, active, onSelect,
}: {
  id: string; value: number; active: boolean; onSelect: (id: string | null) => void;
}) {
  const ring  = useRef<THREE.Mesh>(null);
  const tone  = healthTone(value);
  const color = TONE_HEX[tone];
  const pos   = HOTSPOT_POS[id] ?? [0, 0, 0];
  const [hover, setHover] = useState(false);

  useFrame((state) => {
    if (!ring.current) return;
    const pulse = tone === "ok" ? 1 : 1 + Math.sin(state.clock.elapsedTime * 5) * 0.22;
    ring.current.scale.setScalar(pulse);
  });

  return (
    <group position={pos}>
      <mesh
        ref={ring}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
        onPointerOut={() => setHover(false)}
        onClick={(e) => { e.stopPropagation(); onSelect(active ? null : id); }}
      >
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshBasicMaterial color={color} transparent opacity={active || hover ? 0.95 : 0.6} />
      </mesh>
      {(hover || active) && (
        <Html center distanceFactor={9} position={[0, 0.3, 0]}>
          <div className="pointer-events-none rounded-sm border border-border bg-card/95 px-2 py-1 text-center whitespace-nowrap">
            <p className="label-xs">{HOTSPOTS[id]?.label ?? id}</p>
            <p className="font-mono text-xs" style={{ color }}>{value}/100</p>
          </div>
        </Html>
      )}
    </group>
  );
}

export function UavTwin() {
  const { displayed, focusHotspot, setFocusHotspot } = useMission();
  const health = displayed?.health;

  return (
    <Canvas shadows camera={{ position: [5.5, 2.8, 6.5], fov: 42 }} dpr={[1, 2]}>
      <color attach="background" args={["#0c1018"]} />
      <fog attach="fog" args={["#0c1018", 18, 40]} />

      {/* Lighting */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[8, 12, 6]} intensity={1.8} castShadow shadow-mapSize={1024} />
      <pointLight position={[-6, 4, -4]} intensity={0.6} color="#7fd8e8" />

      <Environment resolution={256}>
        <Lightformer intensity={2.0} position={[0, 8, 2]} scale={[14, 14, 1]} />
        <Lightformer intensity={1.0} color="#5bb8d4" position={[-8, 2, -4]} rotation-y={Math.PI / 2} scale={[20, 4, 1]} />
      </Environment>

      {/* Stars for atmosphere */}
      <Stars radius={60} depth={30} count={600} factor={3} saturation={0} fade />

      {/* Ground grid */}
      <gridHelper args={[30, 30, "#1e2a38", "#162030"]} position={[0, -2.0, 0]} />

      <Suspense fallback={null}>
        <Airframe
          rpm={displayed?.sample.params.rpm ?? 0}
          vibration={displayed?.trustedVibration ?? 0}
        />
      </Suspense>

      {/* XAI hotspot bubbles */}
      {Object.keys(HOTSPOT_POS).map((id) => (
        <Hotspot
          key={id}
          id={id}
          value={health ? health.subsystems[HOTSPOTS[id]!.subsystem] : 100}
          active={focusHotspot === id}
          onSelect={setFocusHotspot}
        />
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={14}
        target={[0, 0, 0]}
        autoRotate={!focusHotspot}
        autoRotateSpeed={0.4}
      />
    </Canvas>
  );
}
