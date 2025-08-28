const VERTEX_SHADER = `
uniform float uTime;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 pos = position;
  pos.x += sin(pos.x * 5.0 + uTime * 3.0) * 0.04;
  pos.y += cos(pos.x * 1.0 + uTime * 1.0) * 0.1;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( pos, 1.0 );
}
`
const FRAGMENT_SHADER = `
uniform sampler2D uTexture;
uniform sampler2D uDisplacement;
uniform float uTime;
uniform float uProgress;
uniform float uScale;
uniform float uOpacity;
uniform float uVignettePower; // Outer radius at which opacity falls to 0
uniform vec3 keyColor;
uniform float similarity;
uniform float smoothness;
uniform float spill;

varying vec2 vUv;
float PI = 3.141592653589793238;

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
  
  return color;
}

void main() {
  vec2 uv1 = vUv;
  // Distortion
  vec2 p = 2.0 * vUv - 2.0;
  p += 0.1 * cos(uScale * 3.7 * p.yx + 1.4 * uTime + vec2(2.2, 3.4));
  p += 0.1 * cos(uScale * 3.0 * p.yx + 1.0 * uTime + vec2(1.2, 3.4));
  p += 0.3 * cos(uScale * 5.0 * p.yx + 2.6 * uTime + vec2(4.2, 1.4));
  p += 0.3 * cos(uScale * 7.5 * p.yx + 3.6 * uTime + vec2(12.2, 3.4));
  uv1.x = mix(vUv.x, length(p), uProgress);
  uv1.y = mix(vUv.y, 0.5 * length(p) + 0.15, uProgress);
  // Ripple
  vec4 displacement = texture2D(uDisplacement, uv1);
  float theta = displacement.r * 2.0 * PI * uTime * 0.15;
  vec2 dir = vec2(sin(theta), cos(theta));
  vec2 uv2 = uv1 + dir * displacement.r * 0.5;
  vec4 color = texture2D(uTexture, uv2);
  
  // Apply chroma key to remove green background
  color = chromaKey(color, keyColor);
  
  // Vignette effect: Compute distance from center (0.5, 0.5)
  vec2 diff = vUv - vec2(0.5);
  // If you want an oval shape, you could scale diff.x (uncomment below if needed)
  diff.x *= 0.8;
  float dist = length(diff);
  // Compute vignette factor: 1.0 in the center, falling smoothly to 0 at uVignettePower
  float vignette = 1.0 - smoothstep(uVignettePower - 0.2, uVignettePower, dist);
  
  // Combine chroma key alpha with vignette
  float finalAlpha = color.a * uOpacity * vignette;
  
  // Discard fully transparent pixels for performance
  if (finalAlpha < 0.01) {
    discard;
  }
  
  gl_FragColor = vec4(color.rgb, finalAlpha);
}
`

export class RipplesMaterial extends THREE.ShaderMaterial {
  constructor(texture) {
    super({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0.02 },
        uScale: { value: 0.5 },
        uTexture: { value: texture },
        uDisplacement: { value: null },
        uOpacity: { value: 1 },
        uVignettePower: { value: 0.6 },
        keyColor: { value: new THREE.Color('#00ff00') },
        similarity: { value: 0.4 },
        smoothness: { value: 0.08 },
        spill: { value: 0.1 },
      },
      side: THREE.DoubleSide,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
    })
  }
}
