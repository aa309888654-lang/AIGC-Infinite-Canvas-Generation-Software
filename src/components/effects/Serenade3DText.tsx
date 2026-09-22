import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import helvetikerFont from 'three/examples/fonts/helvetiker_bold.typeface.json?url';

function createParticleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.26, 'rgba(128,218,255,0.92)');
  gradient.addColorStop(0.62, 'rgba(82,122,255,0.25)');
  gradient.addColorStop(1, 'rgba(82,122,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 96, 96);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createGlowSprite(color: string, scale: [number, number, number], opacity: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.36, color.replace('0.72', '0.32'));
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale[0], scale[1], scale[2]);
  return sprite;
}

export default function Serenade3DText() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameIdRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 620;
    let disposed = false;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020615, 0.055);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 1.45, 13.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.38;
    controls.minPolarAngle = Math.PI / 2.7;
    controls.maxPolarAngle = Math.PI / 1.9;
    controls.target.set(0, 0.45, 0);

    const ambientLight = new THREE.AmbientLight(0x213a68, 0.72);
    scene.add(ambientLight);

    const spotLight = new THREE.SpotLight(0xffffff, 4.2, 38, Math.PI / 5.6, 0.48, 1.1);
    spotLight.position.set(0, 9, 5.2);
    spotLight.target.position.set(0, 0.4, 0);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    scene.add(spotLight, spotLight.target);

    const leftFill = new THREE.PointLight(0x4f8cff, 2.4, 30);
    leftFill.position.set(-6.2, 1.6, 5.8);
    scene.add(leftFill);

    const rightFill = new THREE.PointLight(0xa38bff, 1.9, 28);
    rightFill.position.set(6.4, 2.1, 2.8);
    scene.add(rightFill);

    const rimLight = new THREE.PointLight(0x66e8ff, 3, 34);
    rimLight.position.set(1.8, 2.6, -6);
    scene.add(rimLight);

    const heroGroup = new THREE.Group();
    heroGroup.rotation.set(-0.04, -0.14, -0.015);
    scene.add(heroGroup);

    const envCanvas = document.createElement('canvas');
    envCanvas.width = 512;
    envCanvas.height = 64;
    const envCtx = envCanvas.getContext('2d');
    if (envCtx) {
      const gradient = envCtx.createLinearGradient(0, 0, 512, 0);
      gradient.addColorStop(0, '#081122');
      gradient.addColorStop(0.22, '#66e8ff');
      gradient.addColorStop(0.5, '#f8fafc');
      gradient.addColorStop(0.76, '#7b61ff');
      gradient.addColorStop(1, '#020615');
      envCtx.fillStyle = gradient;
      envCtx.fillRect(0, 0, 512, 64);
    }
    const envTexture = new THREE.CanvasTexture(envCanvas);
    envTexture.mapping = THREE.EquirectangularReflectionMapping;

    const mainMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f7ff,
      metalness: 0.92,
      roughness: 0.16,
      envMap: envTexture,
      envMapIntensity: 1.6,
      emissive: 0x203a62,
      emissiveIntensity: 0.42,
    });

    const bevelMaterial = new THREE.MeshStandardMaterial({
      color: 0x8ff0ff,
      metalness: 0.78,
      roughness: 0.12,
      envMap: envTexture,
      envMapIntensity: 1.85,
      emissive: 0x0c8fff,
      emissiveIntensity: 0.34,
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x78cfff,
      metalness: 0.05,
      roughness: 0.04,
      transmission: 0.58,
      transparent: true,
      opacity: 0.68,
      thickness: 0.62,
      ior: 1.42,
      envMap: envTexture,
      envMapIntensity: 1.25,
      emissive: 0x006dff,
      emissiveIntensity: 0.45,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08,
    });

    const loader = new FontLoader();
    const textMeshes: THREE.Mesh[] = [];
    loader.load(helvetikerFont, (font) => {
      if (disposed) return;

      const mainGeometry = new TextGeometry('Get started', {
        font,
        size: 1.18,
        depth: 0.42,
        curveSegments: 18,
        bevelEnabled: true,
        bevelThickness: 0.045,
        bevelSize: 0.028,
        bevelSegments: 6,
      });
      mainGeometry.center();
      const mainText = new THREE.Mesh(mainGeometry, [mainMaterial, bevelMaterial]);
      mainText.position.set(0, 1.2, 0);
      mainText.rotation.set(-0.03, 0.04, -0.01);
      mainText.castShadow = true;
      mainText.receiveShadow = true;
      heroGroup.add(mainText);
      textMeshes.push(mainText);

      const subGeometry = new TextGeometry('Ecosystems', {
        font,
        size: 0.82,
        depth: 0.24,
        curveSegments: 18,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.024,
        bevelSegments: 5,
      });
      subGeometry.center();
      const subText = new THREE.Mesh(subGeometry, glassMaterial);
      subText.position.set(0, -0.12, 0.18);
      subText.rotation.set(-0.02, -0.035, 0.008);
      subText.castShadow = true;
      subText.receiveShadow = true;
      heroGroup.add(subText);
      textMeshes.push(subText);
    });

    const glowMain = createGlowSprite('rgba(102,232,255,0.72)', [8.2, 3.2, 1], 0.46);
    if (glowMain) {
      glowMain.position.set(0, 0.75, -1.1);
      heroGroup.add(glowMain);
    }

    const glowPurple = createGlowSprite('rgba(122,92,255,0.72)', [7.4, 4.6, 1], 0.32);
    if (glowPurple) {
      glowPurple.position.set(0.4, 0.25, -1.6);
      heroGroup.add(glowPurple);
    }

    const ringGroup = new THREE.Group();
    heroGroup.add(ringGroup);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x66e8ff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    [3.4, 4.9, 6.2].forEach((radius, index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.008 + index * 0.003, 12, 180), ringMaterial.clone());
      ring.rotation.set(Math.PI / 2 + index * 0.16, index * 0.32, index * 0.2);
      ringGroup.add(ring);
    });

    const particleCount = 420;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const radius = 4 + Math.random() * 8;
      const angle = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = Math.sin(angle) * radius - 1.4;
      velocities[i * 3] = (Math.random() - 0.5) * 0.0032;
      velocities[i * 3 + 1] = 0.0015 + Math.random() * 0.004;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.0032;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleTexture = createParticleTexture();
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x9edfff,
      size: 0.07,
      map: particleTexture || undefined,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    const planeGeometry = new THREE.PlaneGeometry(18, 9);
    const planeMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x061331) },
        uBottom: { value: new THREE.Color(0x01030b) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 uTop;
        uniform vec3 uBottom;
        void main() {
          vec3 color = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
          float center = 1.0 - smoothstep(0.0, 0.78, distance(vUv, vec2(0.5, 0.54)));
          color += vec3(0.08, 0.18, 0.36) * center;
          gl_FragColor = vec4(color, 0.86);
        }
      `,
    });
    const backgroundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    backgroundPlane.position.set(0, 0, -5.8);
    scene.add(backgroundPlane);

    const clock = new THREE.Clock();
    function animate() {
      frameIdRef.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      heroGroup.rotation.y = -0.14 + Math.sin(elapsed * 0.36) * 0.11;
      heroGroup.rotation.x = -0.04 + Math.sin(elapsed * 0.28) * 0.028;
      heroGroup.position.y = Math.sin(elapsed * 0.62) * 0.07;
      ringGroup.rotation.z = elapsed * 0.08;
      ringGroup.rotation.y = elapsed * 0.045;

      textMeshes.forEach((mesh, index) => {
        mesh.rotation.y += 0.0012 * (index === 0 ? 1 : -1);
        mesh.position.z = Math.sin(elapsed * 0.7 + index) * 0.035;
      });

      if (glowMain) glowMain.material.opacity = 0.36 + Math.sin(elapsed * 0.9) * 0.1;
      if (glowPurple) glowPurple.material.opacity = 0.24 + Math.cos(elapsed * 0.75) * 0.08;

      const pos = particleGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i += 1) {
        pos[i * 3] += velocities[i * 3] + Math.sin(elapsed * 0.16 + i) * 0.0008;
        pos[i * 3 + 1] += velocities[i * 3 + 1];
        pos[i * 3 + 2] += velocities[i * 3 + 2];
        if (pos[i * 3 + 1] > 4.5) pos[i * 3 + 1] = -4.5;
        if (Math.abs(pos[i * 3]) > 12) pos[i * 3] *= -0.92;
        if (Math.abs(pos[i * 3 + 2]) > 10) pos[i * 3 + 2] *= -0.92;
      }
      particleGeometry.attributes.position.needsUpdate = true;
      particles.rotation.y = elapsed * 0.022;

      leftFill.intensity = 2.2 + Math.sin(elapsed * 0.8) * 0.28;
      rightFill.intensity = 1.75 + Math.cos(elapsed * 0.7) * 0.22;
      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    function handleResize() {
      if (!container) return;
      const newWidth = container.clientWidth || 900;
      const newHeight = container.clientHeight || 620;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameIdRef.current);
      controls.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else if (material) {
          material.dispose();
        }
      });
      particleTexture?.dispose();
      envTexture.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="serenade-three-scene"
    />
  );
}
