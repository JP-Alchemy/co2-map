import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl';

/**
 * A stylised, layered cloud deck for the globe, drawn as a MapLibre custom layer.
 *
 * Over the first few frames the cloud fields are baked into a 2048×1024 equirectangular texture on the GPU
 * (domain-warped simplex fbm sampled on the sphere, so there is no seam at the antimeridian): the main deck,
 * streaky high cirrus and two slow "weather" fields. Every frame then draws three shells from that texture:
 * shadows on the ground, the deck 60 km up and the cirrus above it.
 *
 * Two things make it read as depth rather than a painted texture. The layers drift west at their own
 * speeds and, as the camera turns the globe, slide further than the ground beneath them (parallax, the
 * higher layer more), so the idle spin shows them as separate sheets. And the clouds keep changing shape:
 * a slowly evolving warp stretches and folds them, the weather fields build them up and dissolve them, and
 * live noise boils their edges and tops, lit from the sun's side so the puffs look solid. The deck follows
 * a rough climatology (cloudy tropics and storm tracks, clear subtropical deserts) and fades out as you
 * zoom in towards street level.
 */

const TEX_W = 2048, TEX_H = 1024;
/** the texture is baked over this many frames */
const BAKE_STRIPS = 32;
const DECK_ALTITUDE_M = 60_000;
const CIRRUS_ALTITUDE_M = 110_000;
/** step of the sphere mesh in degrees */
const MESH_STEP = 2;

/**
 * How a layer moves: its own westward drift (degrees per second) and how much further than the ground it
 * slides when the camera turns the globe (parallax: 0.3 = 30% further). `seed` just offsets its pattern.
 */
interface Motion { drift: number; parallax: number; seed: number }
const DECK: Motion = { drift: 0.45, parallax: 0.3, seed: 0 };
const CIRRUS: Motion = { drift: 0.75, parallax: 0.6, seed: 140 };

const NOISE = /* glsl */ `
// 3D simplex noise and its gradient, after Ashima Arts / Stefan Gustavson (MIT)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v, out vec3 grad) {
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
  vec4 m2 = m * m, m4 = m2 * m2;
  vec4 px = vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3));
  vec4 k = m2 * m * px;
  grad = 42.0 * (-8.0 * (k.x * x0 + k.y * x1 + k.z * x2 + k.w * x3) + m4.x * p0 + m4.y * p1 + m4.z * p2 + m4.w * p3);
  return 42.0 * dot(m4, px);
}
float snoise(vec3 v) { vec3 g; return snoise(v, g); }
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
float deck(vec3 p) {
  vec3 q = p * 2.1;
  vec3 warp = vec3(fbm(q + vec3(0.0, 1.7, 3.1), 4), fbm(q + vec3(5.2, 1.3, 8.4), 4), fbm(q + vec3(2.9, 7.7, 4.6), 4));
  // stretch the noise east-west a little so the deck reads as weather bands rather than blobs
  vec3 s = q * vec3(1.0, 1.35, 1.0) * 1.7 + warp * 1.25;
  return fbm(s, 7) * 0.5 + 0.5;
}
float cirrus(vec3 p) {
  vec3 q = p * 2.6;
  vec3 warp = vec3(fbm(q + vec3(3.3, 1.1, 7.7), 3), fbm(q + vec3(8.1, 4.4, 2.2), 3), fbm(q + vec3(1.9, 6.6, 5.5), 3));
  // squashed along the polar axis: long, thin east-west streaks, bent by the warp
  vec3 s = q * vec3(0.8, 4.0, 0.8) + warp * 2.0;
  return fbm(s, 5) * 0.5 + 0.5;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_size;
  vec3 p = sphere((uv.x - 0.5) * 2.0 * PI, (uv.y - 0.5) * PI);
  // r: the deck, g: cirrus, b and a: two slow weather fields
  fragColor = vec4(deck(p), cirrus(p), fbm(p * 1.3 + 17.0, 3) * 0.5 + 0.5, fbm(p * 1.1 - 23.0, 3) * 0.5 + 0.5);
}`;

