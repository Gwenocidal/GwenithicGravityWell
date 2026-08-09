export type Vec2 = { x: number; y: number };

export type RenderState = {
  pointer: Vec2;
  motion: Vec2;
  strength: number;
  time: number;
  fullWidth: number;
  fullHeight: number;
  viewOrigin?: Vec2;
  viewScale?: Vec2;
  observer?: { center: Vec2; zoom: number };
  radiance?: { exposure: number; spectral: number; toneMap: "aces" | "reinhard" | "linear" };
  seed?: number;
};

export type RendererLimits = {
  maxTextureSize: number;
  maxViewportWidth: number;
  maxViewportHeight: number;
};

type CanvasLike = HTMLCanvasElement | OffscreenCanvas;

const VERTEX_SHADER = `
  attribute vec2 a_position;
  uniform vec2 u_view_origin;
  uniform vec2 u_view_scale;
  varying vec2 v_screen_uv;

  void main() {
    vec2 local_uv = (a_position + 1.0) * 0.5;
    v_screen_uv = u_view_origin + local_uv * u_view_scale;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif

  uniform vec2 u_pointer;
  uniform vec2 u_motion;
  uniform vec3 u_observer;
  uniform float u_strength;
  uniform float u_time;
  uniform float u_aspect;
  uniform float u_inv_min_dimension;
  uniform float u_exposure;
  uniform float u_spectral;
  uniform float u_tone_map;
  uniform float u_seed;
  varying vec2 v_screen_uv;

  const float PI = 3.141592653589793;

  mat2 rotate2d(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
  }

  float hash21(vec2 point) {
    vec2 p = fract(point * vec2(123.34, 456.21));
    p += dot(p, p + 45.32 + u_seed * 0.000001);
    return fract(p.x * p.y);
  }

  vec2 hash22(vec2 point) {
    float n = hash21(point);
    return vec2(n, hash21(point + 19.19 + n * 7.13));
  }

  float gaussian(float value) {
    return exp(-value * value);
  }

  vec2 worldFromScreen(vec2 screen_uv, float depth) {
    float zoom = max(u_observer.z, 0.000001);
    vec2 world = u_observer.xy + (screen_uv - vec2(0.5)) * vec2(u_aspect, 1.0) / zoom;
    vec2 gaze = clamp(u_pointer - vec2(0.5), vec2(-0.75), vec2(0.75));
    world -= gaze * (0.0025 + depth * 0.0045) * u_strength / zoom;
    return world;
  }

  vec2 lensedScreen(float depth, float spectral_index, float influence, float screen_radius) {
    vec2 aspect = vec2(u_aspect, 1.0);
    vec2 screen_point = (v_screen_uv - u_pointer) * aspect;
    float radius_squared = dot(screen_point, screen_point);
    float einstein_radius = 0.056 * mix(0.82, 1.04, depth);
    einstein_radius *= 1.0 + spectral_index * 0.026 * u_spectral;
    float inverse_radius = (einstein_radius * einstein_radius) / (radius_squared + 0.000081);
    vec2 lensed_point = screen_point * clamp(1.0 - inverse_radius, -1.58, 1.0);

    float motion_amount = clamp(length(u_motion), 0.0, 1.0);
    float near_lens = 1.0 - smoothstep(einstein_radius * 1.05, einstein_radius * 4.2, screen_radius);
    float resting_spin = near_lens * influence * mix(0.016, 0.065, depth);
    float motion_spin = dot(u_motion, vec2(0.76, -0.44)) * influence * mix(0.075, 0.16, depth);
    lensed_point = rotate2d(resting_spin + motion_spin) * lensed_point;
    lensed_point -= (u_motion * aspect) * influence * mix(0.006, 0.027, depth);

    vec2 radial = screen_point * inversesqrt(max(radius_squared, 0.0000001));
    vec2 tangent = vec2(-radial.y, radial.x);
    float photon = gaussian((screen_radius - einstein_radius) / max(u_inv_min_dimension * 2.8, 0.0026));
    float fracture = spectral_index * influence * u_spectral *
      (u_inv_min_dimension * 0.75 + photon * u_inv_min_dimension * 4.6 + motion_amount * u_inv_min_dimension * 1.7) *
      mix(0.62, 1.22, depth);
    lensed_point += radial * fracture + tangent * fracture * motion_amount * 0.78;
    vec2 mapped = mix(screen_point, lensed_point, influence);
    return u_pointer + mapped / aspect;
  }

  vec3 stellarColor(float temperature) {
    vec3 cool = vec3(0.28, 0.58, 1.35);
    vec3 neutral = vec3(1.18, 1.08, 0.96);
    vec3 warm = vec3(1.45, 0.68, 0.26);
    return temperature < 0.52
      ? mix(cool, neutral, temperature / 0.52)
      : mix(neutral, warm, (temperature - 0.52) / 0.48);
  }

  vec4 starGrid(
    vec2 world,
    float cell_size,
    float seed,
    float density,
    float radius_ratio,
    float gain,
    float pixel_world
  ) {
    vec2 base = floor(world / cell_size);
    float existence = hash21(base + seed);
    if (existence >= density) return vec4(0.0);
    // Stars stay inside a generous cell margin, so one deterministic cell lookup
    // is sufficient and live evaluation does not multiply into a 3x3 search.
    vec2 jitter = hash22(base + seed * 1.73);
    vec2 position = (base + vec2(0.16) + jitter * 0.68) * cell_size;
    float distance_to_star = length(world - position);
    float size_noise = hash21(base + seed * 4.17);
    float physical_radius = cell_size * radius_ratio * mix(0.55, 1.8, size_noise * size_noise);
    float radius = sqrt(physical_radius * physical_radius + pixel_world * pixel_world * 0.32);
    float energy_scale = clamp((physical_radius * physical_radius) / max(radius * radius, 0.00000000001), 0.02, 1.0);
    float core = gaussian(distance_to_star / max(radius, 0.00000001)) * energy_scale;
    float bloom_radius = sqrt(physical_radius * physical_radius * 10.24 + pixel_world * pixel_world * 0.48);
    float bloom_energy = clamp((physical_radius * physical_radius * 10.24) / max(bloom_radius * bloom_radius, 0.00000000001), 0.02, 1.0);
    float bloom = gaussian(distance_to_star / max(bloom_radius, 0.00000001)) * bloom_energy;
    float temperature = hash21(base + seed * 9.31);
    float twinkle = 0.94 + 0.06 * sin(mod(u_time, 4096.0) * (0.7 + size_noise) + existence * 71.0);
    float local_gain = gain * mix(0.32, 1.45, size_noise) * twinkle;
    vec3 light = stellarColor(temperature) * (core * local_gain + bloom * local_gain * 0.11);
    return vec4(light, clamp(core * local_gain + bloom * 0.22, 0.0, 1.0));
  }

  float ellipseLine(vec2 point, vec2 center, vec2 axes, float rotation, float width) {
    vec2 q = rotate2d(-rotation) * (point - center);
    float normalized = length(q / axes);
    float distance_to_curve = abs(normalized - 1.0) * min(axes.x, axes.y);
    return 1.0 - smoothstep(width * 0.45, width * 1.55, distance_to_curve);
  }

  float orbitArc(
    vec2 point,
    vec2 center,
    vec2 axes,
    float rotation,
    float width,
    float arc_center,
    float arc_width
  ) {
    vec2 q = rotate2d(-rotation) * (point - center);
    float angle = atan(q.y / axes.y, q.x / axes.x);
    float angular_distance = abs(atan(sin(angle - arc_center), cos(angle - arc_center)));
    return ellipseLine(point, center, axes, rotation, width) *
      (1.0 - smoothstep(arc_width * 0.65, arc_width, angular_distance));
  }

  vec4 farLayer(vec2 world, float pixel_world) {
    vec2 from_center = world - vec2(0.5);
    float radius = length(from_center);
    float field = 1.0 - smoothstep(0.54, 0.94, radius);
    float violet = exp(-dot(from_center, from_center) * 5.4);
    float ember = exp(-dot(from_center - vec2(-0.10, 0.025), from_center - vec2(-0.10, 0.025)) * 25.0);
    vec3 haze = (vec3(0.17, 0.085, 0.36) * violet * 0.52 + vec3(0.36, 0.16, 0.055) * ember * 0.24) * field;
    vec4 stars = starGrid(world, 0.048, 17.0, 0.62, 0.018, 0.42, pixel_world);
    float orbit = ellipseLine(world, vec2(0.5), vec2(0.75, 0.66), -0.24, max(pixel_world * 1.15, 0.00034));
    float arc = orbitArc(world, vec2(0.5), vec2(0.75, 0.66), -0.24, max(pixel_world * 1.35, 0.00038), 0.72, 0.15);
    vec3 structure = vec3(0.52, 0.40, 0.92) * orbit * 0.12 + vec3(0.72, 0.86, 1.42) * arc * 0.44;
    return vec4(haze + stars.rgb + structure, max(field * 0.24, max(stars.a, orbit * 0.16)));
  }

  vec4 midLayer(vec2 world, float pixel_world) {
    vec4 stars = starGrid(world, 0.069, 43.0, 0.68, 0.020, 0.64, pixel_world);
    float outer = ellipseLine(world, vec2(0.5), vec2(0.59, 0.55), 0.33, max(pixel_world * 1.2, 0.00032));
    float inner = ellipseLine(world, vec2(0.5), vec2(0.40), 0.0, max(pixel_world * 1.3, 0.00034));
    float blue_arc = orbitArc(world, vec2(0.5), vec2(0.59, 0.55), 0.33, max(pixel_world * 1.6, 0.00042), 2.30, 0.095);
    float white_arc = orbitArc(world, vec2(0.5), vec2(0.40), 0.0, max(pixel_world * 1.8, 0.00044), -1.28, 0.11);
    vec3 structure = vec3(1.20, 0.70, 0.29) * outer * 0.17 + vec3(1.05, 0.88, 0.64) * inner * 0.34;
    structure += vec3(0.40, 0.88, 1.55) * blue_arc * 0.62 + vec3(1.50, 1.22, 0.90) * white_arc * 0.88;
    return vec4(stars.rgb + structure, max(stars.a, max(outer * 0.23, inner * 0.43)));
  }

  vec4 microHierarchy(vec2 world, float pixel_world) {
    float lod = floor(log2(max(1.0, u_observer.z)));
    float phase = fract(log2(max(1.0, u_observer.z)));
    float cell = 0.018 * exp2(-lod);
    // The next octave fades in, then becomes the stable current octave at the
    // power-of-two boundary. Its seed is identical on both sides of that handoff.
    vec4 current = starGrid(world, cell, 131.0 + lod * 23.0, 0.18, 0.012, 0.22, pixel_world);
    vec4 next = starGrid(world, cell * 0.5, 131.0 + (lod + 1.0) * 23.0, 0.14, 0.011, 0.22 * smoothstep(0.28, 0.96, phase), pixel_world);
    return vec4(current.rgb + next.rgb, max(current.a, next.a));
  }

  vec4 nearLayer(vec2 world, float pixel_world) {
    vec2 from_center = world - vec2(0.5);
    float radius = length(from_center);
    vec4 stars = starGrid(world, 0.108, 79.0, 0.72, 0.020, 0.88, pixel_world);
    vec4 micro = microHierarchy(world, pixel_world);
    float orbit = ellipseLine(world, vec2(0.5), vec2(0.30, 0.295), 0.18, max(pixel_world * 1.05, 0.00025));
    float orbit_hot = orbitArc(world, vec2(0.5), vec2(0.30, 0.295), 0.18, max(pixel_world * 1.35, 0.00030), -0.55, 0.12);

    float core = exp(-radius * radius * 620.0);
    float core_hot = exp(-radius * radius * 3600.0);
    float beam = exp(-abs(from_center.y) / max(pixel_world * 2.2, 0.0014)) * exp(-abs(from_center.x) * 4.8);
    vec3 core_light = vec3(0.62, 0.38, 1.20) * core * 0.56 + vec3(1.55, 1.15, 0.70) * core_hot * 1.42;
    core_light += vec3(0.62, 0.74, 1.38) * beam * 0.34;

    vec2 line_a = normalize(vec2(0.96, 0.27));
    vec2 line_b = normalize(vec2(0.86, -0.51));
    float trajectory_a = exp(-abs(from_center.x * line_a.y - from_center.y * line_a.x) / max(pixel_world * 1.2, 0.00052));
    float trajectory_b = exp(-abs(from_center.x * line_b.y - from_center.y * line_b.x) / max(pixel_world * 1.0, 0.00045));
    trajectory_a *= smoothstep(0.47, 0.05, abs(dot(from_center, line_a)));
    trajectory_b *= smoothstep(0.42, 0.04, abs(dot(from_center, line_b)));
    vec3 lines = vec3(0.35, 0.60, 1.20) * trajectory_a * 0.25 + vec3(1.22, 0.55, 0.23) * trajectory_b * 0.22;
    vec3 structure = vec3(0.60, 0.43, 1.05) * orbit * 0.10 + vec3(1.34, 0.74, 0.33) * orbit_hot * 0.48;
    return vec4(stars.rgb + micro.rgb + structure + core_light + lines,
      max(max(stars.a, micro.a), max(max(orbit * 0.16, core * 0.76), max(trajectory_a, trajectory_b) * 0.18)));
  }

  vec4 sceneAt(float spectral_index, float influence, float radius) {
    float pixel_world = max(u_inv_min_dimension / max(u_observer.z, 0.000001), 0.0000000002);
    vec2 far_world = worldFromScreen(lensedScreen(1.0, spectral_index, influence, radius), 1.0);
    vec2 mid_world = worldFromScreen(lensedScreen(0.78, spectral_index, influence, radius), 0.58);
    vec2 near_world = worldFromScreen(lensedScreen(0.52, spectral_index, influence, radius), 0.18);
    vec4 far_field = farLayer(far_world, pixel_world);
    vec4 mid_field = midLayer(mid_world, pixel_world);
    vec4 near_field = nearLayer(near_world, pixel_world);
    return vec4(far_field.rgb + mid_field.rgb + near_field.rgb,
      max(far_field.a, max(mid_field.a, near_field.a)));
  }

  vec3 acesToneMap(vec3 color) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
  }

  vec3 applyToneMap(vec3 color) {
    color *= exp2(u_exposure);
    if (u_tone_map < 0.5) return acesToneMap(color);
    if (u_tone_map < 1.5) return color / (vec3(1.0) + color);
    return clamp(color, 0.0, 1.0);
  }

  void main() {
    vec2 aspect = vec2(u_aspect, 1.0);
    vec2 screen_delta = (v_screen_uv - u_pointer) * aspect;
    float radius = length(screen_delta);
    float influence = (1.0 - smoothstep(0.1984, 0.31, radius)) * u_strength;

    vec4 red_scene = sceneAt(-1.0, influence, radius);
    vec4 green_scene = sceneAt(0.0, influence, radius);
    vec4 blue_scene = sceneAt(1.0, influence, radius);
    vec3 radiance = vec3(red_scene.r, green_scene.g, blue_scene.b);
    float alpha = max(red_scene.a, max(green_scene.a, blue_scene.a));

    float pixel = max(u_inv_min_dimension, 0.000008);
    float einstein_radius = 0.056;
    float angle = atan(screen_delta.y, screen_delta.x);
    vec2 motion_aspect = u_motion * aspect;
    float motion_amount = clamp(length(motion_aspect), 0.0, 1.0);
    vec2 axis_seed = vec2(0.87, 0.32) + motion_aspect * 0.22;
    vec2 axis = normalize(axis_seed);
    float axis_angle = atan(axis.y, axis.x);
    float critical_radius = einstein_radius * (1.0 + (0.035 + 0.03 * motion_amount) * cos(2.0 * (angle - axis_angle)));
    float spectral_gap = pixel * 2.2 * u_spectral;
    float ring_width = max(pixel * 1.65, 0.00002);
    float red_ring = gaussian((radius - (critical_radius - spectral_gap)) / ring_width) * u_strength;
    float green_ring = gaussian((radius - critical_radius) / (ring_width * 0.92)) * u_strength;
    float blue_ring = gaussian((radius - (critical_radius + spectral_gap)) / (ring_width * 1.08)) * u_strength;

    float local_time = mod(u_time, 4096.0);
    float broken_ring = 0.68 + 0.32 * sin(angle * 3.0 + local_time * 0.42);
    float arc_a = pow(max(0.0, 0.5 + 0.5 * cos(angle - axis_angle - 0.45)), 10.0);
    float arc_b = pow(max(0.0, 0.5 + 0.5 * cos(angle - axis_angle + 2.25)), 14.0);
    float caustic_knots = clamp(arc_a + arc_b * 0.75, 0.0, 1.0);
    vec2 radial_direction = normalize(screen_delta + vec2(0.0000001));
    vec2 tangent_direction = vec2(-radial_direction.y, radial_direction.x);
    float facing = clamp(0.5 + 0.5 * dot(tangent_direction, axis), 0.0, 1.0);
    float beaming = 0.34 + 0.66 * facing * facing;
    float source_luma = clamp(dot(radiance, vec3(0.21, 0.72, 0.07)), 0.0, 2.0);
    float borrowed_light = clamp(alpha * 0.78 + source_luma * 0.68, 0.0, 1.0);
    vec3 spectral_ring = vec3(red_ring, green_ring, blue_ring) * broken_ring * beaming *
      (0.72 + caustic_knots * 1.05) * borrowed_light;
    radiance += spectral_ring * vec3(1.20, 0.95, 1.30) * 0.76;
    alpha = max(alpha, max(red_ring, max(green_ring, blue_ring)) * borrowed_light * 0.94);

    float second_image = gaussian((radius - einstein_radius * 1.72) / max(pixel * 5.2, 0.00008)) *
      u_strength * borrowed_light;
    float secondary_arc = smoothstep(0.12, 0.95, sin(angle * 2.0 - 0.7) * 0.5 + 0.5);
    radiance += mix(vec3(0.45, 0.32, 0.95), vec3(1.0, 0.70, 0.38), secondary_arc) *
      second_image * secondary_arc * 0.16;
    alpha = max(alpha, second_image * secondary_arc * 0.28);

    float horizon_radius = 0.0208;
    float horizon_aa = max(pixel * 1.5, 0.000012);
    float horizon = (1.0 - smoothstep(horizon_radius - horizon_aa, horizon_radius + horizon_aa * 2.0, radius)) * u_strength;
    float inner_shadow = (1.0 - smoothstep(horizon_radius, einstein_radius * 0.92, radius)) * u_strength;
    radiance = mix(radiance, vec3(0.00004, 0.000025, 0.00010), max(horizon, inner_shadow * 0.76));
    alpha = max(alpha, max(horizon, inner_shadow * 0.84));

    vec3 display_color = pow(applyToneMap(max(radiance, vec3(0.0))), vec3(1.0 / 2.2));
    gl_FragColor = vec4(display_color * alpha, alpha);
  }
`;

