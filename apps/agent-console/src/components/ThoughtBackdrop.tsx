import type { Group } from 'three';
import type { JSX } from 'react';
import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, Stars } from '@react-three/drei';

const ThoughtCoreInner = (): JSX.Element => {
  const meshWire = useRef<Group>(null);
  useFrame((_s, dt) => {
    if (meshWire.current !== null) {
      meshWire.current.rotation.y += dt * 0.35;
      const t = performance.now() / 1000;
      meshWire.current.rotation.x = Math.sin(t * 0.9) * 0.42;
      meshWire.current.rotation.z = Math.cos(t * 0.55) * 0.08;
    }
  });

  return (
    <>
      <Float speed={1.6} rotationIntensity={2.5} floatIntensity={2}>
        <group ref={meshWire}>
          <mesh>
            <icosahedronGeometry args={[2.2, 1]} />
            <meshStandardMaterial
              attach="material"
              wireframe
              color="#62e8ff"
              metalness={0.35}
              roughness={0.12}
              emissive="#090030"
              emissiveIntensity={0.85}
            />
          </mesh>
          <mesh scale={1.12}>
            <icosahedronGeometry args={[2.28, 0]} />
            <MeshDistortMaterial
              distort={0.42}
              speed={2.4}
              color="#bd7bff"
              emissive="#1b003f"
              emissiveIntensity={0.85}
              metalness={0.55}
              roughness={0.18}
            />
          </mesh>
        </group>
      </Float>
      <Sphere args={[0.42, 32, 32]} position={[3.35, -0.72, -0.9]}>
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#0891b2"
          metalness={0.8}
          roughness={0.15}
          wireframe={false}
        />
      </Sphere>
      <Sphere args={[0.28, 32, 32]} position={[-2.9, 1.1, -1.2]}>
        <meshStandardMaterial
          color="#c084fc"
          emissive="#6b21a8"
          metalness={0.75}
          roughness={0.2}
          wireframe={false}
        />
      </Sphere>
    </>
  );
};

export const ThoughtBackdrop = (): JSX.Element => (
  <div className="pointer-events-none fixed inset-0 -z-[1] opacity-95">
    <Canvas
      aria-hidden
      dpr={[1, 2]}
      camera={{ position: [0, 0, 8.25], far: 64, near: 0.1 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#050613']} />
      <fog attach="fog" args={['#050613', 10, 40]} />
      <Stars fade radius={112} depth={42} factor={14} saturation={0} />
      <ambientLight intensity={0.42} />
      <pointLight color="#38bdf8" position={[10, 8, 6]} intensity={220} decay={2} />
      <spotLight color="#d946ef" position={[-14, -4, -2]} intensity={560} decay={2} angle={1.08} />

      <ThoughtCoreInner />
    </Canvas>

    {/* 叠一层暗角与高亮 vignette */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#020205_92%)]" />
  </div>
);