const DRAW_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_opacity;
uniform float u_layer;
out vec4 fragColor;
${NOISE}
const float PI = 3.141592653589793;
/** a step towards the sun (north-west), in texture space */
const vec2 SUN = vec2(-0.0019, 0.0029);
vec3 sphere(float lon, float lat) { return vec3(sin(lon) * cos(lat), sin(lat), cos(lon) * cos(lat)); }
void main() {
  float lon = v_uv.x, lat = v_uv.y;
  float alat = abs(degrees(lat));
  vec2 uv = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);
  float polar = 1.0 - smoothstep(76.0, 88.0, alat);
  // two weather fields drifting through the clouds, building them up in some places and dissolving them in others
  float wB = texture(u_tex, uv + vec2(u_time * 0.0015, 0.0)).b - 0.5;
  float wA = texture(u_tex, uv - vec2(u_time * 0.0011, 0.0)).a - 0.5;

  if (u_layer > 1.5) {
    // high cirrus: thin, streaky, bright, strongest over the storm tracks
    float c = texture(u_tex, uv).g + wA * 0.4 + 0.05 * exp(-pow((alat - 50.0) / 14.0, 2.0)) - 0.08 * exp(-pow((alat - 22.0) / 10.0, 2.0));
    float a = smoothstep(0.63, 0.86, c) * polar;
    float cs = texture(u_tex, uv + SUN * 0.7).g;
    vec3 col = mix(vec3(0.84, 0.89, 0.96), vec3(1.0), clamp(0.8 - (cs - c) * 4.0, 0.0, 1.0));
    float alpha = a * 0.34 * u_opacity;
    fragColor = vec4(col * alpha, alpha);
    return;
  }

  // rough climatology: cloudy equator (ITCZ) and mid-latitude storm tracks, clearer subtropics
  float clim = 0.07 * exp(-pow(degrees(lat) / 8.0, 2.0))
             - 0.10 * exp(-pow((alat - 25.0) / 9.0, 2.0))
             + 0.07 * exp(-pow((alat - 57.0) / 12.0, 2.0));
  float weather = (wB + wA) * 0.32 + clim;

  if (u_layer < 0.5) {
    // shadows: the deck as seen from the ground looking towards the sun, softened
    float ds = texture(u_tex, uv + SUN * 1.6, 1.5).r + weather;
    fragColor = vec4(0.0, 0.0, 0.0, smoothstep(0.52, 0.8, ds) * polar * 0.32 * u_opacity);
    return;
  }

  float r = texture(u_tex, uv).r;
  float rs = texture(u_tex, uv + SUN).r;
  vec3 pc = sphere(lon, lat);
  float fine = 1.0 - smoothstep(0.25, 0.6, length(fwidth(pc)) * 37.0); // fade the fine octave before it aliases
  float d = r + weather;
  // clear sky stays clear whatever the live detail does below
  if (d < 0.45) { fragColor = vec4(0.0); return; }

  // live detail: two octaves evolving through time, so edges boil and tops churn as they drift
  vec3 g1, g2;
  float n1 = snoise(pc * 16.0 + u_time * vec3(0.05, 0.04, -0.045), g1);
  float n2 = snoise(pc * 37.0 + vec3(3.1, 7.4, 1.2) - u_time * vec3(0.06, -0.08, 0.05), g2) * fine;
  float n = n1 * 0.65 + n2 * 0.35;
  d += n * 0.065;
  float a = smoothstep(0.54, 0.78, d) * polar;

  // light from the north-west: slopes facing the sun are bright, the far sides of the towers blue-grey.
  // The deck's slope comes from a second texture tap, the detail's from the noise gradient.
  vec3 east = vec3(cos(lon), 0.0, -sin(lon));
  vec3 north = vec3(-sin(lat) * sin(lon), cos(lat), -sin(lat) * cos(lon));
  vec3 sunDir = normalize(north * 0.8 - east * 0.6);
  float slope = (rs - r) + dot(g1 * (16.0 * 0.65) + g2 * (37.0 * 0.35 * fine), sunDir) * 0.065 * 0.009;
  float lit = clamp(0.92 - slope * 5.0, 0.5, 1.12);
  float core = smoothstep(0.72, 1.0, d);
  vec3 col = mix(vec3(0.70, 0.76, 0.87), vec3(1.0), smoothstep(0.5, 1.08, lit));
  col = mix(col, col * vec3(0.86, 0.9, 0.97), core * 0.55);
  float alpha = a * 0.93 * u_opacity;
  fragColor = vec4(col * alpha, alpha);
}`;

function drawVS(prelude: string, define: string) {
  return `#version 300 es
