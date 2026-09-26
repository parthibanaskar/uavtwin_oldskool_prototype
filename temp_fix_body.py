import codecs, re

path = 'src/components/mc/twin/UavTwin.tsx'
content = codecs.open(path, 'r', 'utf-8').read()

# Widen the main fuselage cylinder
content = content.replace(
    '<cylinderGeometry args={[0.28, 0.15, 5.0, 32]} />',
    '<cylinderGeometry args={[0.48, 0.22, 5.2, 32]} />'
)

# Bigger nose dome
content = content.replace(
    '<mesh material={bodyMat} position={[0, 0.04, 2.4]} scale={[1.0, 0.95, 1.6]}>',
    '<mesh material={bodyMat} position={[0, 0.08, 2.45]} scale={[1.3, 1.25, 2.0]}>'
)

# Wider nose connector cylinder
content = content.replace(
    '<mesh material={bodyMat} position={[0, 0.02, 2.0]} rotation={[Math.PI/2, 0, 0]}>\n        <cylinderGeometry args={[0.28, 0.28, 0.8, 32]} />',
    '<mesh material={bodyMat} position={[0, 0.05, 1.95]} rotation={[Math.PI/2, 0, 0]}>\n        <cylinderGeometry args={[0.48, 0.48, 0.9, 32]} />'
)

# Bigger belly fairing
content = content.replace(
    '<mesh material={bodyMat} position={[0, -0.18, 0.3]} scale={[1.0, 0.5, 3.5]}>',
    '<mesh material={bodyMat} position={[0, -0.26, 0.3]} scale={[1.3, 0.65, 4.0]}>'
)

content = content.replace(
    '<sphereGeometry args={[0.28, 32, 16]} />',
    '<sphereGeometry args={[0.42, 32, 16]} />'
)

codecs.open(path, 'w', 'utf-8').write(content)
print("Body widened")
