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

  float valueNoise(vec2 point, float seed) {
    vec2 base = floor(point);
    vec2 blend = fract(point);
    blend = blend * blend * (3.0 - 2.0 * blend);
    float a = hash21(base + seed);
    float b = hash21(base + vec2(1.0, 0.0) + seed);
    float c = hash21(base + vec2(0.0, 1.0) + seed);
    float d = hash21(base + vec2(1.0, 1.0) + seed);
    return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
  }

  // x: inhabited cloud, y: filament, z: explicit void. The thresholds are
  // intentionally severe: inhabited regions may become lavish, while mature
  // voids are permitted to remain genuinely empty.
  vec3 matterField(vec2 world, float seed, float scale) {
    vec2 p = rotate2d(0.17 + seed * 0.013) * (world - vec2(0.5)) * scale;
    float low = valueNoise(p * 0.48 + vec2(7.1, -3.7), seed + 11.0);
    float cross = valueNoise(p * 0.39 + vec2(-5.4, 12.8), seed + 29.0);
    vec2 warped = p + vec2(low - 0.5, cross - 0.5) * 1.55;
    float middle = valueNoise(warped * 1.07 + vec2(19.3, 2.6), seed + 47.0);
    float fine = valueNoise(warped * 2.41 + vec2(-8.7, 21.4), seed + 83.0);
    float sweep = 0.5 + 0.5 * sin(
      warped.y * 1.72 + sin(warped.x * 1.11 + seed * 0.07) * 1.85
    );
    float ridge_signal = fine * 0.54 + sweep * 0.46;
    float filament = pow(clamp(1.0 - abs(ridge_signal * 2.0 - 1.0), 0.0, 1.0), 4.2);
    float continent = low * 0.61 + middle * 0.39;
    float inhabited = smoothstep(0.46, 0.67, continent + filament * 0.21);
    float void_gate = smoothstep(0.43, 0.61, continent);
    float cloud = inhabited * void_gate * (0.16 + 0.84 * smoothstep(0.30, 0.82, middle));
    return vec3(cloud, filament * void_gate, 1.0 - void_gate);
  }

  // A projected large-scale web built from crossing, selectively surviving
  // ridges. The earlier cellular prototype exposed its Voronoi ancestry; this
  // law keeps long coherence and large voids without drawing a polygon mesh.
  vec3 cosmicWebField(vec2 world, float seed, float scale) {
    vec2 p = rotate2d(0.31 + seed * 0.017) * (world - vec2(0.5)) * scale;
    float warp_x = valueNoise(p * 0.24 + vec2(17.3, -8.4), seed + 3.0);
    float warp_y = valueNoise(p * 0.21 + vec2(-11.7, 21.2), seed + 7.0);
    vec2 warped = p + vec2(warp_x - 0.5, warp_y - 0.5) * 1.86;
    float low = valueNoise(warped * 0.31 + vec2(4.8, -9.3), seed + 19.0);
    float ridge_signal_a = valueNoise(warped * 0.91 + vec2(13.2, 5.7), seed + 31.0);
    float ridge_signal_b = valueNoise(rotate2d(1.08) * warped * 1.17 + vec2(-7.4, 16.1), seed + 47.0);
    float branch_signal = valueNoise(warped * 0.57 + vec2(9.7, -14.1), seed + 91.0);
    float ridge_a = pow(clamp(1.0 - abs(ridge_signal_a * 2.0 - 1.0), 0.0, 1.0), 3.4);
    float ridge_b = pow(clamp(1.0 - abs(ridge_signal_b * 2.0 - 1.0), 0.0, 1.0), 4.2);
    float inhabited_sheet = smoothstep(0.35, 0.63, low * 0.72 + branch_signal * 0.28);
    float branch_survival = smoothstep(0.30, 0.72, branch_signal);
    float filament = max(ridge_a * (0.08 + branch_survival * 0.92), ridge_b * inhabited_sheet * 0.76);
    filament *= 0.18 + inhabited_sheet * 0.82;
    float knot = pow(clamp(ridge_a * ridge_b, 0.0, 1.0), 0.46) *
      smoothstep(0.52, 0.79, low * 0.62 + branch_signal * 0.38);
    float occupied = clamp(filament * 0.78 + knot, 0.0, 1.0);
    float void_region = 1.0 - smoothstep(0.055, 0.34, occupied);
    return vec3(filament, knot, void_region);
  }

  // Local feedback carves a cavity and compresses an incomplete luminous wall.
  // Keeping the bubble inside its deterministic cell means one cell lookup is
  // sufficient while still producing causal adjacency between fullness/absence.
  vec3 feedbackBubble(vec2 world, float seed, float cell_size, float pixel_world) {
    float population_rotation = fract(seed * 0.119) * PI * 2.0;
    vec2 population_world = rotate2d(population_rotation) * (world - vec2(0.5)) + vec2(0.5);
    vec2 base = floor(population_world / cell_size);
    float temperature = hash21(base + seed * 12.1);
    float existence = hash21(base + seed * 15.7);
    if (existence > 0.28) return vec3(0.0, 0.0, temperature);
    vec2 jitter = hash22(base + seed * 1.91);
    vec2 center = (base + vec2(0.34) + jitter * 0.32) * cell_size;
    vec2 q = population_world - center;
    float angle = atan(q.y, q.x);
    float radius = cell_size * mix(0.115, 0.205, hash21(base + seed * 4.3));
    float irregular_radius = radius * (1.0 + 0.14 * sin(angle * 3.0 + seed) + 0.06 * sin(angle * 7.0 - seed));
    float distance_to_center = length(q);
    float cavity = 1.0 - smoothstep(irregular_radius * 0.48, irregular_radius * 0.96, distance_to_center);
    float shell_source_width = radius * 0.075;
    float shell_width = sqrt(shell_source_width * shell_source_width + pixel_world * pixel_world * 1.7);
    float shell_energy = clamp(shell_source_width / max(shell_width, 0.00000001), 0.0005, 1.0);
    float shell = gaussian((distance_to_center - irregular_radius) / shell_width) * shell_energy;
    float opening = smoothstep(0.46, 0.91,
      sin(angle * 2.0 + hash21(base + seed * 8.7) * PI * 2.0));
    opening *= 1.0 - 0.72 * pow(max(0.0,
      0.5 + 0.5 * cos(angle * 5.0 + existence * 31.0)), 12.0);
    shell *= opening * opening;
    return vec3(cavity, shell, temperature);
  }

  // The Lunalisk is not a deposited glyph. These are four pieces of evidence
  // left in the same matter law: underdensity, an outer pressure wall, paired
  // caustics, and a narrow phase seam. The movable well decides how much of the
  // evidence can become mutually legible.
  float crescentDistance(vec2 point, float radius, float cut_shift) {
    float outer_disc = length(point) - radius;
    float displaced_cut = length(point - vec2(cut_shift, 0.0)) - radius * 0.93;
    return max(outer_disc, -displaced_cut);
  }

  vec4 lunaliskField(vec2 world, float pixel_world) {
    vec2 q = rotate2d(-0.27) * (world - vec2(0.5));
    float radius = length(q);
    float angle = atan(q.y, q.x);

    float soft_sink = exp(-pow(radius / 0.235, 3.2));
    float hard_sink = 1.0 - smoothstep(0.036, 0.091 + 0.012 * sin(angle * 3.0), radius);
    float sink = clamp(soft_sink * 0.74 + hard_sink * 0.34, 0.0, 1.0);

    float outer_radius = 0.305 + 0.026 * sin(angle * 3.0 + 0.8) + 0.012 * sin(angle * 8.0 - 1.3);
    float outer_source_width = 0.011;
    float outer_width = sqrt(outer_source_width * outer_source_width + pixel_world * pixel_world * 1.8);
    float outer_energy = clamp(outer_source_width / max(outer_width, 0.00000001), 0.0005, 1.0);
    float outer_shell = gaussian((radius - outer_radius) / outer_width) * outer_energy;
    float outer_lobes = clamp(
      pow(max(0.0, 0.5 + 0.5 * cos(angle - 0.34)), 10.0) +
      pow(max(0.0, 0.5 + 0.5 * cos(angle + 2.04)), 13.0) * 0.68,
      0.0, 1.0
    );
    float fracture = 1.0 - 0.82 * pow(max(0.0, 0.5 + 0.5 * cos(angle * 5.0 + 0.9)), 18.0);
    float outer_ridge = outer_shell * outer_lobes * fracture;

    // A triple-moon symmetry is an intentionally constructed but normally
    // withheld prior, not a permanent emblem. The resident supplies two
    // imperfect occultation crescents; the movable well becomes the missing
    // dark moon only during an encounter.
    vec2 left_point = rotate2d(0.045) * (q - vec2(-0.056, 0.003));
    vec2 right_point = rotate2d(-0.072) * (q - vec2(0.058, -0.002));
    float inner_source_width = 0.00225;
    float inner_width = sqrt(inner_source_width * inner_source_width + pixel_world * pixel_world * 1.42);
    float inner_energy = clamp(inner_source_width / max(inner_width, 0.00000001), 0.0005, 1.0);
    float left_crescent = gaussian(crescentDistance(left_point, 0.038, 0.016) / inner_width) * inner_energy;
    float right_crescent = gaussian(crescentDistance(right_point, 0.035, -0.014) / inner_width) * inner_energy;
    float crescent_fracture = 1.0 - 0.68 * pow(max(0.0,
      0.5 + 0.5 * cos(angle * 9.0 + radius * 93.0 - 0.4)), 16.0);
    crescent_fracture *= 0.32 + 0.68 * smoothstep(-0.24, 0.72,
      sin(angle * 3.0 + radius * 51.0 + 0.6));
    float caustic = (left_crescent + right_crescent * 0.86) * crescent_fracture;

    float seam_curve = q.y - 0.009 * sin(q.x * 71.0) - q.x * 0.13;
    float seam_source_width = 0.000075;
    float seam_width = sqrt(seam_source_width * seam_source_width + pixel_world * pixel_world * 1.1);
    float seam_energy = clamp(seam_source_width / max(seam_width, 0.00000001), 0.0005, 1.0);
    float seam = gaussian(seam_curve / seam_width) * seam_energy *
      exp(-abs(q.x) / 0.0016) * (0.62 + 0.38 * sin(q.x * 183.0 + 0.7));
    float raw_seam_fragments = smoothstep(-0.12, 0.70,
      sin(q.x * 5200.0 + sin(q.x * 1700.0) * 1.4 + 0.3));
    float fragment_period = 0.00120;
    float fragment_resolution = 1.0 - smoothstep(fragment_period * 0.28, fragment_period, pixel_world);
    float seam_fragments = mix(0.44, raw_seam_fragments, fragment_resolution);
    seam *= 0.12 + seam_fragments * 0.88;
    return vec4(sink, outer_ridge, caustic, max(seam, 0.0));
  }

  float lunaliskEncounter() {
    float zoom = max(u_observer.z, 0.000001);
    vec2 pointer_world = u_observer.xy + (u_pointer - vec2(0.5)) * vec2(u_aspect, 1.0) / zoom;
    vec2 anchor_on_screen = (pointer_world - vec2(0.5)) * zoom / vec2(u_aspect, 1.0);
    return (1.0 - smoothstep(0.065, 0.29, length(anchor_on_screen))) * u_strength;
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
    vec3 cool = vec3(0.66, 0.82, 1.20);
    vec3 neutral = vec3(1.16, 1.09, 0.99);
    vec3 warm = vec3(1.27, 0.91, 0.61);
    return temperature < 0.52
      ? mix(cool, neutral, temperature / 0.52)
      : mix(neutral, warm, (temperature - 0.52) / 0.48);
  }

  vec4 galaxyGrid(
    vec2 world,
    float cell_size,
    float seed,
    float density,
    float gain,
    float pixel_world
  ) {
    float population_rotation = fract(seed * 0.137) * PI * 2.0;
    vec2 population_offset = hash22(vec2(seed * 1.7, seed * 0.43)) * cell_size * 7.0;
    vec2 population_world = rotate2d(population_rotation) * (world - vec2(0.5)) +
      vec2(0.5) + population_offset;
    vec2 base = floor(population_world / cell_size);
    float existence = hash21(base + seed * 2.1);
    float allowed_density = clamp(density, 0.0, 0.98);
    if (allowed_density <= 0.0) return vec4(0.0);
    float presence = smoothstep(existence - 0.035, existence + 0.035, allowed_density);
    if (presence <= 0.001) return vec4(0.0);

    vec2 jitter = hash22(base + seed * 3.7);
    vec2 position = (base + vec2(0.27) + jitter * 0.46) * cell_size;
    vec2 delta = population_world - position;
    float morphology = hash21(base + seed * 7.3);
    float orientation = hash21(base + seed * 11.9) * PI;
    vec2 q = rotate2d(orientation) * delta;
    float physical_major = cell_size * mix(0.075, 0.19, hash21(base + seed * 17.1));
    float flattening = mix(0.18, 0.72, hash21(base + seed * 19.7));
    if (morphology > 0.78) flattening = mix(0.58, 0.94, flattening);
    vec2 physical_axes = vec2(physical_major, physical_major * flattening);
    vec2 axes = sqrt(physical_axes * physical_axes +
      vec2(pixel_world * pixel_world * 4.0, pixel_world * pixel_world * 2.25));
    float body_energy = clamp(
      (physical_axes.x * physical_axes.y) / max(axes.x * axes.y, 0.0000000001),
      0.0005, 1.0
    );
    vec2 normalized_q = q / axes;
    float elliptical_radius = length(normalized_q);
    float angle = atan(normalized_q.y, normalized_q.x);

    float envelope = exp(-pow(elliptical_radius, 1.22) * 3.05);
    float bulge = gaussian(elliptical_radius * 4.9);
    float arm_phase = angle * 2.0 + elliptical_radius * mix(9.0, 17.0, morphology) + existence * 19.0;
    float arms = pow(max(0.0, 0.5 + 0.5 * cos(arm_phase)), 5.0) *
      smoothstep(0.10, 0.38, elliptical_radius) * (1.0 - smoothstep(0.72, 1.48, elliptical_radius));
    float dust_lane = pow(max(0.0, 0.5 + 0.5 * cos(arm_phase + 0.72)), 8.0) * envelope;
    float irregular = 0.72 + 0.28 * sin(angle * 5.0 + elliptical_radius * 13.0 + existence * 37.0);
    float body = envelope * mix(0.76 + arms * 0.82, irregular, smoothstep(0.76, 0.94, morphology));
    body *= 1.0 - dust_lane * 0.46;

    float tail_source_width = physical_major * 0.085;
    float tail_width = sqrt(tail_source_width * tail_source_width + pixel_world * pixel_world * 1.82);
    float tail_energy = clamp(tail_source_width / max(tail_width, 0.00000001), 0.0005, 1.0);
    float tail_curve = q.y + (q.x * q.x / max(physical_major, 0.000001)) * mix(-0.42, 0.42, morphology);
    float tail = gaussian(tail_curve / tail_width) * exp(-abs(q.x) / max(physical_major * 1.9, 0.000001));
    tail *= smoothstep(0.63, 0.91, morphology) *
      smoothstep(-physical_major * 1.8, physical_major * 0.25, q.x) * tail_energy;

    float redshift = hash21(base + seed * 23.3);
    vec3 old_stars = mix(vec3(1.22, 0.72, 0.43), vec3(1.15, 0.96, 0.76), redshift);
    vec3 young_stars = mix(vec3(0.62, 0.79, 1.18), vec3(0.86, 0.94, 1.14), redshift);
    vec3 color = mix(young_stars, old_stars, smoothstep(0.28, 0.84, redshift));
    vec3 light = color * body * gain * (0.44 + existence * 0.72) * body_energy;
    light += vec3(1.44, 1.18, 0.88) * bulge * gain * mix(0.55, 2.2, redshift) * body_energy;
    light += mix(vec3(0.57, 0.80, 1.21), vec3(1.25, 0.66, 0.37), redshift) *
      (arms * envelope * 0.38 * body_energy + tail * 0.30) * gain;
    light *= presence;
    float coverage = clamp(((body * 0.72 + bulge) * body_energy + tail * 0.32) * presence, 0.0, 1.0);
    return vec4(light, coverage);
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
    // Every population owns a stable rotation and translation. This preserves
    // deterministic cells without exposing a shared screen-aligned lattice.
    float population_rotation = fract(seed * 0.173) * PI * 2.0;
    vec2 population_offset = hash22(vec2(seed * 0.91, seed * 1.37)) * cell_size * 11.0;
    vec2 population_world = rotate2d(population_rotation) * (world - vec2(0.5)) +
      vec2(0.5) + population_offset;
    vec2 base = floor(population_world / cell_size);
    float existence = hash21(base + seed);
    if (existence >= clamp(density, 0.0, 0.96)) return vec4(0.0);
    // Stars stay inside a generous cell margin, so one deterministic cell lookup
    // is sufficient and live evaluation does not multiply into a 3x3 search.
    vec2 jitter = hash22(base + seed * 1.73);
    vec2 position = (base + vec2(0.24) + jitter * 0.52) * cell_size;
    vec2 delta = population_world - position;
    float distance_to_star = length(delta);
    float size_noise = hash21(base + seed * 4.17);
    float rare = pow(size_noise, 7.0);
    float physical_radius = cell_size * radius_ratio * mix(0.42, 1.58, size_noise * size_noise);
    float radius = sqrt(physical_radius * physical_radius + pixel_world * pixel_world * 0.44);
    float energy_scale = clamp((physical_radius * physical_radius) / max(radius * radius, 0.00000000001), 0.0005, 1.0);
    float core = gaussian(distance_to_star / max(radius, 0.00000001)) * energy_scale;
    float aureole_radius = sqrt(physical_radius * physical_radius * 13.4 + pixel_world * pixel_world * 0.62);
    float aureole_energy = clamp((physical_radius * physical_radius * 13.4) / max(aureole_radius * aureole_radius, 0.00000000001), 0.0005, 1.0);
    float aureole = gaussian(distance_to_star / max(aureole_radius, 0.00000001)) * aureole_energy;
    float temperature = hash21(base + seed * 9.31);
    float twinkle = 0.94 + 0.06 * sin(mod(u_time, 4096.0) * (0.7 + size_noise) + existence * 71.0);
    float local_gain = gain * mix(0.30, 1.62, size_noise) * twinkle;
    vec3 temperature_color = stellarColor(temperature);
    vec3 hot_core = mix(temperature_color, vec3(1.48, 1.31, 1.14), 0.52 + rare * 0.36);

    float orientation = hash21(base + seed * 12.73) * PI;
    vec2 local = rotate2d(orientation) * delta;
    float spike_width = max(pixel_world * 0.68, physical_radius * 0.22);
    float spike_extent = max(physical_radius * mix(3.6, 7.8, rare), pixel_world * 1.8);
    float spike_a = gaussian(local.x / spike_width) * exp(-abs(local.y) / spike_extent);
    float spike_b = gaussian(local.y / spike_width) * exp(-abs(local.x) / spike_extent);
    float spikes = (spike_a + spike_b) * rare * energy_scale;

    // The core carries HDR radiance. Tone mapping, not a painted disc, makes it white-hot.
    vec3 light = hot_core * core * local_gain * (1.15 + rare * 5.2);
    light += temperature_color * aureole * local_gain * (0.10 + rare * 0.23);
    light += hot_core * spikes * local_gain * 0.72;
    float coverage = clamp(
      (core * (1.0 + rare * 2.4) + aureole * 0.30 + spikes * 0.46) * local_gain,
      0.0, 1.0
    );
    return vec4(light, coverage);
  }

  float ellipseDistance(vec2 point, vec2 center, vec2 axes, float rotation) {
    vec2 q = rotate2d(-rotation) * (point - center);
    float normalized = length(q / axes);
    return abs(normalized - 1.0) * min(axes.x, axes.y);
  }

  vec4 orbitEmitter(
    vec2 point,
    vec2 center,
    vec2 axes,
    float rotation,
    float width,
    vec3 color,
    float energy,
    float phase
  ) {
    vec2 q = rotate2d(-rotation) * (point - center);
    float angle = atan(q.y / axes.y, q.x / axes.x);
    float distance_to_curve = ellipseDistance(point, center, axes, rotation);
    float pixel_world = max(u_inv_min_dimension / max(u_observer.z, 0.000001), 0.0000000002);
    float hot_width = sqrt(width * width + pixel_world * pixel_world * 0.42);
    float halo_source_width = width * 4.6;
    float halo_width = sqrt(halo_source_width * halo_source_width + pixel_world * pixel_world * 0.42);
    float atmosphere_source_width = width * 12.0;
    float atmosphere_width = sqrt(atmosphere_source_width * atmosphere_source_width + pixel_world * pixel_world * 0.42);
    float hot = gaussian(distance_to_curve / hot_width) * width / hot_width;
    float halo = gaussian(distance_to_curve / halo_width) * halo_source_width / halo_width;
    float atmosphere = gaussian(distance_to_curve / atmosphere_width) * atmosphere_source_width / atmosphere_width;
    float current = 0.70 + 0.18 * sin(angle * 7.0 + phase) + 0.12 * sin(angle * 17.0 - phase * 1.7);
    float knot = pow(max(0.0, 0.5 + 0.5 * cos(angle * 3.0 + phase * 0.63)), 16.0);
    float local_energy = energy * clamp(current + knot * 1.65, 0.14, 2.4);
    vec3 white_hot = mix(color, vec3(1.42, 1.28, 1.15), 0.58);
    vec3 light = white_hot * hot * local_energy;
    light += color * (halo * 0.115 + atmosphere * 0.022) * local_energy;
    float coverage = clamp(hot * local_energy + halo * 0.26 + atmosphere * 0.06, 0.0, 1.0);
    return vec4(light, coverage);
  }

  vec4 orbitArcEmitter(
    vec2 point,
    vec2 center,
    vec2 axes,
    float rotation,
    float width,
    vec3 color,
    float energy,
    float phase,
    float arc_center,
    float arc_width
  ) {
    vec2 q = rotate2d(-rotation) * (point - center);
    float angle = atan(q.y / axes.y, q.x / axes.x);
    float angular_distance = abs(atan(sin(angle - arc_center), cos(angle - arc_center)));
    float gate = 1.0 - smoothstep(arc_width * 0.66, arc_width, angular_distance);
    return orbitEmitter(point, center, axes, rotation, width, color, energy, phase) * gate;
  }

  vec4 remnantEmitter(
    vec2 point,
    vec2 center,
    float source_radius,
    float rotation,
    float width,
    vec3 color,
    float energy,
    float phase
  ) {
    vec2 q = rotate2d(-rotation) * (point - center);
    float angle = atan(q.y, q.x);
    float radius = length(q);
    float displaced_radius = source_radius * (
      1.0 + 0.105 * sin(angle * 3.0 + phase) +
      0.047 * sin(angle * 8.0 - phase * 1.7)
    );
    float pixel_world = max(u_inv_min_dimension / max(u_observer.z, 0.000001), 0.0000000002);
    float hot_width = sqrt(width * width + pixel_world * pixel_world * 0.46);
    float halo_source_width = width * 5.2;
    float halo_width = sqrt(halo_source_width * halo_source_width + pixel_world * pixel_world * 0.46);
    float hot = gaussian((radius - displaced_radius) / hot_width) * width / hot_width;
    float halo = gaussian((radius - displaced_radius) / halo_width) * halo_source_width / halo_width;
    float torn = smoothstep(0.68, 0.94,
      0.5 + 0.5 * sin(angle * 4.0 + phase + sin(angle * 7.0) * 0.72));
    float knots = pow(max(0.0, 0.5 + 0.5 * cos(angle * 11.0 - phase * 1.3)), 13.0);
    float echo = gaussian((radius - displaced_radius * 1.21) / max(halo_width * 1.7, 0.000001)) *
      smoothstep(0.40, 0.89, 0.5 + 0.5 * sin(angle * 2.0 - phase));
    float local_energy = energy * (0.003 + torn * 0.997) * (0.72 + knots * 1.9);
    vec3 white_hot = mix(color, vec3(1.48, 1.28, 1.05), 0.64);
    vec3 light = white_hot * hot * local_energy;
    light += color * halo * local_energy * 0.13;
    light += mix(color, vec3(0.36, 0.72, 1.42), 0.48) * echo * energy * 0.035;
    float coverage = clamp(hot * local_energy + halo * local_energy * 0.25 + echo * 0.08, 0.0, 1.0);
    return vec4(light, coverage);
  }

  vec4 addLight(vec4 a, vec4 b) {
    return vec4(a.rgb + b.rgb, max(a.a, b.a));
  }

  vec4 ultraLayer(vec2 world, float pixel_world) {
    vec3 web = cosmicWebField(world, 307.0, 0.235);
    vec3 organic = matterField(world, 331.0, 0.182);
    vec2 q = rotate2d(-0.19) * (world - vec2(0.5));
    float radius = length(q);
    float angle = atan(q.y, q.x);
    float macro_sink = exp(-pow(radius / 3.55, 3.0));
    float macro_boundary = 3.75 + 0.42 * sin(angle * 3.0 + 0.5) + 0.19 * sin(angle * 7.0 - 1.2);
    float macro_ridge = gaussian((radius - macro_boundary) / 0.24);
    macro_ridge *= clamp(
      pow(max(0.0, 0.5 + 0.5 * cos(angle - 0.32)), 8.0) +
      pow(max(0.0, 0.5 + 0.5 * cos(angle + 2.18)), 11.0) * 0.64,
      0.0, 1.0
    );

    float filament = pow(clamp(web.x * 0.79 + organic.y * 0.31, 0.0, 1.0), 1.72);
    float knots = pow(clamp(web.y * 0.82 + organic.x * 0.24, 0.0, 1.0), 1.84);
    filament = filament * (1.0 - macro_sink * 0.96) + macro_ridge * 0.58;
    knots *= 1.0 - macro_sink * 0.99;
    float occupied = clamp(filament * 0.76 + knots, 0.0, 1.0);
    float node_permission = smoothstep(0.18, 0.61, occupied);

    vec4 cluster_nodes = galaxyGrid(world, 4.1, 347.0,
      node_permission * (0.035 + knots * 0.64), 0.42, pixel_world);
    vec4 filament_groups = galaxyGrid(world, 1.35, 367.0,
      node_permission * (0.018 + filament * 0.34), 0.16, pixel_world);
    vec3 web_light = vec3(0.105, 0.102, 0.112) * pow(filament, 1.78) * 0.78;
    web_light += vec3(0.32, 0.27, 0.20) * pow(knots, 2.14) * 0.69;
    web_light += vec3(0.18, 0.17, 0.21) * macro_ridge * 0.085;
    vec3 light = web_light + cluster_nodes.rgb + filament_groups.rgb;
    float coverage = max(max(cluster_nodes.a, filament_groups.a), occupied * 0.30);
    return vec4(light, coverage);
  }

  vec4 cosmicLayer(vec2 world, float pixel_world) {
    vec3 broad_web = cosmicWebField(world, 13.0, 0.94);
    vec3 broad_matter = matterField(world, 191.0, 0.76);
    vec3 fine_matter = matterField(world, 223.0, 1.84);
    vec4 resident = lunaliskField(world, pixel_world);
    float evacuation = 1.0 - resident.x * 0.90;
    float filament_signal = clamp((
      broad_matter.y * 0.88 + fine_matter.y * 0.33 +
      broad_web.x * 0.075
    ) * evacuation + resident.y * 0.28, 0.0, 1.0);
    float filament = pow(filament_signal, 1.85);
    float knot_signal = clamp((
      pow(broad_matter.x * fine_matter.x, 0.72) * 0.84 +
      broad_web.y * 0.15
    ) * evacuation + resident.y * 0.13, 0.0, 1.0);
    float knots = pow(knot_signal, 1.55);
    float occupied = clamp(filament * 0.72 + knots, 0.0, 1.0);
    float void_suppression = smoothstep(0.30, 0.70, occupied);

    vec4 clusters = galaxyGrid(world, 0.72, 19.0,
      void_suppression * (0.035 + knots * 0.62), 0.36, pixel_world);
    vec4 galaxies = galaxyGrid(world, 0.31, 43.0,
      void_suppression * (0.025 + filament * 0.46), 0.22, pixel_world);
    vec4 distant = galaxyGrid(world, 0.135, 71.0,
      void_suppression * (0.014 + filament * 0.27), 0.095, pixel_world);

    vec3 web_light = vec3(0.095, 0.086, 0.115) * pow(filament, 3.15) * 0.28;
    web_light += vec3(0.29, 0.22, 0.15) * pow(knots, 3.0) * 0.31;
    float encounter = lunaliskEncounter();
    web_light += mix(vec3(0.27, 0.17, 0.72), vec3(1.18, 0.70, 0.32), encounter) *
      resident.y * (0.025 + encounter * 0.16);
    vec3 light = web_light + clusters.rgb + galaxies.rgb + distant.rgb;
    float coverage = max(max(clusters.a, galaxies.a), max(distant.a, occupied * 0.27));
    return vec4(light, coverage);
  }

  vec4 farLayer(vec2 world, float pixel_world) {
    vec3 matter = matterField(world, 23.0, 2.28);
    vec3 bubble = feedbackBubble(world, 29.0, 0.82, pixel_world);
    vec4 resident = lunaliskField(world, pixel_world);
    float cloud = matter.x * (1.0 - bubble.x * 0.88) * (1.0 - resident.x * 0.86);
    float wall = clamp(matter.y * 0.82 + bubble.y * 0.76 + resident.y * 0.36, 0.0, 1.0);
    float transmission = 1.0 - pow(cloud, 0.58) * 0.76;

    vec4 stars = starGrid(world, 0.051, 31.0,
      cloud * 0.88 + wall * 0.28, 0.016, 0.61, pixel_world);
    vec4 embedded = starGrid(world, 0.021, 47.0,
      cloud * 0.35 + wall * 0.44, 0.010, 0.19, pixel_world);
    stars.rgb *= 0.34 + transmission * 0.66;

    vec3 volume = vec3(0.036, 0.033, 0.052) * pow(cloud, 1.34) * 0.38;
    volume += vec3(0.105, 0.086, 0.125) * pow(matter.y, 1.92) * 0.24;
    volume += mix(vec3(0.20, 0.115, 0.065), vec3(0.105, 0.145, 0.22), bubble.z) *
      pow(bubble.y, 1.78) * 0.13;
    volume += vec3(0.36, 0.11, 0.034) * embedded.rgb.r * cloud * 0.055;
    float encounter = lunaliskEncounter();
    vec3 resident_light = mix(vec3(0.26, 0.16, 0.72), vec3(1.18, 0.66, 0.30), encounter) *
      resident.y * (0.004 + encounter * 0.012);
    vec3 light = volume + stars.rgb + embedded.rgb + resident_light;
    float coverage = max(max(stars.a, embedded.a), max(cloud * 0.40 + wall * 0.26, resident.y * encounter * 0.36));
    return vec4(light, coverage);
  }

  vec4 midLayer(vec2 world, float pixel_world) {
    vec3 matter = matterField(world, 53.0, 3.36);
    vec3 bubble = feedbackBubble(world, 59.0, 0.48, pixel_world);
    vec4 resident = lunaliskField(world, pixel_world);
    float cloud = matter.x * (1.0 - bubble.x * 0.91) * (1.0 - resident.x * 0.90);
    float wall = clamp(matter.y * 0.74 + bubble.y * 0.92 + resident.y * 0.28, 0.0, 1.0);
    float transmission = 1.0 - pow(cloud, 0.62) * 0.81;

    vec4 stars = starGrid(world, 0.071, 61.0,
      cloud * 0.91 + wall * 0.34, 0.018, 0.88, pixel_world);
    vec4 companions = starGrid(world, 0.028, 83.0,
      cloud * 0.21 + wall * 0.52, 0.010, 0.23, pixel_world);
    stars.rgb *= 0.27 + transmission * 0.73;

    vec4 remnants = remnantEmitter(world, vec2(0.78, 0.27), 0.112, 0.39,
      0.00105, vec3(1.18, 0.42, 0.18), 0.62, 2.4);
    remnants = addLight(remnants, remnantEmitter(world, vec2(0.20, 0.73), 0.071, -0.31,
      0.00072, vec3(0.26, 0.70, 1.38), 0.31, 5.7));

    vec3 volume = vec3(0.041, 0.038, 0.058) * pow(cloud, 1.48) * 0.34;
    volume += vec3(0.13, 0.092, 0.12) * pow(matter.y, 1.96) * 0.22;
    volume += mix(vec3(0.245, 0.125, 0.060), vec3(0.085, 0.165, 0.235), bubble.z) *
      pow(bubble.y, 1.92) * 0.14;
    float encounter = lunaliskEncounter();
    vec3 resident_light = vec3(0.31, 0.56, 1.32) * resident.y * (0.004 + encounter * 0.032);
    resident_light += vec3(1.34, 1.10, 0.76) * resident.z * (0.007 + encounter * 0.13);
    vec3 light = volume + stars.rgb + companions.rgb + remnants.rgb + resident_light;
    float coverage = max(max(stars.a, companions.a),
      max(remnants.a, max(cloud * 0.34 + wall * 0.28, max(resident.y, resident.z) * encounter * 0.48)));
    return vec4(light, coverage);
  }

  vec3 detailMatterHierarchy(vec2 world) {
    float continuous_lod = min(16.0, max(0.0, log2(max(1.0, u_observer.z))));
    float lod = floor(continuous_lod);
    float phase = smoothstep(0.14, 0.94, fract(continuous_lod));
    float current_scale = 4.3 * exp2(lod);
    vec3 current = matterField(world, 127.0 + lod * 19.0, current_scale);
    vec3 next = matterField(world, 127.0 + (lod + 1.0) * 19.0, current_scale * 2.0);
    return mix(current, next, phase);
  }

  vec4 microHierarchy(vec2 world, float pixel_world, vec3 matter) {
    float continuous_lod = min(16.0, max(0.0, log2(max(1.0, u_observer.z))));
    float lod = floor(continuous_lod);
    float phase = smoothstep(0.28, 0.96, fract(continuous_lod));
    float cell = 0.018 * exp2(-lod);
    float density = matter.x * 0.68 + matter.y * 0.27;
    vec4 current = starGrid(world, cell, 131.0 + lod * 23.0,
      density, 0.0105, 0.29 * (1.0 - phase), pixel_world);
    vec4 next = starGrid(world, cell * 0.5, 131.0 + (lod + 1.0) * 23.0,
      density, 0.0105, 0.29 * phase, pixel_world);
    return vec4(current.rgb + next.rgb, max(current.a, next.a));
  }

  vec4 nearLayer(vec2 world, float pixel_world) {
    vec3 matter = matterField(world, 89.0, 4.28);
    vec3 bubble = feedbackBubble(world, 97.0, 0.31, pixel_world);
    vec4 resident = lunaliskField(world, pixel_world);
    float cloud = matter.x * (1.0 - bubble.x * 0.94) * (1.0 - resident.x * 0.95);
    float wall = clamp(matter.y * 0.68 + bubble.y + resident.y * 0.24, 0.0, 1.0);
    float transmission = 1.0 - pow(cloud, 0.57) * 0.84;

    vec4 stars = starGrid(world, 0.103, 101.0,
      cloud * 0.91 + wall * 0.39, 0.018, 1.10, pixel_world);
    vec4 companions = starGrid(world, 0.039, 113.0,
      cloud * 0.19 + wall * 0.53, 0.010, 0.28, pixel_world);
    float micro_visibility = smoothstep(1.0, 3.4, log2(max(1.0, u_observer.z)));
    vec4 micro = vec4(0.0);
    if (micro_visibility > 0.001) {
      vec3 detail_matter = detailMatterHierarchy(world);
      micro = microHierarchy(world, pixel_world, detail_matter);
    }
    stars.rgb *= 0.22 + transmission * 0.78;
    companions.rgb *= 0.36 + transmission * 0.64;

    vec3 volume = vec3(0.036, 0.032, 0.049) * pow(cloud, 1.58) * 0.30;
    volume += vec3(0.12, 0.083, 0.112) * pow(matter.y, 2.0) * 0.19;
    volume += mix(vec3(0.25, 0.135, 0.064), vec3(0.080, 0.17, 0.24), bubble.z) *
      pow(bubble.y, 2.0) * 0.12;
    float encounter = lunaliskEncounter();
    vec3 resident_light = vec3(0.30, 0.48, 1.28) * resident.y * (0.002 + encounter * 0.007);
    resident_light += vec3(1.42, 1.18, 0.84) * resident.z * (0.006 + encounter * 0.21);
    resident_light += vec3(0.30, 0.92, 1.46) * resident.w * (0.006 + encounter * 0.82);
    resident_light += vec3(1.12, 0.24, 0.72) * resident.w * encounter * 0.22;

    vec3 light = volume + stars.rgb + companions.rgb +
      micro.rgb * (0.36 + transmission * 0.64) * micro_visibility + resident_light;
    float coverage = max(max(max(stars.a, companions.a), micro.a * micro_visibility),
      max(cloud * 0.30 + wall * 0.24, max(max(resident.y, resident.z), resident.w) * encounter * 0.72));
    return vec4(light, coverage);
  }

  vec4 deepLayer(vec2 world, float pixel_world) {
    vec3 matter = detailMatterHierarchy(world);
    float continuous_lod = min(16.0, max(0.0, log2(max(1.0, u_observer.z))));
    float lod = floor(continuous_lod);
    float cell = 0.094 * exp2(-lod);
    vec3 bubble = feedbackBubble(world, 173.0 + lod * 17.0, cell, pixel_world);
    vec4 resident = lunaliskField(world, pixel_world);
    float cloud = matter.x * (1.0 - bubble.x * 0.94) * (1.0 - resident.x * 0.96);
    float wall = clamp(matter.y * 0.78 + bubble.y, 0.0, 1.0);
    vec4 stars = microHierarchy(world, pixel_world, matter);
    vec4 knots = starGrid(world, cell * 0.31, 181.0 + lod * 29.0,
      cloud * 0.22 + wall * 0.71, 0.010, 0.21, pixel_world);
    float transmission = 1.0 - pow(cloud, 0.59) * 0.88;
    vec3 volume = vec3(0.031, 0.028, 0.043) * pow(cloud, 1.64) * 0.28;
    volume += vec3(0.105, 0.076, 0.105) * pow(matter.y, 2.04) * 0.17;
    volume += mix(vec3(0.25, 0.13, 0.055), vec3(0.075, 0.16, 0.22), bubble.z) *
      pow(bubble.y, 2.04) * 0.12;
    float encounter = lunaliskEncounter();
    vec3 phase_evidence = vec3(0.56, 0.82, 1.24) * resident.w * (0.003 + encounter * 0.16);
    phase_evidence += vec3(1.14, 0.48, 0.70) * resident.w * encounter * 0.055;
    vec3 light = volume + stars.rgb * (0.24 + transmission * 0.76) + knots.rgb + phase_evidence;
    float coverage = max(max(stars.a, knots.a), max(cloud * 0.28 + wall * 0.26, resident.w * encounter * 0.80));
    return vec4(light, coverage);
  }

  vec4 sceneAt(float spectral_index, float influence, float radius) {
    float pixel_world = max(u_inv_min_dimension / max(u_observer.z, 0.000001), 0.0000000002);
    float log_zoom = log2(max(u_observer.z, 0.015625));
    float cosmic_in = smoothstep(-4.85, -3.05, log_zoom);
    float regional_in = smoothstep(-1.82, -0.18, log_zoom);
    float deep_in = smoothstep(4.15, 5.85, log_zoom);
    float ultra_weight = 1.0 - cosmic_in;
    float cosmic_weight = cosmic_in * (1.0 - regional_in);
    float regional_weight = regional_in * (1.0 - deep_in);
    float deep_weight = deep_in;
    vec4 result = vec4(0.0);

    #if defined(GW_ULTRA)
    if (ultra_weight > 0.001) {
      vec2 ultra_world = worldFromScreen(lensedScreen(0.97, spectral_index, influence, radius), 0.94);
      vec4 ultra = ultraLayer(ultra_world, pixel_world);
      result = vec4(result.rgb + ultra.rgb * ultra_weight, max(result.a, ultra.a * ultra_weight));
    }
    #endif
    #if defined(GW_COSMIC)
    if (cosmic_weight > 0.001) {
      vec2 cosmic_world = worldFromScreen(lensedScreen(0.94, spectral_index, influence, radius), 0.88);
      vec4 cosmic = cosmicLayer(cosmic_world, pixel_world);
      result = vec4(result.rgb + cosmic.rgb * cosmic_weight, max(result.a, cosmic.a * cosmic_weight));
    }
    #endif
    #if defined(GW_REGIONAL)
    if (regional_weight > 0.001) {
      vec2 far_world = worldFromScreen(lensedScreen(1.0, spectral_index, influence, radius), 1.0);
      vec2 mid_world = worldFromScreen(lensedScreen(0.78, spectral_index, influence, radius), 0.58);
      vec2 near_world = worldFromScreen(lensedScreen(0.52, spectral_index, influence, radius), 0.18);
      vec4 far_field = farLayer(far_world, pixel_world);
      vec4 mid_field = midLayer(mid_world, pixel_world);
      vec4 near_field = nearLayer(near_world, pixel_world);
      vec3 regional_light = far_field.rgb + mid_field.rgb + near_field.rgb;
      float regional_coverage = max(far_field.a, max(mid_field.a, near_field.a));
      result = vec4(result.rgb + regional_light * regional_weight,
        max(result.a, regional_coverage * regional_weight));
    }
    #endif
    #if defined(GW_DEEP)
    if (deep_weight > 0.001) {
      vec2 deep_world = worldFromScreen(lensedScreen(0.42, spectral_index, influence, radius), 0.10);
      vec4 deep_field = deepLayer(deep_world, pixel_world);
      result = vec4(result.rgb + deep_field.rgb * deep_weight,
        max(result.a, deep_field.a * deep_weight));
    }
    #endif
    return result;
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

    // The default observation stays materially grounded. Strong color is not a
    // universal beauty filter; the lens earns permission to disclose more of
    // the spectral separation near an active encounter.
    float resting_luma = dot(radiance, vec3(0.2126, 0.7152, 0.0722));
    vec3 neutral_radiance = vec3(resting_luma) * vec3(1.025, 1.0, 0.972);
    float chroma_permission = mix(0.62, 0.96, influence);
    radiance = mix(neutral_radiance, radiance, chroma_permission);

    vec3 display_color = pow(applyToneMap(max(radiance, vec3(0.0))), vec3(1.0 / 2.2));
    // This instrument observes an opaque black universe. Coverage still informs
    // gravitationally borrowed light above, but it must not dim unrelated radiance.
    gl_FragColor = vec4(display_color, 1.0);
  }
