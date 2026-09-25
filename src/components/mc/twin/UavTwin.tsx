import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Html, Lightformer, OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { useMission } from "@/lib/twin/store";
import { HOTSPOTS } from "@/lib/twin/profiles";
import { healthTone } from "../primitives";

const TONE_HEX = { ok: "#2fd39a", warn: "#f2c14e", crit: "#ef4444" } as const;

/** Hotspot anchor points on the procedural airframe (metres, model space). */
const HOTSPOT_POS: Record<string, [number, number, number]> = {
  propeller: [0, 0.05, 2.35],
  bearing: [0, 0.05, 1.5],
  hotSection: [0.34, -0.05, 0.72],
  cylinder: [-0.34, 0.05, 1.05],
  oilSystem: [0, -0.3, 1.15],
  fuelSystem: [0, -0.16, 0.1],
  electrical: [0, 0.26, 0.45],
  avionics: [0, 0.22, -0.55],
};

function Airframe({ rpm, vibration }: { rpm: number; vibration: number }) {
  const prop = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    if (prop.current) prop.current.rotation.z += dt * (rpm / 60) * 0.4;
    if (body.current) {
      const a = Math.min(0.05, vibration * 0.003);
      const t = state.clock.elapsedTime;
      body.current.position.y = Math.sin(t * 18) * a;
      body.current.rotation.z = Math.sin(t * 14) * a * 0.5;
    }
  });

  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#d8dde0", metalness: 0.15, roughness: 0.55,
  }), []);
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1e252e", metalness: 0.5, roughness: 0.5 }), []);
  const propMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0d0d0d", metalness: 0.6, roughness: 0.4 }), []);
  const missileMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a3a3a", metalness: 0.3, roughness: 0.7 }), []);

  return (
    <group ref={body} scale={[1, 1, 1]}>

      {/* ===== FUSELAGE ===== */}
      {/* Main body - long tapered cylinder */}
      <mesh material={bodyMat} position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.48, 0.22, 5.2, 32]} />
      </mesh>

      {/* Bulbous nose dome - MQ-1C distinctive smooth round head */}
      <mesh material={bodyMat} position={[0, 0.08, 2.45]} scale={[1.3, 1.25, 2.0]}>
        <sphereGeometry args={[0.3, 32, 32]} />
      </mesh>

      {/* Nose neck connector */}
      <mesh material={bodyMat} position={[0, 0.05, 1.95]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.48, 0.48, 0.9, 32]} />
      </mesh>

      {/* Belly fairing - slightly protruding underbelly */}
      <mesh material={bodyMat} position={[0, -0.26, 0.3]} scale={[1.3, 0.65, 4.0]}>
        <sphereGeometry args={[0.42, 32, 16]} />
      </mesh>

      {/* Engine nacelle/intake on top - behind cockpit */}
      <mesh material={darkMat} position={[0, 0.28, -0.3]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.1, 0.6, 16]} />
      </mesh>
      <mesh material={darkMat} position={[0, 0.24, -0.6]}>
        <boxGeometry args={[0.22, 0.18, 0.4]} />
      </mesh>

      {/* ===== MTS-B SENSOR BALL (Chin turret) ===== */}
      <mesh material={darkMat} position={[0, -0.32, 1.9]}>
        <sphereGeometry args={[0.14, 24, 24]} />
      </mesh>
      <mesh material={darkMat} position={[0, -0.28, 1.9]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.15, 16]} />
      </mesh>
      {/* Glass lens */}
      <mesh material={new THREE.MeshStandardMaterial({ color: "#111", metalness: 0.9, roughness: 0.05 })} position={[0, -0.44, 1.9]}>
        <sphereGeometry args={[0.08, 16, 16]} />
      </mesh>

      {/* ===== WINGS ===== */}
      {/* Main wing - thin, long, high AR - slightly swept leading edge */}
      {/* Left wing */}
      <mesh material={bodyMat} position={[-4.0, 0.08, 0.4]} rotation={[0, 0.03, 0]}>
        <boxGeometry args={[7.0, 0.055, 0.62]} />
      </mesh>
      {/* Left wing tip taper */}
      <mesh material={bodyMat} position={[-7.3, 0.08, 0.36]}>
        <boxGeometry args={[0.6, 0.04, 0.3]} />
      </mesh>
      {/* Right wing */}
      <mesh material={bodyMat} position={[4.0, 0.08, 0.4]} rotation={[0, -0.03, 0]}>
        <boxGeometry args={[7.0, 0.055, 0.62]} />
      </mesh>
      {/* Right wing tip taper */}
      <mesh material={bodyMat} position={[7.3, 0.08, 0.36]}>
        <boxGeometry args={[0.6, 0.04, 0.3]} />
      </mesh>

      {/* ===== WEAPON STATIONS / PYLONS ===== */}
      {/* Left inner pylon */}
      <group position={[-1.6, -0.1, 0.2]}>
        <mesh material={darkMat}><boxGeometry args={[0.04, 0.25, 0.35]} /></mesh>
        {/* Hellfire x2 left inner */}
        <mesh material={missileMat} position={[-0.09, -0.25, 0.15]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 1.1, 12]} />
        </mesh>
        <mesh material={missileMat} position={[0.09, -0.25, 0.15]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 1.1, 12]} />
        </mesh>
      </group>
      {/* Left outer pylon */}
      <group position={[-2.8, -0.08, 0.2]}>
        <mesh material={darkMat}><boxGeometry args={[0.04, 0.22, 0.3]} /></mesh>
        <mesh material={missileMat} position={[-0.09, -0.22, 0.1]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 1.1, 12]} />
        </mesh>
        <mesh material={missileMat} position={[0.09, -0.22, 0.1]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 1.1, 12]} />
        </mesh>
      </group>
      {/* Right inner pylon */}
      <group position={[1.6, -0.1, 0.2]}>
        <mesh material={darkMat}><boxGeometry args={[0.04, 0.25, 0.35]} /></mesh>
        <mesh material={missileMat} position={[-0.09, -0.25, 0.15]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 1.1, 12]} />
        </mesh>
        <mesh material={missileMat} position={[0.09, -0.25, 0.15]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 1.1, 12]} />
        </mesh>
      </group>
      {/* Right outer pylon */}
      <group position={[2.8, -0.08, 0.2]}>
        <mesh material={darkMat}><boxGeometry args={[0.04, 0.22, 0.3]} /></mesh>
        <mesh material={missileMat} position={[-0.09, -0.22, 0.1]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 1.1, 12]} />
        </mesh>
        <mesh material={missileMat} position={[0.09, -0.22, 0.1]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 1.1, 12]} />
        </mesh>
      </group>

      {/* ===== TAIL ASSEMBLY ===== */}
      {/* Tail boom - thin rear fuselage */}
      <mesh material={bodyMat} position={[0, 0, -2.5]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.08, 1.0, 24]} />
      </mesh>

      {/* Inverted V-Tail (anhedral) - key MQ-1C feature */}
      {/* Left V-tail fin - angles down-outward */}
      <mesh material={bodyMat} position={[-0.55, -0.38, -2.8]} rotation={[0.1, 0.05, Math.PI/4 + 0.15]}>
        <boxGeometry args={[1.4, 0.04, 0.55]} />
      </mesh>
      {/* Right V-tail fin */}
      <mesh material={bodyMat} position={[0.55, -0.38, -2.8]} rotation={[0.1, -0.05, -(Math.PI/4 + 0.15)]}>
        <boxGeometry args={[1.4, 0.04, 0.55]} />
      </mesh>

      {/* Vertical stabilizer - short fin pointing UP */}
      <mesh material={bodyMat} position={[0, 0.52, -2.75]}>
        <boxGeometry args={[0.04, 0.9, 0.48]} />
      </mesh>
      {/* Sat-comm antenna on top of tail fin */}
      <mesh material={bodyMat} position={[0, 1.0, -2.72]}>
        <boxGeometry args={[0.3, 0.04, 0.22]} />
      </mesh>
      <mesh material={darkMat} position={[0, 1.04, -2.72]}>
        <cylinderGeometry args={[0.025, 0.025, 0.18, 8]} />
      </mesh>

      {/* ===== PUSHER PROPELLER ===== */}
      <group position={[0, 0, -3.1]}>
        {/* Prop hub */}
        <mesh material={darkMat} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.08, 0.25, 16]} />
        </mesh>
        {/* Spinner cone */}
        <mesh material={darkMat} position={[0, 0, -0.2]} rotation={[-Math.PI/2, 0, 0]}>
          <coneGeometry args={[0.08, 0.2, 16]} />
        </mesh>
        {/* 4-blade propeller */}
        <group ref={prop}>
          {[0, Math.PI/2, Math.PI, 3*Math.PI/2].map((angle, i) => (
            <mesh key={i} material={propMat} position={[
              Math.cos(angle) * 0.7,
              Math.sin(angle) * 0.7,
              0
            ]} rotation={[0, 0, angle]}>
              <boxGeometry args={[1.4, 0.1, 0.03]} />
            </mesh>
          ))}
        </group>
      </group>

      {/* ===== FRONT LANDING GEAR ===== */}
      <group position={[0, -0.32, 1.8]}>
        <mesh material={darkMat} position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.4, 8]} />
        </mesh>
        <mesh material={darkMat} position={[0, -0.42, 0]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.09, 0.09, 0.07, 16]} />
        </mesh>
      </group>

      {/* ===== REAR LANDING GEAR ===== */}
      {/* Left rear */}
      <group position={[-0.3, -0.26, 0.2]}>
        <mesh material={darkMat} position={[0, -0.28, 0]} rotation={[0, 0, 0.15]}>
          <cylinderGeometry args={[0.03, 0.03, 0.55, 8]} />
        </mesh>
        <mesh material={darkMat} position={[-0.06, -0.55, 0]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.11, 0.11, 0.08, 16]} />
        </mesh>
      </group>
      {/* Right rear */}
      <group position={[0.3, -0.26, 0.2]}>
        <mesh material={darkMat} position={[0, -0.28, 0]} rotation={[0, 0, -0.15]}>
          <cylinderGeometry args={[0.03, 0.03, 0.55, 8]} />
        </mesh>
        <mesh material={darkMat} position={[0.06, -0.55, 0]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.11, 0.11, 0.08, 16]} />
        </mesh>
      </group>
    </group>
  );
}

