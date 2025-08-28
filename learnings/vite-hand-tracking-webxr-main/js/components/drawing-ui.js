export const drawingUIComponent = {
  init() {
    this.createUI()
    this.isDrawingEnabled = false // Disabled by default
    this.currentColor = '#FFFFFF' // Default to white
    this.handMarkersVisible = true
    this.gestureDetectionEnabled = false // Disabled by default
    this.grassGrowthEnabled = false // Track grass growth state
    this.handOccluderEnabled = false // Disabled by default
    this.weatherAutoChangeEnabled = false // Disabled by default to match scene config
    this.sphereModeEnabled = false // Disabled by default

    this.showUI = this.showUI.bind(this)

    this.showUI()
  },

  createUI() {
    // Create container for buttons
    const uiContainer = document.createElement('div')
    this.uiContainer = uiContainer // Store reference for later
    uiContainer.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      display: none; /* Hidden by default */
      gap: 16px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.5s ease-in-out;
    `

    // Create button styles with glass effect
    const buttonStyle = `
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      padding: 0;
      outline: none;
    `

    // SVG icons
    const handIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v1m0 4V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v5m0 4V9a2 2 0 0 0-2-2 2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h8a4 4 0 0 0 4-4v-5a2 2 0 0 0-2-2Z"/>
    </svg>`

    const brushIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/>
      <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>
    </svg>`

    const paletteIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
    </svg>`

    const undoIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 7v6h6"/>
      <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
    </svg>`

    const gestureIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
    </svg>`

    const markerIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <!-- Connection lines -->
      <path d="M6 18 L12 12 L18 6" stroke-width="1.5" opacity="0.6"/>
      <path d="M6 6 L12 12 L18 18" stroke-width="1.5" opacity="0.6"/>
      <!-- Marker spheres -->
      <circle cx="6" cy="6" r="2.5" fill="currentColor"/>
      <circle cx="12" cy="12" r="3" fill="currentColor"/>
      <circle cx="18" cy="18" r="2.5" fill="currentColor"/>
      <circle cx="6" cy="18" r="2.5" fill="currentColor"/>
      <circle cx="18" cy="6" r="2.5" fill="currentColor"/>
    </svg>`

    const grassIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 20C12 20 9 15 9 10C9 8 10 6 12 2C14 6 15 8 15 10C15 15 12 20 12 20Z" fill="#4CAF50" fill-opacity="0.3"/>
      <path d="M7 20C7 20 5 17 5 13C5 11.5 5.5 10.5 7 8C8.5 10.5 9 11.5 9 13C9 17 7 20 7 20Z" fill="#4CAF50" fill-opacity="0.3"/>
      <path d="M17 20C17 20 15 17 15 13C15 11.5 15.5 10.5 17 8C18.5 10.5 19 11.5 19 13C19 17 17 20 17 20Z" fill="#4CAF50" fill-opacity="0.3"/>
      <path d="M3 20C3 20 2 18 2 15C2 14 2.5 13 3 11C3.5 13 4 14 4 15C4 18 3 20 3 20Z" fill="#4CAF50" fill-opacity="0.3"/>
      <path d="M21 20C21 20 20 18 20 15C20 14 20.5 13 21 11C21.5 13 22 14 22 15C22 18 21 20 21 20Z" fill="#4CAF50" fill-opacity="0.3"/>
    </svg>`

    const pencilIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 3l4 4L8 20l-4 1 1-4L17 3z"/>
      <path d="M3 21l6-6"/>
    </svg>`

    const sphereIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(15 12 12)"/>
      <path d="M12 2v20"/>
    </svg>`

    const occluderIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <!-- Hand outline -->
      <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v1m0 4V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v5m0 4V9a2 2 0 0 0-2-2 2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h8a4 4 0 0 0 4-4v-5a2 2 0 0 0-2-2Z"/>
      <!-- Mask/occlusion indicator with dotted line -->
      <path d="M7 16h10" stroke-dasharray="2,2" stroke-width="3" opacity="0.6"/>
      <path d="M7 12h10" stroke-dasharray="2,2" stroke-width="3" opacity="0.4"/>
      <path d="M7 8h10" stroke-dasharray="2,2" stroke-width="3" opacity="0.2"/>
    </svg>`

    const weatherIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <g>
        <circle cx="17" cy="10" r="4.5" stroke="#FFD700" fill="#FFD700" stroke-width="0"/>
        <path d="M17 2v2" stroke="#FFD700" stroke-width="2"/>
        <path d="M24 10h-2" stroke="#FFD700" stroke-width="2"/>
        <path d="M22.5 4.5l-1.5 1.5" stroke="#FFD700" stroke-width="2"/>
        <path d="M22.5 15.5l-1.5-1.5" stroke="#FFD700" stroke-width="2"/>
        <path d="M17 18v-2" stroke="#FFD700" stroke-width="2"/>
        <path d="M11.5 4.5l1.5 1.5" stroke="#FFD700" stroke-width="2"/>
        <path d="M11.5 15.5l1.5-1.5" stroke="#FFD700" stroke-width="2"/>
      </g>
      <path d="M13 12h-1.5A6 6 0 1 0 6 18h7a4 4 0 0 0 0-8z" stroke="white" fill="white" stroke-width="2"/>
    </svg>`

    const environmentIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
      <circle cx="8" cy="20" r="2"/>
      <path d="M8 18v-6"/>
      <path d="M6 20l-1.5-1.5"/>
      <path d="M10 20l1.5-1.5"/>
    </svg>`

    const recenterIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3.5"/>
      <line x1="12" y1="4" x2="12" y2="8"/>
      <line x1="12" y1="16" x2="12" y2="20"/>
      <line x1="4" y1="12" x2="8" y2="12"/>
      <line x1="16" y1="12" x2="20" y2="12"/>
    </svg>`

    // Create drawing menu container (left popover)
    const drawingMenuContainer = document.createElement('div')
    drawingMenuContainer.style.cssText = `
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    `

    // Main drawing menu button (brush icon)
    const drawingMenuBtn = document.createElement('button')
    drawingMenuBtn.innerHTML = brushIcon
    drawingMenuBtn.style.cssText = buttonStyle
    drawingMenuBtn.onmouseenter = () => (drawingMenuBtn.style.transform = 'scale(1.1)')
    drawingMenuBtn.onmouseleave = () => (drawingMenuBtn.style.transform = 'scale(1)')
    
    // Drawing menu items container
    const drawingMenuItems = document.createElement('div')
    drawingMenuItems.style.cssText = `
      position: absolute;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      gap: 8px;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    `

    // Create action menu container (right popover for hand/gesture)
    const actionMenuContainer = document.createElement('div')
    actionMenuContainer.style.cssText = `
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    `

    // Main action menu button (hand icon)
    const actionMenuBtn = document.createElement('button')
    actionMenuBtn.innerHTML = handIcon
    actionMenuBtn.style.cssText = buttonStyle
    actionMenuBtn.onmouseenter = () => (actionMenuBtn.style.transform = 'scale(1.1)')
    actionMenuBtn.onmouseleave = () => (actionMenuBtn.style.transform = 'scale(1)')
    
    // Action menu items container
    const actionMenuItems = document.createElement('div')
    actionMenuItems.style.cssText = `
      position: absolute;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      gap: 8px;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    `
    
    // Marker toggle button (spheres icon)
    const markerBtn = document.createElement('button')
    markerBtn.innerHTML = markerIcon
    markerBtn.style.cssText = buttonStyle + `transform: scale(0); transition: transform 0.3s ease;`
    markerBtn.onmouseenter = () => (markerBtn.style.transform = 'scale(1.1)')
    markerBtn.onmouseleave = () => (markerBtn.style.transform = 'scale(1)')
    markerBtn.onclick = () => {
      this.toggleHandMarkers(markerBtn)
      this.toggleActionMenu(actionMenuItems, [markerBtn, gestureBtn, occluderBtn])
    }
    
    // Gesture detection button
    const gestureBtn = document.createElement('button')
    gestureBtn.innerHTML = gestureIcon
    gestureBtn.style.cssText = buttonStyle + `opacity: 0.5; transform: scale(0); transition: transform 0.3s ease 0.05s;`
    gestureBtn.onmouseenter = () => (gestureBtn.style.transform = 'scale(1.1)')
    gestureBtn.onmouseleave = () => (gestureBtn.style.transform = 'scale(1)')
    gestureBtn.onclick = () => {
      this.toggleGestureDetection(gestureBtn)
      this.toggleActionMenu(actionMenuItems, [markerBtn, gestureBtn, occluderBtn])
    }
    
    // Hand occluder button
    const occluderBtn = document.createElement('button')
    occluderBtn.innerHTML = occluderIcon
    occluderBtn.style.cssText = buttonStyle + `opacity: 0.5; transform: scale(0); transition: transform 0.3s ease 0.1s;` // Disabled by default
    occluderBtn.onmouseenter = () => (occluderBtn.style.transform = 'scale(1.1)')
    occluderBtn.onmouseleave = () => (occluderBtn.style.transform = 'scale(1)')
    occluderBtn.onclick = () => {
      this.toggleHandOccluder(occluderBtn)
      this.toggleActionMenu(actionMenuItems, [markerBtn, gestureBtn, occluderBtn])
    }
    
    // Add items to action menu
    actionMenuItems.appendChild(occluderBtn)
    actionMenuItems.appendChild(gestureBtn)
    actionMenuItems.appendChild(markerBtn)
    
    // Toggle action menu on click
    actionMenuBtn.onclick = () => this.toggleActionMenu(actionMenuItems, [markerBtn, gestureBtn, occluderBtn])
    
    // Add to container
    actionMenuContainer.appendChild(actionMenuBtn)
    actionMenuContainer.appendChild(actionMenuItems)

    // Drawing toggle button (for drawing menu)
    const toggleBtn = document.createElement('button')
    toggleBtn.innerHTML = pencilIcon
    toggleBtn.style.cssText = buttonStyle + `opacity: 0.5; transform: scale(0); transition: transform 0.3s ease;`
    toggleBtn.onmouseenter = () => (toggleBtn.style.transform = 'scale(1.1)')
    toggleBtn.onmouseleave = () => (toggleBtn.style.transform = 'scale(1)')
    toggleBtn.onclick = () => {
      this.toggleDrawing(toggleBtn)
      this.toggleActionMenu(drawingMenuItems, [toggleBtn, colorBtn, undoBtn])
    }

    // Color button with picker (for drawing menu)
    const colorBtn = document.createElement('button')
    colorBtn.innerHTML = paletteIcon
    colorBtn.style.cssText = buttonStyle + `position: relative; transform: scale(0); transition: transform 0.3s ease 0.05s;`
    colorBtn.onmouseenter = () => (colorBtn.style.transform = 'scale(1.1)')
    colorBtn.onmouseleave = () => (colorBtn.style.transform = 'scale(1)')

    // Hidden color input
    const colorInput = document.createElement('input')
    colorInput.type = 'color'
    colorInput.value = this.currentColor
    colorInput.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    `
    colorInput.onchange = (e) => {
      this.changeColor(e.target.value, colorBtn)
      this.toggleActionMenu(drawingMenuItems, [toggleBtn, colorBtn, undoBtn])
    }
    colorBtn.appendChild(colorInput)

    // Create environment menu container (middle popover)
    const environmentMenuContainer = document.createElement('div')
    environmentMenuContainer.style.cssText = `
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    `

    // Main environment menu button (environment icon)
    const environmentMenuBtn = document.createElement('button')
    environmentMenuBtn.innerHTML = environmentIcon
    environmentMenuBtn.style.cssText = buttonStyle
    environmentMenuBtn.onmouseenter = () => (environmentMenuBtn.style.transform = 'scale(1.1)')
    environmentMenuBtn.onmouseleave = () => (environmentMenuBtn.style.transform = 'scale(1)')
    
    // Environment menu items container
    const environmentMenuItems = document.createElement('div')
    environmentMenuItems.style.cssText = `
      position: absolute;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      gap: 8px;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    `

    // Grass button (for environment menu)
    const grassBtn = document.createElement('button')
    grassBtn.innerHTML = grassIcon
    grassBtn.style.cssText = buttonStyle + `opacity: 0.5; transform: scale(0); transition: transform 0.3s ease;`
    grassBtn.onmouseenter = () => (grassBtn.style.transform = 'scale(1.1)')
    grassBtn.onmouseleave = () => (grassBtn.style.transform = 'scale(1)')
    grassBtn.onclick = () => {
      this.toggleGrassGrowth(grassBtn)
      this.toggleActionMenu(environmentMenuItems, [grassBtn, weatherBtn])
    }

    // Weather button (for environment menu)
    const weatherBtn = document.createElement('button')
    weatherBtn.innerHTML = weatherIcon
    weatherBtn.style.cssText = buttonStyle + `opacity: 0.5; transform: scale(0); transition: transform 0.3s ease 0.05s;`
    weatherBtn.onmouseenter = () => (weatherBtn.style.transform = 'scale(1.1)')
    weatherBtn.onmouseleave = () => (weatherBtn.style.transform = 'scale(1)')
    weatherBtn.onclick = () => {
      this.toggleWeatherAutoChange(weatherBtn)
      this.toggleActionMenu(environmentMenuItems, [grassBtn, weatherBtn])
    }

    // Add items to environment menu
    environmentMenuItems.appendChild(weatherBtn)
    environmentMenuItems.appendChild(grassBtn)
    
    // Toggle environment menu on click
    environmentMenuBtn.onclick = () => this.toggleActionMenu(environmentMenuItems, [grassBtn, weatherBtn])
    
    // Add to environment container
    environmentMenuContainer.appendChild(environmentMenuBtn)
    environmentMenuContainer.appendChild(environmentMenuItems)

    // Sphere button (for drawing menu)
    const sphereBtn = document.createElement('button')
    sphereBtn.innerHTML = sphereIcon
    sphereBtn.style.cssText = buttonStyle + `opacity: 0.5; transform: scale(0); transition: transform 0.3s ease 0.1s;`
    sphereBtn.onmouseenter = () => (sphereBtn.style.transform = 'scale(1.1)')
    sphereBtn.onmouseleave = () => (sphereBtn.style.transform = 'scale(1)')
    sphereBtn.onclick = () => {
      this.toggleSphereMode(sphereBtn)
      this.toggleActionMenu(drawingMenuItems, [toggleBtn, colorBtn, sphereBtn, undoBtn])
    }

    // Undo button (for drawing menu)
    const undoBtn = document.createElement('button')
    undoBtn.innerHTML = undoIcon
    undoBtn.style.cssText = buttonStyle + `transform: scale(0); transition: transform 0.3s ease 0.15s;`
    undoBtn.onmouseenter = () => (undoBtn.style.transform = 'scale(1.1)')
    undoBtn.onmouseleave = () => (undoBtn.style.transform = 'scale(1)')
    undoBtn.onclick = () => {
      this.undoLastStrokes()
      this.toggleActionMenu(drawingMenuItems, [toggleBtn, colorBtn, sphereBtn, undoBtn])
    }

    // Add items to drawing menu (reverse order for bottom-up stacking)
    drawingMenuItems.appendChild(undoBtn)
    drawingMenuItems.appendChild(sphereBtn)
    drawingMenuItems.appendChild(colorBtn)
    drawingMenuItems.appendChild(toggleBtn)
    
    // Toggle drawing menu on click
    drawingMenuBtn.onclick = () => this.toggleActionMenu(drawingMenuItems, [toggleBtn, colorBtn, sphereBtn, undoBtn])
    
    // Add to drawing container
    drawingMenuContainer.appendChild(drawingMenuBtn)
    drawingMenuContainer.appendChild(drawingMenuItems)

    // Create recenter button
    const recenterBtn = document.createElement('button')
    recenterBtn.innerHTML = recenterIcon
    recenterBtn.style.cssText = buttonStyle
    recenterBtn.onmouseenter = () => (recenterBtn.style.transform = 'scale(1.1)')
    recenterBtn.onmouseleave = () => (recenterBtn.style.transform = 'scale(1)')
    recenterBtn.onclick = () => {
      const scene = document.querySelector('a-scene')
      const camera = document.querySelector('#camera')
      if (scene && camera) {
        // Get camera world position and direction
        const cameraPos = new THREE.Vector3()
        const cameraDir = new THREE.Vector3()
        camera.object3D.getWorldPosition(cameraPos)
        camera.object3D.getWorldDirection(cameraDir)
        
        // Calculate offset position (1.5 units in front of camera)
        const offsetDistance = 1.5
        const offsetPos = cameraPos.clone().add(cameraDir.multiplyScalar(offsetDistance))
        
        // Emit recenter with offset position
        scene.emit('recenter', { 
          offset: {
            x: offsetPos.x - cameraPos.x,
            y: 0, // Keep Y at same level
            z: offsetPos.z - cameraPos.z
          }
        })
      }
    }

    // Add buttons to container (drawing menu on left, environment in middle, action menu and recenter on right)
    uiContainer.appendChild(drawingMenuContainer)
    uiContainer.appendChild(environmentMenuContainer)
    uiContainer.appendChild(actionMenuContainer)
    uiContainer.appendChild(recenterBtn)

    // Add container to body
    document.body.appendChild(uiContainer)
    
    // Store references to marker and gesture buttons for external access
    this.markerBtn = markerBtn
    this.gestureBtn = gestureBtn
  },

  toggleDrawing(button) {
    this.isDrawingEnabled = !this.isDrawingEnabled

    // Update button appearance - only change opacity
    if (this.isDrawingEnabled) {
      button.style.opacity = '1'
    } else {
      button.style.opacity = '0.5'
    }

    // Notify the hand tracking component
    const scene = document.querySelector('a-scene')
    if (scene) {
      scene.emit('drawing-toggled', { enabled: this.isDrawingEnabled })
    }
  },

  changeColor(color, button) {
    this.currentColor = color

    // Add a small color indicator
    const colorIndicator =
      button.querySelector('.color-indicator') || document.createElement('div')
    colorIndicator.className = 'color-indicator'
    colorIndicator.style.cssText = `
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: ${this.currentColor};
      border: 1px solid rgba(0, 0, 0, 0.2);
    `
    if (!button.querySelector('.color-indicator')) {
      button.appendChild(colorIndicator)
    }

    // Notify the hand tracking component
    const scene = document.querySelector('a-scene')
    if (scene) {
      scene.emit('color-changed', { color: this.currentColor })
    }
  },

  undoLastStrokes() {
    // Remove last 10 stroke points
    const scene = document.querySelector('a-scene')
    if (scene) {
      scene.emit('undo-strokes', { count: 10 })
    }
  },

  toggleHandMarkers(button) {
    this.handMarkersVisible = !this.handMarkersVisible

    // Update button appearance - only change opacity
    if (this.handMarkersVisible) {
      button.style.opacity = '1'
    } else {
      button.style.opacity = '0.5'
    }

    // Notify the hand tracking component
    const scene = document.querySelector('a-scene')
    if (scene) {
      scene.emit('hand-markers-toggled', { visible: this.handMarkersVisible })
    }
  },

  toggleGestureDetection(button) {
    this.gestureDetectionEnabled = !this.gestureDetectionEnabled

    // Update button appearance - only change opacity
    if (this.gestureDetectionEnabled) {
      button.style.opacity = '1'
    } else {
      button.style.opacity = '0.5'
    }

    // Notify the gesture recognition component
    const scene = document.querySelector('a-scene')
    if (scene) {
      scene.emit('gesture-detection-toggled', {
        enabled: this.gestureDetectionEnabled,
      })
    }
  },

  showUI() {
    if (this.uiContainer && this.uiContainer.style.display === 'none') {
      // First set display to flex
      this.uiContainer.style.display = 'flex'

      // Then fade in after a small delay
      setTimeout(() => {
        this.uiContainer.style.opacity = '1'
      }, 100)
    }
  },

  toggleActionMenu(menuItems, buttons) {
    const isVisible = menuItems.style.visibility === 'visible'
    
    if (isVisible) {
      // Hide menu
      menuItems.style.opacity = '0'
      menuItems.style.visibility = 'hidden'
      buttons.forEach((btn, index) => {
        setTimeout(() => {
          btn.style.transform = 'scale(0)'
        }, index * 50)
      })
    } else {
      // Show menu
      menuItems.style.visibility = 'visible'
      menuItems.style.opacity = '1'
      buttons.forEach((btn, index) => {
        setTimeout(() => {
          btn.style.transform = 'scale(1)'
        }, index * 50)
      })
    }
  },

  toggleHandOccluder(button) {
    this.handOccluderEnabled = !this.handOccluderEnabled

    // Update button appearance
    if (this.handOccluderEnabled) {
      button.style.opacity = '1'
    } else {
      button.style.opacity = '0.5'
    }

    // Find all hand occluder components
    const handOccluders = document.querySelectorAll('[hand-occluder]')
    handOccluders.forEach(occluder => {
      const occluderComponent = occluder.components['hand-occluder']
      if (occluderComponent) {
        // Simply control visibility based on enabled state
        occluderComponent.enabled = this.handOccluderEnabled
        if (!this.handOccluderEnabled) {
          occluderComponent.setOccluderVisibility(false)
        }
      }
    })
  },

  toggleSphereMode(button) {
    this.sphereModeEnabled = !this.sphereModeEnabled

    // Update button appearance
    if (this.sphereModeEnabled) {
      button.style.opacity = '1'
    } else {
      button.style.opacity = '0.5'
    }

    // When sphere mode is enabled, disable drawing
    if (this.sphereModeEnabled && this.isDrawingEnabled) {
      // Find drawing button and toggle it off
      const drawingBtn = button.parentElement.querySelector('button:first-child')
      if (drawingBtn) {
        this.toggleDrawing(drawingBtn)
      }
    }

    // Emit event for sphere spawner component
    const scene = document.querySelector('a-scene')
    if (scene) {
      scene.emit('sphere-mode-toggled', { enabled: this.sphereModeEnabled })
    }
  },

  toggleWeatherAutoChange(button) {
    // Toggle state
    this.weatherAutoChangeEnabled = !this.weatherAutoChangeEnabled

    // Update button appearance
    if (this.weatherAutoChangeEnabled) {
      button.style.opacity = '1'
    } else {
      button.style.opacity = '0.5'
    }

    // Get the weather system component
    const weatherSystem = document.querySelector('[weather-system]')
    if (weatherSystem && weatherSystem.components['weather-system']) {
      const weatherComponent = weatherSystem.components['weather-system']

      // Update the autoChange property
      weatherComponent.data.autoChange = this.weatherAutoChangeEnabled

      // If enabling, schedule next weather change
      if (this.weatherAutoChangeEnabled) {
        weatherComponent.nextWeatherChangeTime = Date.now() + weatherComponent.getRandomDuration()
      }
    }
  },

  toggleGrassGrowth(button) {
    // Only work in WebAR scene
    const sceneName = window.DEFAULT_SCENE_NAME
    if (sceneName !== 'webar-hand') {
      console.warn('Grass growth button is only for WebAR scene')
      return
    }

    // Toggle state
    this.grassGrowthEnabled = !this.grassGrowthEnabled

    // Update button appearance
    if (this.grassGrowthEnabled) {
      button.style.opacity = '1'
    } else {
      button.style.opacity = '0.5'
    }

    // Find grass field entity
    const grassField = document.querySelector('[grass-field]')
    if (!grassField) {
      console.warn('No grass field found in scene')
      return
    }

    // Get grass component
    const grassComponent = grassField.components['grass-field']
    if (grassComponent) {
      if (this.grassGrowthEnabled) {
        // Start growth animation
        grassComponent.growStartTime = Date.now()
        grassComponent.shrinkStartTime = null // Cancel any shrinking
        grassComponent.currentGrowFactor = 0
        grassComponent.isGrowing = true
        if (grassComponent.grassMaterial) {
          grassComponent.grassMaterial.uniforms.uGrowFactor.value = 0
        }
      } else {
        // Start shrink animation from current growth state
        grassComponent.growStartTime = null // Cancel any growing
        grassComponent.shrinkStartTime = Date.now()
        grassComponent.startShrinkValue = grassComponent.currentGrowFactor
        grassComponent.isGrowing = false
      }
    }

    // Control growth particles
    const growthParticles = document.querySelector('[growth-particles]')
    if (growthParticles && growthParticles.components['growth-particles']) {
      const particlesComponent = growthParticles.components['growth-particles']
      if (this.grassGrowthEnabled) {
        particlesComponent.show()
      } else {
        particlesComponent.hide()
      }
    }
  },
}
