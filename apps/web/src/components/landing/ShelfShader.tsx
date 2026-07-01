"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import gsap from "gsap";

export type ShelfShaderProps = {
  className?: string;
  style?: React.CSSProperties;
};

export function ShelfShader({ className, style }: ShelfShaderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    // --- Film Grain Shader ---
    const FilmGrainShader = {
      uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        time: { value: 0 },
        intensity: { value: 1.1 },
        grainScale: { value: 0.5 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        #ifdef GL_ES
          precision highp int;
          precision mediump float;
        #else
          precision mediump float;
        #endif
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float intensity;
        uniform float grainScale;
        varying vec2 vUv;

        float sparkleNoise(vec2 p) {
          vec2 jPos = p + vec2(37.0, 17.0) * fract(time * 0.07);
          vec3 p3 = fract(vec3(jPos.xyx) * vec3(.1031, .1030, .0973) + time * 0.1);
          p3 += dot(p3, p3.yxz + 19.19);
          return fract((p3.x + p3.y) * p3.z);
        }

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          vec2 pos = gl_FragCoord.xy * 0.5 * grainScale;
          float noise = sparkleNoise(pos);
          noise = noise * 2.0 - 1.0;
          vec3 result = color.rgb + noise * intensity * 0.1;
          gl_FragColor = vec4(result, color.a);
        }
      `,
    };

    function createFilmGrainPass(intensity = 0.9, grainScale = 0.3) {
      const pass = new ShaderPass(FilmGrainShader as any);
      (pass.uniforms as any).intensity.value = intensity;
      (pass.uniforms as any).grainScale.value = grainScale;
      return pass;
    }

    // --- Shelf Configuration ---
    const SHELF_COUNT = 5;
    const BAR_WIDTH = 12;
    const BAR_GAP = 8;
    const MAX_BARS_PER_SHELF = 60;
    const BAR_HEIGHTS = [25, 40, 55, 35, 50, 30, 45, 60, 20, 48, 38, 52];
    const SWEEP_WIDTH_PX = 220;
    const MOUSE_GLOW_WIDTH_PX = 280;
    const SHELF_LINE_HEIGHT = 2;

    // --- Three.js Setup ---
    let DPR_CAP = 2;
    const mm = gsap.matchMedia();
    mm.add("(max-resolution: 180dpi)", () => {
      DPR_CAP = 1.5;
    });
    const EFFECT_PR = Math.min(window.devicePixelRatio, DPR_CAP) * 0.5;

    const container = canvasRef.current!;
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setPixelRatio(EFFECT_PR);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.autoClear = false;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = null as any;
    scene.add(new THREE.AmbientLight(0xffffff, 0.2));

    let camera: THREE.OrthographicCamera;
    let composer: EffectComposer;
    let renderPass: RenderPass;
    let bloomPass: UnrealBloomPass;
    let grainPass: ShaderPass;
    let cameraWidth = 0, cameraHeight = 0;
    let initialized = false;

    // --- Shelf state ---
    let shelfMeshes: THREE.Mesh[] = [];
    let shelfMaterial: THREE.ShaderMaterial | null = null;
    let productMesh: THREE.InstancedMesh | null = null;
    let productMaterial: THREE.ShaderMaterial | null = null;

    // --- Mouse ---
    const mouse = { x: 0, y: 0, active: false };
    let proxyMouseX = 0;
    let proxyInitialized = false;
    let rect = renderer.domElement.getBoundingClientRect();

    // --- Sweep ---
    const sweep = { x: -1.3 };
    let sweepTween: gsap.core.Tween | null = null;

    const listeners: Array<() => void> = [];

    // --- Shelf Line Material ---
    function createShelfMaterial() {
      if (shelfMaterial) shelfMaterial.dispose();
      shelfMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uSweepX: { value: sweep.x },
          uHalfW: { value: cameraWidth * 0.5 },
          uSweepWidth: { value: SWEEP_WIDTH_PX },
          uColor: { value: new THREE.Color("#d4a04c") },
          uBaseOpacity: { value: 0.08 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uSweepX, uHalfW, uSweepWidth;
          uniform vec3 uColor;
          uniform float uBaseOpacity;
          varying vec2 vUv;

          void main() {
            float clipX = vUv.x * 2.0 - 1.0;
            float dx = abs(uSweepX - clipX) * uHalfW;
            float prox = clamp(1.0 - dx / uSweepWidth, 0.0, 1.0);
            prox = pow(prox, 2.0);
            float opacity = uBaseOpacity + prox * 0.35;
            gl_FragColor = vec4(uColor, opacity);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      return shelfMaterial;
    }

    // --- Product Material ---
    function createProductMaterial() {
      if (productMaterial) productMaterial.dispose();
      productMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uSweepX: { value: sweep.x },
          uHalfW: { value: cameraWidth * 0.5 },
          uSweepWidth: { value: SWEEP_WIDTH_PX },
          uMouseClipX: { value: 0 },
          uMouseGlowWidth: { value: MOUSE_GLOW_WIDTH_PX },
          uTime: { value: 0 },
          uColor: { value: new THREE.Color("#f5e6c8") },
          uEmissive: { value: new THREE.Color("#e8a838") },
          uBaseEmissive: { value: 0.03 },
        },
        vertexShader: `
          attribute float aXPos, aShelfY, aBarHeight, aBarWidth;
          uniform float uSweepX, uHalfW, uSweepWidth;
          uniform float uMouseClipX, uMouseGlowWidth;
          varying float vSweepProx, vMouseProx;
          varying vec2 vUv;

          void main() {
            vUv = uv;
            vec3 pos = position;
            pos.x *= aBarWidth;
            pos.y *= aBarHeight;
            pos.x += aXPos;
            pos.y += aShelfY;

            vec4 clip = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            float clipX = clip.x / clip.w;

            float sweepDx = abs(uSweepX - clipX) * uHalfW;
            vSweepProx = clamp(1.0 - sweepDx / uSweepWidth, 0.0, 1.0);
            vSweepProx = pow(vSweepProx, 2.5);

            float mouseDx = abs(uMouseClipX - clipX) * uHalfW;
            vMouseProx = clamp(1.0 - mouseDx / uMouseGlowWidth, 0.0, 1.0);
            vMouseProx = pow(vMouseProx, 0.8);

            gl_Position = clip;
          }
        `,
        fragmentShader: `
          #ifdef GL_ES
            precision highp int;
            precision mediump float;
          #else
            precision mediump float;
          #endif
          uniform vec3 uColor, uEmissive;
          uniform float uBaseEmissive, uTime;
          varying float vSweepProx, vMouseProx;
          varying vec2 vUv;

          void main() {
            float xFromCenter = abs(vUv.x - 0.5) * 2.0;
            float edge = smoothstep(1.0, 0.8, xFromCenter);
            float alpha = edge * 0.45;

            float grad = mix(0.55, 1.0, vUv.y);
            float breathe = 0.92 + 0.08 * sin(uTime * 0.6 + vUv.y * 4.0);

            float emissiveStrength = (uBaseEmissive + vSweepProx * 1.4 + vMouseProx * 0.5) * breathe;
            vec3 finalColor = uColor * grad + uEmissive * emissiveStrength;
            gl_FragColor = vec4(finalColor, alpha + vSweepProx * 0.35);
          }
        `,
        side: THREE.FrontSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      return productMaterial!;
    }

    // --- Create Shelves ---
    function createShelves() {
      shelfMeshes.forEach((m) => {
        scene.remove(m);
        m.geometry.dispose();
      });
      shelfMeshes = [];

      const mat = createShelfMaterial();
      const shelfSpacing = cameraHeight * 0.13;
      const startY = -cameraHeight * 0.5 + cameraHeight * 0.08;

      for (let i = 0; i < SHELF_COUNT; i++) {
        const y = startY + i * shelfSpacing;
        const geo = new THREE.PlaneGeometry(cameraWidth, SHELF_LINE_HEIGHT);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = y;
        scene.add(mesh);
        shelfMeshes.push(mesh);
      }
    }

    // --- Create Products ---
    function createProducts() {
      if (productMesh) {
        scene.remove(productMesh);
        productMesh.geometry.dispose();
        productMesh = null;
      }

      const isMobile = window.innerWidth < 768;
      const barWidth = isMobile ? 10 : BAR_WIDTH;
      const barGap = isMobile ? 6 : BAR_GAP;
      const maxPerShelf = isMobile ? 30 : MAX_BARS_PER_SHELF;

      const shelfSpacing = cameraHeight * 0.13;
      const startY = -cameraHeight * 0.5 + cameraHeight * 0.08;

      let totalBars = 0;
      const shelves: Array<{ y: number; count: number }> = [];

      for (let s = 0; s < SHELF_COUNT; s++) {
        const shelfY = startY + s * shelfSpacing;
        const span = cameraWidth + barGap;
        let count = Math.min(maxPerShelf, Math.max(1, Math.floor((span + barGap) / (barWidth + barGap))));
        count = Math.floor(count * 0.85);
        totalBars += count;
        shelves.push({ y: shelfY, count });
      }

      const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
      geo.translate(0, 0.5, 0);

      const aXPos = new Float32Array(totalBars);
      const aShelfY = new Float32Array(totalBars);
      const aBarHeight = new Float32Array(totalBars);
      const aBarWidth = new Float32Array(totalBars);

      let idx = 0;
      for (let s = 0; s < SHELF_COUNT; s++) {
        const { y: shelfY, count } = shelves[s];
        const span = cameraWidth + barGap;
        const startX = -cameraWidth / 2;
        const step = span / count;

        for (let b = 0; b < count; b++) {
          const jitter = ((s * 7 + b * 13) % 100) / 100 - 0.5;
          const x = startX + b * step + jitter * step * 0.3;
          const heightIdx = (s * 31 + b * 17) % BAR_HEIGHTS.length;

          aXPos[idx] = x;
          aShelfY[idx] = shelfY;
          aBarHeight[idx] = BAR_HEIGHTS[heightIdx];
          aBarWidth[idx] = barWidth;
          idx++;
        }
      }

      geo.setAttribute("aXPos", new THREE.InstancedBufferAttribute(aXPos, 1));
      geo.setAttribute("aShelfY", new THREE.InstancedBufferAttribute(aShelfY, 1));
      geo.setAttribute("aBarHeight", new THREE.InstancedBufferAttribute(aBarHeight, 1));
      geo.setAttribute("aBarWidth", new THREE.InstancedBufferAttribute(aBarWidth, 1));

      const mat = createProductMaterial();
      productMesh = new THREE.InstancedMesh(geo, mat, totalBars);
      productMesh.frustumCulled = false;
      scene.add(productMesh);
    }

    // --- Init ---
    function init() {
      cameraWidth = container.clientWidth;
      cameraHeight = container.clientHeight;

      camera = new THREE.OrthographicCamera(
        -cameraWidth / 2, cameraWidth / 2,
        cameraHeight / 2, -cameraHeight / 2,
        -1000, 1000
      );
      camera.position.z = 10;
      camera.lookAt(0, 0, 0);

      renderer.setSize(cameraWidth, cameraHeight);
      composer = new EffectComposer(renderer);
      (composer as any).setPixelRatio(EFFECT_PR);

      renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      bloomPass = new UnrealBloomPass(new THREE.Vector2(cameraWidth, cameraHeight), 0.8, 0.5, 0.0);
      (bloomPass as any).resolution.set(cameraWidth * 0.5, cameraHeight * 0.5);
      composer.addPass(bloomPass);

      grainPass = createFilmGrainPass();
      composer.addPass(grainPass);

      createShelves();
      createProducts();
      setupPointerTracking();

      sweepTween = gsap.to(sweep, {
        x: 1.3,
        duration: 7,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut",
      });

      initialized = true;
    }

    // --- Pointer Tracking ---
    function setupPointerTracking() {
      const el = renderer.domElement;
      const updatePos = (e: any) => {
        const x = "clientX" in e ? e.clientX : (e.touches?.[0]?.clientX ?? mouse.x);
        const y = "clientY" in e ? e.clientY : (e.touches?.[0]?.clientY ?? mouse.y);
        mouse.x = x - rect.left;
        mouse.y = y - rect.top;
        mouse.active = true;
        if (!proxyInitialized) {
          proxyMouseX = mouse.x;
          proxyInitialized = true;
        }
      };
      const deactivate = () => { mouse.active = false; };

      el.addEventListener("pointermove", updatePos, { passive: true });
      el.addEventListener("pointerleave", deactivate as any, { passive: true });
      el.addEventListener("touchmove", updatePos as any, { passive: true });
      window.addEventListener("touchend", deactivate as any, { passive: true });

      listeners.push(() => {
        el.removeEventListener("pointermove", updatePos);
        el.removeEventListener("pointerleave", deactivate as any);
        el.removeEventListener("touchmove", updatePos as any);
        window.removeEventListener("touchend", deactivate as any);
      });
    }

    // --- Resize ---
    let pendingW = 0, pendingH = 0, heavyResizeTimer: any = null;

    function onResize(newW: number, newH: number) {
      if (!initialized) return;
      pendingW = newW;
      pendingH = newH;

      cameraWidth = newW;
      cameraHeight = newH;
      camera.left = -cameraWidth / 2;
      camera.right = cameraWidth / 2;
      camera.top = cameraHeight / 2;
      camera.bottom = -cameraHeight / 2;
      camera.updateProjectionMatrix();

      createShelves();
      createProducts();

      clearTimeout(heavyResizeTimer);
      heavyResizeTimer = setTimeout(applyHeavyResize, 10);
      rect = renderer.domElement.getBoundingClientRect();
    }

    function applyHeavyResize() {
      heavyResizeTimer = null;
      renderer.setPixelRatio(EFFECT_PR);
      renderer.setSize(pendingW, pendingH);
      (composer as any).setSize(pendingW, pendingH);
      (bloomPass as any)?.setSize(pendingW, pendingH);
      (grainPass as any)?.setSize(pendingW, pendingH);
    }

    // --- Render Loop ---
    const ticker = () => {
      if (!initialized || !productMesh || !productMaterial || !shelfMaterial) return;
      const dt = (gsap.ticker.deltaRatio() as number) * (1 / 60);

      (productMaterial.uniforms as any).uSweepX.value = sweep.x;
      (shelfMaterial.uniforms as any).uSweepX.value = sweep.x;

      const kMouse = 1.0 - Math.exp(-30.0 * dt);
      proxyMouseX += (mouse.x - proxyMouseX) * kMouse;
      const mouseClipX = (proxyMouseX / cameraWidth) * 2 - 1;
      (productMaterial.uniforms as any).uMouseClipX.value = mouseClipX;

      (productMaterial.uniforms as any).uTime.value += dt;
      (grainPass.uniforms as any).time.value += dt * 0.2;

      composer.render();
    };

    // --- Observers ---
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        if (e.target === container) {
          onResize(e.contentRect.width, e.contentRect.height);
        }
      }
    });

    init();
    gsap.ticker.add(ticker);
    ro.observe(container);
    listeners.push(() => gsap.ticker.remove(ticker));
    listeners.push(() => ro.disconnect());

    const onVisibility = () => {
      document.hidden ? gsap.globalTimeline.pause() : gsap.globalTimeline.resume();
    };
    document.addEventListener("visibilitychange", onVisibility);
    listeners.push(() => document.removeEventListener("visibilitychange", onVisibility));

    return () => {
      listeners.forEach((fn) => fn());
      sweepTween?.kill();
      try {
        gsap.globalTimeline.clear();
        scene.traverse((obj: any) => {
          if (obj.isMesh) {
            obj.geometry.dispose();
          }
        });
        shelfMaterial?.dispose();
        productMaterial?.dispose();
        (grainPass as any)?.dispose?.();
        (bloomPass as any)?.dispose?.();
        (composer as any)?.dispose?.();
        (renderer as any)?.dispose?.();
      } catch {}
      try {
        const canvas = renderer.domElement;
        if (canvas && canvas.parentElement === container) {
          container.removeChild(canvas);
        }
      } catch {}
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", height: "100%", ...style }}
    >
      <div
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, opacity: 0.8 }}
      />
    </div>
  );
}