export function fitWithinLongEdge(width: number, height: number, longEdge: number, hardLimit: number) {
  const aspect = width / Math.max(1, height);
  const target = Math.max(64, Math.min(Math.round(longEdge), hardLimit));
  if (aspect >= 1) return { width: target, height: Math.max(64, Math.round(target / aspect)) };
  return { width: Math.max(64, Math.round(target * aspect)), height: target };
}

export class GravityRenderer {
  readonly canvas: CanvasLike;
  readonly gl: WebGLRenderingContext;
  readonly limits: RendererLimits;
  private readonly program: WebGLProgram;
  private readonly buffer: WebGLBuffer;
  private outputKey = "";
  private readonly locations: Record<string, WebGLUniformLocation | number>;

  constructor(canvas: CanvasLike) {
    this.canvas = canvas;
    const gl = (canvas as HTMLCanvasElement).getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    }) as WebGLRenderingContext | null;
    if (!gl) throw new Error("WebGL is unavailable on this system.");
    this.gl = gl;
    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("Could not allocate WebGL resources.");
    this.buffer = buffer;

    const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    this.limits = {
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxViewportWidth: viewport[0],
      maxViewportHeight: viewport[1],
    };

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const uniform = (name: string) => {
      const location = gl.getUniformLocation(this.program, name);
      if (location === null) throw new Error(`Missing shader uniform ${name}.`);
      return location;
    };
    const position = gl.getAttribLocation(this.program, "a_position");
    if (position < 0) throw new Error("Missing shader position attribute.");
    this.locations = {
      position,
      pointer: uniform("u_pointer"), motion: uniform("u_motion"), strength: uniform("u_strength"),
      time: uniform("u_time"), aspect: uniform("u_aspect"), invMin: uniform("u_inv_min_dimension"),
      viewOrigin: uniform("u_view_origin"),
      viewScale: uniform("u_view_scale"), observer: uniform("u_observer"), exposure: uniform("u_exposure"),
      spectral: uniform("u_spectral"), toneMap: uniform("u_tone_map"), seed: uniform("u_seed"),
    };
    gl.clearColor(0, 0, 0, 0);
  }

  // Kept as a compatibility seam for v0.2 callers. The v0.3 universe has no source bitmap.
  setSourceResolution(_width: number, _height: number, _densityReference: number) {}

  render(outputWidth: number, outputHeight: number, state: RenderState) {
    const width = Math.max(2, Math.min(this.limits.maxViewportWidth, Math.round(outputWidth)));
    const height = Math.max(2, Math.min(this.limits.maxViewportHeight, Math.round(outputHeight)));
    const outputKey = `${width}x${height}`;
    if (this.outputKey !== outputKey) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.outputKey = outputKey;
    }
    const origin = state.viewOrigin ?? { x: 0, y: 0 };
    const scale = state.viewScale ?? { x: 1, y: 1 };
    const observer = state.observer ?? { center: { x: 0.5, y: 0.5 }, zoom: 1 };
    const radiance = state.radiance ?? { exposure: 0, spectral: 1, toneMap: "aces" as const };
    const toneMap = radiance.toneMap === "aces" ? 0 : radiance.toneMap === "reinhard" ? 1 : 2;
    const gl = this.gl;
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.locations.position as number);
    gl.vertexAttribPointer(this.locations.position as number, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(this.locations.pointer as WebGLUniformLocation, state.pointer.x, state.pointer.y);
    gl.uniform2f(this.locations.motion as WebGLUniformLocation, state.motion.x, state.motion.y);
    gl.uniform1f(this.locations.strength as WebGLUniformLocation, state.strength);
    gl.uniform1f(this.locations.time as WebGLUniformLocation, state.time);
    gl.uniform1f(this.locations.aspect as WebGLUniformLocation, state.fullWidth / Math.max(1, state.fullHeight));
    gl.uniform1f(this.locations.invMin as WebGLUniformLocation, 1 / Math.max(1, Math.min(state.fullWidth, state.fullHeight)));
    gl.uniform2f(this.locations.viewOrigin as WebGLUniformLocation, origin.x, origin.y);
    gl.uniform2f(this.locations.viewScale as WebGLUniformLocation, scale.x, scale.y);
    gl.uniform3f(this.locations.observer as WebGLUniformLocation, observer.center.x, observer.center.y, observer.zoom);
    gl.uniform1f(this.locations.exposure as WebGLUniformLocation, radiance.exposure);
    gl.uniform1f(this.locations.spectral as WebGLUniformLocation, radiance.spectral);
    gl.uniform1f(this.locations.toneMap as WebGLUniformLocation, toneMap);
    gl.uniform1f(this.locations.seed as WebGLUniformLocation, state.seed ?? 0x6c756e61);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  destroy() {
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteProgram(this.program);
  }
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create WebGL shader program.");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || "Unknown shader link error.";
    gl.deleteProgram(program);
    throw new Error(info);
  }
  return program;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not allocate a WebGL shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || "Unknown shader compilation error.";
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}