${prelude}
${define}
${NOISE}
in vec2 a_lonlat;
uniform float u_elevation;
uniform float u_off;
uniform float u_time;
uniform float u_layer;
out vec2 v_uv;
vec3 sphere(float lon, float lat) { return vec3(sin(lon) * cos(lat), sin(lat), cos(lon) * cos(lat)); }
void main() {
  float lon = a_lonlat.x, lat = a_lonlat.y;
  // where this point sits in the layer's own drifting frame
  float lonC = lon + u_off;
  // a slowly evolving swirl that stretches and folds the clouds (the shadows share the deck's)
  vec3 q = sphere(lonC, lat) * 3.0 + step(1.5, u_layer) * 7.3;
  vec2 w = vec2(snoise(q + u_time * vec3(0.035, 0.025, -0.03)), snoise(q + vec3(11.3, 5.9, 2.4) - u_time * vec3(0.025, -0.035, 0.025)));
  v_uv = vec2(lonC + w.x * 0.035 / max(cos(lat), 0.2), lat + w.y * 0.035);
  vec3 sp = sphere(lon, lat);
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
  /** how far the camera has turned the globe eastwards, in degrees and unwrapped: drives the parallax */
  private turned = 0;
  private lastLng: number | null = null;

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
    const names = ['u_projection_matrix', 'u_projection_fallback_matrix', 'u_projection_tile_mercator_coords', 'u_projection_clipping_plane', 'u_projection_transition', 'u_elevation', 'u_tex', 'u_time', 'u_opacity', 'u_layer', 'u_off'];
    const loc: DrawProgram['loc'] = {};
    for (const n of names) loc[n] = gl.getUniformLocation(program, n);
    p = { program, loc, attr: gl.getAttribLocation(program, 'a_lonlat') };
    this.programs.set(shaderData.variantName, p);
    return p;
  }

  render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput) {
    const map = this.map;
    if (!map || !this.tex || !this.mesh || this.failed || !this.enabled) return;
    const still = reducedMotion();
    // follow the camera round the planet, across the antimeridian, for the parallax
    const lng = map.getCenter().lng;
    if (this.lastLng !== null && !still) { const d = lng - this.lastLng; this.turned += d - Math.round(d / 360) * 360; }
    this.lastLng = lng;
    if (!options.shaderData.define.includes('GLOBE')) return;
    const opacity = cloudOpacity(map.getZoom());
    if (opacity <= 0) return;
    let p: DrawProgram;
    try { p = this.program(gl, options.shaderData); } catch (e) { this.failed = true; console.warn('Cloud layer disabled:', e); return; }
    const t = still ? 0 : (performance.now() - this.t0) / 1000;
    // a layer's longitude offset: its own drift plus a share of the camera's turn, so it outruns the ground
    const offset = (m: Motion) => (((m.drift * t + m.parallax * this.turned + m.seed) % 360) * Math.PI) / 180;
    const pd = options.defaultProjectionData;
    gl.useProgram(p.program);
    gl.uniformMatrix4fv(p.loc.u_projection_matrix, false, pd.mainMatrix);
    gl.uniformMatrix4fv(p.loc.u_projection_fallback_matrix, false, pd.fallbackMatrix);
    gl.uniform4f(p.loc.u_projection_tile_mercator_coords, ...pd.tileMercatorCoords);
    gl.uniform4f(p.loc.u_projection_clipping_plane, ...pd.clippingPlane);
    gl.uniform1f(p.loc.u_projection_transition, pd.projectionTransition);
    gl.uniform1f(p.loc.u_time, t);
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
    const count = this.mesh.count;
    const pass = (layer: number, elevation: number, off: number) => {
      gl.uniform1f(p.loc.u_layer, layer);
      gl.uniform1f(p.loc.u_elevation, elevation);
      gl.uniform1f(p.loc.u_off, off);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    };
    // shadows on the ground, the deck above them, the cirrus highest of all
    const deck = offset(DECK);
    pass(0, 0, deck);
    pass(1, DECK_ALTITUDE_M, deck);
    pass(2, CIRRUS_ALTITUDE_M, offset(CIRRUS));
    gl.disableVertexAttribArray(p.attr);

    // keep the clouds moving: ~15 fps is plenty for motion this slow; interaction and the spin render at full rate anyway
    if (!still) {
      window.clearTimeout(this.repaintTimer);
      this.repaintTimer = window.setTimeout(() => this.map?.triggerRepaint(), 66);
    }
  }
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
