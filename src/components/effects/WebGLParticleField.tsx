import { memo, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface WebGLParticleFieldProps {
  className?: string;
  particleCount?: number;
  /** 主色 - 翠绿 */
  color1?: string;
  /** 蓝色 */
  color2?: string;
  /** 金色 */
  color3?: string;
  /** 整体运动速度倍率 */
  speed?: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_PARTICLE_COUNT = 2000;
const DEFAULT_COLOR_1 = '#00D4AA';
const DEFAULT_COLOR_2 = '#1D4ED8';
const DEFAULT_COLOR_3 = '#C9A96E';
const DEFAULT_SPEED = 1.0;

const SPREAD = 50;          // 粒子分布范围
const HALF_SPREAD = SPREAD / 2;
const PARALLAX_STRENGTH = 0.08;
const DRIFT_SPEED = 0.015;
const BASE_ORBIT = 0.002;
const MOUSE_SMOOTH = 0.03;

/* ------------------------------------------------------------------ */
/*  Vertex Shader                                                      */
/* ------------------------------------------------------------------ */

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3  aColor;

  uniform float uTime;
  uniform float uPixelRatio;

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;

    // 微弱的闪烁
    float twinkle = 0.7 + 0.3 * sin(uTime * 1.2 + aPhase * 6.2831);
    vAlpha = twinkle;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // 透视缩放 + 自身大小
    float sizeAttenuation = 300.0 / (-mvPosition.z);
    gl_PointSize = aSize * uPixelRatio * sizeAttenuation * twinkle;
    gl_PointSize = max(gl_PointSize, 1.0);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

/* ------------------------------------------------------------------ */
/*  Fragment Shader                                                    */
/* ------------------------------------------------------------------ */

const fragmentShader = /* glsl */ `
  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    // 圆形粒子 + 柔和边缘
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    // 高斯发光衰减
    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    glow = pow(glow, 1.5);

    // 中心更亮
    float core = 1.0 - smoothstep(0.0, 0.15, dist);
    vec3 color = vColor + core * 0.6;

    gl_FragColor = vec4(color, glow * vAlpha);
  }
`;

/* ------------------------------------------------------------------ */
/*  Helper: generate particle data (一次性，避免每帧 GC)               */
/* ------------------------------------------------------------------ */

interface ParticleBuffers {
  positions: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
  colors: Float32Array;
}

function createParticleBuffers(count: number, c1: THREE.Color, c2: THREE.Color, c3: THREE.Color): ParticleBuffers {
  const positions = new Float32Array(count * 3);
  const sizes     = new Float32Array(count);
  const phases    = new Float32Array(count);
  const colors    = new Float32Array(count * 3);

  const palette = [c1, c2, c3];

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;

    // 位置: 在立方体空间中均匀分布
    positions[i3]     = (Math.random() - 0.5) * SPREAD;
    positions[i3 + 1] = (Math.random() - 0.5) * SPREAD;
    positions[i3 + 2] = (Math.random() - 0.5) * SPREAD;

    // 大小: 大部分是小粒子，少量大粒子（星星 vs 光点）
    const rand = Math.random();
    if (rand < 0.7) {
      // 小光点 70%
      sizes[i] = 0.5 + Math.random() * 1.5;
    } else if (rand < 0.92) {
      // 中等粒子 22%
      sizes[i] = 1.5 + Math.random() * 3.0;
    } else {
      // 大星星 8%
      sizes[i] = 3.0 + Math.random() * 5.0;
    }

    // 随机相位 (用于闪烁和运动偏移)
    phases[i] = Math.random();

    // 颜色: 从三种颜色中加权随机
    const colorIdx = Math.random() < 0.45 ? 0 : (Math.random() < 0.65 ? 1 : 2);
    const baseColor = palette[colorIdx];
    // 加入少量随机偏移让颜色更丰富
    const hsl = { h: 0, s: 0, l: 0 };
    baseColor.getHSL(hsl);
    const varied = new THREE.Color();
    varied.setHSL(
      hsl.h + (Math.random() - 0.5) * 0.05,
      Math.min(1, hsl.s + (Math.random() - 0.5) * 0.15),
      Math.min(1, Math.max(0, hsl.l + (Math.random() - 0.5) * 0.2))
    );
    colors[i3]     = varied.r;
    colors[i3 + 1] = varied.g;
    colors[i3 + 2] = varied.b;
  }

  return { positions, sizes, phases, colors };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const WebGLParticleField = memo<WebGLParticleFieldProps>(({
  className,
  particleCount = DEFAULT_PARTICLE_COUNT,
  color1 = DEFAULT_COLOR_1,
  color2 = DEFAULT_COLOR_2,
  color3 = DEFAULT_COLOR_3,
  speed = DEFAULT_SPEED,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  /* ---------- Three.js 引用 (不触发重渲染) ---------- */
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    geometry: THREE.BufferGeometry;
    material: THREE.ShaderMaterial;
    points: THREE.Points;
    animId: number;
    clock: THREE.Clock;
    mouse: { x: number; y: number; tx: number; ty: number };
    positions: Float32Array;
    count: number;
    speed: number;
    reducedMotion: boolean;
  } | null>(null);

  /* ---------- 初始化 Three.js 场景 ---------- */
  const initScene = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const width  = container.clientWidth  || 1;
    const height = container.clientHeight || 1;
    const dpr    = Math.min(window.devicePixelRatio, 2);

    // 检查 prefers-reduced-motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reducedMotion = motionQuery.matches;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 200);
    camera.position.set(0, 0, 20);

    // 解析颜色
    const c1 = new THREE.Color(color1);
    const c2 = new THREE.Color(color2);
    const c3 = new THREE.Color(color3);

    // 粒子数据
    const buffers = createParticleBuffers(particleCount, c1, c2, c3);

    // Geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
    geometry.setAttribute('aSize',    new THREE.BufferAttribute(buffers.sizes, 1));
    geometry.setAttribute('aPhase',   new THREE.BufferAttribute(buffers.phases, 1));
    geometry.setAttribute('aColor',   new THREE.BufferAttribute(buffers.colors, 3));

    // Material (ShaderMaterial)
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime:       { value: 0 },
        uPixelRatio: { value: dpr },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Points
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Clock
    const clock = new THREE.Clock();

    // Mouse 状态
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

    // 存储引用
    threeRef.current = {
      renderer,
      scene,
      camera,
      geometry,
      material,
      points,
      animId: 0,
      clock,
      mouse,
      positions: buffers.positions,
      count: particleCount,
      speed,
      reducedMotion,
    };
  }, [particleCount, color1, color2, color3, speed]);

  /* ---------- 动画循环 ---------- */
  const animate = useCallback(() => {
    const ctx = threeRef.current;
    if (!ctx) return;

    const {
      renderer, scene, camera, geometry, material,
      clock, mouse, positions, count, speed, reducedMotion,
    } = ctx;

    const elapsed = clock.getElapsedTime();
    const delta   = clock.getDelta();
    const speedMul = speed * (reducedMotion ? 0.1 : 1.0);

    // 平滑鼠标插值
    mouse.x += (mouse.tx - mouse.x) * MOUSE_SMOOTH;
    mouse.y += (mouse.ty - mouse.y) * MOUSE_SMOOTH;

    // 更新粒子位置 (漂浮 + 缓慢上升)
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // 缓慢上升
      posArray[i3 + 1] += DRIFT_SPEED * speedMul;

      // 微弱的水平漂移 (基于初始位置和时间的正弦波)
      posArray[i3] += Math.sin(elapsed * BASE_ORBIT * speedMul + i * 0.1) * 0.003 * speedMul;
      posArray[i3 + 2] += Math.cos(elapsed * BASE_ORBIT * speedMul + i * 0.13) * 0.002 * speedMul;

      // 边界回绕: 超出范围则重置到底部
      if (posArray[i3 + 1] > HALF_SPREAD) {
        posArray[i3 + 1] = -HALF_SPREAD;
      }
      if (posArray[i3] > HALF_SPREAD)  posArray[i3] = -HALF_SPREAD;
      if (posArray[i3] < -HALF_SPREAD) posArray[i3] = HALF_SPREAD;
      if (posArray[i3 + 2] > HALF_SPREAD)  posArray[i3 + 2] = -HALF_SPREAD;
      if (posArray[i3 + 2] < -HALF_SPREAD) posArray[i3 + 2] = HALF_SPREAD;
    }
    posAttr.needsUpdate = true;

    // 视差: 整个粒子组微微跟随鼠标旋转
    const targetRotY = mouse.x * PARALLAX_STRENGTH;
    const targetRotX = -mouse.y * PARALLAX_STRENGTH;
    ctx.points.rotation.y += (targetRotY - ctx.points.rotation.y) * 0.02;
    ctx.points.rotation.x += (targetRotX - ctx.points.rotation.x) * 0.02;

    // 更新 uniform
    material.uniforms.uTime.value = elapsed;

    // 渲染
    renderer.render(scene, camera);

    // 下一帧
    ctx.animId = requestAnimationFrame(animate);
  }, []);

  /* ---------- 事件处理 ---------- */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const ctx = threeRef.current;
    if (!ctx) return;
    // 归一化到 [-1, 1]
    ctx.mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    ctx.mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, []);

  const handleResize = useCallback(() => {
    const ctx = threeRef.current;
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    const width  = container.clientWidth  || 1;
    const height = container.clientHeight || 1;
    const dpr    = Math.min(window.devicePixelRatio, 2);

    ctx.camera.aspect = width / height;
    ctx.camera.updateProjectionMatrix();

    ctx.renderer.setSize(width, height);
    ctx.renderer.setPixelRatio(dpr);

    ctx.material.uniforms.uPixelRatio.value = dpr;
  }, []);

  const handleReducedMotionChange = useCallback((e: MediaQueryListEvent) => {
    const ctx = threeRef.current;
    if (!ctx) return;
    ctx.reducedMotion = e.matches;
  }, []);

  /* ---------- 生命周期 ---------- */
  useEffect(() => {
    initScene();
    animate();

    const ctx = threeRef.current;
    if (!ctx) return;

    // 事件监听
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionQuery.addEventListener('change', handleReducedMotionChange);

    // 清理函数
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      motionQuery.removeEventListener('change', handleReducedMotionChange);

      // 停止动画
      cancelAnimationFrame(ctx.animId);

      // 从 DOM 移除 canvas
      const canvas = ctx.renderer.domElement;
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }

      // 释放 GPU 资源
      ctx.geometry.dispose();
      ctx.material.dispose();
      ctx.renderer.dispose();

      // 清空场景
      ctx.scene.clear();

      threeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initScene, animate, handleMouseMove, handleResize, handleReducedMotionChange]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
      }}
    />
  );
});

WebGLParticleField.displayName = 'WebGLParticleField';

export default WebGLParticleField;
