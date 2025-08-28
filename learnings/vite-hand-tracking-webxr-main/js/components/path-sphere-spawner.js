// Component that spawns spheres on drawing paths
export const pathSphereSpawnerComponent = {
  schema: {
    sphereRadius: { type: 'number', default: 0.05 },
    animationSpeed: { type: 'number', default: 0.2 }, // Speed in m/s (slow and smooth)
    maxSpheres: { type: 'number', default: 5 }
  },

  init: function () {
    this.spheres = []
    this.loops = [] // Store all self-intersecting loops
    this.lineEntities = [] // Store references to line entities
    
    // console.log('Path sphere spawner initialized')
    
    // Listen for drawing loop events
    this.el.sceneEl.addEventListener('drawing-loop-created', this.onLoopCreated.bind(this))
    
    // Listen for wobbly sphere creation events
    this.el.sceneEl.addEventListener('wobbly-sphere-created', this.onSphereCreated.bind(this))
    
    // Listen for sphere release events
    this.el.sceneEl.addEventListener('sphere-released', this.onSphereReleased.bind(this))
    
    // Listen for path movement events
    this.onPathMoved = this.onPathMoved.bind(this)
  },

  onLoopCreated: function (event) {
    // Store the new loop with intersection info
    const loopData = {
      path: event.detail.path,
      intersection: event.detail.intersection,
      hasLoop: !!event.detail.intersection, // Only true loops should animate spheres
      lineEntity: event.detail.lineEntity // Store reference to the line entity
    }
    this.loops.push(loopData)
    
    // Listen for path moved events on this line entity
    if (event.detail.lineEntity) {
      event.detail.lineEntity.addEventListener('path-moved', this.onPathMoved)
      this.lineEntities.push(event.detail.lineEntity)
    }
    
    // Check all existing spheres to see if they should animate on this new loop
    if (loopData.hasLoop) {
      const spheres = this.el.sceneEl.querySelectorAll('[wobbly-sphere]')
      spheres.forEach(sphere => {
        // Skip spheres that are already animating
        if (sphere.hasAttribute('path-animator-simple')) {
          return
        }
        
        // Get sphere world position
        const spherePos = sphere.object3D.getWorldPosition(new THREE.Vector3())
        
        // Get the line entity's world transform
        let lineWorldPos = new THREE.Vector3()
        if (loopData.lineEntity && loopData.lineEntity.object3D) {
          loopData.lineEntity.object3D.getWorldPosition(lineWorldPos)
        }
        
        // Check if sphere is near this new loop
        let nearPath = false
        let minDistance = Infinity
        
        for (let i = 0; i < loopData.path.length - 1; i++) {
          // Transform line points to world coordinates
          const lineStart = loopData.path[i].clone().add(lineWorldPos)
          const lineEnd = loopData.path[i + 1].clone().add(lineWorldPos)
          const distance = this.distanceToLineSegment(spherePos, lineStart, lineEnd)
          
          if (distance < minDistance) {
            minDistance = distance
          }
          
          if (distance < 0.15) { // 15cm threshold
            nearPath = true
          }
        }
        
        // If sphere is on the new loop, animate it
        if (nearPath) {
          console.log('Found existing sphere on new loop, starting animation')
          this.animateSphereOnPath(sphere, loopData)
          // Track this sphere if not already tracked
          if (!this.spheres.includes(sphere)) {
            this.spheres.push(sphere)
          }
        }
      })
    }
  },

  onSphereCreated: function (event) {
    // console.log('Sphere created event received. Loops available:', this.loops.length)
    
    if (this.loops.length === 0) {
      // console.log('No loops available for sphere animation')
      return
    }
    
    const sphere = event.detail.sphere
    // Use the position from the event, not the sphere's current position
    // Clone the position to avoid reference issues
    const spherePos = event.detail.position.clone()
    
    // Check against all loops
    for (let loopIndex = 0; loopIndex < this.loops.length; loopIndex++) {
      const loopData = this.loops[loopIndex]
      const loop = loopData.path
      let nearPath = false
      let minDistance = Infinity
      let closestSegmentIndex = -1
      
      // Get the line entity's world transform
      let lineWorldPos = new THREE.Vector3()
      if (loopData.lineEntity && loopData.lineEntity.object3D) {
        loopData.lineEntity.object3D.getWorldPosition(lineWorldPos)
      }
      
      for (let i = 0; i < loop.length - 1; i++) {
        // Transform line points to world coordinates
        const lineStart = loop[i].clone().add(lineWorldPos)
        const lineEnd = loop[i + 1].clone().add(lineWorldPos)
        const distance = this.distanceToLineSegment(spherePos, lineStart, lineEnd)
        
        if (distance < minDistance) {
          minDistance = distance
          closestSegmentIndex = i
        }
        
        if (distance < 0.15) { // 15cm - more forgiving for hand placement
          nearPath = true
        }
      }
      
      if (nearPath && loopData.hasLoop) {
        // Much longer delay to ensure sphere position is truly stable
        setTimeout(() => {
          const worldPos = sphere.object3D.getWorldPosition(new THREE.Vector3())
          this.animateSphereOnPath(sphere, loopData)
        }, 500) // Increased delay
        return // Stop checking other loops
      } else if (nearPath) {
        // console.log('Sphere is near path', loopIndex, 'but path has no loop, not animating')
      }
    }
  },

  animateSphereOnPath: function (sphere, loopData) {
    // console.log('Animating sphere on path with', loopData.path.length, 'points')
    
    // Get sphere radius if available
    const sphereRadius = sphere.getAttribute('radius') || sphere.getAttribute('wobbly-sphere')?.radius || this.data.sphereRadius
    
    // Get line world position for proper path transformation
    let lineWorldPos = new THREE.Vector3()
    if (loopData.lineEntity && loopData.lineEntity.object3D) {
      loopData.lineEntity.object3D.getWorldPosition(lineWorldPos)
    }
    
    // Transform path points to world coordinates
    const worldPath = loopData.path.map(p => p.clone().add(lineWorldPos))
    
    // Simple animation config - let path-animator find closest point
    const animatorConfig = {
      path: worldPath,
      speed: this.data.animationSpeed,
      loop: true,
      autoStart: true,
      easing: 'easeInOut',
      sphereRadius: sphereRadius,
      lineEntity: loopData.lineEntity  // Store reference for updates
    }
    
    // Try the simple animator instead
    sphere.setAttribute('path-animator-simple', animatorConfig)
    
    // Track animated sphere
    if (!this.spheres.includes(sphere)) {
      this.spheres.push(sphere)
    }
  },

  distanceToLineSegment: function (point, lineStart, lineEnd) {
    const line = new THREE.Vector3().subVectors(lineEnd, lineStart)
    const lineLength = line.length()
    line.normalize()
    
    const toPoint = new THREE.Vector3().subVectors(point, lineStart)
    const projection = toPoint.dot(line)
    
    if (projection <= 0) {
      return point.distanceTo(lineStart)
    } else if (projection >= lineLength) {
      return point.distanceTo(lineEnd)
    } else {
      const projectedPoint = new THREE.Vector3()
        .copy(lineStart)
        .addScaledVector(line, projection)
      return point.distanceTo(projectedPoint)
    }
  },

  onSphereReleased: function (event) {
    const sphere = event.detail.sphere
    const position = event.detail.position
    const animationData = event.detail.animationData
    
    // console.log('Sphere released, checking if still on path')
    
    // Check if sphere is still near any loop
    let foundNearPath = false
    
    for (let loopIndex = 0; loopIndex < this.loops.length; loopIndex++) {
      const loopData = this.loops[loopIndex]
      const loop = loopData.path
      
      // Get the line entity's world transform
      let lineWorldPos = new THREE.Vector3()
      if (loopData.lineEntity && loopData.lineEntity.object3D) {
        loopData.lineEntity.object3D.getWorldPosition(lineWorldPos)
      }
      
      // Check distance to path
      let minDistance = Infinity
      for (let i = 0; i < loop.length - 1; i++) {
        // Transform line points to world coordinates
        const lineStart = loop[i].clone().add(lineWorldPos)
        const lineEnd = loop[i + 1].clone().add(lineWorldPos)
        const distance = this.distanceToLineSegment(position, lineStart, lineEnd)
        if (distance < minDistance) {
          minDistance = distance
        }
      }
      
      if (minDistance < 0.15 && loopData.hasLoop) {
        // On path, animate from current position
        // console.log('Sphere on path, starting/resuming animation from position:', position.x.toFixed(3), position.y.toFixed(3), position.z.toFixed(3))
        foundNearPath = true
        
        // Don't snap - keep sphere where user placed it
        // Remove existing animator first to ensure clean restart
        if (sphere.hasAttribute('path-animator-simple')) {
          sphere.removeAttribute('path-animator-simple')
          // Small delay to ensure removal is processed
          setTimeout(() => {
            this.animateSphereOnPath(sphere, loopData)
          }, 10)
        } else {
          this.animateSphereOnPath(sphere, loopData)
        }
        break
      }
    }
    
    if (!foundNearPath) {
      // Not on any path, remove animation
      // console.log('Sphere not on any path, removing animation')
      if (sphere.hasAttribute('path-animator-simple')) {
        sphere.removeAttribute('path-animator-simple')
      }
      
      // Remove from tracked spheres
      const index = this.spheres.indexOf(sphere)
      if (index > -1) {
        this.spheres.splice(index, 1)
      }
    }
  },
  
  onPathMoved: function (event) {
    // When a path is moved, update the animator components and sphere positions
    const lineEntity = event.target
    const movement = event.detail.movement
    
    // Find which loop this line entity belongs to
    let movedLoopData = null
    for (let loop of this.loops) {
      if (loop.lineEntity === lineEntity) {
        movedLoopData = loop
        break
      }
    }
    
    if (!movedLoopData) return
    
    console.log('Path moved, updating spheres on this path')
    
    // Update all spheres that are animating on this path
    const spheresToUpdate = []
    
    // Find all spheres with path-animator-simple component
    const allAnimatedSpheres = this.el.sceneEl.querySelectorAll('[path-animator-simple]')
    
    allAnimatedSpheres.forEach(sphere => {
      const animator = sphere.components['path-animator-simple']
      if (!animator) return
      
      // Check if this sphere's line entity matches the moved line
      // Use both the stored lineEntity and check if it's the same element
      if (animator.lineEntity === lineEntity || 
          (animator.lineEntity && animator.lineEntity.el === lineEntity)) {
        spheresToUpdate.push({ sphere, animator })
      }
    })
    
    console.log(`Found ${spheresToUpdate.length} spheres to update on moved path`)
    
    spheresToUpdate.forEach(({ sphere, animator }) => {
      // Get line world position for proper path transformation
      let lineWorldPos = new THREE.Vector3()
      if (movedLoopData.lineEntity && movedLoopData.lineEntity.object3D) {
        movedLoopData.lineEntity.object3D.getWorldPosition(lineWorldPos)
      }
      
      // Transform path points to world coordinates
      const worldPath = movedLoopData.path.map(p => p.clone().add(lineWorldPos))
      
      // Update the animator's path data and reinitialize
      animator.data.path = worldPath
      animator.initializeCurve()
    })
  },
  
  remove: function () {
    this.el.sceneEl.removeEventListener('drawing-loop-created', this.onLoopCreated)
    this.el.sceneEl.removeEventListener('wobbly-sphere-created', this.onSphereCreated)
    this.el.sceneEl.removeEventListener('sphere-released', this.onSphereReleased)
    
    // Remove path moved listeners from all line entities
    this.lineEntities.forEach(entity => {
      entity.removeEventListener('path-moved', this.onPathMoved)
    })
  }
}