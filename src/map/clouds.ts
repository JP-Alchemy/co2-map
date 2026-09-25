import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl';

/**
 * A stylised cloud deck for the globe, drawn as a MapLibre custom layer.
 *
 * Over the first few frames a seamless cloud field is baked into a 2048×1024 equirectangular texture on the GPU
 * (domain-warped simplex fbm sampled on the sphere, so there is no seam at the antimeridian). Every frame
 * then only samples that texture twice: once on a sphere 60 km above the ground for the clouds, and once
 * on the ground, offset away from the sun, for their shadows. The deck drifts eastwards, thickens and
 * thins over time, follows a rough climatology (cloudy tropics and storm tracks, clear subtropical
 * deserts) and fades out as you zoom in towards street level.
 */

const TEX_W = 2048, TEX_H = 1024;
/** the texture is baked over this many frames */
const BAKE_STRIPS = 16;
const CLOUD_ALTITUDE_M = 60_000;
/** step of the sphere mesh in degrees */
const MESH_STEP = 3;

const NOISE = /* glsl */ `
// 3D simplex noise, Ashima Arts / Stefan Gustavson (MIT)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p, int octaves) {
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * snoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.4);
    amp *= 0.5;
  }
  return sum;
}
`;

const BAKE_VS = /* glsl */ `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const BAKE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 u_size;
out vec4 fragColor;
${NOISE}
const float PI = 3.141592653589793;
vec3 sphere(float lon, float lat) { return vec3(sin(lon) * cos(lat), sin(lat), cos(lon) * cos(lat)); }
float clouds(vec3 p) {
  vec3 q = p * 2.1;
  vec3 warp = vec3(fbm(q + vec3(0.0, 1.7, 3.1), 4), fbm(q + vec3(5.2, 1.3, 8.4), 4), fbm(q + vec3(2.9, 7.7, 4.6), 4));
  // stretch the noise east-west a little so the deck reads as weather bands rather than blobs
  vec3 s = q * vec3(1.0, 1.35, 1.0) * 1.7 + warp * 1.25;
  return fbm(s, 7) * 0.5 + 0.5;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_size;
  float lon = (uv.x - 0.5) * 2.0 * PI, lat = (uv.y - 0.5) * PI;
  float d = clouds(sphere(lon, lat));
  float slow = fbm(sphere(lon, lat) * 1.3 + 17.0, 3) * 0.5 + 0.5;
  fragColor = vec4(d, 0.0, slow, 1.0);
}`;

const DRAW_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_lonlat;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_opacity;
uniform float u_shadow;
out vec4 fragColor;
const float PI = 3.141592653589793;
void main() {
  float lat = v_lonlat.y;
  float alat = abs(degrees(lat));
  vec2 uv = vec2(v_lonlat.x / (2.0 * PI) + 0.5, lat / PI + 0.5);
  // slow eastward drift of the whole deck, plus an opposite drift of the "weather" field that thickens and thins it
  vec2 uvA = uv + vec2(u_time * 0.0009, 0.0);
  vec2 uvB = uv - vec2(u_time * 0.0005, 0.0);
  if (u_shadow > 0.5) { uvA += vec2(0.0035, -0.0028); uvB += vec2(0.0035, -0.0028); }
  vec4 t = texture(u_tex, uvA);
  // the same field a little towards the sun (north-west), for cheap self-shadowing
  float toward = texture(u_tex, uvA + vec2(-0.0019, 0.0029)).r;
  float weather = texture(u_tex, uvB).b;
  // rough climatology: cloudy equator (ITCZ) and mid-latitude storm tracks, clearer subtropics
  float clim = 0.07 * exp(-pow(degrees(lat) / 8.0, 2.0))
             - 0.10 * exp(-pow((alat - 25.0) / 9.0, 2.0))
             + 0.07 * exp(-pow((alat - 57.0) / 12.0, 2.0));
  float d = t.r + (weather - 0.5) * 0.45 + clim;
  float a = smoothstep(0.54, 0.78, d);
  a *= 1.0 - smoothstep(78.0, 89.0, alat);
  if (u_shadow > 0.5) {
    float s = a * 0.32 * u_opacity;
    fragColor = vec4(vec3(0.0), s);
    return;
  }
  // light: brighter where the sun-side sample is thinner, blue-grey in the thick cores
  float lit = clamp(0.9 - (toward - t.r) * 5.0, 0.55, 1.08);
  float core = smoothstep(0.7, 0.95, d);
  vec3 col = mix(vec3(0.80, 0.85, 0.93), vec3(1.0), lit - 0.55);
  col = mix(col, col * vec3(0.86, 0.9, 0.97), core * 0.6);
  float alpha = a * 0.92 * u_opacity;
  fragColor = vec4(col * alpha, alpha);
}`;

function drawVS(prelude: string, define: string) {
  return `#version 300 es
