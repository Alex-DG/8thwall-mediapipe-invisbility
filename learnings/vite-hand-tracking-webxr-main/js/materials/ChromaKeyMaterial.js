/**
 * THREE.JS ShaderMaterial that removes a specified color (e.g. greens screen)
 * from a texture. Shader code by https://github.com/Mugen87 on THREE.js forum:
 * https://discourse.threejs.org/t/production-ready-green-screen-with-three-js/23113/2
 */

// @see https://discourse.threejs.org/t/production-ready-green-screen-with-three-js/23113/2

/* Vertex Shader (same as before, just add a uniform for time if needed) */
const VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`

/* Fragment Shader with Glitch + Chroma Key */
// const FRAGMENT_SHADER0 = `
// uniform sampler2D tex;

// // Dimensions (not strictly required for glitch effect)
// uniform float texWidth;
// uniform float texHeight;

// // Chroma key uniforms
// uniform vec3 keyColor;
// uniform float similarity;
// uniform float smoothness;
// uniform float spill;

// // Glitch uniform
// uniform float uTime;

// varying vec2 vUv;

// // Convert RGB to UV space for color difference keying
// vec2 RGBtoUV(vec3 rgb) {
//   return vec2(
//     rgb.r * -0.169 + rgb.g * -0.331 + rgb.b *  0.5    + 0.5,
//     rgb.r *  0.5   + rgb.g * -0.419 + rgb.b * -0.081  + 0.5
//   );
// }

// // Perform the chroma key and spill suppression
// vec4 ProcessChromaKey(vec2 texCoord) {
//   vec4 rgba = texture2D(tex, texCoord);
//   float chromaDist = distance(RGBtoUV(rgba.rgb), RGBtoUV(keyColor));

//   float baseMask = chromaDist - similarity;
//   float fullMask = pow(clamp(baseMask / smoothness, 0.0, 1.0), 1.5);
//   rgba.a = fullMask;

//   // Hard-cut anything below alpha=0.9
//   if (rgba.a < 0.9) discard;

//   // Spill suppression
//   float spillVal = pow(clamp(baseMask / spill, 0.0, 1.0), 1.5);
//   float desat = clamp(rgba.r * 0.2126 + rgba.g * 0.7152 + rgba.b * 0.0722, 0.0, 1.0);
//   rgba.rgb = mix(vec3(desat), rgba.rgb, spillVal);

//   return rgba;
// }

// void main(void) {
//   // 1) Copy the original UV
//   vec2 glitchUv = vUv;

//   // 2) Add a "roll" so lines move vertically over time
//   //    - lineCount (40.0) = how many horizontal "bands"
//   //    - lineSpeed controls how fast lines move
//   //      (positive -> move upward, negative -> move downward)
//   float lineCount = 20.0;
//   float lineSpeed = 0.05;
//   float lineAmplitude = 0.01;
//   float lineFrequency = 10.0;
//   float roll = uTime * lineSpeed;

//   // 3) Determine which "band" we're in, using y + roll
//   float line = floor((glitchUv.y + roll) * lineCount);

//   // 4) Only glitch some lines. Every 5th line, for instance.
//   if (mod(line, 5.0) < 1.0) {
//     // The sine wave offset
//     // Increase amplitude (0.02) or frequency (10.0) for a stronger or faster glitch
//     float offset = lineAmplitude * sin(uTime * lineFrequency + line * 0.1);
//     glitchUv.x += offset;  // shift horizontally
//   }

//   // 5) Pass the glitched UV into the chroma key
//   gl_FragColor = ProcessChromaKey(glitchUv);
// }
// `

