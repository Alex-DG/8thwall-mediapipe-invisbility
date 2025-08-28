const VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAGMENT_SHADER = `
uniform sampler2D tDiffuse;
uniform float time;
uniform vec2 resolution;
uniform vec3 keyColor;
uniform float similarity;
uniform float smoothness;
uniform float spill;
uniform float edgeInnerRadius;
uniform float edgeOuterRadius;
uniform float edgeFadePower;

varying vec2 vUv;

// Helper functions
float saturate(float v) {
  return clamp(v, 0.0, 1.0);
}

vec3 saturate(vec3 v) {
  return clamp(v, vec3(0.0), vec3(1.0));
}

// Random functions
float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

// Noise function
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float a = hash(i.x + i.y * 57.0);
  float b = hash(i.x + 1.0 + i.y * 57.0);
  float c = hash(i.x + (i.y + 1.0) * 57.0);
  float d = hash(i.x + 1.0 + (i.y + 1.0) * 57.0);
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Convert RGB to YUV color space for better chroma keying
vec2 RGBtoUV(vec3 rgb) {
  return vec2(
    rgb.r * -0.169 + rgb.g * -0.331 + rgb.b *  0.5    + 0.5,
    rgb.r *  0.5   + rgb.g * -0.419 + rgb.b * -0.081  + 0.5
  );
}

// Chroma key processing
vec4 chromaKey(vec4 color, vec3 keyCol) {
  float chromaDist = distance(RGBtoUV(color.rgb), RGBtoUV(keyCol));
  
  float baseMask = chromaDist - similarity;
  float fullMask = pow(clamp(baseMask / smoothness, 0.0, 1.0), 1.5);
  
  // Spill suppression
  float spillVal = pow(clamp(baseMask / spill, 0.0, 1.0), 1.5);
  float desat = clamp(color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722, 0.0, 1.0);
  color.rgb = mix(vec3(desat), color.rgb, spillVal);
  
  color.a = fullMask;
  
  // Hard cutoff for better keying
  if (color.a < 0.1) {
    discard;
  }
  
  return color;
}

// Vignette effect from GlitchMaterial
float vignette(vec2 uv) {
  float vignetteStrength = 0.5;
  float vignetteScale = 0.6;
  float vignetteExponent = 3.0;
  
  vec2 center = vec2(0.5);
  vec2 dist = (uv - center) * 2.0;
  dist.x *= resolution.x / resolution.y;
  
  float d = length(dist) / 1.414213562373;
  return mix(1.0, max(0.0, 1.0 - pow(d * vignetteScale, vignetteExponent)), vignetteStrength);
}

// Glitch displacement from GlitchMaterial
vec2 glitchDisplace(vec2 uv, float t) {
  float strength = 0.0;
  
  // Horizontal glitch lines
  float lineNoise = hash(floor(uv.y * 40.0) + floor(t * 10.0));
  if (lineNoise > 0.9) {
    strength = lineNoise * 0.03;
    uv.x += sin(t * 50.0) * strength;
  }
  
  // Periodic strong glitches
  float glitchPeriod = mod(t, 4.0);
  if (glitchPeriod < 0.1) {
    float wave = sin(uv.y * 20.0 + t * 30.0);
    uv.x += wave * 0.02;
    strength = 1.0;
  }
  
  return uv;
}

// RGB shift effect from GlitchMaterial
vec3 rgbShift(sampler2D tex, vec2 uv, float amount) {
  vec3 color;
  float offset = amount * 0.01;
  
  color.r = texture2D(tex, uv + vec2(offset, 0.0)).r;
  color.g = texture2D(tex, uv).g;
  color.b = texture2D(tex, uv - vec2(offset, -offset * 0.5)).b;
  
  return color;
}

void main() {
  vec2 uv = vUv;
  
  // === First Glitch Effect (from GlitchMaterial) ===
  vec2 glitchedUV = glitchDisplace(uv, time);
  float glitchAmount = step(0.9, noise(vec2(time * 0.2, 0.0)));
  
  // === Second Glitch Effect (from Glitch2Material) ===
  float s = (rand(uv.yy) / 32.0) * mod(floor(time * 16.0), 4.0);
  float r1 = rand(floor(uv.yy * 8.0) / 8.0);
  float r2 = rand(floor(uv.yy * 64.0) / 64.0);
  float g1 = rand(0.125 + floor(uv.yy * 8.0) / 8.0);
  float g2 = rand(0.125 + floor(uv.yy * 64.0) / 64.0);
  float b1 = rand(0.225 + floor(uv.yy * 8.0) / 8.0);
  float b2 = rand(0.225 + floor(uv.yy * 64.0) / 64.0);
  float t = rand(floor(r1 + r2 + uv.xx * 16.0) / 16.0) / 8.0;
  
  vec2 uv1 = vec2(r1 / 10.0 + r2 / 120.0, t + s + sin(uv.y * 150.0) / 150.0);
  vec2 uv2 = vec2(g1 / 7.0 - g2 / 80.0, t + s - cos(uv.y * 80.0) / 80.0);
  vec2 uv3 = vec2(b1 / 4.0 + b2 / 40.0, t + s + sin(uv.y * 120.0) / 120.0);
  
  float i = (rand(vec2(floor(time * 8.0))) * 2.0) - 1.0;
  i *= 0.25;
  
  // === Combine both glitch effects ===
  // Apply first glitch displacement to the second glitch UVs
  vec2 combinedUV1 = glitchedUV + uv1 * i;
  vec2 combinedUV2 = glitchedUV + uv2 * i;
  vec2 combinedUV3 = glitchedUV + uv3 * i;
  
  // Sample with combined effects and apply chroma key
  vec4 texR = chromaKey(texture2D(tDiffuse, combinedUV1), keyColor);
  vec4 texG = chromaKey(texture2D(tDiffuse, combinedUV2), keyColor);
  vec4 texB = chromaKey(texture2D(tDiffuse, combinedUV3), keyColor);
  
  // Apply chroma key to center sample for alpha
  vec4 texColor = chromaKey(texture2D(tDiffuse, glitchedUV), keyColor);
  
  // Combine RGB channels from different samples
  vec3 color = vec3(texR.r, texG.g, texB.b);
  
  // Apply additional RGB shift on glitch
  if (glitchAmount > 0.0) {
    color = rgbShift(tDiffuse, glitchedUV, 2.0);
  }
  
  // === Add extra effects ===
  // Scanlines
  float scanline = sin(uv.y * 800.0 + time * 10.0) * 0.04;
  color += scanline;
  
  // Digital noise
  vec3 digitalNoise = vec3(noise(uv * 100.0 + time * 10.0)) * 0.05;
  color += digitalNoise;
  
  // Color grading
  color = saturate(color);
  color = pow(color, vec3(0.8)); // Gamma correction
  color = mix(vec3(0.1), vec3(0.9), color); // Contrast adjustment
  
  // Apply vignette
  color *= vignette(uv);
  
  // Occasional color inversion
  float invertChance = step(0.98, noise(vec2(time * 0.1, 0.0)));
  if (invertChance > 0.0 && mod(time, 5.0) < 0.1) {
    color = vec3(1.0) - color;
  }
  
  // === Edge Fading for Oval Shape ===
  vec2 center = vec2(0.5, 0.5);
  vec2 fromCenter = uv - center;
  fromCenter.x *= 1.0;
  fromCenter.y *= 1.0;
  
  float distFromCenter = length(fromCenter);
  float edgeFade = 1.0 - smoothstep(edgeInnerRadius, edgeOuterRadius, distFromCenter);
  edgeFade = pow(edgeFade, edgeFadePower);
  
  // Combine edge fade with chroma key alpha
  float finalAlpha = texColor.a * edgeFade;
  
  // Discard fully transparent pixels
  if (finalAlpha < 0.01) {
    discard;
  }
  
  gl_FragColor = vec4(saturate(color), finalAlpha);
}
`

