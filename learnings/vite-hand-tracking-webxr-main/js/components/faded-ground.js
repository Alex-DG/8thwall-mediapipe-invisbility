// Faded ground component with smooth edge fade
export const fadedGroundComponent = {
  schema: {
    radius: { type: 'number', default: 12 },
    fadeStart: { type: 'number', default: 0.9 }, // Start fading at 70% of radius
    texture: { type: 'string', default: '' },
    repeat: { type: 'vec2', default: { x: 8, y: 8 } },
  },

  init: function () {
    const data = this.data

    // Create custom shader material
    const vertexShader = `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      
      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      uniform sampler2D map;
      uniform vec2 repeat;
      uniform float radius;
      uniform float fadeStart;
      
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      
      void main() {
        // Calculate distance from center in world space
        float dist = length(vWorldPosition.xz);
        
        // Calculate fade factor
        float fadeRange = radius * (1.0 - fadeStart);
        float fadeFactor = 1.0 - smoothstep(radius * fadeStart, radius, dist);
        
        // Sample texture with repeat
        vec2 tiledUv = vUv * repeat;
        vec4 texColor = texture2D(map, tiledUv);
        
        // Apply fade to alpha
        gl_FragColor = vec4(texColor.rgb, texColor.a * fadeFactor);
      }
    `

    // Load texture and create material
    const textureLoader = new THREE.TextureLoader()
    const texture = textureLoader.load(data.texture || '/textures/ground.png')
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping

    const material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture },
        repeat: { value: new THREE.Vector2(data.repeat.x, data.repeat.y) },
        radius: { value: data.radius },
        fadeStart: { value: data.fadeStart },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
    })

    // Apply to mesh
    this.el.getObject3D('mesh').material = material
  },

  update: function (oldData) {
    if (!this.el.getObject3D('mesh')) return

    const material = this.el.getObject3D('mesh').material
    if (material && material.uniforms) {
      material.uniforms.radius.value = this.data.radius
      material.uniforms.fadeStart.value = this.data.fadeStart
      material.uniforms.repeat.value.set(this.data.repeat.x, this.data.repeat.y)
    }
  },
}
