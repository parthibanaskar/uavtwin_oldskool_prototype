import codecs

path = 'src/components/mc/twin/UavTwin.tsx'
content = codecs.open(path, 'r', 'utf-8').read()

target = '''function Airframe({ rpm, vibration }: { rpm: number; vibration: number }) {'''
end_target = '''function Hotspot({'''

start_idx = content.find(target)
end_idx = content.find(end_target)

replacement = '''function Airframe({ rpm, vibration }: { rpm: number; vibration: number }) {
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

  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#dbe2e6", metalness: 0.2, roughness: 0.6 }), []);
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2c3440", metalness: 0.4, roughness: 0.6 }), []);
  const propMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#111", metalness: 0.5, roughness: 0.5 }), []);
  
  return (
    <group ref={body} scale={[0.8, 0.8, 0.8]} position={[0, 0, 0.6]}>
      {/* Main Fuselage */}
      <mesh material={bodyMat} position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.2, 4.5, 32]} />
      </mesh>
      
      {/* MQ-1C Bulbous Head (Stretched Sphere) */}
      <mesh material={bodyMat} position={[0, 0.15, 1.8]} scale={[1.1, 1.4, 3.2]}>
        <sphereGeometry args={[0.3, 32, 32]} />
      </mesh>

      {/* Nose cone rounding */}
      <mesh material={bodyMat} position={[0, 0, 2.25]} scale={[1, 0.8, 1.5]}>
        <sphereGeometry args={[0.3, 32, 32]} />
      </mesh>

      {/* Belly Radome (Flattened Stretched Sphere) */}
      <mesh material={bodyMat} position={[0, -0.25, 0.5]} scale={[1.2, 0.6, 2.5]}>
        <sphereGeometry args={[0.35, 32, 32]} />
      </mesh>

      {/* Sensor Turret (Chin) */}
      <group position={[0, -0.3, 1.5]}>
        <mesh material={darkMat} position={[0, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.2, 16]} />
        </mesh>
        <mesh material={darkMat} position={[0, -0.1, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
        </mesh>
      </group>

      {/* Wings */}
      <mesh material={bodyMat} position={[0, 0.1, -0.1]}>
        <boxGeometry args={[11.0, 0.05, 0.6]} />
      </mesh>

      {/* Inverted V-Tail (MQ-1C points DOWN, unlike Hermes which points UP) */}
      <mesh material={bodyMat} position={[0.4, -0.5, -2.0]} rotation={[0, 0, Math.PI/4]}>
        <boxGeometry args={[1.6, 0.04, 0.5]} />
      </mesh>
      <mesh material={bodyMat} position={[-0.4, -0.5, -2.0]} rotation={[0, 0, -Math.PI/4]}>
        <boxGeometry args={[1.6, 0.04, 0.5]} />
      </mesh>
      
      {/* Vertical Stabilizer (Upwards) */}
      <mesh material={bodyMat} position={[0, 0.5, -2.0]}>
        <boxGeometry args={[0.04, 1.0, 0.5]} />
      </mesh>

      {/* Tail Cone */}
      <mesh material={bodyMat} position={[0, 0, -2.25]} rotation={[-Math.PI/2, 0, 0]}>
        <coneGeometry args={[0.2, 0.5, 32]} />
      </mesh>

      {/* Pusher Propeller (Rear) */}
      <group position={[0, 0, -2.6]}>
        <mesh material={darkMat} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.2, 16]} />
        </mesh>
        <group ref={prop}>
          <mesh material={propMat}>
            <boxGeometry args={[1.8, 0.04, 0.04]} />
          </mesh>
          <mesh material={propMat} rotation={[0, 0, Math.PI/2]}>
            <boxGeometry args={[1.8, 0.04, 0.04]} />
          </mesh>
        </group>
      </group>
      
      {/* Hellfire Missiles */}
      <group position={[2.0, -0.1, -0.1]}>
        <mesh material={bodyMat} position={[0, 0, 0]}><boxGeometry args={[0.04, 0.2, 0.4]} /></mesh>
        <mesh material={darkMat} position={[0, -0.15, 0.1]}><cylinderGeometry args={[0.06, 0.06, 1.0, 16]} rotation={[Math.PI/2, 0, 0]} /></mesh>
      </group>
      <group position={[-2.0, -0.1, -0.1]}>
        <mesh material={bodyMat} position={[0, 0, 0]}><boxGeometry args={[0.04, 0.2, 0.4]} /></mesh>
        <mesh material={darkMat} position={[0, -0.15, 0.1]}><cylinderGeometry args={[0.06, 0.06, 1.0, 16]} rotation={[Math.PI/2, 0, 0]} /></mesh>
      </group>

      {/* Landing Gear - Front */}
      <group position={[0, -0.4, 1.0]}>
        <mesh material={darkMat} position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.4]} />
        </mesh>
        <mesh material={propMat} position={[0, -0.4, 0]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.06, 0.06, 0.06]} />
        </mesh>
      </group>

      {/* Landing Gear - Rear Left */}
      <group position={[-0.4, -0.2, -0.5]}>
        <mesh material={darkMat} position={[0, -0.3, 0]} rotation={[0, 0, Math.PI/8]}>
          <cylinderGeometry args={[0.03, 0.03, 0.6]} />
        </mesh>
        <mesh material={propMat} position={[-0.1, -0.6, 0]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.08]} />
        </mesh>
      </group>
      
      {/* Landing Gear - Rear Right */}
      <group position={[0.4, -0.2, -0.5]}>
        <mesh material={darkMat} position={[0, -0.3, 0]} rotation={[0, 0, -Math.PI/8]}>
          <cylinderGeometry args={[0.03, 0.03, 0.6]} />
        </mesh>
        <mesh material={propMat} position={[0.1, -0.6, 0]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.08]} />
        </mesh>
      </group>
    </group>
  );
}

'''

new_content = content[:start_idx] + replacement + content[end_idx:]
codecs.open(path, 'w', 'utf-8').write(new_content)
print("Patched Airframe to accurate MQ-1C")
