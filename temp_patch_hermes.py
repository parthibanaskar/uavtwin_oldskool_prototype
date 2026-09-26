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
        <capsuleGeometry args={[0.35, 3.5, 16, 16]} />
      </mesh>
      
      {/* Bulbous Nose (Top/Front) */}
      <mesh material={bodyMat} position={[0, 0.15, 1.5]}>
        <sphereGeometry args={[0.4, 32, 16]} />
      </mesh>
      <mesh material={bodyMat} position={[0, 0.075, 1.6]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 0.8, 16]} />
      </mesh>

      {/* Belly Radome (Bottom/Middle) */}
      <mesh material={bodyMat} position={[0, -0.3, 0.3]}>
        <sphereGeometry args={[0.45, 32, 16]} />
      </mesh>

      {/* Sensor Turret (Chin) */}
      <group position={[0, -0.3, 1.4]}>
        <mesh material={darkMat} position={[0, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.2, 16]} />
        </mesh>
        <mesh material={darkMat} position={[0, -0.1, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
        </mesh>
      </group>

      {/* Wings */}
      <mesh material={bodyMat} position={[0, 0.15, -0.2]}>
        <boxGeometry args={[9.0, 0.06, 0.7]} />
      </mesh>

      {/* V-Tail (Upwards) */}
      <mesh material={bodyMat} position={[0.4, 0.4, -1.8]} rotation={[0, 0, Math.PI/4]}>
        <boxGeometry args={[1.5, 0.05, 0.5]} />
      </mesh>
      <mesh material={bodyMat} position={[-0.4, 0.4, -1.8]} rotation={[0, 0, -Math.PI/4]}>
        <boxGeometry args={[1.5, 0.05, 0.5]} />
      </mesh>
      
      {/* Tail Cone */}
      <mesh material={bodyMat} position={[0, 0, -1.9]} rotation={[-Math.PI/2, 0, 0]}>
        <coneGeometry args={[0.35, 0.6, 16]} />
      </mesh>

      {/* Pusher Propeller (Rear) */}
      <group position={[0, 0, -2.3]}>
        <mesh material={darkMat} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
        </mesh>
        <group ref={prop}>
          <mesh material={propMat}>
            <boxGeometry args={[1.6, 0.05, 0.05]} />
          </mesh>
          <mesh material={propMat} rotation={[0, 0, Math.PI/2]}>
            <boxGeometry args={[1.6, 0.05, 0.05]} />
          </mesh>
        </group>
      </group>
      
      {/* Landing Gear - Front */}
      <group position={[0, -0.3, 1.0]}>
        <mesh material={darkMat} position={[0, -0.3, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.6]} />
        </mesh>
        <mesh material={propMat} position={[0, -0.6, 0]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.08, 0.08, 0.06]} />
        </mesh>
      </group>

      {/* Landing Gear - Rear Left */}
      <group position={[-0.6, -0.2, -0.5]}>
        <mesh material={darkMat} position={[0, -0.4, 0]} rotation={[0, 0, Math.PI/6]}>
          <cylinderGeometry args={[0.04, 0.04, 0.8]} />
        </mesh>
        <mesh material={propMat} position={[-0.2, -0.75, 0]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.08]} />
        </mesh>
      </group>
      
      {/* Landing Gear - Rear Right */}
      <group position={[0.6, -0.2, -0.5]}>
        <mesh material={darkMat} position={[0, -0.4, 0]} rotation={[0, 0, -Math.PI/6]}>
          <cylinderGeometry args={[0.04, 0.04, 0.8]} />
        </mesh>
        <mesh material={propMat} position={[0.2, -0.75, 0]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.08]} />
        </mesh>
      </group>
    </group>
  );
}

'''

new_content = content[:start_idx] + replacement + content[end_idx:]
codecs.open(path, 'w', 'utf-8').write(new_content)
print("Patched Airframe to Hermes 900")
