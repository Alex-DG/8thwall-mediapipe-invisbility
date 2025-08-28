// Component to make drawn lines pinchable and moveable
export const pinchableLineComponent = {
  schema: {
    grabDistance: { default: 0.12 } // Slightly larger than spheres but still reasonable
  },

  init: function () {
    this.grabbed = false
    this.grabOffset = new THREE.Vector3()
    this.originalPosition = new THREE.Vector3()
    this.attachedSpheres = []
    this.pathData = null
    
    // Listen for pinch events
    this.el.sceneEl.addEventListener('pinchstarted', this.onPinchStarted.bind(this))
    this.el.sceneEl.addEventListener('pinchended', this.onPinchEnded.bind(this))
    this.el.sceneEl.addEventListener('pinchmoved', this.onPinchMoved.bind(this))
    
    // Store original path data
    this.el.addEventListener('path-data-set', (event) => {
      this.pathData = event.detail.path
      this.originalPathData = event.detail.path.map(p => p.clone())
    })
  },
  
  isInteractionAllowed: function() {
    // Check all hands for drawing or sphere mode
    const hands = this.el.sceneEl.querySelectorAll('[hand-tracking-controls]')
    
    for (let hand of hands) {
      // Check drawing mode
      const drawComponent = hand.components['hand-xr-draw']
      if (drawComponent && drawComponent.isDrawing) {
        return false
      }
      
      // Check sphere mode
      const wristMenu = hand.components['hand-xr-wrist-menu']
      if (wristMenu && wristMenu.sphereModeEnabled) {
        return false
      }
    }
    
    return true
  },

  onPinchStarted: function (evt) {
    if (this.grabbed) return
    
    // Only allow line grabbing if both drawing and sphere spawning are disabled
    if (!this.isInteractionAllowed()) {
      return
    }
    
    const pinchPosition = evt.detail.position
    if (!pinchPosition) return

    // Check if pinch is near any point on the line
    const mesh = this.el.getObject3D('mesh')
    if (!mesh) return

    // Get world position of the line
    const worldPos = new THREE.Vector3()
    this.el.object3D.getWorldPosition(worldPos)

    // Check distance to line segments
    let minDistance = Infinity
    let closestPoint = null
    
    if (this.pathData) {
      for (let i = 0; i < this.pathData.length - 1; i++) {
        const lineStart = this.pathData[i].clone().add(worldPos)
        const lineEnd = this.pathData[i + 1].clone().add(worldPos)
        const { distance, point } = this.distanceToLineSegment(pinchPosition, lineStart, lineEnd)
        
        if (distance < minDistance) {
          minDistance = distance
          closestPoint = point
        }
      }
    }

    // Before grabbing the line, check if there's a sphere nearby that should take priority
    const spheres = this.el.sceneEl.querySelectorAll('[wobbly-sphere]')
    let sphereNearby = false
    
    spheres.forEach(sphere => {
      const sphereDistance = sphere.object3D.position.distanceTo(pinchPosition)
      // Check if sphere is pinchable and within its grab distance
      const pinchableXr = sphere.components['pinchable-xr']
      if (pinchableXr) {
        const isMoving = sphere.hasAttribute('path-animator-simple') && 
                        sphere.components['path-animator-simple'] && 
                        sphere.components['path-animator-simple'].isPlaying
        const sphereGrabDist = isMoving ? pinchableXr.data.movingGrabDistance : pinchableXr.data.grabDistance
        
        if (sphereDistance < sphereGrabDist) {
          sphereNearby = true
        }
      }
    })
    
    // If close enough and no sphere takes priority, grab the line
    if (minDistance < this.data.grabDistance && !this.grabbed && !sphereNearby) {
      this.grabbed = true
      this.grabbingHand = evt.detail.hand // Track which hand is grabbing
      this.grabOffset.subVectors(worldPos, pinchPosition)
      this.originalPosition.copy(worldPos)
      
      // Change line color to indicate it's grabbed
      const material = mesh.material
      if (material) {
        this.originalColor = material.color.clone()
        material.color = new THREE.Color('#00ff00') // Green when grabbed
      }
      
      // Find all spheres that are animating on this path
      this.findAttachedSpheres()
      
      console.log('Line grabbed at distance:', minDistance)
    }
  },

  onPinchMoved: function (evt) {
    if (!this.grabbed) return
    
    // Only move if it's the same hand that grabbed it
    if (evt.detail.hand !== this.grabbingHand) return

    const pinchPosition = evt.detail.position
    if (!pinchPosition) return

    // Calculate new position
    const newPosition = new THREE.Vector3().copy(pinchPosition).add(this.grabOffset)
    const movement = new THREE.Vector3().subVectors(newPosition, this.originalPosition)
    
    // Move the line
    this.el.object3D.position.add(movement)
    this.originalPosition.copy(newPosition)
    
    // Update path data - the path stays in local coordinates relative to the line entity
    // We don't need to update the path data itself since it's relative to the line's position
    
    // Don't move spheres directly - they will follow the path curve automatically
    
    // Emit event to update path animation
    this.el.emit('path-moved', {
      path: this.pathData,
      movement: movement
    })
  },

  onPinchEnded: function (evt) {
    // Only release if it's the same hand that grabbed it
    if (!this.grabbed || evt.detail.hand !== this.grabbingHand) return
    
    this.grabbed = false
    this.grabbingHand = null
    
    // Restore original color
    const mesh = this.el.getObject3D('mesh')
    if (mesh && mesh.material && this.originalColor) {
      mesh.material.color.copy(this.originalColor)
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
    
    console.log('Line released')
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

  remove: function () {
    this.el.sceneEl.removeEventListener('pinchstarted', this.onPinchStarted)
    this.el.sceneEl.removeEventListener('pinchended', this.onPinchEnded)
    this.el.sceneEl.removeEventListener('pinchmoved', this.onPinchMoved)
  }
}