// Component to smoothly rotate objects to face the user when pinched
export const faceUserWhenPinchedComponent = {
  schema: {
    speed: { type: 'number', default: 2.0 }, // Rotation speed
    yOnly: { type: 'boolean', default: true }, // Only rotate on Y axis
    offset: { type: 'number', default: 0 } // Y rotation offset in degrees
  },

  init: function () {
    this.camera = null
    this.isPinched = false
    this.targetRotation = new THREE.Euler()
    this.currentRotation = new THREE.Euler()
    
    // Listen for pinch events on scene (like pinchable-xr does)
    this.el.sceneEl.addEventListener('pinchstarted', this.onPinchStart.bind(this))
    this.el.sceneEl.addEventListener('pinchended', this.onPinchEnd.bind(this))
    this.el.sceneEl.addEventListener('pinchmoved', this.onPinchMoved.bind(this))
    
    // Get camera reference
    this.camera = this.el.sceneEl.querySelector('#camera')
  },

  onPinchStart: function (evt) {
    // Check if this entity is being pinched
    const pinchPosition = evt.detail.position
    if (!pinchPosition) return
    
    // For regular entities (sunflowers)
    const distance = this.el.object3D.position.distanceTo(pinchPosition)
    const grabDist = 0.15
    
    if (distance < grabDist) {
      this.isPinched = true
      this.currentRotation.copy(this.el.object3D.rotation)
    }
  },

  onPinchEnd: function (evt) {
    if (this.isPinched) {
      this.isPinched = false
    }
  },
  
  onPinchMoved: function (evt) {
    // Could use this for additional tracking if needed
  },

  tick: function (time, deltaTime) {
    if (!this.isPinched || !this.camera) return
    
    // Get world positions
    const objectWorldPos = new THREE.Vector3()
    this.el.object3D.getWorldPosition(objectWorldPos)
    
    const cameraWorldPos = new THREE.Vector3()
    this.camera.object3D.getWorldPosition(cameraWorldPos)
    
    // Calculate direction from object to camera
    const dx = cameraWorldPos.x - objectWorldPos.x
    const dz = cameraWorldPos.z - objectWorldPos.z
    
    // Calculate target Y rotation
    // For A-Frame/Three.js, objects face +Z by default
    const targetY = Math.atan2(dx, dz) + (this.data.offset * Math.PI / 180)
    
    // Set target rotation
    if (this.data.yOnly) {
      this.targetRotation.set(
        this.el.object3D.rotation.x,
        targetY,
        this.el.object3D.rotation.z
      )
    }
    
    // Smoothly interpolate rotation
    const lerpFactor = 1.0 - Math.exp(-this.data.speed * deltaTime / 1000)
    
    // Update current rotation
    this.currentRotation.x = this.el.object3D.rotation.x
    this.currentRotation.y += this.angleDifference(this.targetRotation.y, this.currentRotation.y) * lerpFactor
    this.currentRotation.z = this.el.object3D.rotation.z
    
    // Apply rotation
    this.el.object3D.rotation.set(
      this.currentRotation.x,
      this.currentRotation.y,
      this.currentRotation.z
    )
  },

  // Helper to handle angle wrapping for smooth rotation
  angleDifference: function (target, current) {
    let diff = target - current
    while (diff > Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI
    return diff
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('pinchstarted', this.onPinchStart)
    this.el.sceneEl.removeEventListener('pinchended', this.onPinchEnd)
    this.el.sceneEl.removeEventListener('pinchmoved', this.onPinchMoved)
  }
}