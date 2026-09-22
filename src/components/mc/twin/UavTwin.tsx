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
    if (prop.current) prop.current.rotation.z += dt * (rpm / 60) * 0.35;
    if (body.current) {
      const a = Math.min(0.05, vibration * 0.0035);
      const t = state.clock.elapsedTime;
      body.current.position.y = Math.sin(t * 22) * a;
      body.current.rotation.z = Math.sin(t * 17) * a * 0.6;
    }
  });

  const metal = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#5b6672", metalness: 0.65, roughness: 0.45 }),
    [],
  );
  const dark = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#2c3440", metalness: 0.4, roughness: 0.6 }),
    [],
  );

  return (
    <group ref={body}>
      {/* fuselage */}
      <mesh material={metal} position={[0, 0, 0.6]} rotation-x={Math.PI / 2} castShadow>
        <capsuleGeometry args={[0.3, 2.6, 8, 20]} />
      </mesh>
      {/* nose cone */}
      <mesh material={dark} position={[0, 0, 2.15]} rotation-x={-Math.PI / 2}>
        <coneGeometry args={[0.29, 0.5, 20]} />
      </mesh>
      {/* wings */}
      <mesh material={metal} position={[0, 0.02, 0.75]} castShadow>
        <boxGeometry args={[6.2, 0.08, 0.66]} />
      </mesh>
      {/* winglets */}
      {[-3.05, 3.05].map((x) => (
        <mesh key={x} material={dark} position={[x, 0.18, 0.75]}>
          <boxGeometry args={[0.06, 0.36, 0.5]} />
        </mesh>
      ))}
      {/* tail booms */}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} material={dark} position={[x, 0, -0.9]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.055, 0.055, 2.6, 12]} />
        </mesh>
      ))}
      {/* horizontal stabiliser */}
      <mesh material={metal} position={[0, 0.16, -2.1]}>
        <boxGeometry args={[1.5, 0.06, 0.4]} />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} material={dark} position={[x, 0.36, -2.1]}>
          <boxGeometry args={[0.06, 0.5, 0.36]} />
        </mesh>
      ))}
      {/* payload turret */}
      <mesh material={dark} position={[0, -0.32, 0.95]}>
        <sphereGeometry args={[0.2, 18, 14]} />
      </mesh>
      {/* propeller */}
      <group ref={prop} position={[0, 0, 2.45]}>
        <mesh material={dark}>
          <sphereGeometry args={[0.09, 12, 10]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            material={metal}
            rotation-z={(i * Math.PI * 2) / 3}
            position={[
              Math.cos((i * Math.PI * 2) / 3) * 0.42,
              Math.sin((i * Math.PI * 2) / 3) * 0.42,
              0,
            ]}
          >
            <boxGeometry args={[0.8, 0.09, 0.03]} />
          </mesh>
        ))}
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
