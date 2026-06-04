import { useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";
import { useCallback, useRef, useEffect } from "react";

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
#ifdef GL_ES
precision mediump float;
#endif

uniform float time;
uniform vec2 resolution;
uniform vec3 color;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  vec2 center = vec2(0.5 + sin(time * 0.15) * 0.15, 0.5 + cos(time * 0.12) * 0.1);
  float d = distance(uv, center);
  float glow = 0.001 / (d * d) * 0.0003;
  float pulse = sin(time * 0.5 + d * 3.0) * 0.5 + 0.5;
  float alpha = glow * (0.3 + pulse * 0.2);
  gl_FragColor = vec4(color * alpha, alpha * 0.15);
}
`;

export const GlowShader: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const timeLocRef = useRef<WebGLUniformLocation | null>(null);
  const resLocRef = useRef<WebGLUniformLocation | null>(null);
  const colorLocRef = useRef<WebGLUniformLocation | null>(null);

  const initGl = useCallback((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext("webgl");
    if (!gl) return null;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    return { gl, program, timeLoc: gl.getUniformLocation(program, "time"), resLoc: gl.getUniformLocation(program, "resolution"), colorLoc: gl.getUniformLocation(program, "color") };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || glRef.current) return;
    const ctx = initGl(canvas);
    if (ctx) {
      glRef.current = ctx.gl;
      programRef.current = ctx.program;
      timeLocRef.current = ctx.timeLoc;
      resLocRef.current = ctx.resLoc;
      colorLocRef.current = ctx.colorLoc;
    }
  }, [initGl]);

  useEffect(() => {
    const gl = glRef.current;
    if (!gl) return;
    const time = frame / fps;
    gl.viewport(0, 0, width, height);
    gl.uniform1f(timeLocRef.current, time);
    gl.uniform2f(resLocRef.current, width, height);
    gl.uniform3f(colorLocRef.current, 0.6, 0.1, 0.15);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [frame, fps, width, height]);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 5 }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height: "100%", opacity: 1 }} />
    </AbsoluteFill>
  );
};
