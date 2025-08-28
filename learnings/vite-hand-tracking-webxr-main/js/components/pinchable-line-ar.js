// Component to make drawn lines pinchable and moveable in AR
export const pinchableLineArComponent = {
  schema: {
    pinchDistance: { default: 0.05 }, // Distance between thumb and index to trigger pinch (increased)
    grabDistance: { default: 0.15 } // Slightly larger than spheres (increased)
  },

  init: function () {
    this.grabbed = false
    this.grabOffset = new THREE.Vector3()
    this.originalPosition = new THREE.Vector3()
    this.attachedSpheres = []
    this.pathData = null
    this.mediapipeHand = null
    this.grabbingHandIndex = null
    this.lastPinchState = false
    this.drawingUI = null
    this.isHovered = false
    this.hoverColor = new THREE.Color('#00ffff')
    this.isReady = false // Only allow interaction after path data is set
    
    // Store original path data
    this.el.addEventListener('path-data-set', (event) => {
      // Only update if we have actual path data
      if (event.detail.path && event.detail.path.length > 0) {
        this.pathData = event.detail.path
        this.originalPathData = event.detail.path.map(p => p.clone())
        this.isReady = true // Now we're ready for interaction
        console.log('Line path data set with', this.pathData.length, 'points')
      } else {
        console.log('Received empty path data, keeping existing data')
        // Don't reset isReady if we already have data
        if (!this.pathData) {
          this.isReady = false
        }
      }
    })
  },
  
  tick: function (time) {
    // Don't do anything until we have path data
    if (!this.isReady) return
    
    // Animate hover state
    if (this.isHovered && !this.grabbed) {
      const mesh = this.el.getObject3D('mesh')
      if (mesh && mesh.material) {
        const pulse = 0.7 + Math.sin(time * 0.005) * 0.3
        mesh.material.opacity = pulse
      }
    }
    // Get MediaPipe hand component
    if (!this.mediapipeHand) {
      this.mediapipeHand = this.el.sceneEl.components['mediapipe-hand']
    }

    if (!this.mediapipeHand || !this.mediapipeHand.handEntities) {
      // If no hands available and we're grabbed, release
      if (this.grabbed) {
        this.release()
      }
      return
    }

    // Get drawing UI to check drawing and sphere modes
    if (!this.drawingUI) {
      this.drawingUI = this.el.sceneEl.components['drawing-ui']
    }

    // Only allow line grabbing if both drawing and sphere spawning are disabled
    if (!this.isInteractionAllowed()) {
      if (this.grabbed) {
        this.release()
      }
      return
    }

    // Check if grabbed hand is still visible
    if (this.grabbed && this.grabbingHandIndex !== null) {
      const grabbedHand = this.mediapipeHand.handEntities[this.grabbingHandIndex]
      if (!grabbedHand || !grabbedHand.group || !grabbedHand.group.getAttribute('visible')) {
        // Hand that was grabbing is no longer visible
        this.release()
        return
      }
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
        if (!this.grabbed && !isPinching && this.pathData) {
          // Get world position of the line
          const worldPos = new THREE.Vector3()
          this.el.object3D.getWorldPosition(worldPos)
          
          // Check distance to line segments
          let minDistance = Infinity
          
          for (let i = 0; i < this.pathData.length - 1; i++) {
            const lineStart = this.pathData[i].clone().add(worldPos)
            const lineEnd = this.pathData[i + 1].clone().add(worldPos)
            const { distance } = this.distanceToLineSegment(pinchPosition, lineStart, lineEnd)
            
            if (distance < minDistance) {
              minDistance = distance
            }
          }
          
          const hoverDist = this.data.grabDistance * 1.5
          
          if (minDistance < hoverDist && !this.isHovered) {
            console.log('Line hover start - distance:', minDistance)
            this.isHovered = true
            this.setHoverState(true)
          } else if (minDistance >= hoverDist && this.isHovered) {
            console.log('Line hover end')
            this.isHovered = false
            this.setHoverState(false)
          }
        }
      }
    }
    
    // Remove hover if no hands are visible
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
        this.setHoverState(false)
      }
    }
  },
  
  isInteractionAllowed: function() {
    if (!this.drawingUI) {
      console.log('No drawingUI reference found')
      return true
    }
    
    // Check if drawing mode is enabled
    if (this.drawingUI.isDrawingEnabled) {
      console.log('Interaction blocked: drawing mode is enabled')
      return false
    }
    
    // Check if sphere mode is enabled
    if (this.drawingUI.sphereModeEnabled) {
      console.log('Interaction blocked: sphere mode is enabled')
      return false
    }
    
    return true
  },

  onPinchStarted: function (pinchPosition, handIndex) {
    if (this.grabbed) return
    
    // Check if interaction is allowed
    if (!this.isInteractionAllowed()) {
      console.log('Line interaction blocked by drawing/sphere mode')
      return
    }
    
    // Get world position of the line
    const worldPos = new THREE.Vector3()
    this.el.object3D.getWorldPosition(worldPos)

    // Check distance to line segments
    let minDistance = Infinity
    let closestPoint = null
    
    if (this.pathData && this.pathData.length > 0) {
      for (let i = 0; i < this.pathData.length - 1; i++) {
        const lineStart = this.pathData[i].clone().add(worldPos)
        const lineEnd = this.pathData[i + 1].clone().add(worldPos)
        const { distance, point } = this.distanceToLineSegment(pinchPosition, lineStart, lineEnd)
        
        if (distance < minDistance) {
          minDistance = distance
          closestPoint = point
        }
      }
    } else {
      console.log('No pathData found on line entity!')
    }

    // Before grabbing the line, check if there's a sphere nearby that should take priority
    const spheres = this.el.sceneEl.querySelectorAll('[wobbly-sphere]')
    let sphereNearby = false
    
    spheres.forEach(sphere => {
      const sphereDistance = sphere.object3D.position.distanceTo(pinchPosition)
      // Check if sphere is pinchable and within its grab distance
      const pinchableAr = sphere.components['pinchable-ar']
      if (pinchableAr) {
        const isMoving = sphere.hasAttribute('path-animator-simple') && 
                        sphere.components['path-animator-simple'] && 
                        sphere.components['path-animator-simple'].isPlaying
        const sphereGrabDist = isMoving ? pinchableAr.data.movingGrabDistance : pinchableAr.data.grabDistance
        
        if (sphereDistance < sphereGrabDist) {
          sphereNearby = true
        }
      }
    })
    
    // If close enough and no sphere takes priority, grab the line
    if (minDistance < this.data.grabDistance && !this.grabbed && !sphereNearby) {
      
      this.grabbed = true
      this.grabbingHandIndex = handIndex
      this.grabOffset.subVectors(worldPos, pinchPosition)
      this.originalPosition.copy(worldPos)
      
      // Remove hover state
      if (this.isHovered) {
        this.isHovered = false
        this.setHoverState(false)
      }
      
      // Change line color to indicate it's grabbed
      const mesh = this.el.getObject3D('mesh')
      if (mesh && mesh.material) {
        this.originalColor = mesh.material.color.clone()
        mesh.material.color = new THREE.Color('#00ff00') // Green when grabbed
      }
      
      // Find all spheres that are animating on this path
      this.findAttachedSpheres()
      
      console.log('AR line grabbed at distance:', minDistance)
    }
  },

  onPinchMoved: function (pinchPosition) {
    if (!this.grabbed) return

    // Calculate new position
    const newPosition = new THREE.Vector3().copy(pinchPosition).add(this.grabOffset)
    const movement = new THREE.Vector3().subVectors(newPosition, this.originalPosition)
    
    // Move the line
    this.el.object3D.position.add(movement)
    this.originalPosition.copy(newPosition)
    
    // Emit event to update path animation
    this.el.emit('path-moved', {
      path: this.pathData,
      movement: movement
    })
  },

  onPinchEnded: function () {
    if (!this.grabbed) return
    
    this.release()
  },

  release: function () {
    this.grabbed = false
    this.grabbingHandIndex = null
    
    // Restore original color
    const mesh = this.el.getObject3D('mesh')
    if (mesh && mesh.material) {
      if (this.originalColor) {
        mesh.material.color.copy(this.originalColor)
      } else {
        // Fallback to white if original color wasn't stored
        mesh.material.color.set('#ffffff')
      }
      // Ensure opacity is reset
      mesh.material.opacity = 1.0
      mesh.material.needsUpdate = true
    }
    
    // Update path-sphere-spawner with new path position
    const pathSphereSpawner = this.el.sceneEl.querySelector('[path-sphere-spawner]')
    if (pathSphereSpawner && pathSphereSpawner.components['path-sphere-spawner']) {
      const spawner = pathSphereSpawner.components['path-sphere-spawner']
      // Update the loop data with new positions
      spawner.loops.forEach(loop => {
        if (loop.path === this.pathData) {
          // Path reference is already updated, just need to trigger re-evaluation
          spawner.loops = [...spawner.loops] // Force update
        }
      })
    }
    
    console.log('AR line released')
  },

  findAttachedSpheres: function () {
    this.attachedSpheres = []
    
    // Find all spheres with path-animator-simple
    const animatedSpheres = this.el.sceneEl.querySelectorAll('[path-animator-simple]')
    
    animatedSpheres.forEach(sphere => {
      const animator = sphere.components['path-animator-simple']
      // Check if the sphere's lineEntity matches this line
      if (animator && animator.data.lineEntity === this.el) {
        this.attachedSpheres.push(sphere)
      }
    })
    
    console.log('Found', this.attachedSpheres.length, 'attached spheres')
  },

  distanceToLineSegment: function (point, lineStart, lineEnd) {
    const line = new THREE.Vector3().subVectors(lineEnd, lineStart)
    const lineLength = line.length()
    line.normalize()
    
    const toPoint = new THREE.Vector3().subVectors(point, lineStart)
    const projection = toPoint.dot(line)
    
    let closestPoint
    if (projection <= 0) {
      closestPoint = lineStart.clone()
    } else if (projection >= lineLength) {
      closestPoint = lineEnd.clone()
    } else {
      closestPoint = new THREE.Vector3()
        .copy(lineStart)
        .addScaledVector(line, projection)
    }
    
    return {
      distance: point.distanceTo(closestPoint),
      point: closestPoint
    }
  },

  setHoverState: function (hovering) {
    const mesh = this.el.getObject3D('mesh')
    if (!mesh || !mesh.material) {
      console.log('No mesh or material found for line hover')
      return
    }
    
    if (hovering) {
      // Store original color if not already stored
      if (!this.originalColor) {
        this.originalColor = mesh.material.color.clone()
      }
      // Apply hover color
      mesh.material.color = this.hoverColor
      mesh.material.transparent = true
      mesh.material.opacity = 0.8
      mesh.material.needsUpdate = true
    } else {
      // Restore original color
      if (this.originalColor) {
        mesh.material.color.copy(this.originalColor)
      }
      mesh.material.opacity = 1.0
      mesh.material.needsUpdate = true
    }
  },

  remove: function () {
    // Release if currently grabbed
    if (this.grabbed) {
      this.release()
    }
    
    // Restore original state if hovering
    if (this.isHovered) {
      this.setHoverState(false)
    }
    
    // Ensure color is reset
    const mesh = this.el.getObject3D('mesh')
    if (mesh && mesh.material) {
      if (this.originalColor) {
        mesh.material.color.copy(this.originalColor)
      } else {
        mesh.material.color.set('#ffffff')
      }
      mesh.material.opacity = 1.0
      mesh.material.needsUpdate = true
    }
  }
}