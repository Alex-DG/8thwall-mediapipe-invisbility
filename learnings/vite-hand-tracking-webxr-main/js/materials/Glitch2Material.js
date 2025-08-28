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

// Random function from Shadertoy
float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
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

void main() {
  vec2 uv = vUv;
  
  // === Shadertoy Glitch Effect ===
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
  
  // Sample each color channel with different offsets and apply chroma key
  vec4 texR = texture2D(tDiffuse, uv + uv1 * i);
  vec4 texG = texture2D(tDiffuse, uv + uv2 * i);
  vec4 texB = texture2D(tDiffuse, uv + uv3 * i);
  
  // Apply chroma key to center sample for alpha
  vec4 texColor = texture2D(tDiffuse, uv);
  texColor = chromaKey(texColor, keyColor);
  
  // Apply chroma key to each channel
  texR = chromaKey(texR, keyColor);
  texG = chromaKey(texG, keyColor);
  texB = chromaKey(texB, keyColor);
  
  // Combine RGB channels from different samples
  vec3 color = vec3(texR.r, texG.g, texB.b);
  
  // Color grading
  color = saturate(color);
  color = pow(color, vec3(0.8)); // Gamma correction
  color = mix(vec3(0.1), vec3(0.9), color); // Contrast adjustment
  
  // === Edge Fading for Oval Shape ===
  // Calculate distance from center for circular/oval geometry
  vec2 center = vec2(0.5, 0.5);
  vec2 fromCenter = uv - center;
  
  // Create oval shape by scaling if needed
  // Adjust these values to control oval shape
  fromCenter.x *= 1.0; // Width scaling
  fromCenter.y *= 1.0; // Height scaling
  
  float distFromCenter = length(fromCenter);
  
  // Create smooth edge fade using uniforms
  float edgeFade = 1.0 - smoothstep(edgeInnerRadius, edgeOuterRadius, distFromCenter);
  
  // Apply a power curve for smoother falloff
  edgeFade = pow(edgeFade, edgeFadePower);
  
  // Combine edge fade with chroma key alpha
  float finalAlpha = texColor.a * edgeFade;
  
  // Discard fully transparent pixels for performance
  if (finalAlpha < 0.01) {
    discard;
  }
  
  // Output with combined alpha
  gl_FragColor = vec4(saturate(color), finalAlpha);
}
`

export class Glitch2Material extends THREE.ShaderMaterial {
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
