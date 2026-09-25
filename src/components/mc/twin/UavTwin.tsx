import { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, OrbitControls, Html, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { useMission } from "@/lib/twin/store";
import { HOTSPOTS } from "@/lib/twin/profiles";

// Annotations matched to the original Sketchfab positions but slightly adapted for native 3D
const ANNOTATIONS = [
  { id: 2, position: [-2.02, 0.11, -0.46] as [number, number, number] },
  { id: 5, position: [0.66, 0.04, -0.09] as [number, number, number] },
  { id: 4, position: [1.38, -0.17, -0.13] as [number, number, number] },
  { id: 6, position: [0.93, 0.17, -0.16] as [number, number, number] },
  { id: 7, position: [-0.3, -0.37, 0.19] as [number, number, number] },
  { id: 8, position: [-1.22, -0.37, 0.11] as [number, number, number] },
  { id: 10, position: [2.58, 0.13, 0.2] as [number, number, number] },
];

const TONE_HEX = {
  nominal: "#10b981", // emerald-500
  warning: "#f59e0b", // amber-500
  critical: "#ef4444", // red-500
};

function healthTone(val: number) {
  if (val < 60) return "critical";
  if (val < 85) return "warning";
  return "nominal";
}

function DroneScene({ rpm, vibration, health, focusHotspot, setFocusHotspot }: any) {
  const { scene } = useGLTF("/models/uav.glb");
  const droneRef = useRef<THREE.Group>(null);
  const propRef = useRef<THREE.Object3D | null>(null);

  // Traverse to find propeller
  useEffect(() => {
    scene.traverse((child) => {
      const name = child.name.toLowerCase();
      if (name.includes("prop") || name.includes("rotor") || name.includes("blade")) {
        propRef.current = child;
      }
    });
  }, [scene]);

  useFrame((state, delta) => {
    // Spin propeller based on RPM
    if (propRef.current) {
      propRef.current.rotation.z += (rpm / 60) * delta * 20; 
      propRef.current.rotation.x += (rpm / 60) * delta * 20; // Depending on local axis of the GLTF
    }
    
    // Physics shaking & banking
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
    <group ref={droneRef}>
      <primitive object={scene} scale={1} position={[0,0,0]} />
      {/* Render native HTML hotspots mapped to 3D coords! */}
      {ANNOTATIONS.map(({ id, position }) => {
        const subsystem = HOTSPOTS[id]?.subsystem;
        const val = subsystem && health ? (health.subsystems[subsystem] ?? 100) : 100;
        const tone = healthTone(val);
        const color = TONE_HEX[tone];
        const isActive = focusHotspot === id;

        return (
          <Html key={id} position={position} center distanceFactor={15} zIndexRange={[100, 0]}>
            <button
              className="pointer-events-auto flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all"
              style={{
                borderColor: color,
                backgroundColor: isActive ? color + "99" : "#101720cc",
                color: color,
                boxShadow: isActive ? `0 0 12px ${color}` : "none",
                whiteSpace: "nowrap"
              }}
              onClick={() => setFocusHotspot(isActive ? null : id)}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              {HOTSPOTS[id]?.label ?? id}
              <span className="opacity-70">{val}</span>
            </button>
          </Html>
        );
      })}
    </group>
  );
}

export function UavTwin() {
  const { displayed, focusHotspot, setFocusHotspot } = useMission();
  const stateRef = useRef(displayed);

  useEffect(() => {
    stateRef.current = displayed;
  }, [displayed]);

  const rpm = displayed?.sample.params.rpm ?? 0;
  const vibration = displayed?.trustedVibration ?? 0;
  const health = displayed?.health;

  return (
    <div className="absolute inset-0 bg-[#101720] overflow-hidden flex flex-col cursor-move">
      <Canvas camera={{ position: [5, 4, -6], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 5]} intensity={2.5} />
        <Environment preset="city" />
        
        <DroneScene 
          rpm={rpm} 
          vibration={vibration} 
          health={health} 
          focusHotspot={focusHotspot} 
          setFocusHotspot={setFocusHotspot} 
        />
        
        <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} enablePan={false} maxPolarAngle={Math.PI / 2 + 0.2} />
        <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={20} blur={2} far={4} />
      </Canvas>
    </div>
  );
}
