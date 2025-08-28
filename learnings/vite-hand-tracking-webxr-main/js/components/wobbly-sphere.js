// Perlin noise shader code
const noise = `
  // GLSL textureless classic 3D noise "cnoise",
  // with an RSL-style periodic variant "pnoise".
  // Author:  Stefan Gustavson (stefan.gustavson@liu.se)
  // Version: 2011-10-11
  //
  // Many thanks to Ian McEwan of Ashima Arts for the
  // ideas for permutation and gradient selection.
  //
  // Copyright (c) 2011 Stefan Gustavson. All rights reserved.
  // Distributed under the MIT license. See LICENSE file.
  // https://github.com/ashima/webgl-noise
  //

  vec3 mod289(vec3 x)
  {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec4 mod289(vec4 x)
  {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec4 permute(vec4 x)
  {
    return mod289(((x*34.0)+1.0)*x);
  }

  vec4 taylorInvSqrt(vec4 r)
  {
    return 1.79284291400159 - 0.85373472095314 * r;
  }

  vec3 fade(vec3 t) {
    return t*t*t*(t*(t*6.0-15.0)+10.0);
  }

  // Classic Perlin noise, periodic variant
  float pnoise(vec3 P, vec3 rep)
  {
    vec3 Pi0 = mod(floor(P), rep); // Integer part, modulo period
    vec3 Pi1 = mod(Pi0 + vec3(1.0), rep); // Integer part + 1, mod period
    Pi0 = mod289(Pi0);
    Pi1 = mod289(Pi1);
    vec3 Pf0 = fract(P); // Fractional part for interpolation
    vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;

    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);

    vec4 gx0 = ixy0 * (1.0 / 7.0);
    vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);

    vec4 gx1 = ixy1 * (1.0 / 7.0);
    vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);

    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x;
    g011 *= norm1.y;
    g101 *= norm1.z;
    g111 *= norm1.w;

    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);

    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
  }
`

const rotation = `
  mat3 rotation3dY(float angle) {
    float s = sin(angle);
    float c = cos(angle);

    return mat3(
      c, 0.0, -s,
      0.0, 1.0, 0.0,
      s, 0.0, c
    );
  }

  vec3 rotateY(vec3 v, float angle) {
    return rotation3dY(angle) * v;
  }
`

