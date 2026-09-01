import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';

const IS_COARSE =
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const IS_SMALL = typeof window !== 'undefined' && window.innerWidth < 768;
const LOW_POWER = IS_COARSE || IS_SMALL;

/* Mouse-parallax rig: the whole scene gently follows the cursor */
function Rig({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = THREE.MathUtils.lerp(
      ref.current.rotation.y,
      state.pointer.x * 0.45,
      0.06
    );
    ref.current.rotation.x = THREE.MathUtils.lerp(
      ref.current.rotation.x,
      -state.pointer.y * 0.3,
      0.06
    );
  });
  return <group ref={ref}>{children}</group>;
}

/* ── The core: dark faceted gem with a smoldering amber-gold ember ──
   Black + warm gold is the oldest luxury pairing there is; the glow
   breathes slowly like an ember, never neon, never loud. */
function GemCore() {
  const core = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (core.current) {
      core.current.rotation.y -= delta * 0.25;
      const s = 1 + Math.sin(t * 1.4) * 0.04;
      core.current.scale.setScalar(s);
      const mat = core.current.material as THREE.MeshStandardMaterial;
      // slow ember breathing — dims to a whisper, never fully dark
      mat.emissiveIntensity = 0.38 + Math.sin(t * 0.9) * 0.18;
    }
    if (light.current) {
      light.current.intensity = 1.1 + Math.sin(t * 0.9) * 0.45;
    }
  });

  return (
    <group>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial
          color="#181410"
          emissive="#c8963e"
          emissiveIntensity={0.38}
          metalness={0.9}
          roughness={0.24}
          flatShading
        />
      </mesh>

      {/* hairline gold wireframe tracing the facets */}
      <mesh scale={1.014}>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshBasicMaterial color="#e3b869" wireframe transparent opacity={0.22} />
      </mesh>

      {/* warm light spilling onto the knot around it */}
      <pointLight ref={light} color="#d9a852" intensity={1.1} distance={5.5} decay={2} />
    </group>
  );
}

/* ── Outer sculpture: open wireframe knot + detailed orbit rings ── */
function OuterSculpture() {
  const knot = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Group>(null);
  const ringB = useRef<THREE.Group>(null);
  const ringC = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (knot.current) {
      knot.current.rotation.x += delta * 0.1;
      knot.current.rotation.y += delta * 0.16;
    }
    if (ringA.current) ringA.current.rotation.z += delta * 0.22;
    if (ringB.current) ringB.current.rotation.z -= delta * 0.16;
    if (ringC.current) ringC.current.rotation.z += delta * 0.1;
  });

  const knotSegments: [number, number] = LOW_POWER ? [140, 24] : [300, 48];
  const ringSegments = LOW_POWER ? 120 : 220;

  return (
    <group>
      <mesh ref={knot}>
        <torusKnotGeometry args={[1.55, 0.2, knotSegments[0], knotSegments[1]]} />
        <meshStandardMaterial
          color="#d9d9d9"
          metalness={0.85}
          roughness={0.28}
          wireframe
          transparent
          opacity={0.65}
        />
      </mesh>

      {/* ring A: main orbit with beaded studs */}
      <group ref={ringA} rotation={[Math.PI / 2.15, 0.35, 0]}>
        <mesh>
          <torusGeometry args={[2.35, 0.016, 12, ringSegments]} />
          <meshStandardMaterial color="#ffffff" metalness={0.7} roughness={0.3} />
        </mesh>
        {Array.from({ length: LOW_POWER ? 6 : 10 }).map((_, i, arr) => {
          const a = (i / arr.length) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 2.35, Math.sin(a) * 2.35, 0]}>
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshStandardMaterial color="#ffffff" metalness={0.6} roughness={0.25} />
            </mesh>
          );
        })}
      </group>

      {/* ring B: secondary orbit carrying a small satellite */}
      <group ref={ringB} rotation={[Math.PI / 1.75, -0.5, 0]}>
        <mesh>
          <torusGeometry args={[2.8, 0.01, 10, ringSegments]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
        </mesh>
        <mesh position={[2.8, 0, 0]}>
          <octahedronGeometry args={[0.11, 0]} />
          <meshStandardMaterial color="#f0f0f0" metalness={0.8} roughness={0.25} flatShading />
        </mesh>
      </group>

      {/* ring C: faint outermost orbit */}
      <mesh ref={ringC} rotation={[Math.PI / 2.6, 0.9, 0.4]}>
        <torusGeometry args={[3.15, 0.006, 8, ringSegments]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

/* ── Floating satellites: richer geometry, self-rotating ────── */
function Spinner({
  children,
  speed = 1,
}: {
  children: React.ReactNode;
  speed?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * 0.4 * speed;
    ref.current.rotation.y += delta * 0.55 * speed;
  });
  return <group ref={ref}>{children}</group>;
}

function Satellites() {
  const detail = LOW_POWER ? 0 : 1;
  return (
    <>
      <Float speed={2} rotationIntensity={0.6} floatIntensity={1.6}>
        <group position={[2.9, 1.3, -0.5]}>
          <Spinner speed={1.2}>
            <mesh>
              <octahedronGeometry args={[0.3, detail]} />
              <meshStandardMaterial color="#f0f0f0" metalness={0.75} roughness={0.3} flatShading />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.44, 0.012, 8, 48]} />
              <meshStandardMaterial color="#bdbdbd" metalness={0.8} roughness={0.3} />
            </mesh>
          </Spinner>
        </group>
      </Float>

      <Float speed={1.6} rotationIntensity={0.8} floatIntensity={1.4}>
        <group position={[-3.1, -1, 0.3]}>
          <Spinner speed={0.8}>
            <mesh>
              <boxGeometry args={[0.36, 0.36, 0.36]} />
              <meshStandardMaterial color="#8a8a8a" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh scale={1.25}>
              <boxGeometry args={[0.36, 0.36, 0.36]} />
              <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.28} />
            </mesh>
          </Spinner>
        </group>
      </Float>

      <Float speed={2.4} rotationIntensity={0.7} floatIntensity={2}>
        <group position={[-2.2, 1.9, -1]}>
          <Spinner speed={1.5}>
            <mesh>
              <dodecahedronGeometry args={[0.24, 0]} />
              <meshStandardMaterial color="#cfcfcf" metalness={0.65} roughness={0.35} flatShading />
            </mesh>
          </Spinner>
        </group>
      </Float>

      <Float speed={1.8} rotationIntensity={0.5} floatIntensity={1.2}>
        <group position={[2.5, -1.8, 0.4]}>
          <Spinner speed={0.6}>
            <mesh>
              <sphereGeometry args={[0.16, 24, 24]} />
              <meshStandardMaterial color="#ffffff" metalness={0.5} roughness={0.2} />
            </mesh>
            <mesh rotation={[Math.PI / 2.4, 0.4, 0]}>
              <torusGeometry args={[0.26, 0.008, 8, 40]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
            </mesh>
          </Spinner>
        </group>
      </Float>

      <Float speed={2.1} rotationIntensity={0.9} floatIntensity={1.7}>
        <group position={[0.4, 2.4, -1.4]}>
          <Spinner speed={1.1}>
            <mesh>
              <icosahedronGeometry args={[0.16, 0]} />
              <meshStandardMaterial color="#e5e5e5" metalness={0.7} roughness={0.3} flatShading />
            </mesh>
          </Spinner>
        </group>
      </Float>
    </>
  );
}

