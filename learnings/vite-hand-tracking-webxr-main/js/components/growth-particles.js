// Growth particles component for grass growing animation
export const growthParticlesComponent = {
  schema: {
    count: { type: 'number', default: 500 },
    radius: { type: 'number', default: 5 },
    minHeight: { type: 'number', default: 0 },
    maxHeight: { type: 'number', default: 3 },
    particleSize: { type: 'number', default: 0.05 },
    duration: { type: 'number', default: 10000 }, // 8s delay + 2s growth
    delay: { type: 'number', default: 0 }, // start immediately
    speedY: { type: 'number', default: 1.0 }, // Y-axis speed multiplier
  },

  init: function () {
    this.particles = null
    this.startTime = null
    this.isActive = false
    this.targetOpacity = 0
    this.currentOpacity = 0
    this.fadeSpeed = 1.0 // fade in/out over 1 second
    this.createParticles()
  },

  createParticles: function () {
    const data = this.data
    const geometry = new THREE.BufferGeometry()

    // Create random positions
    const positions = new Float32Array(data.count * 3)
    const velocities = new Float32Array(data.count * 3)
    const delays = new Float32Array(data.count)
    const sizes = new Float32Array(data.count)

    for (let i = 0; i < data.count; i++) {
      // Random position within radius
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * data.radius

      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = Math.sin(angle) * radius

      // Random upward velocity with speedY multiplier
      velocities[i * 3] = (Math.random() - 0.5) * 0.2
      velocities[i * 3 + 1] = (0.3 + Math.random() * 0.7) * data.speedY
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2

      // Random start delay spread across full loop duration
      delays[i] = Math.random() * 12.0

      // Random sizes
      sizes[i] = data.particleSize * (0.25 + Math.random() * 0.25)
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3))
    geometry.setAttribute('delay', new THREE.BufferAttribute(delays, 1))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    // Create shader material
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        opacity: { value: 0 },
        color1: { value: new THREE.Color('hotpink') }, // Mint green
        color2: { value: new THREE.Color('yellow') }, // Light blue
      },
      vertexShader: `
        attribute vec3 velocity;
        attribute float delay;
        attribute float size;
        
        uniform float time;
        uniform vec3 color1;
        uniform vec3 color2;
        
        varying float vAlpha;
        varying vec3 vColor;
        
        void main() {
          // Loop particles every 6 seconds with offset based on delay (slower speed)
          float cycleTime = mod(time + delay, 6.0);
          vec3 pos = position + velocity * cycleTime;

          
          // Fade in quickly, fade out slowly
          vAlpha = smoothstep(0.0, 0.2, cycleTime) * smoothstep(6.0, 5.0, cycleTime);
          
          // Color variation using uniform colors
          vColor = mix(color1, color2, sin(delay * 3.14 + time * 0.5) * 0.5 + 0.5);
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float opacity;
        
        varying float vAlpha;
        varying vec3 vColor;
        
        void main() {
          float dist = distance(gl_PointCoord, vec2(0.5));
          float strength = 0.05 / dist - 0.1;
          
          // Apply fade factor
          float alpha = strength * opacity * vAlpha;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this.particles = new THREE.Points(geometry, material)
    this.el.setObject3D('particles', this.particles)

    // Start immediately but with 0 opacity
    this.startTime = Date.now()
    this.isActive = true
  },

  tick: function (time, deltaTime) {
    if (!this.particles || !this.isActive) return

    const material = this.particles.material
    const elapsed = Date.now() - this.startTime

    // Update time for particle movement (continuous)
    material.uniforms.time.value = elapsed * 0.001

    // Smooth opacity transition
    const dt = deltaTime * 0.001 // Convert to seconds
    if (this.currentOpacity < this.targetOpacity) {
      this.currentOpacity = Math.min(this.targetOpacity, this.currentOpacity + dt * this.fadeSpeed)
    } else if (this.currentOpacity > this.targetOpacity) {
      this.currentOpacity = Math.max(this.targetOpacity, this.currentOpacity - dt * this.fadeSpeed)
    }

    // Apply opacity with subtle pulsing when visible
    if (this.currentOpacity > 0) {
      const pulse = Math.sin(elapsed * 0.001) * 0.1 + 0.9 // Subtle pulse 0.8-1.0
      material.uniforms.opacity.value = this.currentOpacity * pulse
    } else {
      material.uniforms.opacity.value = 0
    }
  },

  show: function () {
    this.targetOpacity = 1.0
  },

  hide: function () {
    this.targetOpacity = 0
  },

  startAnimation: function () {
    // Reset and start particle animation
    this.startTime = Date.now()
    this.show()
    // Don't auto-hide - let particles continue animating like in WebXR scene
  },

  remove: function () {
    if (this.el.getObject3D('particles')) {
      this.el.removeObject3D('particles')
    }
  },
}