// Component for wobbly sphere shader effect
export const wobblySphereComponent = {
  schema: {
    radius: { type: 'number', default: 0.5 },
    speed: { type: 'number', default: 0.11 },
    noiseDensity: { type: 'number', default: 4.13 },
    noiseStrength: { type: 'number', default: 0.12 },
    frequency: { type: 'number', default: 10 },
    amplitude: { type: 'number', default: 0.8 },
    intensity: { type: 'number', default: 4.2 },
  },

  init: function () {
    // Create materials immediately
    this.createMaterials()
  },

  createMaterials: function () {
    const data = this.data

    // Create sphere geometry with radius from schema
    this.geometry = new THREE.SphereGeometry(data.radius, 128, 128)

    // Create wobbly shader material
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: data.speed },
        uNoiseDensity: { value: data.noiseDensity },
        uNoiseStrength: { value: data.noiseStrength },
        uFrequency: { value: data.frequency },
        uAmplitude: { value: data.amplitude },
        uIntensity: { value: data.intensity },
      },
      vertexShader: noise + rotation + `
        varying float vDistort;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;

        uniform float uTime;
        uniform float uSpeed;
        uniform float uNoiseDensity;
        uniform float uNoiseStrength;
        uniform float uFrequency;
        uniform float uAmplitude;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          
          float t = uTime * uSpeed;
          
          // Multi-layered noise for more complex distortion
          float distortion1 = pnoise((normal + t) * uNoiseDensity, vec3(10.0)) * uNoiseStrength;
          float distortion2 = pnoise((normal + t * 0.5) * uNoiseDensity * 2.0, vec3(10.0)) * uNoiseStrength * 0.5;
          float distortion = distortion1 + distortion2;

          vec3 pos = position + (normal * distortion);
          
          // Glitch displacement
          float glitchTime = floor(t * 8.0) / 8.0;
          float glitch = step(0.95, pnoise(vec3(glitchTime), vec3(1.0))) * 0.1;
          pos += normal * glitch;
          
          float angle = sin(uv.y * uFrequency + t) * uAmplitude;
          pos = rotateY(pos, angle);

          vDistort = distortion;
          vPosition = (modelMatrix * vec4(pos, 1.0)).xyz;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying float vDistort;
        varying vec3 vNormal;
        varying vec3 vPosition;

        uniform float uTime;
        uniform float uIntensity;

        // Bright cyberpunk color palette
        vec3 cyberpunkPalette(float t) {
          // Base brightness (never too dark)
          vec3 a = vec3(0.5, 0.5, 0.6);
          // Color variation strength
          vec3 b = vec3(0.5, 0.5, 0.4);
          // Frequency of color changes
          vec3 c = vec3(1.0, 1.0, 1.0);
          // Phase shift for each color channel
          vec3 d = vec3(0.0, 0.33, 0.67);
          
          return a + b * cos(6.28318 * (c * t + d));
        }
        
        // Digital rain effect
        float digitalRain(vec2 uv, float time) {
          float speed = 0.5;
          float y = fract(uv.y * 10.0 + time * speed);
          return step(0.98, y) * step(y, 0.99);
        }
        
        // Hexagonal pattern
        float hexPattern(vec2 p) {
          vec2 h = vec2(1.0, 1.732);
          vec2 a = mod(p, h) - h * 0.5;
          vec2 b = mod(p - h * 0.5, h) - h * 0.5;
          return min(dot(a, a), dot(b, b));
        }

        void main() {
          float distort = vDistort * uIntensity;
          
          // ONLY these three colors
          vec3 mintGreen = vec3(0.0, 1.0, 0.624);   // #00ff9f
          vec3 brightBlue = vec3(0.0, 0.722, 1.0);  // #00b8ff
          vec3 hotPink = vec3(1.0, 0.412, 0.706);   // #FF69B4
          
          // Create smooth animated transitions between the three colors
          float phase1 = distort * 4.0 + vPosition.x * 2.0 + uTime * 0.2;
          float phase2 = distort * 3.0 + vPosition.y * 2.5 + uTime * 0.3;
          float phase3 = distort * 5.0 + vPosition.z * 2.0 + uTime * 0.25;
          
          // Calculate mixing factors with smooth transitions
          float t1 = sin(phase1) * 0.5 + 0.5;
          float t2 = sin(phase2) * 0.5 + 0.5;
          float t3 = sin(phase3) * 0.5 + 0.5;
          
          // Create balanced three-way color blend
          vec3 color;
          if (t1 < 0.33) {
            // Mint green to bright blue
            color = mix(mintGreen, brightBlue, smoothstep(0.0, 0.33, t1));
          } else if (t1 < 0.66) {
            // Bright blue to hot pink
            color = mix(brightBlue, hotPink, smoothstep(0.33, 0.66, t1));
          } else {
            // Hot pink back to mint green
            color = mix(hotPink, mintGreen, smoothstep(0.66, 1.0, t1));
          }
          
          // Add second layer with different phase for more color variety
          vec3 color2;
          float shift = 0.4; // Phase shift for second layer
          float t2_shifted = mod(t2 + shift, 1.0);
          if (t2_shifted < 0.33) {
            color2 = mix(hotPink, mintGreen, smoothstep(0.0, 0.33, t2_shifted));
          } else if (t2_shifted < 0.66) {
            color2 = mix(mintGreen, brightBlue, smoothstep(0.33, 0.66, t2_shifted));
          } else {
            color2 = mix(brightBlue, hotPink, smoothstep(0.66, 1.0, t2_shifted));
          }
          
          // Blend the two color layers equally
          color = mix(color, color2, 0.5);
          
          // Add subtle shading based on normal direction
          float shading = dot(vNormal, normalize(vec3(1.0, 1.0, 0.5))) * 0.2 + 0.8;
          color *= shading;
          
          // Fresnel effect cycling through all three colors
          vec3 viewDirection = normalize(cameraPosition - vPosition);
          float fresnel = pow(1.0 - dot(viewDirection, vNormal), 2.0);
          float rimT = mod(uTime * 0.3 + vPosition.y, 1.0);
          vec3 rimColor;
          if (rimT < 0.33) {
            rimColor = mix(mintGreen, brightBlue, rimT * 3.0);
          } else if (rimT < 0.66) {
            rimColor = mix(brightBlue, hotPink, (rimT - 0.33) * 3.0);
          } else {
            rimColor = mix(hotPink, mintGreen, (rimT - 0.66) * 3.0);
          }
          color = mix(color, rimColor, fresnel * 0.3);
          
          // Holographic interference using all colors
          float interference = sin(vPosition.y * 30.0 + vPosition.x * 20.0 + uTime * 2.0) * 0.5 + 0.5;
          vec3 interferenceColor = mix(mix(mintGreen, brightBlue, interference), hotPink, sin(interference * 3.14) * 0.5 + 0.5);
          color = mix(color, interferenceColor, 0.2);
          
          // Energy pulsing
          float pulse = sin(uTime * 3.0) * 0.1 + 0.9;
          color *= pulse;
          
          // Scanline effect
          float scanline = sin(vUv.y * 200.0 + uTime * 10.0) * 0.04 + 1.0;
          color *= scanline;
          
          // Output with consistent brightness
          gl_FragColor = vec4(color * 1.2, 0.95);
        }
      `,
      side: THREE.DoubleSide,
    })

    // Create mesh
    this.mesh = new THREE.Mesh(this.geometry, this.material)

    // Remove any existing mesh
    const existingMesh = this.el.getObject3D('mesh')
    if (existingMesh) {
      this.el.removeObject3D('mesh')
    }

    this.el.setObject3D('mesh', this.mesh)
  },

  update: function (oldData) {
    const data = this.data

    // Only update if material exists
    if (!this.material || !this.material.uniforms) return

    if (oldData.speed !== data.speed) {
      this.material.uniforms.uSpeed.value = data.speed
    }
    if (oldData.noiseDensity !== data.noiseDensity) {
      this.material.uniforms.uNoiseDensity.value = data.noiseDensity
    }
    if (oldData.noiseStrength !== data.noiseStrength) {
      this.material.uniforms.uNoiseStrength.value = data.noiseStrength
    }
    if (oldData.frequency !== data.frequency) {
      this.material.uniforms.uFrequency.value = data.frequency
    }
    if (oldData.amplitude !== data.amplitude) {
      this.material.uniforms.uAmplitude.value = data.amplitude
    }
    if (oldData.intensity !== data.intensity) {
      this.material.uniforms.uIntensity.value = data.intensity
    }
    if (oldData.radius !== data.radius) {
      // Recreate geometry with new radius
      this.geometry = new THREE.SphereGeometry(data.radius, 64, 64)
      this.mesh.geometry = this.geometry
    }
  },

  tick: function (time) {
    // Update time uniform for animation
    if (this.material && this.material.uniforms) {
      this.material.uniforms.uTime.value = time * 0.001
    }
  },

  remove: function () {
    if (this.mesh) {
      this.el.removeObject3D('mesh')
    }
  },
}