${prelude}
${define}
in vec2 a_lonlat;
uniform float u_elevation;
out vec2 v_lonlat;
void main() {
  v_lonlat = a_lonlat;
  float lon = a_lonlat.x, lat = a_lonlat.y;
  vec3 sp = vec3(sin(lon) * cos(lat), sin(lat), cos(lon) * cos(lat));
  float latc = clamp(lat, -1.4844, 1.4844);
  vec2 merc = vec2((lon + PI) / (2.0 * PI), 0.5 - log(tan(PI / 4.0 + latc / 2.0)) / (2.0 * PI));
#ifdef GLOBE
  gl_Position = interpolateProjection(merc, sp, u_elevation);
#else
  gl_Position = projectTileWithElevation(merc, 0.0);
#endif
}`;
}

function compile(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile failed');
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'program link failed');
  return p;
}

interface DrawProgram { program: WebGLProgram; loc: Record<string, WebGLUniformLocation | null>; attr: number }

/** Cloud opacity by zoom: full over the globe, gone by the time you look at a region. */
export function cloudOpacity(zoom: number) {
  if (zoom <= 2.4) return 1;
  if (zoom >= 5.2) return 0;
  const k = (zoom - 2.4) / 2.8;
  return 1 - k * k * (3 - 2 * k);
}

export class CloudLayer implements CustomLayerInterface {
  id = 'clouds';
  type = 'custom' as const;
  renderingMode = '2d' as const;
  enabled = true;
  private map: MapLibreMap | null = null;
  private tex: WebGLTexture | null = null;
  private bake: { program: WebGLProgram; tex: WebGLTexture; fbo: WebGLFramebuffer; quad: WebGLBuffer; strip: number } | null = null;
  private mesh: { vbo: WebGLBuffer; ibo: WebGLBuffer; count: number } | null = null;
  private programs = new Map<string, DrawProgram>();
  private repaintTimer: number | undefined;
  private failed = false;
  private readonly t0 = performance.now();

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext) {
    this.map = map;
    const verts: number[] = [];
    const cols = 360 / MESH_STEP + 1, rows = 180 / MESH_STEP + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) verts.push(((-180 + c * MESH_STEP) * Math.PI) / 180, ((-90 + r * MESH_STEP) * Math.PI) / 180);
    }
    const idx: number[] = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
        idx.push(a, b, d, b, e, d);
      }
    }
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    const ibo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    this.mesh = { vbo, ibo, count: idx.length };
  }

  onRemove(_map: MapLibreMap, gl: WebGL2RenderingContext) {
    window.clearTimeout(this.repaintTimer);
    if (this.mesh) { gl.deleteBuffer(this.mesh.vbo); gl.deleteBuffer(this.mesh.ibo); }
    if (this.tex) gl.deleteTexture(this.tex);
    if (this.bake) { gl.deleteTexture(this.bake.tex); gl.deleteFramebuffer(this.bake.fbo); gl.deleteBuffer(this.bake.quad); gl.deleteProgram(this.bake.program); this.bake = null; }
    for (const p of this.programs.values()) gl.deleteProgram(p.program);
    this.programs.clear();
    this.map = null;
  }

  /**
   * Bake the cloud texture into an offscreen framebuffer, a strip per frame so no single draw call is
   * long enough to stall a weak GPU. MapLibre restores its own GL state after `prerender`.
   */
  prerender(gl: WebGL2RenderingContext) {
    if (this.tex || this.failed) return;
    try {
      const b = (this.bake ??= this.startBake(gl));
      const rows = TEX_H / BAKE_STRIPS;
      gl.bindFramebuffer(gl.FRAMEBUFFER, b.fbo);
      gl.viewport(0, 0, TEX_W, TEX_H);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST); gl.disable(gl.CULL_FACE);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(0, b.strip * rows, TEX_W, rows);
      gl.colorMask(true, true, true, true);
      gl.useProgram(b.program);
      gl.uniform2f(gl.getUniformLocation(b.program, 'u_size'), TEX_W, TEX_H);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.quad);
      const a = gl.getAttribLocation(b.program, 'a_pos');
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disableVertexAttribArray(a);
      gl.disable(gl.SCISSOR_TEST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      b.strip++;
      if (b.strip >= BAKE_STRIPS) {
        gl.bindTexture(gl.TEXTURE_2D, b.tex);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.deleteBuffer(b.quad);
        gl.deleteFramebuffer(b.fbo);
        gl.deleteProgram(b.program);
        this.tex = b.tex;
        this.bake = null;
      }
      this.map?.triggerRepaint();
    } catch (e) {
      this.failed = true;
      console.warn('Cloud layer disabled:', e);
    }
  }

  private startBake(gl: WebGL2RenderingContext) {
    const program = compile(gl, BAKE_VS, BAKE_FS);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, TEX_W, TEX_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    return { program, tex, fbo, quad, strip: 0 };
  }

  private program(gl: WebGL2RenderingContext, shaderData: CustomRenderMethodInput['shaderData']) {
    let p = this.programs.get(shaderData.variantName);
    if (p) return p;
    const program = compile(gl, drawVS(shaderData.vertexShaderPrelude, shaderData.define), DRAW_FS);
    const names = ['u_projection_matrix', 'u_projection_fallback_matrix', 'u_projection_tile_mercator_coords', 'u_projection_clipping_plane', 'u_projection_transition', 'u_elevation', 'u_tex', 'u_time', 'u_opacity', 'u_shadow'];
    const loc: DrawProgram['loc'] = {};
    for (const n of names) loc[n] = gl.getUniformLocation(program, n);
    p = { program, loc, attr: gl.getAttribLocation(program, 'a_lonlat') };
    this.programs.set(shaderData.variantName, p);
    return p;
  }

  render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput) {
    const map = this.map;
    if (!map || !this.tex || !this.mesh || this.failed || !this.enabled) return;
    if (!options.shaderData.define.includes('GLOBE')) return;
    const opacity = cloudOpacity(map.getZoom());
    if (opacity <= 0) return;
    let p: DrawProgram;
    try { p = this.program(gl, options.shaderData); } catch (e) { this.failed = true; console.warn('Cloud layer disabled:', e); return; }
    const pd = options.defaultProjectionData;
    gl.useProgram(p.program);
    gl.uniformMatrix4fv(p.loc.u_projection_matrix, false, pd.mainMatrix);
    gl.uniformMatrix4fv(p.loc.u_projection_fallback_matrix, false, pd.fallbackMatrix);
    gl.uniform4f(p.loc.u_projection_tile_mercator_coords, ...pd.tileMercatorCoords);
    gl.uniform4f(p.loc.u_projection_clipping_plane, ...pd.clippingPlane);
    gl.uniform1f(p.loc.u_projection_transition, pd.projectionTransition);
    gl.uniform1f(p.loc.u_time, (performance.now() - this.t0) / 1000);
    gl.uniform1f(p.loc.u_opacity, opacity);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(p.loc.u_tex, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.mesh.ibo);
    gl.enableVertexAttribArray(p.attr);
    gl.vertexAttribPointer(p.attr, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    // shadows on the ground, then the clouds themselves above them
    gl.uniform1f(p.loc.u_shadow, 1);
    gl.uniform1f(p.loc.u_elevation, 0);
    gl.drawElements(gl.TRIANGLES, this.mesh.count, gl.UNSIGNED_SHORT, 0);
    gl.uniform1f(p.loc.u_shadow, 0);
    gl.uniform1f(p.loc.u_elevation, CLOUD_ALTITUDE_M);
    gl.drawElements(gl.TRIANGLES, this.mesh.count, gl.UNSIGNED_SHORT, 0);
    gl.disableVertexAttribArray(p.attr);

    // keep the deck drifting: ~15 fps is plenty for motion this slow; interaction renders at full rate anyway
    if (!reducedMotion()) {
      window.clearTimeout(this.repaintTimer);
      this.repaintTimer = window.setTimeout(() => this.map?.triggerRepaint(), 66);
    }
  }
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
