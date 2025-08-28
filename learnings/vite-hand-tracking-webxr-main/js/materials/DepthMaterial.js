const VERTEX_SHADER = `
varying vec2 vUv;
uniform sampler2D depthTexture;
uniform float depthScale;
uniform float time;

void main() {
  vUv = uv;
  
  // Sample depth texture
  vec4 depth = texture2D(depthTexture, uv);
  
  // Use depth to displace vertices along normal
  vec3 newPosition = position;
  float displacement = depth.r * depthScale;
  
  // Add some subtle animation
  displacement *= 1.0 + sin(time * 2.0) * 0.1;
  
  // Displace along Z axis (toward camera)
  newPosition.z += displacement;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`

const FRAGMENT_SHADER = `
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform float time;
uniform vec3 keyColor;
uniform float similarity;
uniform float smoothness;
uniform float spill;
uniform float edgeInnerRadius;
uniform float edgeOuterRadius;
uniform float edgeFadePower;

varying vec2 vUv;

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
  
  // Sample textures
  vec4 color = texture2D(colorTexture, uv);
  vec4 depth = texture2D(depthTexture, uv);
  
  // Apply chroma key to remove green background
  color = chromaKey(color, keyColor);
  
  // Use depth to create subtle lighting effect
  float depthValue = depth.r;
  
  // Create a subtle rim light effect based on depth
  float rimLight = 1.0 - depthValue;
  rimLight = pow(rimLight, 2.0);
  
  // Add depth-based shading
  vec3 finalColor = color.rgb;
  finalColor *= 0.8 + depthValue * 0.4; // Darker in recessed areas
  finalColor += vec3(0.2, 0.3, 0.4) * rimLight * 0.3; // Subtle blue rim light
  
  // === Edge Fading for Oval Shape ===
  vec2 center = vec2(0.5, 0.5);
  vec2 fromCenter = uv - center;
  
  // Create oval shape
  fromCenter.x *= 1.0;
  fromCenter.y *= 1.0;
  
  float distFromCenter = length(fromCenter);
  
  // Create smooth edge fade
  float edgeFade = 1.0 - smoothstep(edgeInnerRadius, edgeOuterRadius, distFromCenter);
  edgeFade = pow(edgeFade, edgeFadePower);
  
  // Combine edge fade with chroma key alpha
  float finalAlpha = color.a * edgeFade;
  
  // Discard fully transparent pixels
  if (finalAlpha < 0.01) {
    discard;
  }
  
  gl_FragColor = vec4(finalColor, finalAlpha);
}
`

export class DepthMaterial extends THREE.ShaderMaterial {
  constructor(options = {}) {
    // Create placeholder textures if not provided
    const createPlaceholderTexture = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, 1, 1)
      return new THREE.CanvasTexture(canvas)
    }
    
    const {
      colorTexture = createPlaceholderTexture(),
      depthTexture = createPlaceholderTexture(),
      depthScale = 0.1,
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
        colorTexture: { value: colorTexture },
        depthTexture: { value: depthTexture },
        depthScale: { value: depthScale },
        time: { value: 0 },
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
      // Material doesn't need resolution updates for this effect
    }
    window.addEventListener('resize', this._resizeHandler)
  }

  updateTime(time) {
    this.uniforms.time.value = time
  }

  setColorTexture(texture) {
    this.uniforms.colorTexture.value = texture
    this.needsUpdate = true
  }

  setDepthTexture(texture) {
    this.uniforms.depthTexture.value = texture
    this.needsUpdate = true
  }

  dispose() {
    window.removeEventListener('resize', this._resizeHandler)
    super.dispose()
  }
}