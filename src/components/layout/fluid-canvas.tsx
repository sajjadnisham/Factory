"use client";

import { useEffect, useRef } from "react";

/**
 * The moving part of the background: a domain-warped noise field, drifting.
 *
 * This is a fragment shader on one fullscreen triangle — a single draw call per
 * frame, with no geometry, no textures and nothing on the main thread but the
 * clock. It is not a Navier-Stokes solver; it is the look of one, which is what
 * a background behind product photography actually needs. A real solver would
 * mean a velocity field, a pressure solve and several render targets per frame,
 * on phones over mobile data.
 *
 * Everything below exists to keep it from being a battery tax:
 *   * half-resolution buffer, capped at 1.5× device pixels — the field is all
 *     low-frequency, so nobody can see the difference,
 *   * ~30fps rather than the display's refresh rate,
 *   * paused entirely when the tab is hidden,
 *   * never started at all under prefers-reduced-motion, or when WebGL is
 *     missing, in which case the CSS gradients underneath simply stay put.
 */

const VERT = `#version 100
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

// Value noise, three octaves, then the output of one fbm used to displace the
// input of the next. That feedback is what makes the bands fold over each other
// like something being stirred, instead of sliding past like fog.
const FRAG = `#version 100
precision mediump float;

uniform vec2 u_res;
uniform float u_time;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  // Correct for aspect so the field does not stretch on a phone.
  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0) * 2.2;
  float t = u_time * 0.045;

  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3 - t)));
  vec2 r = vec2(
    fbm(p + 3.0 * q + vec2(1.7, 9.2) + 0.3 * t),
    fbm(p + 3.0 * q + vec2(8.3, 2.8) - 0.2 * t)
  );
  float f = fbm(p + 3.5 * r);

  // Store colours: volt yellow and electric blue lifted out of a navy base.
  vec3 navy  = vec3(0.055, 0.129, 0.220);
  vec3 blue  = vec3(0.180, 0.400, 0.900);
  vec3 volt  = vec3(1.000, 0.831, 0.000);

  vec3 col = mix(navy, blue, clamp(f * f * 2.4, 0.0, 1.0));
  col = mix(col, volt, clamp(r.x * r.x * 1.15, 0.0, 1.0));

  // Falls away from the edges so the field reads as lit from within the page
  // rather than as a rectangle laid on top of it.
  float vignette = smoothstep(1.25, 0.15, length(uv - 0.5));
  col *= vignette;

  // Held well down: this sits behind photographs of clothes, and the clothes
  // are the thing being sold.
  gl_FragColor = vec4(col, 1.0) * 0.62;
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("[fluid]", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function FluidCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const gl =
      (canvas.getContext("webgl", { alpha: true, antialias: false, depth: false }) as
        | WebGLRenderingContext
        | null) ?? null;
    if (!gl) return; // The CSS gradients underneath remain, simply still.

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("[fluid]", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    // One oversized triangle rather than two triangles: same coverage, no seam
    // down the diagonal, one vertex fewer to think about.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");

    function resize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.floor((window.innerWidth * dpr) / 2));
      const h = Math.max(1, Math.floor((window.innerHeight * dpr) / 2));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      gl!.viewport(0, 0, w, h);
      gl!.uniform2f(uRes, w, h);
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });

    const started = performance.now();
    let raf = 0;
    let last = 0;

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      if (now - last < 33) return; // ~30fps is plenty for something this slow
      last = now;
      gl!.uniform1f(uTime, (now - started) / 1000);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return <canvas ref={ref} className="fluid-canvas" aria-hidden="true" />;
}