export class UltimateGlitchMaterial extends THREE.ShaderMaterial {
  constructor(options = {}) {
    const {
      texture = null,
      resolution = new THREE.Vector2(window.innerWidth, window.innerHeight),
      keyColor = '#00ff00',
      similarity = 0.4,
      smoothness = 0.08,
      spill = 0.1,
      edgeInnerRadius = 0.35,
      edgeOuterRadius = 0.5,
      edgeFadePower = 1.5,
    } = options

    super({
      uniforms: {
        tDiffuse: { value: texture },
        time: { value: 0 },
        resolution: { value: resolution },
        keyColor: { value: new THREE.Color(keyColor) },
        similarity: { value: similarity },
        smoothness: { value: smoothness },
        spill: { value: spill },
        edgeInnerRadius: { value: edgeInnerRadius },
        edgeOuterRadius: { value: edgeOuterRadius },
        edgeFadePower: { value: edgeFadePower },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    // Handle window resize
    this._resizeHandler = () => {
      this.uniforms.resolution.value.set(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', this._resizeHandler)
  }

  updateTime(time) {
    this.uniforms.time.value = time
  }

  setTexture(texture) {
    this.uniforms.tDiffuse.value = texture
    this.needsUpdate = true
  }

  dispose() {
    window.removeEventListener('resize', this._resizeHandler)
    super.dispose()
  }
}