/* strong soft-glow sprite texture — bright core, crisp sparkle cross */
function makeStarTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  const beam = (w: number, h: number) => {
    const bg = ctx.createRadialGradient(c, c, 0, c, c, Math.max(w, h) / 2);
    bg.addColorStop(0, 'rgba(255,255,255,1)');
    bg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.translate(c, c);
    ctx.scale(w / size, h / size);
    ctx.translate(-c, -c);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  };
  beam(size, size * 0.16);
  beam(size * 0.16, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/* Starfield — high-contrast sparkling stars in two depth layers */
function Particles() {
  const layers = useMemo(
    () =>
      LOW_POWER
        ? [
            { count: 90, spread: 14, size: 0.18, opacity: 1, speed: 0.015 },
            { count: 60, spread: 19, size: 0.1, opacity: 0.75, speed: -0.009 },
          ]
        : [
            { count: 110, spread: 13, size: 0.22, opacity: 1, speed: 0.016 },
            { count: 70, spread: 19, size: 0.12, opacity: 0.8, speed: -0.01 },
          ],
    []
  );

  const texture = useMemo(() => makeStarTexture(), []);
  const groupRef = useRef<THREE.Group>(null);
  const matRefs = useRef<(THREE.PointsMaterial | null)[]>([]);

  const positionsPerLayer = useMemo(
    () =>
      layers.map((l) => {
        const arr = new Float32Array(l.count * 3);
        for (let i = 0; i < l.count; i++) {
          const r = l.spread * (0.5 + Math.random() * 0.5);
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
          arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.8;
          arr[i * 3 + 2] = r * Math.cos(phi);
        }
        return arr;
      }),
    [layers]
  );

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    g.children.forEach((child, i) => {
      child.rotation.y += delta * layers[i].speed;
      child.rotation.x += delta * layers[i].speed * 0.35;
    });
    const t = state.clock.elapsedTime;
    // strong twinkle: dips deeper, peaks at full brightness
    matRefs.current.forEach((m, i) => {
      if (m) m.opacity = layers[i].opacity * (0.65 + 0.35 * Math.sin(t * 1.3 + i * 2.4));
    });
  });

  return (
    <group ref={groupRef}>
      {layers.map((l, i) => (
        <points key={i}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positionsPerLayer[i], 3]} />
          </bufferGeometry>
          <pointsMaterial
            ref={(el) => {
              matRefs.current[i] = el;
            }}
            map={texture}
            size={l.size}
            color="#ffffff"
            transparent
            opacity={l.opacity}
            sizeAttenuation
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      ))}
    </group>
  );
}

export default function Scene3D({ active = true }: { active?: boolean }) {
  const [dpr, setDpr] = useState<number>(LOW_POWER ? 1 : 1.5);

  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={dpr}
      camera={{ position: [0, 0, 8.6], fov: 48 }}
      gl={{
        antialias: !LOW_POWER,
        alpha: true,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
      }}
      className="!pointer-events-none"
      eventSource={document.body}
      eventPrefix="client"
    >
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr(LOW_POWER ? 1 : 1.5)}
      />
      <AdaptiveDpr pixelated />
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 5]} intensity={1.3} color="#ffffff" />
      <pointLight position={[-5, -3, -2]} intensity={0.4} color="#9a9a9a" />
      <Rig>
        <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.8}>
          <GemCore />
          <OuterSculpture />
        </Float>
        <Satellites />
        <Particles />
      </Rig>
    </Canvas>
  );
}
