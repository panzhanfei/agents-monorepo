import type { Group, Mesh, MeshStandardMaterial } from 'three';
import { Color } from 'three';
import type { JSX } from 'react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, Stars } from '@react-three/drei';

import { ThoughtBackdropErrorBoundary } from '~/components/ThoughtBackdropErrorBoundary';
import { useThoughtBackdropPhysics } from '~/components/thought-backdrop-drive';
import { isBrowserWebGlLikelySupported } from '~/lib/webgl-capability';

type IMeshDistortLike = {
  distort: number;
  speed: number;
  color: Color;
  emissive: Color;
};

const COL_WIRE_BASE = new Color('#62e8ff');
const COL_WIRE_THINK = new Color('#fb923c');
const COL_WIRE_EM_BASE = new Color('#090030');
const COL_WIRE_EM_THINK = new Color('#431407');
const COL_DIST_BASE = new Color('#bd7bff');
const COL_DIST_THINK = new Color('#f472b6');
const COL_DIST_EM_BASE = new Color('#1b003f');
const COL_DIST_EM_THINK = new Color('#4c0519');

const ThoughtCoreInner = (): JSX.Element => {
  const { phaseRef, inputSpikeRef } = useThoughtBackdropPhysics();
  const meshWire = useRef<Group>(null);
  const distortMeshRef = useRef<Mesh>(null);
  const wireMeshRef = useRef<Mesh>(null);
  const thinkingBlendRef = useRef(0);
  const motionBlendRef = useRef(0);
  const tmpWireCol = useRef(new Color());
  const tmpWireEm = useRef(new Color());
  const tmpDistCol = useRef(new Color());
  const tmpDistEm = useRef(new Color());

  useFrame((_s, dt) => {
    const phase = phaseRef.current;
    const thinkTarget = phase === 'thinking' ? 1 : 0;
    thinkingBlendRef.current +=
      (thinkTarget - thinkingBlendRef.current) * (1 - Math.exp(-dt * 4.6));

    let spike = inputSpikeRef.current;
    spike *= Math.exp(-dt * 2.85);
    inputSpikeRef.current = spike;

    const inputBoost = phase === 'input' ? spike : spike * 0.28;
    const motionTarget = Math.min(
      1,
      thinkingBlendRef.current * 0.92 + inputBoost * 0.88,
    );
    motionBlendRef.current +=
      (motionTarget - motionBlendRef.current) * (1 - Math.exp(-dt * 6));

    const b = motionBlendRef.current;
    const tb = thinkingBlendRef.current;

    if (meshWire.current !== null) {
      const spin = 0.32 + b * (0.85 + spike * 1.15);
      meshWire.current.rotation.y += dt * spin;
      const t = performance.now() / 1000;
      const swayMul = 0.9 + spike * 1.35;
      meshWire.current.rotation.x =
        Math.sin(t * (0.9 + b * 1.6)) * (0.42 + b * 0.28) * swayMul;
      meshWire.current.rotation.z =
        Math.cos(t * (0.55 + b * 1.1)) * (0.08 + b * 0.12);
      const pulse = 1 + b * (0.07 + Math.sin(t * 3.4) * 0.035);
      meshWire.current.scale.setScalar(pulse);
    }

    const wireMat = wireMeshRef.current?.material;
    if (
      wireMat !== null &&
      wireMat !== undefined &&
      typeof wireMat === 'object' &&
      'color' in wireMat &&
      'emissive' in wireMat
    ) {
      const m = wireMat as MeshStandardMaterial;
      tmpWireCol.current.lerpColors(COL_WIRE_BASE, COL_WIRE_THINK, tb);
      tmpWireEm.current.lerpColors(COL_WIRE_EM_BASE, COL_WIRE_EM_THINK, tb);
      m.color.copy(tmpWireCol.current);
      m.emissive.copy(tmpWireEm.current);
    }

    const dm = distortMeshRef.current?.material;
    if (
      dm !== null &&
      dm !== undefined &&
      typeof dm === 'object' &&
      'distort' in dm &&
      'speed' in dm &&
      'color' in dm &&
      'emissive' in dm
    ) {
      const shaderMat = dm as IMeshDistortLike;
      shaderMat.distort = 0.42 + b * 0.48 + spike * 0.22;
      shaderMat.speed = 2.4 + b * 2.8 + spike * 3.1;
      tmpDistCol.current.lerpColors(COL_DIST_BASE, COL_DIST_THINK, tb);
      tmpDistEm.current.lerpColors(COL_DIST_EM_BASE, COL_DIST_EM_THINK, tb);
      shaderMat.color.copy(tmpDistCol.current);
      shaderMat.emissive.copy(tmpDistEm.current);
    }
  });

  return (
    <>
      <Float
        speed={1.6}
        rotationIntensity={2.5}
        floatIntensity={2}
      >
        <group ref={meshWire}>
          <mesh ref={wireMeshRef}>
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
          <mesh ref={distortMeshRef} scale={1.12}>
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

/** Flat fill when Canvas cannot mount — matches scene background hue. */
const BackdropSolid = (): JSX.Element => (
  <div aria-hidden className="absolute inset-0 bg-[#050613]" />
);

const ThoughtScene = (): JSX.Element => (
  <>
    <color attach="background" args={['#050613']} />
    <fog attach="fog" args={['#050613', 10, 40]} />
    <Stars fade radius={112} depth={42} factor={14} saturation={0} />
    <ambientLight intensity={0.42} />
    <pointLight color="#38bdf8" position={[10, 8, 6]} intensity={220} decay={2} />
    <spotLight color="#d946ef" position={[-14, -4, -2]} intensity={560} decay={2} angle={1.08} />

    <ThoughtCoreInner />
  </>
);

const shellClass =
  'pointer-events-none fixed inset-0 -z-[1] opacity-95';

const vignetteOverlay = (
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#020205_92%)]" />
);

export const ThoughtBackdrop = (): JSX.Element => {
  const webGlProbe = useMemo(() => isBrowserWebGlLikelySupported(), []);
  const [runCanvas, setRunCanvas] = useState(false);
  const [glRuntimeBlocked, setGlRuntimeBlocked] = useState(false);

  useEffect(() => {
    const onWindowError = (ev: ErrorEvent) => {
      const parts = [
        ev.message,
        ev.error instanceof Error ? ev.error.message : '',
        typeof ev.error?.stack === 'string' ? ev.error.stack : '',
      ];
      const text = parts.join(' ');
      if (
        /WebGL|webgl|THREE\.WebGLRenderer|Error creating WebGL|context (loss|lost)/i.test(
          text,
        )
      ) {
        setGlRuntimeBlocked(true);
      }
    };

    window.addEventListener('error', onWindowError);
    return () => {
      window.removeEventListener('error', onWindowError);
    };
  }, []);

  useEffect(() => {
    if (!webGlProbe || glRuntimeBlocked) {
      return;
    }

    /** One frame later: avoids stacking multiple GL contexts during dev Strict Mode’s double mount. */
    const id = requestAnimationFrame(() => {
      setRunCanvas(true);
    });

    return () => {
      cancelAnimationFrame(id);
    };
  }, [webGlProbe, glRuntimeBlocked]);

  if (!webGlProbe || glRuntimeBlocked) {
    return (
      <div className={shellClass}>
        <BackdropSolid />
        {vignetteOverlay}
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <ThoughtBackdropErrorBoundary fallback={<BackdropSolid />}>
        {runCanvas ? (
          <div className="absolute inset-0">
            <Suspense fallback={null}>
              <Canvas
                aria-hidden
                className="block h-full w-full touch-none"
                dpr={[1, 1.5]}
                camera={{ position: [0, 0, 8.25], far: 64, near: 0.1 }}
                gl={{
                  alpha: true,
                  antialias: false,
                  depth: true,
                  stencil: false,
                  powerPreference: 'default',
                  failIfMajorPerformanceCaveat: false,
                }}
              >
                <ThoughtScene />
              </Canvas>
            </Suspense>
          </div>
        ) : (
          <BackdropSolid />
        )}
      </ThoughtBackdropErrorBoundary>
      {vignetteOverlay}
    </div>
  );
};
