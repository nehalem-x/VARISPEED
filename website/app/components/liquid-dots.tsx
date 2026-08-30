'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec2 uPointer;
  varying float vLight;
  varying float vNoise;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(.11, .17, .23));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise3d(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  float turbulence(vec3 p) {
    float sum = 0.0;
    float weight = 0.56;
    for (int i = 0; i < 4; i++) {
      sum += abs(noise3d(p) * 2.0 - 1.0) * weight;
      p = p * 2.03 + vec3(0.13, -0.09, 0.17);
      weight *= 0.5;
    }
    return sum;
  }

  void main() {
    vec3 base = position;
    vec3 direction = normalize(base);
    float slowTime = uTime * 0.12;
    float broad = noise3d(direction * 1.45 + vec3(slowTime, -slowTime * .7, slowTime * .45));
    float detail = turbulence(direction * 2.7 + vec3(-slowTime * .55, slowTime * .8, slowTime));
    float pointerField = dot(direction.xy, normalize(uPointer + vec2(.001))) * length(uPointer) * .09;
    float displacement = (broad - .5) * .95 + detail * .42 + pointerField;
    vec3 displaced = base + normal * displacement;

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = clamp((2.05 + detail * 1.5) * uPixelRatio * (7.0 / -mvPosition.z), 1.25, 4.8);
    vNoise = detail;
    vLight = clamp(.28 + direction.z * .34 + broad * .7, .16, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying float vLight;
  varying float vNoise;

  void main() {
    vec2 point = gl_PointCoord - .5;
    float distanceToCenter = length(point);
    if (distanceToCenter > .5) discard;
    float edge = smoothstep(.5, .22, distanceToCenter);
    float strength = (.42 + vLight * .58) * (.72 + vNoise * .34);
    gl_FragColor = vec4(vec3(.96), edge * strength);
  }
`;

export function LiquidDots() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.z = 7.4;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    host.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(2.45, 148, 92);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uPointer: { value: new THREE.Vector2(0, 0) },
      },
    });
    const points = new THREE.Points(geometry, material);
    points.rotation.set(-0.18, 0.48, 0.06);
    scene.add(points);

    const pointerTarget = new THREE.Vector2();
    const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let visible = true;
    let start = performance.now();

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = Math.max(width, 1) / Math.max(height, 1);
      camera.updateProjectionMatrix();
      material.uniforms.uPixelRatio.value = dpr;
    };

    const render = (now: number) => {
      if (!visible) return;
      const elapsed = (now - start) / 1000;
      material.uniforms.uTime.value = prefersReducedMotion.matches ? 2.4 : elapsed;
      material.uniforms.uPointer.value.lerp(pointerTarget, 0.045);
      if (!prefersReducedMotion.matches) {
        points.rotation.y = 0.48 + elapsed * 0.018 + material.uniforms.uPointer.value.x * 0.08;
        points.rotation.x = -0.18 + material.uniforms.uPointer.value.y * 0.055;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointerTarget.set(
        ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2,
        -((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2,
      );
    };
    const onVisibility = () => {
      visible = document.visibilityState === 'visible';
      cancelAnimationFrame(frame);
      if (visible) {
        start = performance.now() - material.uniforms.uTime.value * 1000;
        frame = requestAnimationFrame(render);
      }
    };

    window.addEventListener('resize', resize, { passive: true });
    host.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    resize();
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      host.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibility);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="liquid-dots" aria-hidden="true" />;
}
