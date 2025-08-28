// Component for spawning spheres with pinch gesture in WebAR
export const handArSphereSpawnerComponent = {
  schema: {
    hand: { default: 'right', oneOf: ['left', 'right'] },
  },

  init: function () {
    this.createdSpheres = []
    this.isPinching = false
    this.pinchThreshold = 0.04 // Distance threshold for pinch detection (slightly increased)
    this.maxPreviewDistance = 0.5 // Maximum distance to show preview (increased for much larger spheres)
    this.stabilizationTime = 1100 // 1.1 seconds of stable position needed
    this.stabilizationThreshold = 0.01 // Maximum movement allowed during stabilization (more forgiving)

    // Preview sphere
    this.previewSphere = null
    this.previewStartTime = 0
    this.lastPreviewDistance = 0
    this.isStabilizing = false

    // Store reference to drawing UI for checking sphere mode
    this.drawingUI = null
    this.sphereModeEnabled = false

    // MediaPipe hand tracking references
    this.mediapipeHand = null
    this.handData = null

    console.log('Hand AR Sphere Spawner initialized')
    this.createPreviewSphere()
    this.setupEventListeners()
  },

  createPreviewSphere: function () {
    // Create preview sphere entity
    this.previewSphere = document.createElement('a-sphere')
    this.previewSphere.setAttribute(
      'material',
      'color: hotpink; transparent: true; opacity: 0.2; wireframe: true'
    )
    this.previewSphere.setAttribute('radius', 0.05)
    this.previewSphere.setAttribute('visible', false)
    this.el.sceneEl.appendChild(this.previewSphere)
  },

  setupEventListeners: function () {
    // Listen for sphere mode toggle
    this.el.sceneEl.addEventListener('sphere-mode-toggled', (event) => {
      this.sphereModeEnabled = event.detail.enabled
      console.log('Sphere mode:', this.sphereModeEnabled ? 'enabled' : 'disabled')
      
      if (!this.sphereModeEnabled) {
        this.previewSphere.setAttribute('visible', false)
        this.isStabilizing = false
      }
    })
  },

  tick: function (time) {
    // Only spawn spheres if sphere mode is enabled
    if (!this.sphereModeEnabled) {
      this.previewSphere.setAttribute('visible', false)
      this.isStabilizing = false
      return
    }

    // Get MediaPipe hand component
    if (!this.mediapipeHand) {
      this.mediapipeHand = this.el.sceneEl.components['mediapipe-hand']
      if (!this.mediapipeHand) {
        console.log('MediaPipe hand component not found')
        return
      }
    }

    if (!this.mediapipeHand.handEntities) {
      console.log('MediaPipe handEntities not ready')
      return
    }

    // For MediaPipe, we'll just use the first detected hand regardless of left/right
    // since MediaPipe doesn't reliably distinguish between left and right hands
    // TODO: Implement proper hand chirality detection if needed
    let handData = null
    
    // Try to find any visible hand
    for (let i = 0; i < this.mediapipeHand.handEntities.length; i++) {
      const hand = this.mediapipeHand.handEntities[i]
      if (hand && hand.group && hand.group.getAttribute('visible')) {
        handData = hand
        break
      }
    }
    
    this.handData = handData

    if (!this.handData) {
      console.log(`No visible hand found for sphere spawning`)
      this.previewSphere.setAttribute('visible', false)
      return
    }

    if (!this.handData.landmarks || this.handData.landmarks.length < 21) {
      console.log(`Incomplete landmarks:`, this.handData.landmarks?.length || 0)
      this.previewSphere.setAttribute('visible', false)
      return
    }

    // Check if hand is visible (redundant check since we already filtered for visible hands)
    if (!this.handData.group || !this.handData.group.getAttribute('visible')) {
      console.log(`Hand group not visible`)
      this.previewSphere.setAttribute('visible', false)
      return
    }

    // Get thumb tip (landmark 4) and index tip (landmark 8) world positions
    const thumbTip = this.handData.landmarks[4]
    const indexTip = this.handData.landmarks[8]

    if (thumbTip && indexTip) {
      const thumbPos = new THREE.Vector3()
      const indexPos = new THREE.Vector3()

      // MediaPipe stores landmarks as A-Frame entities with object3D
      if (thumbTip.object3D && indexTip.object3D) {
        thumbTip.object3D.getWorldPosition(thumbPos)
        indexTip.object3D.getWorldPosition(indexPos)
      } else {
        console.log('Landmark object3D not ready')
        return
      }

      // Calculate distance between thumb and index
      const distance = thumbPos.distanceTo(indexPos)
      
      // Log distance periodically for debugging (less frequent)
      if (!this.lastLogTime || time - this.lastLogTime > 2000) {
        console.log(`Pinch distance: ${distance.toFixed(3)}, threshold: ${this.pinchThreshold}, max: ${this.maxPreviewDistance}`)
        this.lastLogTime = time
      }

      // Show preview when fingers are within max distance
      if (distance < this.maxPreviewDistance) {
        // Calculate center position
        const centerPos = new THREE.Vector3()
          .addVectors(thumbPos, indexPos)
          .multiplyScalar(0.5)

        // Show and position preview sphere
        this.previewSphere.setAttribute('position', centerPos)
        this.previewSphere.setAttribute('visible', true)

        // Use distance directly as radius
        const scale = Math.max(distance * 2.5, 0.05) // Scale up more for better visibility
        this.previewSphere.setAttribute('radius', scale)

        // Store the current distance for sphere creation
        this.currentDistance = distance

        // Check for stabilization regardless of distance
        if (!this.isStabilizing) {
          // Start stabilization when preview is visible
          this.isStabilizing = true
          this.previewStartTime = time
          this.lastPreviewDistance = distance
          this.stabilizationStartDistance = distance
        } else {
          // Check if position is stable
          const distanceChange = Math.abs(distance - this.lastPreviewDistance)

          if (distanceChange > this.stabilizationThreshold) {
            // Position changed too much, reset stabilization
            this.previewStartTime = time
            this.lastPreviewDistance = distance
            this.stabilizationStartDistance = distance
          } else {
            // Check if stabilized for long enough
            if (time - this.previewStartTime >= this.stabilizationTime) {
              console.log('Creating sphere after stabilization')
              // Create the actual sphere with the current preview size
              this.createSphere(thumbPos, indexPos, this.currentDistance)

              // Reset stabilization
              this.isStabilizing = false
              this.previewStartTime = 0
              
              // Hide preview after creation
              this.previewSphere.setAttribute('visible', false)
            }
          }
        }
      } else {
        // Fingers are separating beyond preview distance
        if (this.isStabilizing && this.previewStartTime > 0) {
          // Was stabilizing, check if we should create sphere
          const stabilizationDuration = time - this.previewStartTime
          
          // If we were close to creating (80% of stabilization time), create it anyway
          if (stabilizationDuration >= this.stabilizationTime * 0.8) {
            console.log('Creating sphere on release after partial stabilization')
            // Create sphere with stored distance
            this.createSphere(thumbPos, indexPos, this.currentDistance)
          }
        }
        // Hide preview and reset
        this.previewSphere.setAttribute('visible', false)
        this.isStabilizing = false
        this.previewStartTime = 0
      }
    }

    // Update existing spheres (remove old ones)
    this.updateSpheres(time)
  },

  createSphere: function (thumbPos, indexPos, distance) {
    console.log('Creating sphere with pinch distance:', distance)

    // Calculate center position between thumb and index
    const centerPos = new THREE.Vector3()
      .addVectors(thumbPos, indexPos)
      .multiplyScalar(0.5)

    // Create sphere entity with both geometry and wobbly effect
    const sphere = document.createElement('a-sphere')
    // Use exact same calculation as preview
    const scale = Math.max(distance * 2.5, 0.05) // Same as preview
    sphere.setAttribute('radius', scale)

    // Get current color from drawing UI if available
    const drawingUI = this.el.sceneEl.components['drawing-ui']
    const currentColor = drawingUI ? drawingUI.currentColor : '#4CC3D9'
    console.log('Drawing UI found:', !!drawingUI, 'Color:', currentColor)

    // Add wobbly sphere component with matching radius
    sphere.setAttribute('wobbly-sphere', {
      radius: scale,
      speed: 0.11,
      noiseDensity: THREE.MathUtils.randFloat(2.0, 4.0),
      noiseStrength: THREE.MathUtils.randFloat(0.025, 0.06),
      frequency: 10,
      amplitude: THREE.MathUtils.randFloat(0.0, 2.0),
      intensity: THREE.MathUtils.randFloat(4.0, 8.0),
    })

    // Set position
    sphere.setAttribute('position', centerPos)

    // Add random rotation
    sphere.setAttribute('rotation', {
      x: Math.random() * 360,
      y: Math.random() * 360,
      z: Math.random() * 360,
    })

    // Add pinchable component for AR interaction
    sphere.setAttribute('pinchable-ar', '')

    // Set lifetime (5-10 minutes for spheres)
    sphere.lifetime = THREE.MathUtils.randFloat(300000, 600000)
    sphere.createdTime = Date.now()

    // Add to scene with small delay to ensure proper initialization
    this.el.sceneEl.appendChild(sphere)
    console.log('Sphere added to scene')

    // Force material creation after adding to scene
    setTimeout(() => {
      if (
        sphere.components['wobbly-sphere'] &&
        !sphere.components['wobbly-sphere'].material
      ) {
        sphere.components['wobbly-sphere'].createMaterials()
      }
    }, 10)

    this.createdSpheres.push(sphere)

    // Emit event for other components to listen
    this.el.sceneEl.emit('wobbly-sphere-created', {
      sphere: sphere,
      position: centerPos,
      radius: scale,
    })

    console.log(
      `Sphere created at: ${centerPos.x.toFixed(3)}, ${centerPos.y.toFixed(3)}, ${centerPos.z.toFixed(3)} with radius: ${scale.toFixed(3)}`
    )
  },

  updateSpheres: function (time) {
    const currentTime = Date.now()

    // Update sphere positions and remove old ones
    for (let i = this.createdSpheres.length - 1; i >= 0; i--) {
      const sphere = this.createdSpheres[i]

      // Skip spheres that are animating on paths - they shouldn't be removed
      if (sphere.hasAttribute('path-animator-simple')) {
        // Remove from our tracking but don't delete the sphere
        this.createdSpheres.splice(i, 1)
        continue
      }

      // Check lifetime
      if (currentTime - sphere.createdTime > sphere.lifetime) {
        // Remove components first to avoid geometry error
        try {
          if (sphere.hasAttribute('wobbly-sphere')) {
            sphere.removeAttribute('wobbly-sphere')
          }
          // Just remove the entity
          if (sphere.parentNode) {
            sphere.parentNode.removeChild(sphere)
          }
        } catch (e) {
          console.warn('Error removing sphere:', e)
        }
        this.createdSpheres.splice(i, 1)
        continue
      }

      // No floating motion - spheres stay where created
    }
  },

  remove: function () {
    // Clean up preview sphere
    if (this.previewSphere) {
      this.previewSphere.remove()
    }

    // Clean up all created spheres
    this.createdSpheres.forEach((sphere) => {
      sphere.remove()
    })
    this.createdSpheres = []
  },
}