`;

type ShaderRegime =
  | "ultra"
  | "ultra-cosmic"
  | "cosmic"
  | "cosmic-regional"
  | "regional"
  | "regional-deep"
  | "deep";

type ProgramBundle = {
  program: WebGLProgram;
  locations: Record<string, WebGLUniformLocation | number>;
};

const REGIME_DEFINES: Record<ShaderRegime, string[]> = {
  ultra: ["GW_ULTRA"],
  "ultra-cosmic": ["GW_ULTRA", "GW_COSMIC"],
  cosmic: ["GW_COSMIC"],
  "cosmic-regional": ["GW_COSMIC", "GW_REGIONAL"],
  regional: ["GW_REGIONAL"],
  "regional-deep": ["GW_REGIONAL", "GW_DEEP"],
  deep: ["GW_DEEP"],
};

function regimeForZoom(zoom: number): ShaderRegime {
  const logZoom = Math.log2(Math.max(zoom, 0.015625));
  if (logZoom < -4.85) return "ultra";
  if (logZoom <= -3.05) return "ultra-cosmic";
  if (logZoom < -1.82) return "cosmic";
  if (logZoom <= -0.18) return "cosmic-regional";
  if (logZoom < 4.15) return "regional";
  if (logZoom <= 5.85) return "regional-deep";
  return "deep";
}

function fragmentShaderForRegime(regime: ShaderRegime) {
  const defines = REGIME_DEFINES[regime].map((name) => `#define ${name} 1`).join("\n");
  return `${defines}\n${FRAGMENT_SHADER}`;
}

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
  private readonly buffer: WebGLBuffer;
  private readonly programs = new Map<ShaderRegime, ProgramBundle>();
  private outputKey = "";

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
    // The home aperture compiles first. More distant/deeper scale laws compile
    // only when the observer crosses into them, so a first touch does not pay
    // for every possible universe before it can answer.
    this.programs.set("regional", this.createProgramBundle("regional"));
    gl.clearColor(0, 0, 0, 0);
  }

  private createProgramBundle(regime: ShaderRegime): ProgramBundle {
    const { gl } = this;
    const program = createProgram(gl, VERTEX_SHADER, fragmentShaderForRegime(regime));
    const uniform = (name: string) => {
      const location = gl.getUniformLocation(program, name);
      if (location === null) throw new Error(`Missing shader uniform ${name}.`);
      return location;
    };
    const position = gl.getAttribLocation(program, "a_position");
    if (position < 0) throw new Error("Missing shader position attribute.");
    return {
      program,
      locations: {
        position,
        pointer: uniform("u_pointer"), motion: uniform("u_motion"), strength: uniform("u_strength"),
        time: uniform("u_time"), aspect: uniform("u_aspect"), invMin: uniform("u_inv_min_dimension"),
        viewOrigin: uniform("u_view_origin"),
        viewScale: uniform("u_view_scale"), observer: uniform("u_observer"), exposure: uniform("u_exposure"),
        spectral: uniform("u_spectral"), toneMap: uniform("u_tone_map"), seed: uniform("u_seed"),
      },
    };
  }

  private programForZoom(zoom: number) {
    const regime = regimeForZoom(zoom);
    let bundle = this.programs.get(regime);
    if (!bundle) {
      bundle = this.createProgramBundle(regime);
      this.programs.set(regime, bundle);
    }
    return bundle;
  }

  compileScaleRegimesForTest() {
    const probes = [0.015625, 0.05, 0.125, 0.4, 1, 24, 128];
    for (const zoom of probes) this.programForZoom(zoom);
    return [...this.programs.keys()];
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
    const { program, locations } = this.programForZoom(observer.zoom);
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(locations.position as number);
    gl.vertexAttribPointer(locations.position as number, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(locations.pointer as WebGLUniformLocation, state.pointer.x, state.pointer.y);
    gl.uniform2f(locations.motion as WebGLUniformLocation, state.motion.x, state.motion.y);
    gl.uniform1f(locations.strength as WebGLUniformLocation, state.strength);
    gl.uniform1f(locations.time as WebGLUniformLocation, state.time);
    gl.uniform1f(locations.aspect as WebGLUniformLocation, state.fullWidth / Math.max(1, state.fullHeight));
    gl.uniform1f(locations.invMin as WebGLUniformLocation, 1 / Math.max(1, Math.min(state.fullWidth, state.fullHeight)));
    gl.uniform2f(locations.viewOrigin as WebGLUniformLocation, origin.x, origin.y);
    gl.uniform2f(locations.viewScale as WebGLUniformLocation, scale.x, scale.y);
    gl.uniform3f(locations.observer as WebGLUniformLocation, observer.center.x, observer.center.y, observer.zoom);
    gl.uniform1f(locations.exposure as WebGLUniformLocation, radiance.exposure);
    gl.uniform1f(locations.spectral as WebGLUniformLocation, radiance.spectral);
    gl.uniform1f(locations.toneMap as WebGLUniformLocation, toneMap);
    gl.uniform1f(locations.seed as WebGLUniformLocation, state.seed ?? 0x6c756e61);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  destroy() {
    this.gl.deleteBuffer(this.buffer);
    for (const { program } of this.programs.values()) this.gl.deleteProgram(program);
    this.programs.clear();
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
