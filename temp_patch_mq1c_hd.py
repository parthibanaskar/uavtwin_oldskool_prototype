import codecs

path = 'src/components/mc/twin/UavTwin.tsx'
content = codecs.open(path, 'r', 'utf-8').read()

target = 'function Airframe({ rpm, vibration }: { rpm: number; vibration: number }) {'
end_target = 'function Hotspot({'

start_idx = content.find(target)
end_idx = content.find(end_target)

replacement = r"""function Airframe({ rpm, vibration }: { rpm: number; vibration: number }) {
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
        <cylinderGeometry args={[0.28, 0.15, 5.0, 32]} />
      </mesh>

      {/* Bulbous nose dome - MQ-1C distinctive smooth round head */}
      <mesh material={bodyMat} position={[0, 0.04, 2.4]} scale={[1.0, 0.95, 1.6]}>
        <sphereGeometry args={[0.3, 32, 32]} />
      </mesh>

      {/* Nose neck connector */}
      <mesh material={bodyMat} position={[0, 0.02, 2.0]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.8, 32]} />
      </mesh>

      {/* Belly fairing - slightly protruding underbelly */}
      <mesh material={bodyMat} position={[0, -0.18, 0.3]} scale={[1.0, 0.5, 3.5]}>
        <sphereGeometry args={[0.28, 32, 16]} />
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

"""

new_content = content[:start_idx] + replacement + content[end_idx:]
codecs.open(path, 'w', 'utf-8').write(new_content)
print("Patched Airframe - HD MQ-1C Gray Eagle")
