import { GrassMaterial } from '../libs/GrassMaterial.js'

// Grass field component with animated shader
export const grassFieldComponent = {
  schema: {
    count: { type: 'number', default: 8192 },
    patchSize: { type: 'number', default: 20 },
    width: { type: 'number', default: 0.3 },
    height: { type: 'number', default: 2.0 },
    segments: { type: 'number', default: 5 },
    windSpeed: { type: 'number', default: 1.0 },
    debug: { type: 'boolean', default: false },
  },

  init: function () {
    this.grassMaterial = null
    this.mesh = null
    this.growStartTime = null
    this.shrinkStartTime = null
    this.growDelay = 0 // No delay when triggered by button
    this.growDuration = 2000 // 2 seconds to grow
    this.shrinkDuration = 2000 // 2 seconds to shrink
    this.currentGrowFactor = 0 // Track current growth state
    this.createGrass()
  },

  createGeometry: function (segments) {
    const VERTICES = (segments + 1) * 2
    const indices = []

    for (let i = 0; i < segments; ++i) {
      const vi = i * 2
      indices[i * 12 + 0] = vi + 0
      indices[i * 12 + 1] = vi + 1
      indices[i * 12 + 2] = vi + 2

      indices[i * 12 + 3] = vi + 2
      indices[i * 12 + 4] = vi + 1
      indices[i * 12 + 5] = vi + 3

      const fi = VERTICES + vi
      indices[i * 12 + 6] = fi + 2
      indices[i * 12 + 7] = fi + 1
      indices[i * 12 + 8] = fi + 0

      indices[i * 12 + 9] = fi + 3
      indices[i * 12 + 10] = fi + 1
      indices[i * 12 + 11] = fi + 2
    }

    const geo = new THREE.InstancedBufferGeometry()
    geo.instanceCount = this.data.count
    geo.setIndex(indices)
    geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, 0),
      1 + this.data.patchSize * 2
    )

    return geo
  },

  createGrass: async function () {
    const data = this.data

    // Load textures
    const textureLoader = new THREE.TextureLoader()

    await Promise.all([
      new Promise((resolve) => {
        textureLoader.load('/textures/grass1.png', (texture) => {
          texture.wrapS = THREE.RepeatWrapping
          texture.wrapT = THREE.RepeatWrapping
          resolve(texture)
        })
      }),
      new Promise((resolve) => {
        textureLoader.load('/textures/grass2.png', (texture) => {
          texture.wrapS = THREE.RepeatWrapping
          texture.wrapT = THREE.RepeatWrapping
          resolve(texture)
        })
      }),
    ]).then(([texture1, texture2]) => {
      const grassMaterial = new GrassMaterial(
        texture1,
        texture2,
        data.segments,
        data.patchSize,
        data.width,
        data.height
      )

      const grassGeometry = this.createGeometry(data.segments)

      this.mesh = new THREE.Mesh(grassGeometry, grassMaterial)
      this.mesh.frustumCulled = false
      this.mesh.name = 'grass-mesh'

      this.el.setObject3D('mesh', this.mesh)
      this.grassMaterial = grassMaterial

      // Set wind speed from schema
      this.grassMaterial.uniforms.uWindSpeed.value = data.windSpeed

      // Keep initial grow factor from material (currently 0)
      // this.grassMaterial.uniforms.uGrowFactor.value = 1.0

      console.log('Grass field created with', data.count, 'instances')

      // Start grow animation automatically if debug is true, otherwise wait for button press
      if (data.debug) {
        this.growStartTime = Date.now()
        console.log('Debug mode: Starting grass growth animation')
      } else {
        this.growStartTime = null
      }
    })
  },

  tick: function (time) {
    if (this.grassMaterial && this.mesh) {
      this.grassMaterial.uniforms.time.value = time * 0.001

      // Update fade center to mesh position
      const worldPos = new THREE.Vector3()
      this.mesh.getWorldPosition(worldPos)
      this.grassMaterial.uniforms.uFadeCenter.value.set(worldPos.x, worldPos.z)

      // Handle grow animation
      if (this.growStartTime) {
        const now = Date.now()
        if (now >= this.growStartTime) {
          const elapsed = (now - this.growStartTime) / this.growDuration
          if (elapsed < 1) {
            this.currentGrowFactor = elapsed
            this.grassMaterial.uniforms.uGrowFactor.value = this.currentGrowFactor
          } else {
            this.currentGrowFactor = 1.0
            this.grassMaterial.uniforms.uGrowFactor.value = 1.0
            this.growStartTime = null // Animation complete
          }
        }
      }
      
      // Handle shrink animation
      if (this.shrinkStartTime) {
        const now = Date.now()
        const elapsed = (now - this.shrinkStartTime) / this.shrinkDuration
        if (elapsed < 1) {
          // Shrink from current value to 0
          this.currentGrowFactor = this.startShrinkValue * (1 - elapsed)
          this.grassMaterial.uniforms.uGrowFactor.value = this.currentGrowFactor
        } else {
          this.currentGrowFactor = 0
          this.grassMaterial.uniforms.uGrowFactor.value = 0
          this.shrinkStartTime = null // Animation complete
        }
      }
    }
  },

  update: function (oldData) {
    if (this.grassMaterial && oldData.windSpeed !== this.data.windSpeed) {
      this.grassMaterial.uniforms.uWindSpeed.value = this.data.windSpeed
    }
  },

  animateGrassGrowth: function () {
    // Reset and start growth animation
    if (this.grassMaterial) {
      this.currentGrowFactor = 0
      this.growStartTime = Date.now()
      this.isGrowing = true
      this.shrinkStartTime = null
      console.log('Starting grass growth animation')
    }
  },

  remove: function () {
    if (this.el.getObject3D('mesh')) {
      this.el.removeObject3D('mesh')
    }
  },
}
