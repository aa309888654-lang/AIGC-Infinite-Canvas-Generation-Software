// @ts-nocheck
import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

interface AnimatedMeshBackgroundProps {
  color?: string;
  secondaryColor?: string;
  accentColor?: string;
  particleCount?: number;
  connectionDistance?: number;
  particleSize?: number;
  lineOpacity?: number;
  mouseInfluence?: number;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
}

const AnimatedMeshBackground: React.FC<AnimatedMeshBackgroundProps> = ({
  color = '#3B82F6',
  secondaryColor = '#1D4ED8',
  accentColor = '#6366F1',
  particleCount = 200,
  mouseInfluence = 0.15,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const animationFrameRef = useRef<number>(0);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      mouseRef.current.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    },
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.035);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x111122, 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.PointLight(
      new THREE.Color(color),
      3,
      20,
      1.5
    );
    mainLight.position.set(1.5, 0.5, 3);
    scene.add(mainLight);

    const secondaryLight = new THREE.PointLight(
      new THREE.Color(secondaryColor),
      2,
      15,
      1.5
    );
    secondaryLight.position.set(-2, -1, 2);
    scene.add(secondaryLight);

    const accentLight = new THREE.PointLight(
      new THREE.Color(accentColor),
      1.5,
      12,
      1.5
    );
    accentLight.position.set(0, 2, -1);
    scene.add(accentLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(0, 5, 3);
    scene.add(directionalLight);

    // --- Main Object: Iridescent Torus Knot ---
    const torusKnotGeometry = new THREE.TorusKnotGeometry(1.2, 0.35, 128, 32, 2, 3);

    // Custom iridescent shader material
    const iridescentVertexShader = `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      varying vec2 vUvCoord;

      void main() {
        vUvCoord = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        vNormal = normalize(normalMatrix * normal);
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const iridescentFragmentShader = `
      uniform float uTime;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;

      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      varying vec2 vUvCoord;

      // Simple noise for iridescence
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);

        // Iridescent color shift based on view angle and time
        float angle = dot(viewDir, vNormal) + uTime * 0.3;
        vec3 iriColor = mix(uColor1, uColor2, sin(angle * 3.14159) * 0.5 + 0.5);
        iriColor = mix(iriColor, uColor3, sin(angle * 6.28318 + 1.0) * 0.3 + 0.3);

        // Add noise-based variation
        float n = noise(vUvCoord * 8.0 + uTime * 0.1);
        iriColor += n * 0.08;

        // Metallic reflection
        vec3 reflected = reflect(-viewDir, vNormal);
        float envMap = pow(max(dot(reflected, vec3(0.0, 1.0, 0.0)), 0.0), 2.0);

        // Combine
        vec3 baseColor = iriColor * 0.6;
        vec3 metalColor = mix(baseColor, vec3(1.0), 0.15);
        vec3 finalColor = metalColor + fresnel * iriColor * 1.2 + envMap * uColor2 * 0.3;

        // Subtle rim glow
        finalColor += fresnel * uColor1 * 0.5;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const iridescentMaterial = new THREE.ShaderMaterial({
      vertexShader: iridescentVertexShader,
      fragmentShader: iridescentFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(color) },
        uColor2: { value: new THREE.Color(secondaryColor) },
        uColor3: { value: new THREE.Color(accentColor) },
      },
    });

    const torusKnot = new THREE.Mesh(torusKnotGeometry, iridescentMaterial);
    torusKnot.position.set(1.2, 0, 0);
    scene.add(torusKnot);

    // --- Wireframe overlay for extra visual depth ---
    const wireframeGeometry = new THREE.TorusKnotGeometry(1.22, 0.36, 64, 16, 2, 3);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      wireframe: true,
      transparent: true,
      opacity: 0.04,
    });
    const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    wireframeMesh.position.copy(torusKnot.position);
    scene.add(wireframeMesh);

    // --- Particles ---
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const velocities = new Float32Array(particleCount * 3);

    const color1 = new THREE.Color(color);
    const color2 = new THREE.Color(secondaryColor);
    const color3 = new THREE.Color(accentColor);

    for (let i = 0; i < particleCount; i++) {
      // Distribute particles in a large sphere
      const radius = 3 + Math.random() * 8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi) - 2;

      // Random velocities for drift
      velocities[i * 3] = (Math.random() - 0.5) * 0.003;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.003;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;

      // Mix of teal, cyan, and accent colors
      const colorMix = Math.random();
      let pColor: THREE.Color;
      if (colorMix < 0.4) {
        pColor = color1.clone().lerp(color2, Math.random());
      } else if (colorMix < 0.8) {
        pColor = color2.clone().lerp(color3, Math.random() * 0.5);
      } else {
        pColor = color3.clone();
      }

      particleColors[i * 3] = pColor.r;
      particleColors[i * 3 + 1] = pColor.g;
      particleColors[i * 3 + 2] = pColor.b;

      sizes[i] = 1.5 + Math.random() * 3;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('aParticleColor', new THREE.BufferAttribute(particleColors, 3));
    particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    // Custom particle shader for glow effect
    const particleVertexShader = `
      attribute vec3 aParticleColor;
      attribute float aSize;
      varying vec3 vParticleColor;
      varying float vAlpha;

      void main() {
        vParticleColor = aParticleColor;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = length(mvPosition.xyz);
        vAlpha = clamp(1.0 - dist / 15.0, 0.1, 0.8);
        gl_PointSize = aSize * (200.0 / -mvPosition.z);
        gl_PointSize = max(gl_PointSize, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const particleFragmentShader = `
      varying vec3 vParticleColor;
      varying float vAlpha;

      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;

        float glow = 1.0 - smoothstep(0.0, 0.5, dist);
        glow = pow(glow, 1.5);

        vec3 finalColor = vParticleColor * (1.0 + glow * 0.5);
        gl_FragColor = vec4(finalColor, glow * vAlpha);
      }
    `;

    const particleMaterial = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);

    // --- God Rays (simple volumetric light beams) ---
    const rayCount = 5;
    const rays: THREE.Mesh[] = [];
    for (let i = 0; i < rayCount; i++) {
      const rayGeometry = new THREE.PlaneGeometry(0.3 + Math.random() * 0.4, 12 + Math.random() * 6);
      const rayMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(i % 2 === 0 ? color : secondaryColor),
        transparent: true,
        opacity: 0.015 + Math.random() * 0.02,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ray = new THREE.Mesh(rayGeometry, rayMaterial);
      const angle = (i / rayCount) * Math.PI * 2 + Math.random() * 0.5;
      ray.position.set(
        Math.cos(angle) * 2 + 1.2,
        Math.sin(angle) * 1.5,
        -3
      );
      ray.rotation.z = angle + Math.PI * 0.25;
      ray.rotation.y = Math.random() * 0.3;
      scene.add(ray);
      rays.push(ray);
    }

    // --- Mouse Tracking ---
    window.addEventListener('mousemove', handleMouseMove);

    // --- Resize Handler ---
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // --- Animation Loop ---
    const clock = new THREE.Clock();
    const baseCameraPos = new THREE.Vector3(0, 0, 5);

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const delta = clock.getDelta();

      // Smooth mouse following with lerp
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.02;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.02;

      // Update iridescent shader time
      iridescentMaterial.uniforms.uTime.value = elapsed;

      // Rotate main object slowly
      torusKnot.rotation.y = elapsed * 0.15 + mouseRef.current.x * 0.3;
      torusKnot.rotation.x = elapsed * 0.1 + mouseRef.current.y * 0.2;
      torusKnot.rotation.z = Math.sin(elapsed * 0.08) * 0.1;

      // Wireframe follows main object
      wireframeMesh.rotation.copy(torusKnot.rotation);

      // Subtle floating motion for main object
      torusKnot.position.y = Math.sin(elapsed * 0.3) * 0.15;
      wireframeMesh.position.y = torusKnot.position.y;

      // Animate particles - drift
      const posArray = particleGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        posArray[i * 3] += velocities[i * 3];
        posArray[i * 3 + 1] += velocities[i * 3 + 1];
        posArray[i * 3 + 2] += velocities[i * 3 + 2];

        // Wrap particles that go too far
        const dist = Math.sqrt(
          posArray[i * 3] ** 2 +
          posArray[i * 3 + 1] ** 2 +
          (posArray[i * 3 + 2] + 2) ** 2
        );
        if (dist > 12) {
          const radius = 3 + Math.random() * 4;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          posArray[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
          posArray[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
          posArray[i * 3 + 2] = radius * Math.cos(phi) - 2;
        }
      }
      particleGeometry.attributes.position.needsUpdate = true;

      // Slow particle system rotation
      particleSystem.rotation.y = elapsed * 0.02;
      particleSystem.rotation.x = elapsed * 0.01;

      // Animate god rays
      rays.forEach((ray, i) => {
        ray.material.opacity = (0.015 + Math.sin(elapsed * 0.5 + i) * 0.01) * (1 + mouseRef.current.x * 0.3);
        ray.rotation.z += 0.0003 * (i % 2 === 0 ? 1 : -1);
      });

      // Animate lights
      mainLight.position.x = 1.5 + Math.sin(elapsed * 0.5) * 0.5;
      mainLight.position.y = 0.5 + Math.cos(elapsed * 0.3) * 0.3;
      secondaryLight.position.x = -2 + Math.cos(elapsed * 0.4) * 0.3;

      // Camera parallax - subtle mouse follow
      camera.position.x = baseCameraPos.x + mouseRef.current.x * mouseInfluence;
      camera.position.y = baseCameraPos.y - mouseRef.current.y * mouseInfluence;
      camera.lookAt(0.5, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);

      // Dispose geometries
      torusKnotGeometry.dispose();
      wireframeGeometry.dispose();
      particleGeometry.dispose();

      // Dispose materials
      iridescentMaterial.dispose();
      wireframeMaterial.dispose();
      particleMaterial.dispose();
      rays.forEach((ray) => {
        ray.geometry.dispose();
        (ray.material as THREE.Material).dispose();
      });

      // Dispose renderer
      renderer.dispose();

      // Remove canvas from DOM
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [color, secondaryColor, accentColor, particleCount, mouseInfluence, handleMouseMove]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100vh',
        zIndex: -1,
        background: '#000000',
        overflow: 'hidden',
      }}
    >
      {/* Edge vignette overlay for depth */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
    </div>
  );
};

export default AnimatedMeshBackground;