function Hotspot({
  id,
  value,
  active,
  onSelect,
}: {
  id: string;
  value: number;
  active: boolean;
  onSelect: (id: string | null) => void;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const tone = healthTone(value);
  const color = TONE_HEX[tone];
  const pos = HOTSPOT_POS[id] ?? [0, 0, 0];
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
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(active ? null : id);
        }}
      >
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshBasicMaterial color={color} transparent opacity={active || hover ? 0.95 : 0.6} />
      </mesh>
      {(hover || active) && (
        <Html center distanceFactor={9} position={[0, 0.3, 0]}>
          <div className="pointer-events-none rounded-sm border border-border bg-card/95 px-2 py-1 text-center whitespace-nowrap">
            <p className="label-xs">{HOTSPOTS[id]?.label ?? id}</p>
            <p className="font-mono text-xs" style={{ color }}>
              {value}/100
            </p>
          </div>
        </Html>
      )}
    </group>
  );
}

function GlbAirframe({ url }: { url: string }) {
  const [Comp, setComp] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { useGLTF } = await import("@react-three/drei");
      if (!alive) return;
      const Model = () => {
        const gltf = useGLTF(url);
        return <primitive object={gltf.scene} />;
      };
      setComp(() => Model);
    })();
    return () => {
      alive = false;
    };
  }, [url]);
  return Comp ? <Comp /> : null;
}

