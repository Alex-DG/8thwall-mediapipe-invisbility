// Component that detects pinch gestures and emits events
export const handXrPinchDetectorComponent = {
  schema: {
    hand: { default: 'right', oneOf: ['left', 'right'] },
    pinchThreshold: { default: 0.04 }, // Distance threshold for pinch detection
    releaseThreshold: { default: 0.06 } // Distance threshold for pinch release
  },

  init: function () {
    this.isPinching = false
    this.pinchPosition = new THREE.Vector3()
    this.thumbTipPosition = new THREE.Vector3()
    this.indexTipPosition = new THREE.Vector3()
    this.handTracking = null
  },

  tick: function () {
    // Get hand tracking controls component
    if (!this.handTracking) {
      this.handTracking = this.el.components['hand-tracking-controls']
      if (!this.handTracking) return
    }

    // Make sure hand is visible
    if (!this.handTracking.el.object3D.visible) {
      // If hand was pinching and disappeared, end the pinch
      if (this.isPinching) {
        this.isPinching = false
        this.el.sceneEl.emit('pinchended', {
          hand: this.data.hand,
          position: this.pinchPosition.clone()
        })
      }
      return
    }

    const handModel = this.handTracking.el.object3D
    if (!handModel || handModel.children.length === 0) return

    // Get thumb and index finger tips
    const thumbTip = handModel.getObjectByName('thumb-tip')
    const indexTip = handModel.getObjectByName('index-finger-tip')

    if (!thumbTip || !indexTip) return

    // Get world positions
    thumbTip.getWorldPosition(this.thumbTipPosition)
    indexTip.getWorldPosition(this.indexTipPosition)

    // Calculate pinch distance
    const distance = this.thumbTipPosition.distanceTo(this.indexTipPosition)
    
    // Calculate pinch position (midpoint between thumb and index)
    this.pinchPosition.lerpVectors(this.thumbTipPosition, this.indexTipPosition, 0.5)

    // Check for pinch state changes
    if (!this.isPinching && distance < this.data.pinchThreshold) {
      // Start pinch
      this.isPinching = true
      this.el.sceneEl.emit('pinchstarted', {
        hand: this.data.hand,
        position: this.pinchPosition.clone()
      })
    } else if (this.isPinching && distance > this.data.releaseThreshold) {
      // End pinch
      this.isPinching = false
      this.el.sceneEl.emit('pinchended', {
        hand: this.data.hand,
        position: this.pinchPosition.clone()
      })
    } else if (this.isPinching) {
      // Update pinch position
      this.el.sceneEl.emit('pinchmoved', {
        hand: this.data.hand,
        position: this.pinchPosition.clone()
      })
    }
  }
}