const FRAGMENT_SHADER = `
uniform sampler2D tex;

// Dimensions (not strictly required for glitch effect)
uniform float texWidth;
uniform float texHeight;

// Chroma key uniforms
uniform vec3 keyColor;
uniform float similarity;
uniform float smoothness;
uniform float spill;

// Glitch uniform
uniform float uTime;

varying vec2 vUv;

// Convert RGB to UV space for color difference keying
vec2 RGBtoUV(vec3 rgb) {
  return vec2(
    rgb.r * -0.169 + rgb.g * -0.331 + rgb.b *  0.5    + 0.5,
    rgb.r *  0.5   + rgb.g * -0.419 + rgb.b * -0.081  + 0.5
  );
}

// Perform the chroma key and spill suppression
vec4 ProcessChromaKey(vec2 texCoord) {
  vec4 rgba = texture2D(tex, texCoord);
  float chromaDist = distance(RGBtoUV(rgba.rgb), RGBtoUV(keyColor));

  float baseMask = chromaDist - similarity;
  float fullMask = pow(clamp(baseMask / smoothness, 0.0, 1.0), 1.5);
  rgba.a = fullMask;

  // Hard-cut anything below alpha=0.9
  if (rgba.a < 0.9) discard;

  // Spill suppression
  float spillVal = pow(clamp(baseMask / spill, 0.0, 1.0), 1.5);
  float desat = clamp(rgba.r * 0.2126 + rgba.g * 0.7152 + rgba.b * 0.0722, 0.0, 1.0);
  rgba.rgb = mix(vec3(desat), rgba.rgb, spillVal);

  return rgba;
}

void main(void) {
  // === Glitch Effect ===
  vec2 glitchUv = vUv;
  float lineCount = 60.0;
  float lineSpeed = 0.05;
  float lineAmplitude = 0.01;
  float lineFrequency = 10.0;
  float roll = uTime * lineSpeed;
  float line = floor((glitchUv.y + roll) * lineCount);
  if (mod(line, 5.0) < 1.0) {
    float offset = lineAmplitude * sin(uTime * lineFrequency + line * 0.1);
    glitchUv.x += offset;
  }
  
  // === Chroma Key Processing ===
  vec4 texColor = ProcessChromaKey(glitchUv);
  
  // === Wireframe Effect with Gradient Border ===
  float gridSize = 16.0;
  float lineThickness = 0.02;
  vec2 grid = fract(vUv * gridSize);
  float maskX = 1.0 - smoothstep(0.0, lineThickness, grid.x);
  float maskY = 1.0 - smoothstep(0.0, lineThickness, grid.y) / 1.4;
  float wireMask = max(maskX, maskY);
  
  // Create a gradient for the wireframe's background:
  // Sample the texture at the bottom to get a base color.
  vec4 bottomColor = texture2D(tex, vec2(vUv.x, 0.0));
  // Mix the bottom color with white – adjust the mix factor as needed.
  vec4 gradientColor = mix(bottomColor, vec4(1.0), 0.5);
  
  // Use a vertical gradient to blend between the wireframe and the texture.
  float blendFactor = smoothstep(0.0, 0.3, vUv.y);
  vec4 wireColor = gradientColor * wireMask;
  
  // Mix the wireframe (with gradient) with the chroma-keyed texture.
  vec4 finalColor = mix(wireColor, texColor, blendFactor);
  
  // === White Glowing Light Effect ===
  float glowSpeed = 0.2;  // Adjust speed of the glow
  float glowWidth = 0.1; // Adjust width of the glow line
  float glowPos = mod(uTime * glowSpeed, 1.0);
  float glowFactor = exp(-pow((vUv.x - glowPos) / glowWidth, 2.0));
  glowFactor *= wireMask;
  
  finalColor.rgb = mix(finalColor.rgb, vec3(1.0), glowFactor);
  
  gl_FragColor = finalColor;
}
`

// eslint-disable-next-line new-cap
class ChromaKeyMaterial extends THREE.ShaderMaterial {
  /**
   *
   * @param {string} url Image or video to load into material's texture
   * @param {ColorRepresentation} keyColor
   * @param {number} width
   * @param {number} height
   * @param {number} similarity
   * @param {number} smoothness
   * @param {number} spill
   */

  //  similarity: 0.05,
  //   smoothness: 0.3,
  //   spill: 0.4,
  //   offsetY: 0.7,
  //   amplitude: 0.1,
  //   frequency: 0.5,

  constructor(
    url,
    keyColor,
    width,
    height,
    similarity = 0.05,
    smoothness = 0.3,
    spill = 0.1
  ) {
    super({
      uniforms: {
        tex: { value: null },
        keyColor: { value: new THREE.Color('#00ff00') },
        texWidth: { value: width },
        texHeight: { value: height },
        similarity: { value: similarity },
        smoothness: { value: smoothness },
        spill: { value: spill },
        uTime: { value: 0 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      side: THREE.DoubleSide,
    })

    // this.setValues({
    //   uniforms: {
    //     tex: {
    //       value: this.texture,
    //     },
    //     keyColor: { value: chromaKeyColor },
    //     texWidth: { value: width },
    //     texHeight: { value: height },
    //     similarity: { value: similarity },
    //     smoothness: { value: smoothness },
    //     spill: { value: spill },
    //     uTime: { value: 0 },
    //   },
    //   vertexShader: VERTEX_SHADER,
    //   fragmentShader: FRAGMENT_SHADER,
    //   transparent: true,
    // })
  }
}

export { ChromaKeyMaterial }
