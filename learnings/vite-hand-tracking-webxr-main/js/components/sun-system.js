// Beautiful sun with glow, corona and lens flare effects
export const sunSystemComponent = {
  schema: {
    position: { type: 'vec3', default: { x: -15, y: 30, z: -40 } },
    coreSize: { type: 'number', default: 3 },
    glowSize: { type: 'number', default: 8 },
    coreColor: { type: 'color', default: '#FFFAF0' },
    glowColor: { type: 'color', default: '#FFD700' },
    intensity: { type: 'number', default: 1.5 },
    animated: { type: 'boolean', default: true }
  },

  init: function () {
    this.sunGroup = new THREE.Group()
    this.time = 0
    
    // Create sun core
    this.createSunCore()
    
    // Create glow effect
    this.createGlow()
    
    // Skip corona and lens flares for cleaner look
    // this.createCorona()
    // this.createLensFlares()
    
    // Position sun
    this.sunGroup.position.copy(this.data.position)
    this.el.object3D.add(this.sunGroup)
    
    // Add light source
    this.createSunLight()
  },

  createSunCore: function () {
    // Core geometry
    const coreGeometry = new THREE.SphereGeometry(this.data.coreSize, 32, 32)
    
    // Core shader material
    this.coreMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(this.data.coreColor) },
        intensity: { value: this.data.intensity },
        opacity: { value: 1.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewPosition;
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float intensity;
        uniform float opacity;
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewPosition;
        
        // Better noise function for sun surface
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        
        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i = floor(v + dot(v, C.yy));
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod289(i);
          vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m; m = m*m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
          vec3 g;
          g.x = a0.x * x0.x + h.x * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }
        
        void main() {
          vec2 uv = vUv;
          
          // Multiple layers of noise for realistic sun surface
          float n1 = snoise(uv * 4.0 + time * 0.05) * 0.5 + 0.5;
          float n2 = snoise(uv * 8.0 - time * 0.03) * 0.5 + 0.5;
          float n3 = snoise(uv * 16.0 + time * 0.08) * 0.5 + 0.5;
          float n4 = snoise(uv * 32.0 - time * 0.1) * 0.5 + 0.5;
          
          // Combine noises with different weights
          float surface = n1 * 0.5 + n2 * 0.25 + n3 * 0.15 + n4 * 0.1;
          
          // Create bright spots (solar granulation)
          float spots = pow(n3 * n4, 2.0);
          surface += spots * 0.3;
          
          // Edge darkening (limb darkening)
          float edgeFactor = 1.0 - pow(length(uv - 0.5) * 2.0, 2.0);
          surface *= edgeFactor;
          
          // Color variation from white-hot to yellow-orange
          vec3 hotColor = vec3(1.0, 0.95, 0.8);
          vec3 coolColor = vec3(1.0, 0.7, 0.3);
          vec3 surfaceColor = mix(coolColor, hotColor, surface);
          
          // Natural glow emanating from the surface
          vec3 viewDir = normalize(vViewPosition);
          float fresnel = pow(1.0 - dot(viewDir, vNormal), 1.5);
          
          // Add bloom-like glow to bright areas
          float bloom = pow(surface, 3.0) * 2.0;
          
          vec3 glowColor = vec3(1.0, 0.9, 0.7) * fresnel * 0.5;
          vec3 finalColor = surfaceColor * intensity + glowColor + bloom * hotColor;
          
          // Make the sun emit light
          finalColor = pow(finalColor, vec3(0.8)); // Slight tone mapping
          
          gl_FragColor = vec4(finalColor, opacity);
        }
      `,
      transparent: true,
      depthWrite: true
    })
    
    const core = new THREE.Mesh(coreGeometry, this.coreMaterial)
    this.sunGroup.add(core)
  },

  createGlow: function () {
    // Single tight glow layer that merges with sun surface
    const glowGeometry = new THREE.SphereGeometry(this.data.glowSize, 32, 32)
    
    // Glow shader material
    this.glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(this.data.glowColor) },
        intensity: { value: this.data.intensity },
        viewVector: { value: new THREE.Vector3() },
        opacity: { value: 1.0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPositionNormal;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float intensity;
        uniform float opacity;
        
        varying vec3 vNormal;
        varying vec3 vPositionNormal;
        
        void main() {
          // Ultra-tight atmospheric glow that merges with sun surface
          float rim = 1.0 - abs(dot(vPositionNormal, vNormal));
          rim = pow(rim, 12.0); // Even steeper falloff for seamless merge
          
          // Very subtle pulsing
          float pulse = 1.0 + sin(time * 1.5) * 0.015;
          
          // Soft warm glow that matches surface colors
          vec3 glowColor = vec3(1.0, 0.88, 0.7);
          
          vec3 finalColor = glowColor * intensity * pulse * 0.6;
          float alpha = rim * 0.3 * opacity; // Apply opacity uniform
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide
    })
    
    const glow = new THREE.Mesh(glowGeometry, this.glowMaterial)
    this.sunGroup.add(glow)
  },


  createLensFlares: function () {
    // Create lens flare sprites
    const flareGroup = new THREE.Group()
    
    const flarePositions = [0.3, 0.5, 0.7, 1.0, 1.3]
    const flareSizes = [0.5, 0.3, 0.4, 0.6, 0.2]
    const flareColors = ['#FFFFFF', '#FFE4B5', '#FFD700', '#FFA500', '#FF6347']
    
    flarePositions.forEach((pos, i) => {
      const flareGeometry = new THREE.PlaneGeometry(
        this.data.coreSize * flareSizes[i], 
        this.data.coreSize * flareSizes[i]
      )
      
      const flareMaterial = new THREE.MeshBasicMaterial({
        color: flareColors[i],
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
      
      const flare = new THREE.Mesh(flareGeometry, flareMaterial)
      flare.position.z = -pos * 10 // Position along camera direction
      flare.userData.offset = pos
      
      flareGroup.add(flare)
    })
    
    this.lensFlares = flareGroup
    this.el.object3D.add(flareGroup)
  },

  createSunLight: function () {
    // Add directional light from sun position
    const sunLight = document.createElement('a-entity')
    sunLight.setAttribute('light', {
      type: 'directional',
      color: this.data.glowColor,
      intensity: 0.3,
      castShadow: true
    })
    sunLight.setAttribute('position', this.data.position)
    this.el.sceneEl.appendChild(sunLight)
    this.sunLight = sunLight
  },

  tick: function (_, deltaTime) {
    if (!this.data.animated) return
    
    this.time += deltaTime * 0.001
    
    // Update shader uniforms
    if (this.coreMaterial) {
      this.coreMaterial.uniforms.time.value = this.time
    }
    if (this.glowMaterial) {
      this.glowMaterial.uniforms.time.value = this.time
    }
    
    // Subtle alive motion - like the sun is breathing
    if (this.sunGroup) {
      // Very subtle scale pulsing
      const breathScale = 1.0 + Math.sin(this.time * 0.2) * 0.02 + Math.sin(this.time * 0.7) * 0.01
      this.sunGroup.scale.setScalar(breathScale)
      
      // Tiny position wobble to simulate atmospheric distortion
      const wobbleX = Math.sin(this.time * 0.3) * 0.1
      const wobbleY = Math.sin(this.time * 0.4 + 1.0) * 0.1
      this.sunGroup.position.x = this.data.position.x + wobbleX
      this.sunGroup.position.y = this.data.position.y + wobbleY
      
      // Slow rotation
      this.sunGroup.rotation.y += deltaTime * 0.00005
    }
    
    // Lens flares removed for cleaner look
  },

  remove: function () {
    if (this.sunGroup) {
      this.el.object3D.remove(this.sunGroup)
    }
    if (this.lensFlares) {
      this.el.object3D.remove(this.lensFlares)
    }
    if (this.sunLight) {
      this.sunLight.remove()
    }
  }
}