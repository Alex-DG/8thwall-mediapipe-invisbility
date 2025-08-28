// Simplified path animator that starts exactly from sphere position
export const pathAnimatorSimpleComponent = {
  schema: {
    path: { type: 'array', default: [] },
    speed: { type: 'number', default: 0.2 },
    loop: { type: 'boolean', default: true },
    autoStart: { type: 'boolean', default: true },
    lineEntity: { type: 'selector', default: null }
  },

  init: function () {
    this.curve = null
    this.isPlaying = false
    this.currentDistance = 0
    this.totalLength = 0
    this.lineEntity = null // Store reference to line entity
    
    // console.log('Simple path animator initialized')
  },

  update: function (oldData) {
    if (this.data.path !== oldData.path && this.data.path && this.data.path.length > 1) {
      this.setupPath()
    }
    
    // Store line entity reference
    if (this.data.lineEntity !== oldData.lineEntity) {
      this.lineEntity = this.data.lineEntity
    }
  },

  setupPath: function () {
    const path = this.data.path
    if (path.length < 2) return
    
    // Create curve
    this.curve = new THREE.CatmullRomCurve3(path, this.data.loop)
    this.totalLength = this.curve.getLength()
    
    // console.log(`Path setup with ${path.length} points, length: ${this.totalLength.toFixed(2)}m`)
    
    if (this.data.autoStart) {
      setTimeout(() => this.play(), 500)
    }
  },

  play: function () {
    if (!this.curve) return
    
    // Get current sphere position
    const spherePos = this.el.object3D.position.clone()
    // console.log('Starting from sphere position:', spherePos.x.toFixed(3), spherePos.y.toFixed(3), spherePos.z.toFixed(3))
    
    // Find the closest point on the curve and the distance along the curve to that point
    let minDist = Infinity
    let closestT = 0
    let closestPoint = null
    
    // Sample the curve at many points
    for (let t = 0; t <= 1; t += 0.001) {
      const point = this.curve.getPointAt(t)
      const dist = spherePos.distanceTo(point)
      if (dist < minDist) {
        minDist = dist
        closestT = t
        closestPoint = point.clone()
      }
    }
    
    // console.log('Closest point on curve:', closestPoint.x.toFixed(3), closestPoint.y.toFixed(3), closestPoint.z.toFixed(3))
    // console.log('Distance to curve:', minDist.toFixed(3), 'Start t:', closestT.toFixed(3))
    
    // Start from the closest point
    this.currentDistance = closestT * this.totalLength
    this.isPlaying = true
    
    // Move to the closest point on the curve to start
    this.el.object3D.position.copy(closestPoint)
  },

  tick: function (time, deltaTime) {
    if (!this.isPlaying || !this.curve) return
    
    // Move along the curve
    this.currentDistance += this.data.speed * (deltaTime / 1000)
    
    // Handle looping
    if (this.currentDistance >= this.totalLength) {
      if (this.data.loop) {
        this.currentDistance = this.currentDistance % this.totalLength
      } else {
        this.currentDistance = this.totalLength
        this.isPlaying = false
      }
    }
    
    // Get position at current distance
    const t = this.currentDistance / this.totalLength
    const position = this.curve.getPointAt(t)
    
    // Update sphere position
    this.el.object3D.position.copy(position)
  },

  pause: function () {
    this.isPlaying = false
  },

  resume: function () {
    if (!this.isPlaying) {
      this.play() // Recalculate from current position
    }
  },

  initializeCurve: function () {
    // Reinitialize the curve with current path data
    if (this.data.path && this.data.path.length > 1) {
      this.setupPath()
      // If was playing, continue from current position
      if (this.isPlaying) {
        this.play()
      }
    }
  }
}