export function UavTwin() {
  const { displayed, focusHotspot, setFocusHotspot } = useMission();
  const [hasModel, setHasModel] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetch("/models/uav.glb", { method: "HEAD" })
      .then((r) => {
        if (alive && r.ok) setHasModel(true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const health = displayed?.health;

  return (
    <Canvas shadows camera={{ position: [4.2, 2.6, 5.4], fov: 46 }} dpr={[1, 1.8]}>
      <color attach="background" args={["#101720"]} />
      <fog attach="fog" args={["#101720", 12, 34]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 9, 5]} intensity={1.5} castShadow />
      <Environment>
        <Lightformer intensity={1.6} position={[0, 6, 2]} scale={[10, 10, 1]} />
        <Lightformer
          intensity={0.9}
          color="#7fd8e8"
          position={[-6, 1, -2]}
          rotation-y={Math.PI / 2}
          scale={[18, 2, 1]}
        />
      </Environment>
      <gridHelper args={[26, 26, "#26313d", "#1b232c"]} position={[0, -1.4, 0]} />
      <Suspense fallback={null}>
        {hasModel ? (
          <GlbAirframe url="/models/uav.glb" />
        ) : (
          <Airframe
            rpm={displayed?.sample.params.rpm ?? 0}
            vibration={displayed?.trustedVibration ?? 0}
          />
        )}
      </Suspense>
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
        minDistance={3.5}
        maxDistance={12}
        target={[0, 0, 0.4]}
        autoRotate={!focusHotspot}
        autoRotateSpeed={0.35}
      />
    </Canvas>
  );
}
