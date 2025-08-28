// Component for spawning spheres with pinch gesture
export const handXrSphereSpawnerComponent = {
  schema: {
    hand: { default: 'right', oneOf: ['left', 'right'] },
  },

  init: function () {
    this.createdSpheres = []
    this.isPinching = false
    this.pinchThreshold = 0.3 // Distance threshold for pinch detection (increased)
    this.maxPreviewDistance = 0.5 // Maximum distance to show preview (increased)
    this.stabilizationTime = 1500 // 1.5 seconds of stable position needed
    this.stabilizationThreshold = 0.005 // Maximum movement allowed during stabilization

    // Preview sphere
    this.previewSphere = null
    this.previewStartTime = 0
    this.lastPreviewDistance = 0
    this.isStabilizing = false

    // Get reference to wrist menu for checking sphere mode
    this.wristMenu = null

    this.createPreviewSphere()
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

  tick: function (time) {
    // Get wrist menu component to check if sphere mode is enabled
    if (!this.wristMenu) {
      this.wristMenu = this.el.components['hand-xr-wrist-menu']
    }

    // Only spawn spheres if sphere mode is enabled
    if (!this.wristMenu || !this.wristMenu.sphereModeEnabled) {
      this.previewSphere.setAttribute('visible', false)
      this.isStabilizing = false
      return
    }

    const handControls = this.el.components['hand-tracking-controls']
    if (!handControls) return

    // Get hand model
    const handModel = handControls.el.object3D
    if (!handModel || handModel.children.length === 0) return

    // Get thumb and index positions
    const thumbTip = handModel.getObjectByName('thumb-tip')
    const indexTip = handModel.getObjectByName('index-finger-tip')

    if (thumbTip && indexTip) {
      const thumbPos = new THREE.Vector3()
      const indexPos = new THREE.Vector3()

      thumbTip.getWorldPosition(thumbPos)
      indexTip.getWorldPosition(indexPos)

      // Calculate distance between thumb and index
      const distance = thumbPos.distanceTo(indexPos)

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
        const scale = Math.max(distance * 2, 0.05) // Scale up for better visibility
        this.previewSphere.setAttribute('radius', scale)

        // Store the current distance for sphere creation
        this.currentDistance = distance

        // Check for pinch and stabilization
        if (distance < this.pinchThreshold) {
          if (!this.isStabilizing) {
            // Start stabilization
            this.isStabilizing = true
            this.previewStartTime = time
            this.lastPreviewDistance = distance
          } else {
            // Check if position is stable
            const distanceChange = Math.abs(distance - this.lastPreviewDistance)

            if (distanceChange > this.stabilizationThreshold) {
              // Position changed too much, reset stabilization
              this.previewStartTime = time
              this.lastPreviewDistance = distance
            } else {
              // Check if stabilized for long enough
              if (time - this.previewStartTime >= this.stabilizationTime) {
                // Create the actual sphere
                this.createSphere(thumbPos, indexPos, distance)

                // Reset stabilization
                this.isStabilizing = false
                this.previewStartTime = 0
              }
            }
          }
        } else {
          // Not pinching, reset stabilization
          this.isStabilizing = false
        }
      } else {
        // Fingers are separating
        if (this.isStabilizing && this.previewStartTime > 0) {
          // Was stabilizing, now releasing - create sphere at current distance
          const stabilizationDuration = time - this.previewStartTime
          if (stabilizationDuration >= this.stabilizationTime) {
            // Create sphere even if fingers are far apart
            this.createSphere(thumbPos, indexPos, distance)
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
    const scale = Math.max(distance * 2, 0.05) // Same as preview
    sphere.setAttribute('radius', scale)

    // Get current color from menu
    const currentColor = this.wristMenu
      ? this.wristMenu.currentColor
      : '#4CC3D9'

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

    // No additional scaling needed - the radius is already set to match preview
    // sphere.setAttribute('scale', '1 1 1') // Keep at normal scale

    // Add random rotation
    sphere.setAttribute('rotation', {
      x: Math.random() * 360,
      y: Math.random() * 360,
      z: Math.random() * 360,
    })

    // Add pinchable component for interaction
    sphere.setAttribute('pinchable-xr', '')

    // No velocity - spheres should stay where created
    // sphere.velocity = null

    // Set lifetime (5-10 minutes for spheres not on paths)
    sphere.lifetime = THREE.MathUtils.randFloat(300000, 600000)
    sphere.createdTime = Date.now()

    // Add to scene with small delay to ensure proper initialization
    this.el.sceneEl.appendChild(sphere)

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
      `Sphere created at: ${centerPos.x}, ${centerPos.y}, ${centerPos.z} with radius: ${scale}`
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

      // Check lifetime only for non-animated spheres
      if (currentTime - sphere.createdTime > sphere.lifetime) {
        // Remove components first to avoid geometry error
        try {
          if (sphere.hasAttribute('wobbly-sphere')) {
            sphere.removeAttribute('wobbly-sphere')
          }
          // Don't remove geometry/material attributes on primitives
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
