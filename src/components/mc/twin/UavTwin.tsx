import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Html, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { useMission } from "@/lib/twin/store";
import { HOTSPOTS } from "@/lib/twin/profiles";
import { healthTone } from "../primitives";

const TONE_HEX = { ok: "#2fd39a", warn: "#f2c14e", crit: "#ef4444" } as const;

/** Hotspot anchor points on the procedural airframe (metres, model space). */
const HOTSPOT_POS: Record<string, [number, number, number]> = {
  propeller: [-2.02, 0.11, -0.46],
  bearing: [0.66, 0.04, -0.09],
  hotSection: [1.38, -0.17, -0.13],
  cylinder: [1.15, 0.15, -0.1], // Roughly between bearing and hotSection
  oilSystem: [0.93, 0.17, -0.16],
  fuelSystem: [-0.3, -0.37, 0.19],
  electrical: [-1.22, -0.37, 0.11],
  avionics: [2.58, 0.13, 0.2],
};

function GlbAirframe({ rpm, vibration }: { rpm: number; vibration: number }) {
  const { scene } = useGLTF("/models/uav.glb");
  const droneRef = useRef<THREE.Group>(null);
  const propRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    scene.traverse((child) => {
      const name = child.name.toLowerCase();
      if (name.includes("prop") || name.includes("rotor") || name.includes("blade")) {
        propRef.current = child;
      }
    });
  }, [scene]);

  useFrame((state, delta) => {
    if (propRef.current) {
      propRef.current.rotation.z += (rpm / 60) * delta * 20;
      propRef.current.rotation.x += (rpm / 60) * delta * 20;
    }
    if (droneRef.current) {
      const t = state.clock.getElapsedTime();
      const bank = Math.sin(t * 0.5) * 0.05;
      const pitch = Math.cos(t * 0.3) * 0.02;
      const shakeAmt = Math.max(0, vibration - 20) * 0.002;
      const shakeX = (Math.random() - 0.5) * shakeAmt;
      const shakeY = (Math.random() - 0.5) * shakeAmt;
      const shakeZ = (Math.random() - 0.5) * shakeAmt;
      
      droneRef.current.rotation.z = THREE.MathUtils.lerp(droneRef.current.rotation.z, bank, 0.1);
      droneRef.current.rotation.x = THREE.MathUtils.lerp(droneRef.current.rotation.x, pitch, 0.1);
      droneRef.current.position.set(shakeX, shakeY, shakeZ);
    }
  });

  return (
    <group ref={droneRef} scale={1.2}>
      {/* 
        The Sketchfab model coordinates might be slightly off due to orientation differences.
        Usually GLTF models need some rotation to match the world axes correctly.
        We'll just render it here, the user can orbit around it.
      */}
      <primitive object={scene} />
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



export function UavTwin() {
  const { displayed, focusHotspot, setFocusHotspot } = useMission();

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
        <GlbAirframe
          rpm={displayed?.sample.params.rpm ?? 0}
          vibration={displayed?.trustedVibration ?? 0}
        />
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
