export const portalHandUIComponent = {
  init() {
    this.createUI()
    this.handMarkersVisible = true
    this.showUI = this.showUI.bind(this)
    this.showUI()
  },

  createUI() {
    // Create container for buttons
    const uiContainer = document.createElement('div')
    this.uiContainer = uiContainer
    uiContainer.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
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

    // Create action menu container
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
      this.toggleActionMenu(actionMenuItems, [markerBtn])
    }
    
    // Add marker button to action menu
    actionMenuItems.appendChild(markerBtn)
    
    // Toggle action menu on click
    actionMenuBtn.onclick = () => this.toggleActionMenu(actionMenuItems, [markerBtn])
    
    // Add to container
    actionMenuContainer.appendChild(actionMenuBtn)
    actionMenuContainer.appendChild(actionMenuItems)
    
    // Add containers to UI
    uiContainer.appendChild(actionMenuContainer)
    document.body.appendChild(uiContainer)
  },

  showUI() {
    if (this.uiContainer) {
      this.uiContainer.style.display = 'flex'
      // Trigger reflow
      this.uiContainer.offsetHeight
      this.uiContainer.style.opacity = '1'
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
  }
}