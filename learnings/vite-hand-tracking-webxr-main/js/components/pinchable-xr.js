// Pinchable component based on working hand-tracking example
// Detects when a hand pinch gesture happens near the entity

export const pinchableXrComponent = {
  schema: {
    pinchDistance: { default: 0.08 },
    grabDistance: { default: 0.1 }, // Default grab distance
    movingGrabDistance: { default: 0.15 }, // Larger grab distance when sphere is moving
  },

  init: function () {
    this.grabbed = false
    this.grabOffset = new THREE.Vector3()
    this.originalColor = this.el.getAttribute('color')
    this.wasAnimating = false
    this.animationData = null

    // Listen for pinch events from hand-tracking-controls
    this.el.sceneEl.addEventListener('pinchstarted', this.onPinchStarted.bind(this))
    this.el.sceneEl.addEventListener('pinchended', this.onPinchEnded.bind(this))
    this.el.sceneEl.addEventListener('pinchmoved', this.onPinchMoved.bind(this))
  },

  onPinchStarted: function (evt) {
    // Prevent multiple grabs
    if (this.grabbed) return
    
    // Check if this hand is already grabbing something
    if (evt.detail.grabbedEntity) return
    
    // Get pinch position from event
    const pinchPosition = evt.detail.position
    if (!pinchPosition) return

    // Calculate distance from pinch to this entity
    const distance = this.el.object3D.position.distanceTo(pinchPosition)

    // Use larger grab distance if sphere is moving
    const isMoving = this.el.hasAttribute('path-animator-simple') && 
                     this.el.components['path-animator-simple'] && 
                     this.el.components['path-animator-simple'].isPlaying
    const grabDist = isMoving ? this.data.movingGrabDistance : this.data.grabDistance

    // If close enough, grab the object
    if (distance < grabDist) {
      // Find all pinchable entities within range
      const allPinchables = this.el.sceneEl.querySelectorAll('[pinchable-xr]')
      let closestEntity = null
      let closestDistance = Infinity
      
      // Find the closest entity
      allPinchables.forEach(entity => {
        const entityDistance = entity.object3D.position.distanceTo(pinchPosition)
        const entityGrabDist = entity.components['pinchable-xr'].data.grabDistance
        if (entityDistance < entityGrabDist && entityDistance < closestDistance) {
          closestDistance = entityDistance
          closestEntity = entity
        }
      })
      
      // Only grab if this is the closest entity
      if (closestEntity === this.el) {
        this.grabbed = true
        this.grabbingHand = evt.detail.hand // Track which hand is grabbing
        this.grabOffset.subVectors(this.el.object3D.position, pinchPosition)
        this.el.setAttribute('color', '#00FF00') // Green when grabbed
        
        // Mark this entity as grabbed for this hand
        evt.detail.grabbedEntity = this.el

        // Check if sphere is animating on a path
        if (this.el.hasAttribute('path-animator-simple')) {
          this.wasAnimating = true
          // Store animation data
          this.animationData = {
            path: this.el.getAttribute('path-animator-simple').path,
            speed: this.el.getAttribute('path-animator-simple').speed
          }
          // Pause the animation
          const pathAnimator = this.el.components['path-animator-simple']
          if (pathAnimator) {
            pathAnimator.pause()
          }
        }

        // Update status text
        const statusText = document.querySelector('#statusText')
        if (statusText) {
          statusText.setAttribute('value', 'Object grabbed!')
        }

        console.log('Object grabbed at distance:', distance)
      } // End of if (closestEntity === this.el)
    } // End of if (distance < grabDist)
  },

  onPinchMoved: function (evt) {
    if (!this.grabbed) return
    
    // Only move if it's the same hand that grabbed it
    if (evt.detail.hand !== this.grabbingHand) return

    const pinchPosition = evt.detail.position
    if (!pinchPosition) return

    // Move object with pinch
    this.el.object3D.position.copy(pinchPosition).add(this.grabOffset)
  },

  onPinchEnded: function (evt) {
    // Only release if it's the same hand that grabbed it
    if (this.grabbed && evt.detail.hand === this.grabbingHand) {
      this.grabbed = false
      this.grabbingHand = null
      this.el.setAttribute('color', this.originalColor)

      // Check if sphere should be on a path (whether it was animating or not)
      // This allows non-animated spheres to start animating when placed on paths
      this.el.sceneEl.emit('sphere-released', {
        sphere: this.el,
        position: this.el.object3D.position.clone(),
        animationData: this.animationData,
        wasAnimating: this.wasAnimating
      })
      this.wasAnimating = false
      this.animationData = null

      // Update status text
      const statusText = document.querySelector('#statusText')
      if (statusText) {
        statusText.setAttribute('value', 'Object released')
      }

      console.log('Object released')
    }
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('pinchstarted', this.onPinchStarted)
    this.el.sceneEl.removeEventListener('pinchended', this.onPinchEnded)
    this.el.sceneEl.removeEventListener('pinchmoved', this.onPinchMoved)
  },
}
