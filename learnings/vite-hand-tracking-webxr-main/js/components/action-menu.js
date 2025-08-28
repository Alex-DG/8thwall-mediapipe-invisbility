// Expanding action menu component with popover style
export const actionMenuComponent = {
  schema: {
    position: { type: 'vec3', default: { x: 0, y: 0, z: -0.5 } },
    expanded: { type: 'boolean', default: false },
    animationDuration: { type: 'number', default: 300 }, // milliseconds
  },

  init: function () {
    this.isExpanded = this.data.expanded
    this.isAnimating = false
    this.buttons = []
    this.buttonSpacing = 0.08
    this.mainButtonSize = 0.06
    this.subButtonSize = 0.05
    
    // Create main menu button
    this.createMainButton()
    
    // Create sub-buttons
    this.createSubButtons()
    
    // Set initial state
    this.updateMenuState(false)
  },

  createMainButton: function () {
    // Main button container
    this.mainButton = document.createElement('a-entity')
    this.mainButton.setAttribute('position', '0 0 0')
    
    // Button background
    const buttonBg = document.createElement('a-plane')
    buttonBg.setAttribute('width', this.mainButtonSize)
    buttonBg.setAttribute('height', this.mainButtonSize)
    buttonBg.setAttribute('material', 'color: #1a1a1a; opacity: 0.9')
    this.mainButton.appendChild(buttonBg)
    
    // Menu icon (three dots)
    const iconContainer = document.createElement('a-entity')
    iconContainer.setAttribute('position', '0 0 0.001')
    
    // Create three dots
    const dotPositions = [
      { x: -0.015, y: 0 },
      { x: 0, y: 0 },
      { x: 0.015, y: 0 }
    ]
    
    dotPositions.forEach(pos => {
      const dot = document.createElement('a-circle')
      dot.setAttribute('radius', '0.004')
      dot.setAttribute('color', '#ffffff')
      dot.setAttribute('position', `${pos.x} ${pos.y} 0`)
      iconContainer.appendChild(dot)
    })
    
    this.mainButton.appendChild(iconContainer)
    
    // Add click handler
    this.mainButton.addEventListener('click', () => {
      this.toggleMenu()
    })
    
    // Add hover effects
    this.mainButton.addEventListener('mouseenter', () => {
      if (!this.isAnimating) {
        buttonBg.setAttribute('color', '#2a2a2a')
      }
    })
    
    this.mainButton.addEventListener('mouseleave', () => {
      if (!this.isAnimating) {
        buttonBg.setAttribute('color', '#1a1a1a')
      }
    })
    
    this.el.appendChild(this.mainButton)
  },

  createSubButtons: function () {
    // Button configurations
    const buttonConfigs = [
      {
        id: 'hand-button',
        icon: 'hand',
        color: '#4CAF50',
        onClick: () => {
          this.el.sceneEl.emit('action-menu-clicked', { action: 'toggle-hand-markers' })
          console.log('Hand button clicked')
        }
      },
      {
        id: 'gesture-button',
        icon: 'gesture',
        color: '#2196F3',
        onClick: () => {
          this.el.sceneEl.emit('action-menu-clicked', { action: 'toggle-gestures' })
          console.log('Gesture button clicked')
        }
      }
    ]
    
    buttonConfigs.forEach((config, index) => {
      const button = this.createSubButton(config, index)
      this.buttons.push(button)
      this.el.appendChild(button.entity)
    })
  },

  createSubButton: function (config, index) {
    const buttonEntity = document.createElement('a-entity')
    buttonEntity.setAttribute('visible', false)
    buttonEntity.setAttribute('position', '0 0 0') // Start at center
    
    // Button background
    const buttonBg = document.createElement('a-plane')
    buttonBg.setAttribute('width', this.subButtonSize)
    buttonBg.setAttribute('height', this.subButtonSize)
    buttonBg.setAttribute('material', `color: ${config.color}; opacity: 0`)
    buttonEntity.appendChild(buttonBg)
    
    // Icon container
    const iconContainer = document.createElement('a-entity')
    iconContainer.setAttribute('position', '0 0 0.001')
    iconContainer.setAttribute('scale', '0 0 0')
    
    // Create icon based on type
    if (config.icon === 'hand') {
      this.createHandIcon(iconContainer)
    } else if (config.icon === 'gesture') {
      this.createGestureIcon(iconContainer)
    }
    
    buttonEntity.appendChild(iconContainer)
    
    // Add click handler
    buttonEntity.addEventListener('click', () => {
      if (this.isExpanded && !this.isAnimating) {
        config.onClick()
        // Close menu after action
        setTimeout(() => this.toggleMenu(), 100)
      }
    })
    
    // Add hover effects
    buttonEntity.addEventListener('mouseenter', () => {
      if (this.isExpanded && !this.isAnimating) {
        buttonBg.setAttribute('opacity', '1')
      }
    })
    
    buttonEntity.addEventListener('mouseleave', () => {
      if (this.isExpanded && !this.isAnimating) {
        buttonBg.setAttribute('opacity', '0.8')
      }
    })
    
    return {
      entity: buttonEntity,
      background: buttonBg,
      icon: iconContainer,
      config: config,
      targetPosition: this.calculateButtonPosition(index)
    }
  },

  createHandIcon: function (container) {
    // Simple hand icon using primitives
    const palm = document.createElement('a-plane')
    palm.setAttribute('width', '0.02')
    palm.setAttribute('height', '0.025')
    palm.setAttribute('material', 'color: #ffffff')
    palm.setAttribute('position', '0 -0.005 0')
    container.appendChild(palm)
    
    // Fingers
    const fingerPositions = [
      { x: -0.008, y: 0.01, h: 0.012 },
      { x: -0.0027, y: 0.012, h: 0.015 },
      { x: 0.0027, y: 0.012, h: 0.015 },
      { x: 0.008, y: 0.01, h: 0.012 }
    ]
    
    fingerPositions.forEach(pos => {
      const finger = document.createElement('a-plane')
      finger.setAttribute('width', '0.004')
      finger.setAttribute('height', pos.h)
      finger.setAttribute('material', 'color: #ffffff')
      finger.setAttribute('position', `${pos.x} ${pos.y} 0`)
      container.appendChild(finger)
    })
    
    // Thumb
    const thumb = document.createElement('a-plane')
    thumb.setAttribute('width', '0.004')
    thumb.setAttribute('height', '0.01')
    thumb.setAttribute('material', 'color: #ffffff')
    thumb.setAttribute('position', '-0.012 0 0')
    thumb.setAttribute('rotation', '0 0 -30')
    container.appendChild(thumb)
  },

  createGestureIcon: function (container) {
    // Gesture icon - pointing hand
    const hand = document.createElement('a-entity')
    
    // Palm (smaller for pointing gesture)
    const palm = document.createElement('a-rounded')
    palm.setAttribute('width', '0.018')
    palm.setAttribute('height', '0.02')
    palm.setAttribute('radius', '0.003')
    palm.setAttribute('color', '#ffffff')
    palm.setAttribute('position', '0 -0.005 0')
    palm.setAttribute('rotation', '0 0 -10')
    hand.appendChild(palm)
    
    // Index finger extended
    const indexFinger = document.createElement('a-rounded')
    indexFinger.setAttribute('width', '0.004')
    indexFinger.setAttribute('height', '0.018')
    indexFinger.setAttribute('radius', '0.002')
    indexFinger.setAttribute('color', '#ffffff')
    indexFinger.setAttribute('position', '0 0.012 0')
    indexFinger.setAttribute('rotation', '0 0 -10')
    hand.appendChild(indexFinger)
    
    // Other fingers folded (shorter)
    const foldedFingers = [
      { x: -0.005, y: 0.005 },
      { x: 0.005, y: 0.005 },
      { x: 0.009, y: 0.003 }
    ]
    
    foldedFingers.forEach(pos => {
      const finger = document.createElement('a-rounded')
      finger.setAttribute('width', '0.003')
      finger.setAttribute('height', '0.008')
      finger.setAttribute('radius', '0.0015')
      finger.setAttribute('color', '#ffffff')
      finger.setAttribute('position', `${pos.x} ${pos.y} 0`)
      finger.setAttribute('rotation', '0 0 -10')
      hand.appendChild(finger)
    })
    
    container.appendChild(hand)
  },

  calculateButtonPosition: function (index) {
    // Arrange buttons in a arc pattern
    const radius = 0.08
    const angleStep = 30 // degrees
    const startAngle = -15 // Start slightly to the left
    
    const angle = (startAngle + (index * angleStep)) * Math.PI / 180
    
    return {
      x: Math.sin(angle) * radius,
      y: Math.cos(angle) * radius,
      z: 0
    }
  },

  toggleMenu: function () {
    if (this.isAnimating) return
    
    this.isExpanded = !this.isExpanded
    this.updateMenuState(true)
  },

  updateMenuState: function (animate) {
    this.isAnimating = animate
    
    if (animate) {
      this.animateMenuTransition()
    } else {
      // Instant update
      this.buttons.forEach(button => {
        if (this.isExpanded) {
          button.entity.setAttribute('visible', true)
          button.entity.setAttribute('position', button.targetPosition)
          button.background.setAttribute('opacity', '0.8')
          button.icon.setAttribute('scale', '1 1 1')
        } else {
          button.entity.setAttribute('visible', false)
          button.entity.setAttribute('position', '0 0 0')
          button.background.setAttribute('opacity', '0')
          button.icon.setAttribute('scale', '0 0 0')
        }
      })
    }
  },

  animateMenuTransition: function () {
    const duration = this.data.animationDuration
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3)
      
      this.buttons.forEach((button, index) => {
        if (this.isExpanded) {
          // Expanding
          button.entity.setAttribute('visible', true)
          
          // Animate position
          const currentPos = {
            x: button.targetPosition.x * eased,
            y: button.targetPosition.y * eased,
            z: button.targetPosition.z * eased
          }
          button.entity.setAttribute('position', currentPos)
          
          // Animate opacity and scale with stagger
          const staggerDelay = index * 50 // ms delay between buttons
          const staggerProgress = Math.max(0, (elapsed - staggerDelay) / duration)
          const staggerEased = 1 - Math.pow(1 - Math.min(staggerProgress, 1), 3)
          
          button.background.setAttribute('opacity', 0.8 * staggerEased)
          button.icon.setAttribute('scale', `${staggerEased} ${staggerEased} ${staggerEased}`)
        } else {
          // Collapsing
          const reversed = 1 - eased
          
          // Animate position
          const currentPos = {
            x: button.targetPosition.x * reversed,
            y: button.targetPosition.y * reversed,
            z: button.targetPosition.z * reversed
          }
          button.entity.setAttribute('position', currentPos)
          
          // Animate opacity and scale
          button.background.setAttribute('opacity', 0.8 * reversed)
          button.icon.setAttribute('scale', `${reversed} ${reversed} ${reversed}`)
        }
      })
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        this.isAnimating = false
        
        // Hide buttons after collapse animation
        if (!this.isExpanded) {
          this.buttons.forEach(button => {
            button.entity.setAttribute('visible', false)
          })
        }
        
        // Emit event
        this.el.sceneEl.emit('action-menu-toggled', { expanded: this.isExpanded })
      }
    }
    
    requestAnimationFrame(animate)
  },

  update: function (oldData) {
    if (oldData.position !== this.data.position) {
      this.el.setAttribute('position', this.data.position)
    }
  }
}