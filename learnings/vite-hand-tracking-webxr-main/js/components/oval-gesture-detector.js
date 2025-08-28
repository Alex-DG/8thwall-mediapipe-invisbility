import { RipplesMaterial } from '../materials/RipplesMaterial.js'
import { ChromaKeyMaterial } from '../materials/ChromaKeyMaterial.js'
import { GlitchMaterial } from '../materials/GlitchMaterial.js'
import { Glitch2Material } from '../materials/Glitch2Material.js'
import { DepthMaterial } from '../materials/DepthMaterial.js'
import { UltimateGlitchMaterial } from '../materials/UltimateGlitchMaterial.js'

export const ovalGestureDetectorComponent = {
  schema: {
    touchThreshold: { type: 'number', default: 0.03 }, // Distance threshold for considering fingers touching
    rotationThresholdMultiplier: { type: 'number', default: 1.8 }, // Multiplier for threshold when hands are rotated
    planeColor: { type: 'color', default: '#FFFFFF' },
    planeOpacity: { type: 'number', default: 0.7 },
    debugMode: { type: 'boolean', default: false },
    matIndex: { default: 6 }, // Index of the material to use
  },

  init: function () {
    this.leftHandData = null
    this.rightHandData = null
    this.ovalEntity = null
    this.isGestureActive = false
    this.debugSpheres = []
    this.currentOvalParams = { width: 0, height: 0 }
    this.targetOvalParams = { width: 0, height: 0 }
    this.video = null
    this.videoTexture = null

    // No longer need scaling properties - size is calculated directly from finger positions

    // Rotation smoothing
    this.currentRotation = 0
    this.targetRotation = 0

    // Depth video properties
    this.depthVideo = null
    this.depthVideoTexture = null
    this.videoLoaded = false
    this.depthVideoLoaded = false

    // Multiple videos management
    this.videoSources = [
      '/videos/butterfly.mp4',
      '/videos/dream-green-video.mp4',
      '/videos/mugen.mp4',
      '/videos/dot3.mp4',
      '/videos/loveheart.mp4',
      '/videos/cyber_man.mp4',
      '/videos/cat.mp4',
      '/videos/sakura.mp4',
      '/videos/ai-entity-green-video.mp4',
    ]
    this.preloadedVideos = {}
    this.preloadedTextures = {}
    this.currentVideoIndex = 0
    this.allVideosLoaded = false

    // MediaPipe hand landmark indices
    this.THUMB_TIP = 4
    this.INDEX_TIP = 8
    this.MIDDLE_TIP = 12 // Middle finger tip
    this.THUMB_MCP = 2 // Thumb metacarpophalangeal joint
    this.INDEX_MCP = 5 // Index finger metacarpophalangeal joint
    this.MIDDLE_MCP = 9 // Middle finger metacarpophalangeal joint
    this.THUMB_IP = 3 // Thumb interphalangeal joint
    this.INDEX_DIP = 7 // Index distal interphalangeal joint

    // Gesture detection state
    this.middleFingerRaised = false
    this.leftMiddleFingerRaised = false
    this.gestureDebounce = false
    this.leftGestureDebounce = false
    this.gestureDebounceTime = 1000 // 1 second cooldown between gestures

    // Preload all videos
    this.preloadAllVideos()

    // Create depth video for material index 5
    // this.createDepthVideoElement()

    // Create the oval shape entity
    this.createOvalShape()

    // Listen for hand tracking data
    this.setupEventListeners()

    if (this.data.debugMode) {
      this.createDebugVisuals()
    }
  },

  preloadAllVideos: function () {
    let loadedCount = 0
    let errorCount = 0
    const totalVideos = this.videoSources.length

    // Emit initial progress
    this.el.sceneEl.emit('video-loading-progress', {
      loaded: 0,
      total: totalVideos,
    })

    this.videoSources.forEach((src, index) => {
      const video = document.createElement('video')
      video.src = src
      video.crossOrigin = 'anonymous'
      video.loop = true
      video.muted = true
      video.playsInline = true
      video.setAttribute('playsinline', '')
      video.setAttribute('webkit-playsinline', '')
      
      // Add timeout for video loading
      const loadTimeout = setTimeout(() => {
        console.warn(`Video load timeout for: ${src}`)
        video.dispatchEvent(new Event('error'))
      }, 30000) // 30 second timeout

      // Handle load success - use loadedmetadata for better compatibility
      video.addEventListener('loadedmetadata', () => {
        clearTimeout(loadTimeout)
        console.log(`Video metadata loaded: ${src}`)
        
        // Wait for more data before considering it loaded
        video.addEventListener('canplay', () => {
          console.log(`Video can play: ${src}`)

          // Create texture
          const texture = new THREE.VideoTexture(video)
          texture.minFilter = THREE.LinearFilter
          texture.magFilter = THREE.LinearFilter
          texture.format = THREE.RGBAFormat
          texture.needsUpdate = true

          // Store video and texture
          this.preloadedVideos[index] = video
          this.preloadedTextures[index] = texture

          // Update progress
          loadedCount++

          // Emit progress event
          this.el.sceneEl.emit('video-loading-progress', {
            loaded: loadedCount,
            total: totalVideos,
          })

          // Check if all loaded
          if (loadedCount + errorCount === totalVideos) {
            this.allVideosLoaded = true
            this.onAllVideosLoaded()
          }
        }, { once: true })
      }, { once: true })

      // Handle load error
      video.addEventListener('error', (e) => {
        clearTimeout(loadTimeout)
        console.error(`Error loading video ${src}:`, e)
        console.error('Video error details:', {
          error: video.error,
          networkState: video.networkState,
          readyState: video.readyState
        })
        
        errorCount++

        // Try to create a placeholder for failed videos
        const canvas = document.createElement('canvas')
        canvas.width = 512
        canvas.height = 512
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#333'
        ctx.fillRect(0, 0, 512, 512)
        ctx.fillStyle = '#fff'
        ctx.font = '24px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('Video Load Error', 256, 256)
        
        const texture = new THREE.CanvasTexture(canvas)
        this.preloadedTextures[index] = texture
        
        // Emit progress event
        this.el.sceneEl.emit('video-loading-progress', {
          loaded: loadedCount + errorCount,
          total: totalVideos,
        })

        if (loadedCount + errorCount === totalVideos) {
          this.allVideosLoaded = true
          this.onAllVideosLoaded()
        }
      })
      
      // Handle stalled loading
      video.addEventListener('stalled', () => {
        console.warn(`Video loading stalled: ${src}`)
      })
      
      video.addEventListener('suspend', () => {
        console.warn(`Video loading suspended: ${src}`)
      })

      // Preload video data
      video.preload = 'auto'
      
      // Start loading
      video.load()
    })
  },

  onAllVideosLoaded: function () {
    console.log('All videos loaded!')

    // Set the first video as current
    this.video = this.preloadedVideos[0]
    this.videoTexture = this.preloadedTextures[0]
    this.videoLoaded = true

    // Update material with the first video
    this.updateMaterialTexture()

    // Emit event
    this.el.sceneEl.emit('videos-loaded', { count: this.videoSources.length })
  },

  updateMaterialTexture: function () {
    if (!this.ovalMaterial || !this.videoTexture) return

    if (this.ovalMaterial.uniforms?.uTexture) {
      this.ovalMaterial.uniforms.uTexture.value = this.videoTexture
    } else if (this.ovalMaterial.uniforms?.tex) {
      this.ovalMaterial.uniforms.tex.value = this.videoTexture
    } else if (this.ovalMaterial.uniforms?.tDiffuse) {
      this.ovalMaterial.uniforms.tDiffuse.value = this.videoTexture
    } else if (this.ovalMaterial.uniforms?.colorTexture) {
      this.ovalMaterial.uniforms.colorTexture.value = this.videoTexture
    } else {
      this.ovalMaterial.map = this.videoTexture
    }

    this.ovalMaterial.needsUpdate = true
  },

  switchToVideo: function (index) {
    if (index < 0 || index >= this.videoSources.length) return
    if (!this.allVideosLoaded) return

    // Pause current video
    if (this.video && !this.video.paused) {
      this.video.pause()
    }

    // Switch to new video
    this.currentVideoIndex = index
    this.video = this.preloadedVideos[index]
    this.videoTexture = this.preloadedTextures[index]

    // Update material
    this.updateMaterialTexture()

    // Play if gesture is active
    if (this.isGestureActive && this.video.paused) {
      this.video.play().catch((err) => console.warn('Video play failed:', err))
    }

    console.log(`Switched to video: ${this.videoSources[index]}`)
  },

  createDepthVideoElement: function () {
    // Create depth video element
    this.depthVideo = document.createElement('video')
    this.depthVideo.src = '/videos/dream-depth-video.mp4'
    this.depthVideo.crossOrigin = 'anonymous'
    this.depthVideo.loop = true
    this.depthVideo.muted = true
    this.depthVideo.playsInline = true
    this.depthVideo.setAttribute('playsinline', '')

    // Set up error handling
    this.depthVideo.onerror = (e) => {
      console.error('Depth video loading error:', e)
    }

    // Wait for depth video to be ready before creating texture
    this.depthVideo.addEventListener('loadeddata', () => {
      console.log('Depth video loaded successfully')

      // Create depth video texture
      this.depthVideoTexture = new THREE.VideoTexture(this.depthVideo)
      this.depthVideoTexture.minFilter = THREE.LinearFilter
      this.depthVideoTexture.magFilter = THREE.LinearFilter
      this.depthVideoTexture.format = THREE.RGBAFormat
      this.depthVideoTexture.needsUpdate = true

      this.depthVideoLoaded = true

      // Update DepthMaterial if it's being used
      if (
        this.data.matIndex === 5 &&
        this.ovalMaterial?.uniforms?.depthTexture
      ) {
        this.ovalMaterial.uniforms.depthTexture.value = this.depthVideoTexture
        console.log('Updated DepthMaterial depth texture')
      }

      // Check if both videos are loaded for DepthMaterial
      this.checkDepthMaterialReady()
    })

    // Load depth video
    this.depthVideo.load()
  },

  checkDepthMaterialReady: function () {
    // If using DepthMaterial and both videos are loaded, update textures
    if (
      this.data.matIndex === 5 &&
      this.videoLoaded &&
      this.depthVideoLoaded &&
      this.ovalMaterial
    ) {
      console.log('Both videos loaded, updating DepthMaterial textures')

      if (this.ovalMaterial.setColorTexture && this.videoTexture) {
        this.ovalMaterial.setColorTexture(this.videoTexture)
      }

      if (this.ovalMaterial.setDepthTexture && this.depthVideoTexture) {
        this.ovalMaterial.setDepthTexture(this.depthVideoTexture)
      }

      // Force material update
      this.ovalMaterial.needsUpdate = true
    }
  },

  createOvalShape: function () {
    this.ovalEntity = document.createElement('a-entity')

    // Create a solid circle geometry that we'll scale into an oval
    const radius = 1 // Default radius for the oval
    const segments = 64 * 2 * 2 // More segments for smoother curve

    const geometry = new THREE.CircleGeometry(radius, segments)

    // Return a custom material
    const customMaterial = {
      0: () => {
        return new THREE.MeshBasicMaterial({
          color: new THREE.Color(this.data.planeColor), // Fallback color
          opacity: this.data.planeOpacity,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      },
      1: () => {
        return new RipplesMaterial()
      },
      2: () => {
        return new ChromaKeyMaterial()
      },
      3: () => {
        const material = new GlitchMaterial({
          resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
        })
        return material
      },
      4: () => {
        const material = new Glitch2Material({
          resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
        })
        return material
      },
      5: () => {
        const material = new DepthMaterial({
          depthScale: 0.25,
        })
        // Textures will be set later when videos are loaded
        return material
      },
      6: () => {
        const material = new UltimateGlitchMaterial({
          resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
        })
        return material
      },
    }

    const material = customMaterial[this.data.matIndex]()

    const mesh = new THREE.Mesh(geometry, material)
    this.ovalMaterial = material
    this.ovalEntity.setObject3D('mesh', mesh)
    this.ovalEntity.setAttribute('visible', false)

    this.el.sceneEl.appendChild(this.ovalEntity)
  },

  createDebugVisuals: function () {
    // Create debug spheres for touch points
    const touchPoints = ['leftThumb', 'rightThumb', 'leftIndex', 'rightIndex']
    touchPoints.forEach((point) => {
      const sphere = document.createElement('a-sphere')
      sphere.setAttribute('radius', '0.01')
      sphere.setAttribute(
        'color',
        point.includes('Thumb') ? '#FF0000' : '#00FF00'
      )
      sphere.setAttribute('visible', false)
      this.el.sceneEl.appendChild(sphere)
      this.debugSpheres[point] = sphere
    })
  },

  setupEventListeners: function () {
    // Listen for keyboard events to switch videos
    window.addEventListener('keydown', (event) => {
      if (!this.allVideosLoaded) return

      if (event.key === 'ArrowRight') {
        // Next video
        const nextIndex =
          (this.currentVideoIndex + 1) % this.videoSources.length
        this.switchToVideo(nextIndex)
      } else if (event.key === 'ArrowLeft') {
        // Previous video
        const prevIndex =
          (this.currentVideoIndex - 1 + this.videoSources.length) %
          this.videoSources.length
        this.switchToVideo(prevIndex)
      } else if (event.key >= '1' && event.key <= '7') {
        // Direct video selection (1-7)
        const index = parseInt(event.key) - 1
        if (index < this.videoSources.length) {
          this.switchToVideo(index)
        }
      }
    })

    // Listen for hand tracking updates
    this.el.sceneEl.addEventListener('hand-tracking-update', (event) => {
      const { handIndex, landmarks, worldLandmarks } = event.detail

      if (handIndex === 0) {
        this.leftHandData = { landmarks, worldLandmarks, handIndex }
      } else if (handIndex === 1) {
        this.rightHandData = { landmarks, worldLandmarks, handIndex }
      }

      // Check for oval gesture when both hands are detected
      if (this.leftHandData && this.rightHandData) {
        this.checkOvalGesture()
      }

      // Check for middle finger gesture on right hand
      if (this.rightHandData) {
        this.checkMiddleFingerGesture()
      }

      // Check for middle finger gesture on left hand
      if (this.leftHandData) {
        this.checkLeftMiddleFingerGesture()
      }
    })
  },

  checkOvalGesture: function () {
    // Get world positions of key landmarks
    const leftThumb = this.getWorldPosition(this.leftHandData, this.THUMB_TIP)
    const leftIndex = this.getWorldPosition(this.leftHandData, this.INDEX_TIP)
    const rightThumb = this.getWorldPosition(this.rightHandData, this.THUMB_TIP)
    const rightIndex = this.getWorldPosition(this.rightHandData, this.INDEX_TIP)

    if (!leftThumb || !leftIndex || !rightThumb || !rightIndex) {
      this.hideOvalShape()
      return
    }

    // Get MCP positions for expanded oval
    const leftThumbMCP = this.getWorldPosition(
      this.leftHandData,
      this.THUMB_MCP
    )
    const leftIndexMCP = this.getWorldPosition(
      this.leftHandData,
      this.INDEX_MCP
    )
    const rightThumbMCP = this.getWorldPosition(
      this.rightHandData,
      this.THUMB_MCP
    )
    const rightIndexMCP = this.getWorldPosition(
      this.rightHandData,
      this.INDEX_MCP
    )

    if (!leftThumbMCP || !leftIndexMCP || !rightThumbMCP || !rightIndexMCP) {
      this.hideOvalShape()
      return
    }

    // Update debug spheres if enabled
    if (this.data.debugMode) {
      this.updateDebugSphere('leftThumb', leftThumb)
      this.updateDebugSphere('leftIndex', leftIndex)
      this.updateDebugSphere('rightThumb', rightThumb)
      this.updateDebugSphere('rightIndex', rightIndex)
    }

    // Check if fingers are touching
    const thumbsDistance = this.calculateDistance(leftThumb, rightThumb)
    const indexDistance = this.calculateDistance(leftIndex, rightIndex)

    const thumbsTouching = thumbsDistance < this.data.touchThreshold
    const indexTouching = indexDistance < this.data.touchThreshold

    // Add some tolerance when hands are rotated
    // Calculate the rotation angle to detect if hands are tilted
    const indexVector = rightIndex.clone().sub(leftIndex)
    const thumbVector = rightThumb.clone().sub(leftThumb)

    // Get average rotation from both finger pairs
    const indexRotationAngle = Math.atan2(indexVector.y, indexVector.x)
    const thumbRotationAngle = Math.atan2(thumbVector.y, thumbVector.x)
    const avgRotationAngle = (indexRotationAngle + thumbRotationAngle) / 2

    // Calculate how much the hands are rotated from horizontal
    // 0 = horizontal, PI/2 = vertical
    const rotationFromHorizontal = Math.abs(avgRotationAngle)

    // Increase tolerance based on rotation, especially for right rotation (positive angles)
    let rotationTolerance = 1.0
    if (rotationFromHorizontal > 0.3) {
      // About 17 degrees
      // More tolerance for larger rotations
      rotationTolerance =
        1.0 +
        (rotationFromHorizontal / Math.PI) *
          this.data.rotationThresholdMultiplier
    }

    const adjustedThreshold = this.data.touchThreshold * rotationTolerance

    const thumbsTouchingAdjusted = thumbsDistance < adjustedThreshold
    const indexTouchingAdjusted = indexDistance < adjustedThreshold

    // Debug logging when gesture fails
    if (
      this.data.debugMode &&
      this.isGestureActive &&
      (!thumbsTouchingAdjusted || !indexTouchingAdjusted)
    ) {
      console.log('Gesture lost:', {
        thumbsDistance,
        indexDistance,
        threshold: this.data.touchThreshold,
        adjustedThreshold,
        rotationAngle: avgRotationAngle * (180 / Math.PI),
        rotationTolerance,
        thumbsTouchingAdjusted,
        indexTouchingAdjusted,
      })
    }

    if (thumbsTouchingAdjusted && indexTouchingAdjusted) {
      // Gesture detected - show and position the oval
      this.showOvalShape(leftThumb, leftIndex, rightThumb, rightIndex)
    } else {
      // Gesture not detected - hide the oval
      this.hideOvalShape()
    }
  },

  checkMiddleFingerGesture: function () {
    if (!this.allVideosLoaded) return

    // Get middle finger tip and MCP positions
    const middleTip = this.getWorldPosition(this.rightHandData, this.MIDDLE_TIP)
    const middleMCP = this.getWorldPosition(this.rightHandData, this.MIDDLE_MCP)
    const indexTip = this.getWorldPosition(this.rightHandData, this.INDEX_TIP)
    const indexMCP = this.getWorldPosition(this.rightHandData, this.INDEX_MCP)

    if (!middleTip || !middleMCP || !indexTip || !indexMCP) return

    // Calculate vertical distances (Y axis)
    const middleFingerHeight = middleTip.y - middleMCP.y
    const indexFingerHeight = indexTip.y - indexMCP.y

    // Check if middle finger is raised significantly more than index finger
    const isMiddleFingerRaised =
      middleFingerHeight > indexFingerHeight * 1.3 && middleFingerHeight > 0.08 // Minimum height threshold

    // Detect gesture transition (not raised -> raised)
    if (
      isMiddleFingerRaised &&
      !this.middleFingerRaised &&
      !this.gestureDebounce
    ) {
      // Trigger next video
      this.middleFingerRaised = true
      this.gestureDebounce = true

      // Switch to next video
      const nextIndex = (this.currentVideoIndex + 1) % this.videoSources.length
      this.switchToVideo(nextIndex)

      // Visual feedback
      console.log('Middle finger gesture detected! Switching to next video...')

      // Reset debounce after cooldown
      setTimeout(() => {
        this.gestureDebounce = false
      }, this.gestureDebounceTime)
    } else if (!isMiddleFingerRaised) {
      this.middleFingerRaised = false
    }
  },

  checkLeftMiddleFingerGesture: function () {
    if (!this.allVideosLoaded) return

    // Get middle finger tip and MCP positions for left hand
    const middleTip = this.getWorldPosition(this.leftHandData, this.MIDDLE_TIP)
    const middleMCP = this.getWorldPosition(this.leftHandData, this.MIDDLE_MCP)
    const indexTip = this.getWorldPosition(this.leftHandData, this.INDEX_TIP)
    const indexMCP = this.getWorldPosition(this.leftHandData, this.INDEX_MCP)

    if (!middleTip || !middleMCP || !indexTip || !indexMCP) return

    // Calculate vertical distances (Y axis)
    const middleFingerHeight = middleTip.y - middleMCP.y
    const indexFingerHeight = indexTip.y - indexMCP.y

    // Check if middle finger is raised significantly more than index finger
    const isMiddleFingerRaised =
      middleFingerHeight > indexFingerHeight * 1.3 && middleFingerHeight > 0.08 // Minimum height threshold

    // Detect gesture transition (not raised -> raised)
    if (
      isMiddleFingerRaised &&
      !this.leftMiddleFingerRaised &&
      !this.leftGestureDebounce
    ) {
      // Trigger previous video
      this.leftMiddleFingerRaised = true
      this.leftGestureDebounce = true

      // Switch to previous video - if at first item, go to last
      let prevIndex = this.currentVideoIndex - 1
      if (prevIndex < 0) {
        prevIndex = this.videoSources.length - 1
      }
      this.switchToVideo(prevIndex)

      // Visual feedback
      console.log(
        'Left middle finger gesture detected! Switching to previous video...'
      )

      // Reset debounce after cooldown
      setTimeout(() => {
        this.leftGestureDebounce = false
      }, this.gestureDebounceTime)
    } else if (!isMiddleFingerRaised) {
      this.leftMiddleFingerRaised = false
    }
  },

  getWorldPosition: function (handData, landmarkIndex) {
    if (
      !handData ||
      !handData.landmarks ||
      !handData.landmarks[landmarkIndex]
    ) {
      return null
    }

    // Get the hand entity for this hand
    const handEntities = this.el.sceneEl.querySelectorAll('[id^="hand-"]')
    const handEntity = handEntities[handData.handIndex]
    if (!handEntity) return null

    // Get the specific landmark entity
    const landmarkEntities = handEntity.querySelectorAll('a-entity')
    const landmarkEntity = landmarkEntities[landmarkIndex]
    if (!landmarkEntity) return null

    // Get world position of the landmark
    const worldPos = new THREE.Vector3()
    landmarkEntity.object3D.getWorldPosition(worldPos)

    return worldPos
  },

  calculateDistance: function (pos1, pos2) {
    return pos1.distanceTo(pos2)
  },

  showOvalShape: function (leftThumb, leftIndex, rightThumb, rightIndex) {
    if (!this.isGestureActive) {
      this.isGestureActive = true
      this.el.sceneEl.emit('oval-gesture-detected', { active: true })

      // Start playing video when gesture is detected
      if (this.allVideosLoaded && this.video && this.video.paused) {
        this.video.play().catch((err) => {
          console.warn('Video autoplay failed:', err)
        })
      }

      // Also play depth video if using DepthMaterial
      if (
        this.data.matIndex === 5 &&
        this.depthVideo &&
        this.depthVideo.paused
      ) {
        this.depthVideo.play().catch((err) => {
          console.warn('Depth video autoplay failed:', err)
        })
      }
    }

    // Calculate center position of the oval
    const center = new THREE.Vector3()
    center.add(leftThumb)
    center.add(leftIndex)
    center.add(rightThumb)
    center.add(rightIndex)
    center.multiplyScalar(0.25)

    // Calculate oval dimensions to always fit the space between fingers
    // For a more horizontal oval, we'll calculate width and height differently

    // Width: Include the full span from left thumb to right index (diagonal)
    // This gives us the maximum horizontal extent
    const horizontalSpan1 = leftThumb.distanceTo(rightIndex)
    const horizontalSpan2 = leftIndex.distanceTo(rightThumb)
    const maxHorizontalSpan = Math.max(horizontalSpan1, horizontalSpan2)

    // Alternative width calculation using midpoints for comparison
    const leftMidpoint = new THREE.Vector3()
      .addVectors(leftThumb, leftIndex)
      .multiplyScalar(0.5)
    const rightMidpoint = new THREE.Vector3()
      .addVectors(rightThumb, rightIndex)
      .multiplyScalar(0.5)
    const midpointDistance = leftMidpoint.distanceTo(rightMidpoint)

    // Height: average of the thumb-to-index distances
    const leftFingerDistance = this.calculateDistance(leftThumb, leftIndex)
    const rightFingerDistance = this.calculateDistance(rightThumb, rightIndex)
    const avgFingerDistance = (leftFingerDistance + rightFingerDistance) / 2

    // Use the larger of the two width calculations for a nice horizontal oval
    const width = Math.max(midpointDistance * 1.3, maxHorizontalSpan * 0.8)

    // Set target dimensions - width is significantly larger than height
    this.targetOvalParams.width = width
    this.targetOvalParams.height = avgFingerDistance * 0.9 // Slightly smaller height for more oval shape

    // Update oval position
    this.ovalEntity.object3D.position.copy(center)

    // Calculate rotation to align oval with finger positions
    // The oval should orient so that index fingers are at top, thumbs at bottom

    // Calculate the average positions of index fingers and thumbs
    const indexCenter = new THREE.Vector3()
      .addVectors(leftIndex, rightIndex)
      .multiplyScalar(0.5)
    const thumbCenter = new THREE.Vector3()
      .addVectors(leftThumb, rightThumb)
      .multiplyScalar(0.5)

    // Vector from thumb center to index center defines the "up" direction
    const upVector = indexCenter.clone().sub(thumbCenter)

    // Calculate angle - we want the angle from vertical (Y-axis)
    const angle = Math.atan2(upVector.x, upVector.y)

    // Update target rotation
    this.targetRotation = -angle // Negative to rotate in the correct direction

    // Make the oval face the camera
    const camera = this.el.sceneEl.camera
    if (camera) {
      // Get camera world position and direction
      const cameraWorldPos = new THREE.Vector3()
      const cameraWorldQuat = new THREE.Quaternion()
      camera.getWorldPosition(cameraWorldPos)
      camera.getWorldQuaternion(cameraWorldQuat)

      // Make oval face the camera
      this.ovalEntity.object3D.lookAt(cameraWorldPos)

      // Apply smoothed rotation - this will be updated in tick()
      this.ovalEntity.object3D.rotation.z = this.currentRotation
    }

    // Show the oval
    this.ovalEntity.setAttribute('visible', true)
  },

  hideOvalShape: function () {
    if (this.isGestureActive) {
      this.isGestureActive = false
      this.el.sceneEl.emit('oval-gesture-detected', { active: false })

      // Pause video when gesture ends
      if (this.video && !this.video.paused) {
        this.video.pause()
      }

      // Also pause depth video
      if (this.depthVideo && !this.depthVideo.paused) {
        this.depthVideo.pause()
      }

      // Reset target dimensions for smooth fade out
      this.targetOvalParams.width = 0
      this.targetOvalParams.height = 0
    }
  },

  updateDebugSphere: function (name, position) {
    if (this.debugSpheres[name]) {
      this.debugSpheres[name].object3D.position.copy(position)
      this.debugSpheres[name].setAttribute('visible', true)
    }
  },

  tick: function (time) {
    // Update current video texture
    if (
      this.allVideosLoaded &&
      this.videoTexture &&
      this.video &&
      !this.video.paused
    ) {
      this.videoTexture.needsUpdate = true
    }

    // Update depth video texture for DepthMaterial
    if (this.depthVideoTexture && this.depthVideo && !this.depthVideo.paused) {
      this.depthVideoTexture.needsUpdate = true
    }

    // Update material time for animation
    if (this.ovalMaterial?.uniforms?.uTime) {
      this.ovalMaterial.uniforms.uTime.value = time * 0.001
    } else if (this.ovalMaterial?.uniforms?.time) {
      // GlitchMaterial and DepthMaterial use 'time' uniform
      this.ovalMaterial.uniforms.time.value = time * 0.001
    }

    // Update DepthMaterial if it's being used
    if (this.data.matIndex === 5 && this.ovalMaterial?.updateTime) {
      this.ovalMaterial.updateTime(time * 0.001)
    }

    // Smooth transitions for oval dimensions
    const lerpFactor = 0.15 // Smooth interpolation
    this.currentOvalParams.width = THREE.MathUtils.lerp(
      this.currentOvalParams.width,
      this.targetOvalParams.width,
      lerpFactor
    )
    this.currentOvalParams.height = THREE.MathUtils.lerp(
      this.currentOvalParams.height,
      this.targetOvalParams.height,
      lerpFactor
    )

    // Smooth rotation interpolation
    if (this.targetRotation !== undefined) {
      // Handle angle wrapping for smooth interpolation
      let diff = this.targetRotation - this.currentRotation

      // Normalize the difference to [-PI, PI]
      while (diff > Math.PI) diff -= 2 * Math.PI
      while (diff < -Math.PI) diff += 2 * Math.PI

      // Apply smooth interpolation
      const rotationLerpFactor = 0.1 // Smooth but responsive rotation
      this.currentRotation += diff * rotationLerpFactor
    }

    // Apply the interpolated scale to the oval
    if (this.ovalEntity) {
      // Simple uniform scaling based on interpolated dimensions
      this.ovalEntity.object3D.scale.set(
        this.currentOvalParams.width,
        this.currentOvalParams.height,
        1
      )

      // Hide the oval if it's too small
      if (
        this.currentOvalParams.width < 0.01 &&
        this.currentOvalParams.height < 0.01
      ) {
        this.ovalEntity.setAttribute('visible', false)
      }
    }

    // Add subtle animation when active
    if (
      this.isGestureActive &&
      this.ovalEntity &&
      this.ovalEntity.getAttribute('visible')
    ) {
      // Gentle breathing effect (already includes dynamic scale)
      const breathe = Math.sin(time * 0.002) * 0.02 + 1
      this.ovalEntity.object3D.scale.multiplyScalar(breathe)

      // Subtle opacity pulsing
      // if (this.ovalMaterial) {
      //   const opacityPulse = Math.sin(time * 0.003) * 0.1 + 0.9
      //   this.ovalMaterial.setOpacity(this.data.planeOpacity * opacityPulse)
      // }
    }
  },

  remove: function () {
    // Clean up all preloaded videos
    Object.values(this.preloadedVideos).forEach((video) => {
      if (video) {
        video.pause()
        video.src = ''
      }
    })

    // Clean up all textures
    Object.values(this.preloadedTextures).forEach((texture) => {
      if (texture) {
        texture.dispose()
      }
    })

    this.preloadedVideos = {}
    this.preloadedTextures = {}
    this.video = null
    this.videoTexture = null

    // Clean up depth video
    if (this.depthVideo) {
      this.depthVideo.pause()
      this.depthVideo.src = ''
      this.depthVideo = null
    }

    if (this.depthVideoTexture) {
      this.depthVideoTexture.dispose()
      this.depthVideoTexture = null
    }

    // Clean up oval entity
    if (this.ovalEntity) {
      this.ovalEntity.parentNode.removeChild(this.ovalEntity)
    }

    // Remove debug spheres
    Object.values(this.debugSpheres).forEach((sphere) => {
      if (sphere.parentNode) {
        sphere.parentNode.removeChild(sphere)
      }
    })
  },
}
