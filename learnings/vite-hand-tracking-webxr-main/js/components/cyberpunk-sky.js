// Cyberpunk sky component with animated gradient
export const cyberpunkSkyComponent = {
  schema: {
    topColor: { type: 'color', default: '#000033' },
    horizonColor: { type: 'color', default: '#660066' },
    bottomColor: { type: 'color', default: '#000066' },
    offset: { type: 'number', default: 0 },
    exponent: { type: 'number', default: 0.6 },
  },

  init: function () {
    const data = this.data
    
    // Create sky geometry
    this.geometry = new THREE.SphereGeometry(500, 32, 32)
    
    // Create gradient shader material
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(data.topColor) },
        horizonColor: { value: new THREE.Color(data.horizonColor) },
        bottomColor: { value: new THREE.Color(data.bottomColor) },
        offset: { value: data.offset },
        exponent: { value: data.exponent },
        time: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        uniform float time;
        
        varying vec3 vWorldPosition;
        
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          
          vec3 color;
          if (h > 0.0) {
            // Above horizon - blend from horizon to top
            float factor = pow(h, exponent);
            color = mix(horizonColor, topColor, factor);
          } else {
            // Below horizon - blend from horizon to bottom
            float factor = pow(-h, exponent);
            color = mix(horizonColor, bottomColor, factor);
          }
          
          // Add subtle animated glow
          float glow = sin(time * 0.5 + h * 3.14159) * 0.05 + 0.95;
          color *= glow;
          
          // Add distant city lights effect on horizon
          float horizonGlow = 1.0 - abs(h);
          horizonGlow = pow(horizonGlow, 8.0);
          vec3 cityLights = vec3(1.0, 0.5, 0.8);
          color += cityLights * horizonGlow * 0.3 * (sin(time * 2.0) * 0.3 + 0.7);
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
    })
    
    // Create mesh
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.el.setObject3D('mesh', this.mesh)
  },

  update: function (oldData) {
    const data = this.data
    
    if (oldData.topColor !== data.topColor) {
      this.material.uniforms.topColor.value = new THREE.Color(data.topColor)
    }
    if (oldData.horizonColor !== data.horizonColor) {
      this.material.uniforms.horizonColor.value = new THREE.Color(data.horizonColor)
    }
    if (oldData.bottomColor !== data.bottomColor) {
      this.material.uniforms.bottomColor.value = new THREE.Color(data.bottomColor)
    }
    if (oldData.offset !== data.offset) {
      this.material.uniforms.offset.value = data.offset
    }
    if (oldData.exponent !== data.exponent) {
      this.material.uniforms.exponent.value = data.exponent
    }
  },

  tick: function (time) {
    if (this.material && this.material.uniforms) {
      this.material.uniforms.time.value = time * 0.001
    }
  },

  remove: function () {
    if (this.mesh) {
      this.el.removeObject3D('mesh')
    }
  },
}