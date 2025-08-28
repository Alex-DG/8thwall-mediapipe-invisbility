// Pinchable component for AR using MediaPipe hand tracking
// Allows grabbing and moving spheres with pinch gesture

export const pinchableArComponent = {
  schema: {
    pinchDistance: { default: 0.05 }, // Distance between thumb and index to trigger pinch (increased)
    grabDistance: { default: 0.12 }, // Default grab distance (increased)
    movingGrabDistance: { default: 0.18 }, // Larger grab distance when sphere is moving (increased)
  },

  init: function () {
    this.grabbed = false
    this.grabOffset = new THREE.Vector3()
    this.originalColor = this.el.getAttribute('color')
    this.wasAnimating = false
    this.animationData = null
    this.mediapipeHand = null
    this.grabbingHandIndex = null
    this.lastPinchState = false
    
    // Store reference to drawing UI for checking sphere mode
    this.drawingUI = null
    
    // Visual feedback elements
    this.hoverIndicator = null
    this.grabIndicator = null
    this.isHovered = false
    
    // Depth control
    this.initialGrabDistance = null
    this.depthOffset = 0
  },

  tick: function (time) {
    // Animate hover indicator
    if (this.hoverIndicator) {
      const scale = 1 + Math.sin(time * 0.005) * 0.1
      this.hoverIndicator.scale.set(scale, scale, scale)
      this.hoverIndicator.rotation.y = time * 0.001
    }
    // Get MediaPipe hand component
    if (!this.mediapipeHand) {
      this.mediapipeHand = this.el.sceneEl.components['mediapipe-hand']
    }

    if (!this.mediapipeHand || !this.mediapipeHand.handEntities) return

    // Get drawing UI to check if sphere mode is enabled
    if (!this.drawingUI) {
      this.drawingUI = this.el.sceneEl.components['drawing-ui']
    }

    // Don't allow grabbing if sphere mode is enabled
    if (this.drawingUI && this.drawingUI.sphereModeEnabled) {
      if (this.grabbed) {
        this.release()
      }
      return
    }

    // Check each visible hand for pinch
    for (let handIndex = 0; handIndex < this.mediapipeHand.handEntities.length; handIndex++) {
      const hand = this.mediapipeHand.handEntities[handIndex]
      
      if (!hand || !hand.group || !hand.group.getAttribute('visible')) continue
      if (!hand.landmarks || hand.landmarks.length < 21) continue

      // Get thumb tip (landmark 4) and index tip (landmark 8)
      const thumbTip = hand.landmarks[4]
      const indexTip = hand.landmarks[8]

      if (thumbTip && indexTip && thumbTip.object3D && indexTip.object3D) {
        const thumbPos = new THREE.Vector3()
        const indexPos = new THREE.Vector3()
        
        thumbTip.object3D.getWorldPosition(thumbPos)
        indexTip.object3D.getWorldPosition(indexPos)

        // Calculate pinch distance
        const pinchDistance = thumbPos.distanceTo(indexPos)
        const isPinching = pinchDistance < this.data.pinchDistance

        // Calculate pinch center position
        const pinchPosition = new THREE.Vector3()
          .addVectors(thumbPos, indexPos)
          .multiplyScalar(0.5)

        // Handle pinch state changes
        if (isPinching && !this.lastPinchState) {
          // Pinch started
          this.onPinchStarted(pinchPosition, handIndex)
        } else if (isPinching && this.grabbed && this.grabbingHandIndex === handIndex) {
          // Pinch moving
          this.onPinchMoved(pinchPosition)
        } else if (!isPinching && this.lastPinchState && this.grabbed && this.grabbingHandIndex === handIndex) {
          // Pinch ended
          this.onPinchEnded()
        }

        // Only track pinch state for the hand that might be grabbing
        if (handIndex === this.grabbingHandIndex || !this.grabbed) {
          this.lastPinchState = isPinching
        }
        
        // Check for hover when not grabbed and not pinching
        if (!this.grabbed && !isPinching) {
          const distance = this.el.object3D.position.distanceTo(pinchPosition)
          const isMoving = this.el.hasAttribute('path-animator-simple') && 
                           this.el.components['path-animator-simple'] && 
                           this.el.components['path-animator-simple'].isPlaying
          const hoverDist = (isMoving ? this.data.movingGrabDistance : this.data.grabDistance) * 1.5
          
          if (distance < hoverDist && !this.isHovered) {
            this.isHovered = true
            this.createHoverIndicator()
          } else if (distance >= hoverDist && this.isHovered) {
            this.isHovered = false
            this.removeHoverIndicator()
          }
        }
      }
    }
    
    // Remove hover indicator if no hands are visible
    if (this.isHovered && !this.grabbed) {
      let anyHandVisible = false
      for (let i = 0; i < this.mediapipeHand.handEntities.length; i++) {
        const hand = this.mediapipeHand.handEntities[i]
        if (hand && hand.group && hand.group.getAttribute('visible')) {
          anyHandVisible = true
          break
        }
      }
      if (!anyHandVisible) {
        this.isHovered = false
        this.removeHoverIndicator()
      }
    }
  },

  onPinchStarted: function (pinchPosition, handIndex) {
    // Prevent multiple grabs
    if (this.grabbed) return

    // Calculate distance from pinch to this entity
    const distance = this.el.object3D.position.distanceTo(pinchPosition)

    // Use larger grab distance if sphere is moving
    const isMoving = this.el.hasAttribute('path-animator-simple') && 
                     this.el.components['path-animator-simple'] && 
                     this.el.components['path-animator-simple'].isPlaying
    const grabDist = isMoving ? this.data.movingGrabDistance : this.data.grabDistance

    // If close enough, check if this is the closest entity
    if (distance < grabDist) {
      // Find all pinchable entities within range
      const allPinchables = this.el.sceneEl.querySelectorAll('[pinchable-ar]')
      let closestEntity = null
      let closestDistance = Infinity
      
      // Find the closest entity
      allPinchables.forEach(entity => {
        const entityDistance = entity.object3D.position.distanceTo(pinchPosition)
        const entityComponent = entity.components['pinchable-ar']
        if (entityComponent) {
          const entityIsMoving = entity.hasAttribute('path-animator-simple') && 
                                entity.components['path-animator-simple'] && 
                                entity.components['path-animator-simple'].isPlaying
          const entityGrabDist = entityIsMoving ? 
            entityComponent.data.movingGrabDistance : 
            entityComponent.data.grabDistance
          
          if (entityDistance < entityGrabDist && entityDistance < closestDistance) {
            closestDistance = entityDistance
            closestEntity = entity
          }
        }
      })
      
      // Only grab if this is the closest entity
      if (closestEntity === this.el) {
        this.grabbed = true
        this.grabbingHandIndex = handIndex
        this.grabOffset.subVectors(this.el.object3D.position, pinchPosition)
        
        // Store initial grab distance for depth control
        const camera = document.querySelector('#camera')
        if (camera) {
          const cameraPos = new THREE.Vector3()
          camera.object3D.getWorldPosition(cameraPos)
          this.initialGrabDistance = this.el.object3D.position.distanceTo(cameraPos)
        }
        
        // Remove hover and add grab indicator
        this.removeHoverIndicator()
        this.isHovered = false
        this.createGrabIndicator()

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

        console.log('AR sphere grabbed at distance:', distance)
        console.log('Depth control: Spread hand wide to push away, narrow to pull closer')
      }
    }
  },

  onPinchMoved: function (pinchPosition) {
    if (!this.grabbed) return

    // Get hand entities for depth control
    if (!this.mediapipeHand || !this.mediapipeHand.handEntities) {
      // Fallback to simple movement
      this.el.object3D.position.copy(pinchPosition).add(this.grabOffset)
      return
    }

    const hand = this.mediapipeHand.handEntities[this.grabbingHandIndex]
    if (!hand || !hand.landmarks || hand.landmarks.length < 21) {
      this.el.object3D.position.copy(pinchPosition).add(this.grabOffset)
      return
    }

    // Use the spread between thumb and pinky for depth control
    // Wide spread = push away, narrow = pull closer
    const thumbBase = hand.landmarks[1] // Thumb CMC
    const pinkyBase = hand.landmarks[17] // Pinky MCP
    
    if (thumbBase && pinkyBase && thumbBase.object3D && pinkyBase.object3D) {
      const thumbBasePos = new THREE.Vector3()
      const pinkyBasePos = new THREE.Vector3()
      
      thumbBase.object3D.getWorldPosition(thumbBasePos)
      pinkyBase.object3D.getWorldPosition(pinkyBasePos)
      
      // Calculate hand spread
      const handSpread = thumbBasePos.distanceTo(pinkyBasePos)
      
      // Initialize reference spread if not set
      if (!this.referenceSpread) {
        this.referenceSpread = handSpread
      }
      
      // Calculate depth change based on spread difference
      const spreadDiff = handSpread - this.referenceSpread
      const depthScale = spreadDiff * 8.0 // Amplify the effect
      
      // Get camera for depth direction
      const camera = document.querySelector('#camera')
      if (camera && this.initialGrabDistance) {
        const cameraPos = new THREE.Vector3()
        const cameraDir = new THREE.Vector3()
        
        camera.object3D.getWorldPosition(cameraPos)
        camera.object3D.getWorldDirection(cameraDir)
        
        // Calculate base position from pinch
        const basePos = pinchPosition.clone().add(this.grabOffset)
        
        // Apply depth offset along camera direction
        const depthAdjustment = cameraDir.clone().multiplyScalar(depthScale)
        basePos.add(depthAdjustment)
        
        // Apply position
        this.el.object3D.position.copy(basePos)
        
        // Visual feedback for depth
        if (this.grabIndicator) {
          const scale = 1 + Math.abs(depthScale) * 0.1
          this.grabIndicator.scale.set(scale, scale, scale)
        }
      } else {
        // Fallback if no camera
        this.el.object3D.position.copy(pinchPosition).add(this.grabOffset)
      }
    } else {
      // Fallback if landmarks not available
      this.el.object3D.position.copy(pinchPosition).add(this.grabOffset)
    }
  },

  onPinchEnded: function () {
    if (!this.grabbed) return
    
    this.release()
  },

  release: function () {
    this.grabbed = false
    this.grabbingHandIndex = null
    this.initialGrabDistance = null // Reset depth tracking
    this.depthOffset = 0
    this.referenceSpread = null // Reset hand spread reference
    
    // Remove visual feedback
    this.removeGrabIndicator()

    // Check if sphere should be on a path
    this.el.sceneEl.emit('sphere-released', {
      sphere: this.el,
      position: this.el.object3D.position.clone(),
      animationData: this.animationData,
      wasAnimating: this.wasAnimating
    })
    this.wasAnimating = false
    this.animationData = null

    console.log('AR sphere released')
  },

  createHoverIndicator: function () {
    if (this.hoverIndicator) return
    
    // Create a wireframe sphere slightly larger than the object
    const radius = this.el.getAttribute('radius') || 0.05
    const geometry = new THREE.SphereGeometry(radius * 1.2, 16, 16)
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    })
    
    this.hoverIndicator = new THREE.Mesh(geometry, material)
    this.el.object3D.add(this.hoverIndicator)
  },

  removeHoverIndicator: function () {
    if (this.hoverIndicator) {
      this.el.object3D.remove(this.hoverIndicator)
      this.hoverIndicator.geometry.dispose()
      this.hoverIndicator.material.dispose()
      this.hoverIndicator = null
    }
  },

  createGrabIndicator: function () {
    if (this.grabIndicator) return
    
    // Create a solid green sphere slightly larger
    const radius = this.el.getAttribute('radius') || 0.05
    const geometry = new THREE.SphereGeometry(radius * 1.15, 32, 32)
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.4
    })
    
    this.grabIndicator = new THREE.Mesh(geometry, material)
    this.el.object3D.add(this.grabIndicator)
  },

  removeGrabIndicator: function () {
    if (this.grabIndicator) {
      this.el.object3D.remove(this.grabIndicator)
      this.grabIndicator.geometry.dispose()
      this.grabIndicator.material.dispose()
      this.grabIndicator = null
    }
  },

  remove: function () {
    this.removeHoverIndicator()
    this.removeGrabIndicator()
  },
}