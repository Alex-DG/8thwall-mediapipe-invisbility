import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision'

let gestureRecognizer
let video
let lastVideoTime = -1

// Initialize MediaPipe Gesture Recognizer
async function createGestureRecognizer() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
  )

  gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
  })
}

// A-Frame component for gesture recognition
export const mediapipeGestureComponent = {
  init: function () {
    console.log('⚙️', 'MediaPipe Gesture Component initializing...')

    // Gesture detection state
    this.gestureDetectionEnabled = false
    this.currentGesture = null
    this.lastGestureTime = 0

    // Animation state (will be controlled via events)
    this.hasDrawings = false

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
    this.setupEventListeners()
    this.setupVideoStream()
  },

  setupEventListeners: function () {
    // Listen for gesture detection toggle
    this.el.sceneEl.addEventListener('gesture-detection-toggled', (event) => {
      this.gestureDetectionEnabled = event.detail.enabled
      console.log(
        `Gesture detection ${
          this.gestureDetectionEnabled ? 'enabled' : 'disabled'
        }`
      )
    })

    // Listen for drawing state changes
    this.el.sceneEl.addEventListener('drawings-changed', (event) => {
      this.hasDrawings = event.detail.hasDrawings
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
      await createGestureRecognizer()
      console.log('✅', 'MediaPipe Gesture Recognizer initialized successfully')
      this.detectGestures()
    } catch (error) {
      console.error('Error initializing MediaPipe Gesture Recognizer:', error)
    }
  },

  detectGestures: function () {
    if (!video || !gestureRecognizer || !this.gestureDetectionEnabled) {
      requestAnimationFrame(() => this.detectGestures())
      return
    }

    const startTimeMs = performance.now()
    if (lastVideoTime !== video.currentTime) {
      lastVideoTime = video.currentTime
      try {
        const results = gestureRecognizer.recognizeForVideo(video, startTimeMs)
        this.processGestureResults(results)
      } catch (error) {
        console.error('Error detecting gestures:', error)
      }
    }

    requestAnimationFrame(() => this.detectGestures())
  },

  processGestureResults: function (results) {
    if (!results || !results.gestures || results.gestures.length === 0) {
      // No gesture detected
      if (this.currentGesture) {
        console.log('👋 Gesture stopped')
        this.currentGesture = null

        // Emit event for visual feedback
        this.el.sceneEl.emit('gesture-detected', {
          gesture: null,
          confidence: 0,
        })
      }

      // Stop animation after a brief delay
      if (this.hasDrawings) {
        setTimeout(() => {
          if (!this.currentGesture) {
            this.el.sceneEl.emit('gesture-animation', { action: 'stop' })
          }
        }, 200)
      }
      return
    }

    // Get the most confident gesture for first hand
    const gesture = results.gestures[0][0]
    const gestureName = gesture.categoryName
    const confidence = gesture.score

    // Only process high confidence gestures
    if (confidence < 0.7) return

    // Log gesture if it's new or changed
    if (!this.currentGesture || this.currentGesture !== gestureName) {
      const handedness = results.handednesses[0][0].displayName
      console.log(
        `✋ Gesture Detected: ${gestureName} | Confidence: ${(
          confidence * 100
        ).toFixed(1)}% | Hand: ${handedness}`
      )
      this.currentGesture = gestureName

      // Emit event for visual feedback
      this.el.sceneEl.emit('gesture-detected', {
        gesture: gestureName,
        confidence: confidence,
        handedness: handedness,
      })
    }

    // Handle specific gestures for animation
    if (this.hasDrawings) {
      let direction = null
      let action = 'animate'

      // Map gestures to directions and actions
      switch (gestureName) {
        case 'Pointing_Up':
          direction = 'Up'
          break
        case 'Victory':
        case 'ILoveYou':
          direction = 'Up'
          break
        case 'Thumb_Down':
          direction = 'Down'
          break
        case 'Thumb_Up':
          // Special floating animation for Thumb_Up
          action = 'float'
          break
        case 'Open_Palm':
          // Stop animation for open palm
          action = 'stop'
          break
        case 'Closed_Fist':
          // Reset drawing position
          action = 'reset'
          break
      }

      // Emit animation event
      if (action === 'animate' && direction) {
        this.el.sceneEl.emit('gesture-animation', {
          action: 'animate',
          direction: direction,
        })
      } else if (action === 'float') {
        this.el.sceneEl.emit('gesture-animation', {
          action: 'float',
        })
      } else if (action === 'stop' || action === 'reset') {
        this.el.sceneEl.emit('gesture-animation', {
          action: action,
        })
      }
    }
  },
}
