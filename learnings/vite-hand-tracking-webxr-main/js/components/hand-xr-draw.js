import { MeshLine, MeshLineMaterial } from '../libs/MeshLine.js'

// Component to draw with index fingertip
export const handXrDrawComponent = {
  schema: {
    hand: { default: 'left', oneOf: ['left', 'right'] },
  },

  init: function () {
    // Create the hotpink sphere pointer for index finger
    this.sphere = document.createElement('a-sphere')
    this.sphere.setAttribute('radius', 0.005)
    this.sphere.setAttribute('color', 'hotpink')
    this.sphere.setAttribute('position', '0 0 0')
    this.el.sceneEl.appendChild(this.sphere)
    
    // Create the light blue sphere for thumb tip
    this.thumbSphere = document.createElement('a-sphere')
    this.thumbSphere.setAttribute('radius', 0.005)
    this.thumbSphere.setAttribute('color', 'lightblue')
    this.thumbSphere.setAttribute('position', '0 0 0')
    this.el.sceneEl.appendChild(this.thumbSphere)

    this.handEl = null
    
    // Drawing state
    this.isDrawing = false // Drawing disabled by default
    this.currentStroke = null
    this.strokePoints = []
    this.previousPosition = new THREE.Vector3()
    this.currentColor = 'hotpink'
    this.detectedIntersection = null // Store intersection during drawing
    
    // Container for all strokes
    this.drawingContainer = document.createElement('a-entity')
    this.drawingContainer.setAttribute('id', `${this.data.hand}-hand-drawing`)
    this.el.sceneEl.appendChild(this.drawingContainer)
    
    // Load stroke texture
    this.loadStrokeTexture()
  },

  tick: function () {
    // Get hand tracking controls component
    if (!this.handEl) {
      this.handEl = this.el
      const handControls = this.handEl.components['hand-tracking-controls']
      if (!handControls) return
    }

    const handControls = this.handEl.components['hand-tracking-controls']
    if (!handControls) return

    // Update sphere position and draw
    if (handControls.indexTipPosition) {
      this.sphere.object3D.position.copy(handControls.indexTipPosition)
      this.sphere.object3D.visible = true
      
      // Handle drawing
      this.handleDrawing(handControls.indexTipPosition)
    } else {
      this.sphere.object3D.visible = false
      // End stroke if hand is not visible
      if (this.currentStroke) {
        this.endStroke()
      }
    }
    
    // Update thumb sphere position
    const handModel = handControls.el.object3D
    if (handModel && handModel.children.length > 0) {
      const thumbTip = handModel.getObjectByName('thumb-tip')
      if (thumbTip) {
        const thumbPos = new THREE.Vector3()
        thumbTip.getWorldPosition(thumbPos)
        this.thumbSphere.object3D.position.copy(thumbPos)
        this.thumbSphere.object3D.visible = true
      } else {
        this.thumbSphere.object3D.visible = false
      }
    } else {
      this.thumbSphere.object3D.visible = false
    }
  },
  
  handleDrawing: function(position) {
    // Only draw if drawing is enabled
    if (!this.isDrawing) {
      // End current stroke if drawing was just disabled
      if (this.currentStroke) {
        this.endStroke()
      }
      this.previousPosition.copy(position)
      return
    }
    
    const distance = position.distanceTo(this.previousPosition)
    
    // Start new stroke if we don't have one
    if (!this.currentStroke) {
      this.startStroke()
    }
    
    // Add point if moved enough (but not too much - prevents jumps)
    if (distance > 0.001 && distance < 0.1) {
      this.addPointToStroke(position)
    } else if (distance > 0.1) {
      // End stroke and start new one if hand moved too far
      this.endStroke()
      this.startStroke()
    }
    
    this.previousPosition.copy(position)
  },
  
  startStroke: function() {
    this.strokePoints = []
    this.detectedIntersection = null // Reset intersection for new stroke
    this.currentStroke = document.createElement('a-entity')
    // Add pinchable component to make the line grabbable
    this.currentStroke.setAttribute('pinchable-line', '')
    this.drawingContainer.appendChild(this.currentStroke)
  },
  
  addPointToStroke: function(position) {
    this.strokePoints.push(position.clone())
    
    // Need at least 2 points to draw a line
    if (this.strokePoints.length >= 2) {
      this.updateStrokeMesh()
    }
    
    // Check for self-intersection while drawing
    if (this.strokePoints.length > 4 && this.strokePoints.length % 10 === 0) {
      const intersection = this.checkSelfIntersection()
      if (intersection) {
        // Store the intersection for later use
        this.detectedIntersection = intersection
      }
    }
  },
  
  updateStrokeMesh: function() {
    // Create geometry from points
    const geometry = new THREE.BufferGeometry()
    const positions = []
    
    this.strokePoints.forEach(point => {
      positions.push(point.x, point.y, point.z)
    })
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    
    // Create MeshLine
    const line = new MeshLine()
    line.setGeometry(geometry)
    
    // Create MeshLineMaterial with texture
    const material = new MeshLineMaterial({
      useMap: this.strokeTexture ? 1 : 0,
      map: this.strokeTexture,
      color: new THREE.Color(this.currentColor),
      opacity: 1.0,
      lineWidth: 0.02,
      sizeAttenuation: 1,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
      alphaTest: 0.1,
      transparent: true,
      depthWrite: true,
      depthTest: true,
    })
    
    // Remove old mesh if exists
    if (this.currentStroke.getObject3D('mesh')) {
      this.currentStroke.removeObject3D('mesh')
    }
    
    // Create and add new mesh
    const mesh = new THREE.Mesh(line.geometry, material)
    this.currentStroke.setObject3D('mesh', mesh)
  },
  
  endStroke: function() {
    if (this.strokePoints.length < 2 && this.currentStroke) {
      // Remove empty stroke
      this.currentStroke.remove()
    } else if (this.strokePoints.length >= 3) {
      // Use the stored intersection from drawing or check one more time
      const intersection = this.detectedIntersection || this.checkSelfIntersection()
      
      // Only emit if there's an actual loop
      if (intersection) {
        console.log('Stroke ended with self-intersection, creating loop')
        
        // Emit event with path data and intersection info
        this.el.sceneEl.emit('drawing-loop-created', {
          path: this.strokePoints.map(p => p.clone()),
          hand: this.data.hand,
          intersection: intersection,
          lineEntity: this.currentStroke
        })
      } else {
        console.log('Stroke ended without intersection, no loop created')
      }
      
      // Emit path data to the stroke entity for pinchable-line component
      if (this.currentStroke && this.strokePoints.length > 0) {
        this.currentStroke.emit('path-data-set', {
          path: this.strokePoints.map(p => p.clone())
        })
      }
    }
    this.currentStroke = null
    this.strokePoints = []
    this.detectedIntersection = null
  },
  
  checkSelfIntersection: function() {
    console.log('Checking self-intersection. Points:', this.strokePoints.length)
    
    // Need at least 4 points to have an intersection
    if (this.strokePoints.length < 4) return null
    
    let foundIntersection = null
    let intersectionCount = 0
    
    // Check all segments against all other non-adjacent segments
    for (let i = 0; i < this.strokePoints.length - 1; i++) {
      const p1 = this.strokePoints[i]
      const p2 = this.strokePoints[i + 1]
      
      // Check against all other segments (skip adjacent ones)
      for (let j = 0; j < this.strokePoints.length - 1; j++) {
        // Skip if segments are adjacent or the same
        if (Math.abs(i - j) <= 1) continue
        
        const p3 = this.strokePoints[j]
        const p4 = this.strokePoints[j + 1]
        
        // Check if lines intersect
        const intersection = this.getLineIntersection(
          p1.x, p1.z,
          p2.x, p2.z,
          p3.x, p3.z,
          p4.x, p4.z
        )
        
        if (intersection) {
          intersectionCount++
          console.log(`Self-intersection detected between segments ${i}-${i+1} and ${j}-${j+1}!`)
          console.log(`  Segment 1: (${p1.x.toFixed(3)}, ${p1.z.toFixed(3)}) to (${p2.x.toFixed(3)}, ${p2.z.toFixed(3)})`)
          console.log(`  Segment 2: (${p3.x.toFixed(3)}, ${p3.z.toFixed(3)}) to (${p4.x.toFixed(3)}, ${p4.z.toFixed(3)})`)
          
          // Also check Y values to ensure they're reasonably close
          const avgY1 = (p1.y + p2.y) / 2
          const avgY2 = (p3.y + p4.y) / 2
          const yDiff = Math.abs(avgY1 - avgY2)
          console.log(`  Y difference: ${yDiff.toFixed(3)}m`)
          
          if (yDiff < 0.3) { // Increased tolerance to 30cm vertically
            // Calculate 3D intersection point
            const intersectionPoint = new THREE.Vector3(
              intersection.x,
              (avgY1 + avgY2) / 2, // Average Y value
              intersection.z
            )
            // Return the first intersection found
            return {
              point: intersectionPoint,
              index: Math.min(i, j) + 1 // Index after the earlier segment
            }
          }
        }
      }
    }
    
    console.log(`No valid self-intersection found. Checked ${(this.strokePoints.length - 1) * (this.strokePoints.length - 2) / 2} segment pairs, found ${intersectionCount} intersections`)
    
    // Check if start and end points are close enough to form a loop
    if (this.strokePoints.length > 10) {
      const startPoint = this.strokePoints[0]
      const endPoint = this.strokePoints[this.strokePoints.length - 1]
      const distance = startPoint.distanceTo(endPoint)
      
      console.log(`Distance between start and end: ${distance.toFixed(3)}m`)
      
      if (distance < 0.15) { // Within 15cm
        console.log('Start and end points close enough - treating as loop')
        return {
          point: startPoint.clone(),
          index: 0 // Loop starts at beginning
        }
      }
    }
    
    return null
  },
  
  lineSegmentsIntersect: function(x1, y1, x2, y2, x3, y3, x4, y4) {
    const intersection = this.getLineIntersection(x1, y1, x2, y2, x3, y3, x4, y4)
    return intersection !== null
  },
  
  getLineIntersection: function(x1, y1, x2, y2, x3, y3, x4, y4) {
    // Calculate the direction vectors
    const dx1 = x2 - x1
    const dy1 = y2 - y1
    const dx2 = x4 - x3
    const dy2 = y4 - y3
    
    const denom = dx1 * dy2 - dy1 * dx2
    
    // Check if lines are parallel
    if (Math.abs(denom) < 0.0001) {
      return null
    }
    
    const t = ((x3 - x1) * dy2 - (y3 - y1) * dx2) / denom
    const u = ((x3 - x1) * dy1 - (y3 - y1) * dx1) / denom
    
    // Check if intersection point is within both line segments
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      const intersectX = x1 + t * dx1
      const intersectZ = y1 + t * dy1
      return { x: intersectX, z: intersectZ }
    }
    
    return null
  },
  
  loadStrokeTexture: function () {
    // Load the stroke texture
    const textureLoader = new THREE.TextureLoader()
    this.strokeTexture = textureLoader.load(
      '/textures/stroke-00.png',
      (texture) => {
        console.log('✅', 'Stroke texture loaded successfully for hand-xr-draw')
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
      },
      undefined,
      (error) => {
        console.error('Error loading stroke texture:', error)
      }
    )
  },

  remove: function () {
    if (this.sphere) {
      this.sphere.remove()
    }
    if (this.thumbSphere) {
      this.thumbSphere.remove()
    }
    if (this.drawingContainer) {
      this.drawingContainer.remove()
    }
  },
}