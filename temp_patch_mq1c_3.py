import codecs

path = 'src/components/mc/twin/UavTwin.tsx'
content = codecs.open(path, 'r', 'utf-8').read()

target = '''function Airframe({ rpm, vibration }: { rpm: number; vibration: number }) {'''
end_target = '''export function UavTwin() {'''

start_idx = content.find(target)
end_idx = content.find(end_target)

replacement = '''function Airframe({ rpm, vibration }: { rpm: number; vibration: number }) {
  const prop = React.useRef<THREE.Group>(null);
  const body = React.useRef<THREE.Group>(null);

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

  const bodyMat = React.useMemo(() => new THREE.MeshStandardMaterial({ color: "#e3e7e8", metalness: 0.1, roughness: 0.8 }), []);
  const darkMat = React.useMemo(() => new THREE.MeshStandardMaterial({ color: "#2c3440", metalness: 0.4, roughness: 0.6 }), []);
  const propMat = React.useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a1a1a", metalness: 0.3, roughness: 0.7 }), []);
  const glassMat = React.useMemo(() => new THREE.MeshStandardMaterial({ color: "#111111", metalness: 0.9, roughness: 0.1 }), []);
  
  return (
    <group ref={body} scale={[0.8, 0.8, 0.8]}>
      {/* Main Fuselage */}
      <mesh material={bodyMat} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.25, 4.0, 16]} />
      </mesh>
      
      {/* Bulbous Radome (Front) */}
      <mesh material={bodyMat} position={[0, 0.2, 1.6]} rotation={[-0.1, 0, 0]}>
        <sphereGeometry args={[0.4, 32, 16]} />
      </mesh>
      <mesh material={bodyMat} position={[0, 0.1, 1.8]}>
        <cylinderGeometry args={[0.3, 0.4, 0.8, 16]} rotation={[Math.PI/2, 0, 0]} />
      </mesh>
      
      {/* Sensor Turret (Chin) */}
      <mesh material={darkMat} position={[0, -0.4, 1.7]}>
        <cylinderGeometry args={[0.15, 0.15, 0.2, 16]} />
      </mesh>
      <mesh material={glassMat} position={[0, -0.5, 1.7]}>
        <sphereGeometry args={[0.15, 16, 16]} />
      </mesh>

      {/* Engine Intake (Top) */}
      <mesh material={bodyMat} position={[0, 0.4, -0.8]}>
        <boxGeometry args={[0.3, 0.25, 0.8]} />
      </mesh>
      <mesh material={darkMat} position={[0, 0.42, -0.38]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.26, 0.2]} />
      </mesh>

      {/* Wings */}
      <mesh material={bodyMat} position={[0, 0.1, 0.2]}>
        <boxGeometry args={[7.0, 0.08, 0.6]} />
      </mesh>
      
      {/* Pylons and Missiles */}
      <group position={[1.5, -0.1, 0.2]}>
        <mesh material={bodyMat} position={[0, 0, 0]}><boxGeometry args={[0.05, 0.3, 0.4]} /></mesh>
        <mesh material={darkMat} position={[0, -0.2, 0.1]}><cylinderGeometry args={[0.08, 0.08, 1.2, 8]} rotation={[Math.PI/2, 0, 0]} /></mesh>
      </group>
      <group position={[-1.5, -0.1, 0.2]}>
        <mesh material={bodyMat} position={[0, 0, 0]}><boxGeometry args={[0.05, 0.3, 0.4]} /></mesh>
        <mesh material={darkMat} position={[0, -0.2, 0.1]}><cylinderGeometry args={[0.08, 0.08, 1.2, 8]} rotation={[Math.PI/2, 0, 0]} /></mesh>
      </group>

      {/* V-Tail (Inverted) */}
      <mesh material={bodyMat} position={[0.4, -0.3, -1.8]} rotation={[0, 0, -Math.PI/4]}>
        <boxGeometry args={[1.2, 0.05, 0.4]} />
      </mesh>
      <mesh material={bodyMat} position={[-0.4, -0.3, -1.8]} rotation={[0, 0, Math.PI/4]}>
        <boxGeometry args={[1.2, 0.05, 0.4]} />
      </mesh>
      
      {/* Vertical Stabilizer (Upwards) */}
      <mesh material={bodyMat} position={[0, 0.4, -1.8]}>
        <boxGeometry args={[0.05, 0.8, 0.4]} />
      </mesh>

      {/* Pusher Propeller (Rear) */}
      <group position={[0, 0, -2.1]}>
        <mesh material={bodyMat} rotation={[Math.PI/2, 0, 0]}>
          <coneGeometry args={[0.2, 0.4, 16]} />
        </mesh>
        <group ref={prop}>
          <mesh material={propMat} position={[0, 0, -0.1]}>
            <boxGeometry args={[1.8, 0.05, 0.05]} />
          </mesh>
          <mesh material={propMat} position={[0, 0, -0.1]} rotation={[0, 0, Math.PI/2]}>
            <boxGeometry args={[1.8, 0.05, 0.05]} />
          </mesh>
        </group>
      </group>
      
      {/* Hotspots */}
      <Hotspot id="bearing" position={COMPONENT_POS.bearing} />
      <Hotspot id="propeller" position={COMPONENT_POS.propeller} />
      <Hotspot id="fuel" position={COMPONENT_POS.fuel} />
      <Hotspot id="hotSection" position={COMPONENT_POS.hotSection} />
      <Hotspot id="oilSystem" position={COMPONENT_POS.oilSystem} />
      <Hotspot id="avionics" position={COMPONENT_POS.avionics} />
    </group>
  );
}

'''

new_content = content[:start_idx] + replacement + content[end_idx:]
codecs.open(path, 'w', 'utf-8').write(new_content)
print("Patched Airframe to MQ-1C without deleting UavTwin")
