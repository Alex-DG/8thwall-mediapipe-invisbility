import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { MeshLine, MeshLineMaterial } from '../libs/MeshLine.js'

let handLandmarker
let video
let lastVideoTime = -1
let results = undefined

// Initialize MediaPipe Hand Landmarker
async function createHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
  )

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
  })
}

// A-Frame component for hand tracking in portal-hand scene
export const mediapipePortalHandComponent = {
  tick: function (time) {
    // Update shader uniforms
    if (this.indexFingerShader) {
      this.indexFingerShader.uniforms.time.value = time * 0.001
    }

    // Remove all pulse rings when markers are disabled
    if (!this.handMarkersVisible && this.pulseRings) {
      // Clean up any existing pulse rings
      this.pulseRings.forEach((pulse) => {
        if (pulse.mesh.parent) {
          pulse.mesh.parent.remove(pulse.mesh)
        }
      })
      this.pulseRings = []
    }

    // Update cyberpunk landmark animations when visible
    if (this.handMarkersVisible && this.handEntities) {
      const pulse = Math.sin(time * 0.003) * 0.2 + 0.8 // Pulsing effect
      const fastPulse = Math.sin(time * 0.01) * 0.3 + 0.7 // Faster pulse for tips

      this.handEntities.forEach((hand, handIndex) => {
        hand.landmarks.forEach((landmark, i) => {
          const mesh = landmark.getObject3D('mesh')
          const glow = landmark.getObject3D('glow')

          if (mesh && mesh.material) {
            // Fingertips pulse faster
            if ([4, 8, 12, 16, 20].includes(i)) {
              mesh.material.emissiveIntensity = 0.5 * fastPulse
              if (glow) glow.material.opacity = 0.3 * fastPulse
            } else {
              mesh.material.emissiveIntensity = 0.5 * pulse
              if (glow) glow.material.opacity = 0.3 * pulse
            }
          }
        })
      })
    }

    // Update animations
    if (this.animatingStrokes) {
      this.updateFloatingAnimation(time)
    } else if (this.floatingAnimation) {
      this.updateYAxisFloating(time)
    }
  },

  init: function () {
    console.log('⚙️', 'MediaPipe Hand Component initializing...')
    this.handEntities = []

    // Drawing state
    this.isDrawing = false
    this.drawingEnabled = false // Disabled by default to match UI
    this.currentStroke = null
    this.strokePoints = []
    this.lastDrawTime = 0
    this.drawingContainer = null
    this.currentColor = '#FFFFFF' // Default to white
    this.allStrokes = [] // Keep track of all strokes for undo
    this.currentStrokeEntities = [] // Track entities in current stroke
    this.handWasVisible = false // Track if hand was previously visible
    this.handMarkersVisible = true // Track if hand markers should be shown
    this.strokeStartCameraPos = null // Store camera position when stroke starts
    this.strokeStartCameraRot = null // Store camera rotation when stroke starts
    this.handPositionBuffer = {} // Buffer for hand position stabilization
    this.handStabilizationFrames = 5 // Number of frames to average
    this.strokeTexture = null // Texture for brush strokes

    // Wait for scene to be ready
    if (this.el.sceneEl.hasLoaded) {
      this.initializeComponents()
    } else {
      this.el.sceneEl.addEventListener('loaded', () => {
        this.initializeComponents()
      })
    }
  },

  initializeComponents: function () {
    console.log('Scene loaded, initializing MediaPipe components...')

    // Create hand entities
    this.createHandEntities()

    // Create container for drawings
    this.createDrawingContainer()

    // Load stroke texture
    this.loadStrokeTexture()

    // Create index finger shader material
    this.createIndexFingerMaterial()

    // Listen for UI events
    this.setupEventListeners()

    // Setup video stream
    this.setupVideoStream()
  },

  createHandEntities: function () {
    // Create entities for hand landmarks
    for (let h = 0; h < 2; h++) {
      const handGroup = document.createElement('a-entity')
      handGroup.setAttribute('id', `hand-${h}`)
      handGroup.setAttribute('visible', false)

      const landmarks = []
      // Create 21 landmarks per hand
      for (let i = 0; i < 21; i++) {
        const landmark = document.createElement('a-entity')

        // Create cyberpunk-style geometry with different sizes for different landmarks
        let size = 0.008 // Default size
        if (i === 0) size = 0.012 // Wrist - larger
        else if ([4, 8, 12, 16, 20].includes(i)) size = 0.01 // Fingertips - medium

        const geometry = new THREE.SphereGeometry(size, 8, 8)

        // Create cyberpunk material with emissive glow
        const material = new THREE.MeshPhysicalMaterial({
          color: h === 0 ? 0x00ffff : 0xff00ff, // Cyan for left, magenta for right
          emissive: h === 0 ? 0x00ffff : 0xff00ff,
          emissiveIntensity: 0.5,
          metalness: 0.8,
          roughness: 0.2,
          wireframe: false,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
        })

        const mesh = new THREE.Mesh(geometry, material)

        // Add glow effect using a larger transparent sphere
        const glowGeometry = new THREE.SphereGeometry(size * 1.5, 8, 8)
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: h === 0 ? 0x00ffff : 0xff00ff,
          transparent: true,
          opacity: 0.3,
          side: THREE.BackSide,
        })
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial)

        landmark.setObject3D('mesh', mesh)
        landmark.setObject3D('glow', glowMesh)
        handGroup.appendChild(landmark)
        landmarks.push(landmark)
      }

      // Create connections between landmarks
      const connections = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4], // Thumb
        [0, 5],
        [5, 6],
        [6, 7],
        [7, 8], // Index finger
        [0, 9],
        [9, 10],
        [10, 11],
        [11, 12], // Middle finger
        [0, 13],
        [13, 14],
        [14, 15],
        [15, 16], // Ring finger
        [0, 17],
        [17, 18],
        [18, 19],
        [19, 20], // Pinky
        [5, 9],
        [9, 13],
        [13, 17], // Palm
      ]

      connections.forEach(([start, end]) => {
        const line = document.createElement('a-entity')
        // Cyberpunk-style lines with hand-specific colors
        const lineColor = h === 0 ? '#00ffff' : '#ff00ff'
        line.setAttribute(
          'line',
          `start: 0 0 0; end: 0 0 0; color: ${lineColor}; opacity: 0.8`
        )
        handGroup.appendChild(line)
      })

      this.el.sceneEl.appendChild(handGroup)
      this.handEntities.push({ group: handGroup, landmarks: landmarks })
    }
  },

  createDrawingContainer: function () {
    this.drawingContainer = document.createElement('a-entity')
    this.drawingContainer.setAttribute('id', 'drawing-container')
    // Make drawing container independent of camera movement
    this.drawingContainer.setAttribute('position', '0 0 0')
    this.el.sceneEl.appendChild(this.drawingContainer)
  },

  loadStrokeTexture: function () {
    // Load the stroke texture
    const textureLoader = new THREE.TextureLoader()
    this.strokeTexture = textureLoader.load(
      '/textures/stroke-00.png',
      (texture) => {
        console.log('✅', 'Stroke texture loaded successfully')
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
      },
      undefined,
      (error) => {
        console.error('Error loading stroke texture:', error)
      }
    )
  },

  createCyberpunkLineMaterial: function (color) {
    // Create animated cyberpunk line shader
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(color) },
        opacity: { value: 0.8 },
      },
      vertexShader: `
        attribute float lineDistance;
        varying float vLineDistance;
        
        void main() {
          vLineDistance = lineDistance;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float opacity;
        
        varying float vLineDistance;
        
        void main() {
          // Create moving energy pulse along the line
          float pulse = sin(vLineDistance * 10.0 - time * 3.0) * 0.5 + 0.5;
          
          // Add some noise for cyberpunk feel
          float noise = fract(sin(vLineDistance * 43.0) * 43758.5453);
          pulse += noise * 0.1;
          
          // Fade edges
          float alpha = opacity * pulse;
          
          gl_FragColor = vec4(color * (0.5 + pulse * 0.5), alpha);
        }
      `,
      transparent: true,
      linewidth: 2,
    })
  },

  createIndexFingerMaterial: function () {
    // Create a cool shader material for index finger when isolated
    this.indexFingerShader = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x00ffff) },
        glowColor: { value: new THREE.Color(0xff00ff) },
        pulseSpeed: { value: 2.0 },
        glowIntensity: { value: 2.0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform vec3 glowColor;
        uniform float pulseSpeed;
        uniform float glowIntensity;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        
        void main() {
          // Create animated gradient
          float pulse = sin(time * pulseSpeed) * 0.5 + 0.5;
          
          // Fresnel effect for rim lighting
          vec3 viewDirection = normalize(cameraPosition - vPosition);
          float fresnel = pow(1.0 - dot(viewDirection, vNormal), 2.0);
          
          // Animated energy pattern
          float pattern = sin(vPosition.x * 10.0 + time * 3.0) * 
                         sin(vPosition.y * 10.0 - time * 2.0) * 
                         sin(vPosition.z * 10.0 + time * 4.0);
          pattern = pattern * 0.5 + 0.5;
          
          // Mix colors with animation
          vec3 finalColor = mix(color, glowColor, pattern * pulse);
          
          // Add rim glow
          finalColor += glowColor * fresnel * glowIntensity * pulse;
          
          // Add inner glow
          float innerGlow = 1.0 - length(vUv - vec2(0.5)) * 2.0;
          innerGlow = clamp(innerGlow, 0.0, 1.0);
          finalColor += glowColor * innerGlow * 0.5;
          
          // Output with alpha
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      transparent: false,
    })

    // Store original materials for restoration
    this.originalMaterials = new Map()

    // Create pulse ring geometry and material
    this.createPulseRing()

    // Animation state
    this.animatingStrokes = false
    this.animationDirection = null
    this.animationSpeed = 0.0005
    this.animationOffset = { x: 0, y: 0, z: 0 }
    this.floatingAnimation = false
    this.floatingTime = 0
  },

  createPulseRing: function () {
    // Create ring geometry for pulse effect
    const ringGeometry = new THREE.RingGeometry(0.02, 0.025, 32)

    // Create pulse material
    this.pulseMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        pulseProgress: { value: 0 },
        color: { value: new THREE.Color(0x00ffff) },
      },
      vertexShader: `
        varying vec2 vUv;
        uniform float pulseProgress;
        
        void main() {
          vUv = uv;
          vec3 pos = position;
          
          // Scale the ring based on pulse progress
          float scale = 1.0 + pulseProgress * 3.0;
          pos *= scale;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float pulseProgress;
        uniform vec3 color;
        varying vec2 vUv;
        
        void main() {
          // Fade out as pulse progresses
          float alpha = (1.0 - pulseProgress) * 0.6;
          
          // Add radial gradient
          vec2 center = vec2(0.5, 0.5);
          float dist = distance(vUv, center);
          alpha *= 1.0 - dist;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    // Store pulse rings for each hand
    this.pulseRings = []
    this.lastPulseTime = 0
    this.pulseInterval = 1500 // Pulse every 1.5 seconds
  },

  setupEventListeners: function () {
    // Listen for drawing toggle
    this.el.sceneEl.addEventListener('drawing-toggled', (event) => {
      this.drawingEnabled = event.detail.enabled
      if (!this.drawingEnabled && this.isDrawing) {
        this.endStroke()
      }
    })

    // Listen for color change
    this.el.sceneEl.addEventListener('color-changed', (event) => {
      this.currentColor = event.detail.color
      // Update shader colors when color changes
      if (this.indexFingerShader) {
        this.indexFingerShader.uniforms.color.value = new THREE.Color(
          this.currentColor
        )
        this.indexFingerShader.uniforms.glowColor.value = new THREE.Color(
          this.currentColor
        ).multiplyScalar(1.5)
      }
    })

    // Listen for undo
    this.el.sceneEl.addEventListener('undo-strokes', (event) => {
      this.undoStrokes(event.detail.count)
    })

    // Listen for hand markers toggle
    this.el.sceneEl.addEventListener('hand-markers-toggled', (event) => {
      this.handMarkersVisible = event.detail.visible

      // Clean up pulse rings when markers are shown
      if (this.handMarkersVisible && this.pulseRings) {
        this.pulseRings.forEach((pulse) => {
          if (pulse.mesh.parent) {
            pulse.mesh.parent.remove(pulse.mesh)
          }
        })
        this.pulseRings = []
      }
    })

    // Listen for gesture detection events from mediapipe-gesture component
    this.el.sceneEl.addEventListener('gesture-detected', (event) => {
      const { gesture, confidence } = event.detail

      // Visual feedback based on gesture detection
      if (!this.handMarkersVisible && this.indexFingerShader) {
        if (gesture) {
          // Gesture detected - increase glow
          this.indexFingerShader.uniforms.glowIntensity.value = 2.0
        } else {
          // No gesture - subtle pulsing
          const currentTime = Date.now()
          const pulse = Math.sin(currentTime * 0.003) * 0.2 + 0.8
          this.indexFingerShader.uniforms.glowIntensity.value = pulse
        }
      }
    })

    // Listen for action menu clicks
    this.el.sceneEl.addEventListener('action-menu-clicked', (event) => {
      if (event.detail.action === 'toggle-hand-markers') {
        this.handMarkersVisible = !this.handMarkersVisible
        this.el.sceneEl.emit('hand-markers-toggled', {
          visible: this.handMarkersVisible,
        })
        console.log('Hand markers toggled:', this.handMarkersVisible)
      }
    })

    // Listen for gesture animation commands
    this.el.sceneEl.addEventListener('gesture-animation', (event) => {
      const { action, direction } = event.detail

      switch (action) {
        case 'animate':
          if (direction && this.allStrokes.length > 0) {
            this.floatingAnimation = false // Stop Y-axis floating if active
            if (!this.animatingStrokes) {
              this.startFloatingAnimation(direction)
            } else if (this.animationDirection !== direction) {
              this.animationDirection = direction
              console.log(`✨ Direction changed to: ${direction}`)
            }
          }
          break
        case 'float':
          if (this.allStrokes.length > 0) {
            this.animatingStrokes = false // Stop directional animation if active
            if (!this.floatingAnimation) {
              this.startYAxisFloating()
            }
          }
          break
        case 'stop':
          this.stopAnimation()
          this.stopYAxisFloating()
          break
        case 'reset':
          if (this.animationOffset) {
            this.animationOffset = { x: 0, y: 0, z: 0 }
            if (this.drawingContainer && this.drawingContainer.object3D) {
              this.drawingContainer.object3D.position.set(0, 0, 0)
            }
          }
          this.stopAnimation()
          this.stopYAxisFloating()
          break
      }
    })
  },

  setupVideoStream: async function () {
    // Get video stream from 8th Wall
    video = document.querySelector('video')
    if (!video) {
      // Wait for video element to be created by 8th Wall
      setTimeout(() => this.setupVideoStream(), 100)
      return
    }

    try {
      await createHandLandmarker()
      console.log('✅', 'MediaPipe Hand Landmarker initialized successfully')
      this.detectHands()
    } catch (error) {
      console.error('Error initializing MediaPipe:', error)
    }
  },

  detectHands: function () {
    if (!video || !handLandmarker) {
      console.log('Missing video or handLandmarker', {
        video: !!video,
        handLandmarker: !!handLandmarker,
      })
      return
    }

    const startTimeMs = performance.now()
    if (lastVideoTime !== video.currentTime) {
      lastVideoTime = video.currentTime
      try {
        results = handLandmarker.detectForVideo(video, startTimeMs)
        this.updateHandVisuals(results)
      } catch (error) {
        console.error('Error detecting hands:', error)
      }
    }

    requestAnimationFrame(() => this.detectHands())
  },

  updateHandVisuals: function (results) {
    const camera = document.querySelector('#camera')
    if (!camera) {
      console.log('No camera found')
      return
    }

    // Hide all hands initially
    this.handEntities.forEach((hand) => {
      hand.group.setAttribute('visible', false)
    })

    // Check if hand tracking was lost
    if (!results || !results.landmarks || results.landmarks.length === 0) {
      // Hand lost - end any active stroke
      if (this.handWasVisible && this.isDrawing) {
        this.endStroke()
      }
      this.handWasVisible = false
      return
    }

    if (results.landmarks && results.landmarks.length > 0) {
      this.handWasVisible = true
      results.landmarks.forEach((landmarks, handIndex) => {
        if (handIndex >= this.handEntities.length) return

        const hand = this.handEntities[handIndex]
        // Show full hand group if markers are visible
        hand.group.setAttribute('visible', true)

        // Emit hand tracking update event with world landmarks
        if (results.worldLandmarks && results.worldLandmarks[handIndex]) {
          this.el.sceneEl.emit('hand-tracking-update', {
            handIndex: handIndex,
            landmarks: landmarks,
            worldLandmarks: results.worldLandmarks[handIndex],
          })
        }

        // Position hand group relative to camera with stabilization
        const cameraWorldPos = new THREE.Vector3()
        const cameraWorldQuat = new THREE.Quaternion()
        camera.object3D.getWorldPosition(cameraWorldPos)
        camera.object3D.getWorldQuaternion(cameraWorldQuat)

        // Position hands in front of camera
        const handDistance = 0.6 // Distance in front of camera
        const handOffset = new THREE.Vector3(0, 0, -handDistance)
        handOffset.applyQuaternion(cameraWorldQuat)

        const targetPos = cameraWorldPos.clone().add(handOffset)

        // Smooth hand group position
        const currentPos = hand.group.object3D.position
        const posSmoothing = 0.8 // High smoothing for stable base position
        hand.group.object3D.position.lerp(targetPos, 1 - posSmoothing)

        // Smooth hand group rotation
        const currentQuat = hand.group.object3D.quaternion
        hand.group.object3D.quaternion.slerp(cameraWorldQuat, 1 - posSmoothing)

        // Update landmark positions with advanced stabilization
        landmarks.forEach((landmark, i) => {
          if (i < hand.landmarks.length) {
            // Validate landmark data
            if (
              !landmark ||
              typeof landmark.x !== 'number' ||
              typeof landmark.y !== 'number' ||
              typeof landmark.z !== 'number' ||
              isNaN(landmark.x) ||
              isNaN(landmark.y) ||
              isNaN(landmark.z)
            ) {
              console.warn('Invalid landmark data:', landmark)
              return
            }

            // Convert normalized coordinates to local hand space
            const handWidth = 0.6
            const x = (landmark.x - 0.5) * handWidth
            const y = (0.5 - landmark.y) * handWidth + 0.03
            const z = -landmark.z * 0.1

            // Apply advanced stabilization
            const stabilizedPos = this.stabilizeLandmarkPosition(handIndex, i, {
              x,
              y,
              z,
            })

            // Set position if valid
            if (
              stabilizedPos &&
              !isNaN(stabilizedPos.x) &&
              !isNaN(stabilizedPos.y) &&
              !isNaN(stabilizedPos.z)
            ) {
              hand.landmarks[i].setAttribute(
                'position',
                `${stabilizedPos.x} ${stabilizedPos.y} ${stabilizedPos.z}`
              )

              // Control landmark visibility based on hand markers toggle
              if (this.handMarkersVisible) {
                // Show all landmarks when markers are visible
                hand.landmarks[i].object3D.visible = true

                // Restore original material if it was changed
                const meshObject = hand.landmarks[i].getObject3D('mesh')
                const landmarkKey = `${handIndex}-${i}`
                if (meshObject && this.originalMaterials.has(landmarkKey)) {
                  meshObject.material = this.originalMaterials.get(landmarkKey)
                  meshObject.scale.setScalar(1.0)
                }
              } else {
                // Hide all landmarks when markers are not visible
                hand.landmarks[i].object3D.visible = false
              }
            }
          }
        })

        // Update connections
        const connections = [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 4],
          [0, 5],
          [5, 6],
          [6, 7],
          [7, 8],
          [0, 9],
          [9, 10],
          [10, 11],
          [11, 12],
          [0, 13],
          [13, 14],
          [14, 15],
          [15, 16],
          [0, 17],
          [17, 18],
          [18, 19],
          [19, 20],
          [5, 9],
          [9, 13],
          [13, 17],
        ]

        // Update connections less frequently to reduce visual noise
        if (!this.lineUpdateCounter) this.lineUpdateCounter = 0
        this.lineUpdateCounter++

        // Only update lines every 3rd frame
        if (this.lineUpdateCounter % 3 === 0) {
          const lines = hand.group.querySelectorAll('[line]')
          connections.forEach(([start, end], index) => {
            if (
              index < lines.length &&
              start < hand.landmarks.length &&
              end < hand.landmarks.length
            ) {
              // Hide lines when hand markers are not visible
              if (!this.handMarkersVisible) {
                lines[index].setAttribute('visible', false)
              } else {
                lines[index].setAttribute('visible', true)

                const startPosObj = hand.landmarks[start].object3D.position
                const endPosObj = hand.landmarks[end].object3D.position

                // Only update line if both positions are valid
                if (
                  startPosObj &&
                  endPosObj &&
                  !isNaN(startPosObj.x) &&
                  !isNaN(startPosObj.y) &&
                  !isNaN(startPosObj.z) &&
                  !isNaN(endPosObj.x) &&
                  !isNaN(endPosObj.y) &&
                  !isNaN(endPosObj.z)
                ) {
                  const startPos = `${startPosObj.x} ${startPosObj.y} ${startPosObj.z}`
                  const endPos = `${endPosObj.x} ${endPosObj.y} ${endPosObj.z}`

                  // Use cyberpunk colors matching the hand
                  const lineColor = handIndex === 0 ? '#00ffff' : '#ff00ff'
                  lines[index].setAttribute(
                    'line',
                    `start: ${startPos}; end: ${endPos}; color: ${lineColor}; opacity: 0.8`
                  )
                }
              }
            }
          })
        }

        // Handle drawing with index finger (landmark 8 is index fingertip)
        if (handIndex === 0 && landmarks.length > 8) {
          // Use first hand for drawing
          this.handleDrawing(landmarks[8], hand.landmarks[8])
        }
      })
    }
  },

  handleDrawing: function (landmark, landmarkEntity) {
    if (!landmarkEntity) {
      // No landmark entity - end drawing if active
      if (this.isDrawing) {
        this.endStroke()
      }
      return
    }

    // Get world position of index fingertip
    const fingertipWorld = new THREE.Vector3()
    landmarkEntity.object3D.getWorldPosition(fingertipWorld)

    // Check if thumb and index are pinched (drawing gesture)
    // For now, we'll use a simple proximity check or you can implement pinch detection
    const isPinching = this.detectPinchGesture()

    if (isPinching && !this.isDrawing) {
      // Start drawing
      this.startNewStroke(fingertipWorld)
    } else if (isPinching && this.isDrawing) {
      // Continue drawing
      this.addPointToStroke(fingertipWorld)
    } else if (!isPinching && this.isDrawing) {
      // Stop drawing
      this.endStroke()
    }
  },

  detectPinchGesture: function () {
    // Check if drawing is enabled via UI
    return this.drawingEnabled
  },

  startNewStroke: function (position) {
    this.isDrawing = true
    this.strokePoints = [position.clone()]
    this.lastDrawTime = Date.now()
    this.currentStrokeEntities = [] // Reset current stroke entities
  },

  addPointToStroke: function (position) {
    const now = Date.now()
    const timeDelta = now - this.lastDrawTime

    // Add points more frequently for immediate response
    if (timeDelta > 4) {
      // ~250fps for immediate capture
      const lastPoint = this.strokePoints[this.strokePoints.length - 1]
      const distance = position.distanceTo(lastPoint)

      if (distance > 0.002) {
        // Very low threshold for continuous lines
        this.strokePoints.push(position.clone())
        this.lastDrawTime = now

        // Update stroke immediately for responsive drawing
        if (this.strokePoints.length >= 2) {
          this.updateStroke()
        }
      }
    }
  },

  updateStroke: function () {
    // For AR, try to update existing stroke instead of recreating
    if (
      this.currentStrokeEntities.length > 0 &&
      window.DEFAULT_SCENE_NAME === 'webar-hand'
    ) {
      const existingEntity = this.currentStrokeEntities[0]
      const existingMesh = existingEntity.getObject3D('mesh')
      if (existingMesh) {
        // Just update the geometry instead of recreating everything
        this.updateExistingStroke(existingEntity)
        return
      }
    }

    // Remove previous stroke mesh if exists
    if (this.currentStrokeEntities.length > 0) {
      this.currentStrokeEntities.forEach((entity) => {
        if (entity.parentNode) {
          entity.parentNode.removeChild(entity)
        }
      })
      this.currentStrokeEntities = []
    }

    // Create smooth curve through all points
    if (this.strokePoints.length >= 2) {
      // Use less smoothing for more responsive drawing
      const smoothedPoints =
        this.strokePoints.length > 10
          ? this.smoothStrokePoints(this.strokePoints)
          : this.strokePoints

      // Create MeshLine
      const line = new MeshLine()

      // Convert points to geometry
      const geometry = new THREE.BufferGeometry().setFromPoints(smoothedPoints)
      line.setGeometry(geometry)

      // Create MeshLineMaterial with texture
      const material = new MeshLineMaterial({
        useMap: this.strokeTexture ? 1 : 0,
        map: this.strokeTexture,
        color: new THREE.Color(this.currentColor),
        opacity: 1.0,
        lineWidth: 0.02, // Adjust line width as needed
        sizeAttenuation: 1,
        resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
        alphaTest: 0.1,
        transparent: true,
        depthWrite: true,
        depthTest: true,
      })

      // Update resolution on window resize
      if (!this.resizeHandler) {
        this.resizeHandler = () => {
          material.resolution.set(window.innerWidth, window.innerHeight)
        }
        window.addEventListener('resize', this.resizeHandler)
      }

      const mesh = new THREE.Mesh(line.geometry, material)
      mesh.frustumCulled = false // Ensure it's always rendered

      // Create entity and add to scene
      const strokeEntity = document.createElement('a-entity')
      strokeEntity.setObject3D('mesh', mesh)
      strokeEntity.classList.add('stroke-segment')

      // Add pinchable component for AR interaction
      strokeEntity.setAttribute('pinchable-line-ar', '')

      // Store path data for pinchable component - delay to ensure component is initialized
      setTimeout(() => {
        strokeEntity.emit('path-data-set', {
          path: smoothedPoints.map((p) => p.clone()),
        })
      }, 10)

      this.drawingContainer.appendChild(strokeEntity)

      // Track current stroke
      this.currentStrokeEntities.push(strokeEntity)
      // Don't add to allStrokes yet - wait until stroke is complete
    }
  },

  updateExistingStroke: function (entity) {
    // Update the existing stroke mesh instead of recreating
    const smoothedPoints =
      this.strokePoints.length > 10
        ? this.smoothStrokePoints(this.strokePoints)
        : this.strokePoints

    if (smoothedPoints.length < 2) return

    const geometry = new MeshLine()
    geometry.setPoints(smoothedPoints)

    const material = new MeshLineMaterial({
      color: new THREE.Color(this.currentColor),
      lineWidth: 0.02,
      sizeAttenuation: true,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
      transparent: true,
      opacity: 1.0,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.frustumCulled = false

    // Replace the mesh
    entity.setObject3D('mesh', mesh)

    // Update path data
    setTimeout(() => {
      entity.emit('path-data-set', {
        path: smoothedPoints.map((p) => p.clone()),
      })
    }, 0)
  },

  smoothStrokePoints: function (points) {
    if (points.length < 3) return points

    const smoothed = []
    const smoothingFactor = 0.15 // Reduced for more responsive drawing

    // Keep first point
    smoothed.push(points[0].clone())

    // Apply smoothing to middle points
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const next = points[i + 1]

      const smoothedPoint = new THREE.Vector3(
        curr.x * (1 - smoothingFactor) +
          (prev.x + next.x) * smoothingFactor * 0.5,
        curr.y * (1 - smoothingFactor) +
          (prev.y + next.y) * smoothingFactor * 0.5,
        curr.z * (1 - smoothingFactor) +
          (prev.z + next.z) * smoothingFactor * 0.5
      )

      smoothed.push(smoothedPoint)
    }

    // Keep last point
    if (points.length > 1) {
      smoothed.push(points[points.length - 1].clone())
    }

    return smoothed
  },

  stabilizeLandmarkPosition: function (handIndex, landmarkIndex, newPos) {
    const key = `${handIndex}-${landmarkIndex}`

    // Initialize buffer if needed
    if (!this.handPositionBuffer[key]) {
      this.handPositionBuffer[key] = {
        positions: [],
        lastStablePos: newPos,
        velocity: { x: 0, y: 0, z: 0 },
      }
    }

    const buffer = this.handPositionBuffer[key]

    // Add new position to buffer
    buffer.positions.push({ ...newPos, timestamp: Date.now() })

    // Keep only recent positions (last N frames)
    if (buffer.positions.length > this.handStabilizationFrames) {
      buffer.positions.shift()
    }

    // If not enough data yet, return current position with basic smoothing
    if (buffer.positions.length < 3) {
      // Less smoothing for index finger tip (landmark 8) for responsive drawing
      const smooth = landmarkIndex === 8 ? 0.3 : 0.7
      const smoothedPos = {
        x: buffer.lastStablePos.x * smooth + newPos.x * (1 - smooth),
        y: buffer.lastStablePos.y * smooth + newPos.y * (1 - smooth),
        z: buffer.lastStablePos.z * smooth + newPos.z * (1 - smooth),
      }
      buffer.lastStablePos = smoothedPos
      return smoothedPos
    }

    // Calculate weighted average (more recent positions have higher weight)
    let weightedSum = { x: 0, y: 0, z: 0 }
    let totalWeight = 0

    buffer.positions.forEach((pos, index) => {
      const weight = (index + 1) / buffer.positions.length // Linear weight
      weightedSum.x += pos.x * weight
      weightedSum.y += pos.y * weight
      weightedSum.z += pos.z * weight
      totalWeight += weight
    })

    const avgPos = {
      x: weightedSum.x / totalWeight,
      y: weightedSum.y / totalWeight,
      z: weightedSum.z / totalWeight,
    }

    // Apply movement threshold - ignore tiny movements
    const movementThreshold = 0.002 // Adjust based on your scale
    const deltaX = Math.abs(avgPos.x - buffer.lastStablePos.x)
    const deltaY = Math.abs(avgPos.y - buffer.lastStablePos.y)
    const deltaZ = Math.abs(avgPos.z - buffer.lastStablePos.z)

    // Only update if movement exceeds threshold
    if (
      deltaX > movementThreshold ||
      deltaY > movementThreshold ||
      deltaZ > movementThreshold
    ) {
      // Apply less smoothing for index finger tip for drawing responsiveness
      const finalSmooth = landmarkIndex === 8 ? 0.4 : 0.75
      const finalPos = {
        x: buffer.lastStablePos.x * finalSmooth + avgPos.x * (1 - finalSmooth),
        y: buffer.lastStablePos.y * finalSmooth + avgPos.y * (1 - finalSmooth),
        z: buffer.lastStablePos.z * finalSmooth + avgPos.z * (1 - finalSmooth),
      }

      // Update velocity for predictive smoothing
      const timeDelta = 16 // Approximate frame time
      buffer.velocity = {
        x: (finalPos.x - buffer.lastStablePos.x) / timeDelta,
        y: (finalPos.y - buffer.lastStablePos.y) / timeDelta,
        z: (finalPos.z - buffer.lastStablePos.z) / timeDelta,
      }

      buffer.lastStablePos = finalPos
      return finalPos
    }

    // Return last stable position if movement is below threshold
    return buffer.lastStablePos
  },

  checkLoopIntersection: function () {
    // Simple check: if start and end points are close enough
    if (this.strokePoints.length > 10) {
      const startPoint = this.strokePoints[0]
      const endPoint = this.strokePoints[this.strokePoints.length - 1]
      const distance = startPoint.distanceTo(endPoint)

      if (distance < 0.15) {
        // Within 15cm
        console.log('Start and end points close enough - treating as loop')
        return {
          point: startPoint.clone(),
          index: 0, // Loop starts at beginning
        }
      }
    }

    return null
  },

  endStroke: function () {
    // Check for loop intersection before finalizing stroke
    if (this.strokePoints.length > 3 && this.currentStrokeEntities.length > 0) {
      const intersection = this.checkLoopIntersection()

      // Get the last stroke entity which contains the full stroke
      const strokeEntity =
        this.currentStrokeEntities[this.currentStrokeEntities.length - 1]

      // Always emit event for any path (not just loops)
      // This matches WebXR behavior where spheres animate on any line
      // Always provide an intersection so hasLoop will be true in path-sphere-spawner
      this.el.sceneEl.emit('drawing-loop-created', {
        path: this.strokePoints.map((p) => p.clone()),
        intersection: intersection || {
          point: this.strokePoints[0].clone(),
          index: 0,
        }, // Always provide intersection
        lineEntity: strokeEntity,
      })

      if (intersection) {
        console.log('Loop detected in drawn path!')
      } else {
        console.log('Path created (non-loop)')
      }
    }

    // Add the completed stroke to allStrokes for undo functionality
    if (this.currentStrokeEntities.length > 0) {
      this.allStrokes.push(...this.currentStrokeEntities)

      // Emit path data again to ensure pinchable component has it
      this.currentStrokeEntities.forEach((entity) => {
        // Re-emit path data after stroke is complete
        setTimeout(() => {
          entity.emit('path-data-set', {
            path: this.strokePoints.map((p) => p.clone()),
          })
        }, 50)
      })

      // Notify gesture component that we have drawings
      this.el.sceneEl.emit('drawings-changed', {
        hasDrawings: this.allStrokes.length > 0,
      })
    }

    this.isDrawing = false
    this.strokePoints = []
    this.currentStrokeEntities = [] // Clear current stroke reference
  },

  undoStrokes: function (count) {
    // Remove the last 'count' stroke segments
    const toRemove = Math.min(count, this.allStrokes.length)

    for (let i = 0; i < toRemove; i++) {
      const stroke = this.allStrokes.pop()
      if (stroke && stroke.parentNode) {
        stroke.parentNode.removeChild(stroke)
      }
    }

    // Notify gesture component about drawing state change
    this.el.sceneEl.emit('drawings-changed', {
      hasDrawings: this.allStrokes.length > 0,
    })
  },

  startFloatingAnimation: function (direction) {
    this.animatingStrokes = true
    this.animationDirection = direction
    this.animationSpeed = 0.0005 // Speed per millisecond

    console.log(`✨ Starting animation: ${direction}`)

    // Initialize animation offset if not exists
    if (!this.animationOffset) {
      this.animationOffset = { x: 0, y: 0, z: 0 }
    }
  },

  stopAnimation: function () {
    this.animatingStrokes = false
    console.log('⏹ Animation stopped')
  },

  updateFloatingAnimation: function (time) {
    if (!this.drawingContainer || !this.drawingContainer.object3D) return

    // Simple incremental movement based on direction
    const increment = this.animationSpeed * 16 // Assuming ~60fps, adjust for frame time

    // For diagonal movement, we use 0.707 (approximately 1/√2) to maintain consistent speed
    const diagonalFactor = 0.707

    switch (this.animationDirection) {
      case 'Up':
        this.animationOffset.y += increment
        break
      case 'Down':
        this.animationOffset.y -= increment
        break
      case 'Left':
        this.animationOffset.x -= increment
        break
      case 'Right':
        this.animationOffset.x += increment
        break
      case 'UpLeft':
        this.animationOffset.x -= increment * diagonalFactor
        this.animationOffset.y += increment * diagonalFactor
        break
      case 'UpRight':
        this.animationOffset.x += increment * diagonalFactor
        this.animationOffset.y += increment * diagonalFactor
        break
      case 'DownLeft':
        this.animationOffset.x -= increment * diagonalFactor
        this.animationOffset.y -= increment * diagonalFactor
        break
      case 'DownRight':
        this.animationOffset.x += increment * diagonalFactor
        this.animationOffset.y -= increment * diagonalFactor
        break
    }

    // Apply offset to drawing container
    this.drawingContainer.object3D.position.set(
      this.animationOffset.x,
      this.animationOffset.y,
      this.animationOffset.z
    )
  },

  startYAxisFloating: function () {
    this.floatingAnimation = true
    this.floatingTime = Date.now()
    console.log('👍 Starting Y-axis floating animation')

    // Initialize animation offset if not exists
    if (!this.animationOffset) {
      this.animationOffset = { x: 0, y: 0, z: 0 }
    }
  },

  stopYAxisFloating: function () {
    this.floatingAnimation = false
    console.log('⏹ Y-axis floating stopped')
  },

  updateYAxisFloating: function (time) {
    if (!this.drawingContainer || !this.drawingContainer.object3D) return

    // Calculate elapsed time since animation started
    const elapsed = (time - this.floatingTime) * 0.001 // Convert to seconds

    // Create smooth sine wave motion on Y axis
    const floatSpeed = 0.5 // Speed of floating motion
    const floatAmplitude = 0.1 // How far it moves up and down

    // Apply sine wave to Y position
    const yOffset =
      Math.sin(elapsed * floatSpeed * Math.PI * 2) * floatAmplitude

    // Apply the floating motion
    this.drawingContainer.object3D.position.set(
      this.animationOffset.x,
      this.animationOffset.y + yOffset,
      this.animationOffset.z
    )
  },
}
