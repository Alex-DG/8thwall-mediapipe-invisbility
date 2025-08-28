// Component for wrist button and palm menu
export const handXrWristMenuComponent = {
  schema: {
    hand: { default: 'left', oneOf: ['left', 'right'] },
  },

  init: function () {
    this.wristButton = null
    this.palmMenu = null
    this.isMenuVisible = false
    this.colorIndicator = null
    this.drawToggleButton = null
    this.sphereButton = null
    this.grassButton = null
    this.weatherButton = null

    // Current state
    this.currentColor = '#FF69B4' // hotpink
    this.drawingEnabled = false // Drawing disabled by default
    this.sphereModeEnabled = false // Sphere mode disabled by default
    this.grassGrowthEnabled = false // Grass growth disabled by default
    this.weatherAutoChangeEnabled = false // Weather auto-change disabled by default

    // Available colors
    this.colorOptions = [
      '#FF69B4', // hotpink
      '#00FFFF', // cyan
      '#FFD700', // gold
      '#00FF00', // lime
      '#FF00FF', // magenta
      '#FFA500', // orange
      '#FF0000', // red
      '#0000FF', // blue
    ]

    this.createWristButton()
    this.createPalmMenu()
  },

  createWristButton: function () {
    // Create wrist button container
    this.wristButton = document.createElement('a-entity')
    this.wristButton.setAttribute('id', `${this.data.hand}-wrist-button`)

    // Rounded button
    const button = document.createElement('a-cylinder')
    button.setAttribute('radius', 0.015)
    button.setAttribute('height', 0.007)
    button.setAttribute('color', '#4a4a4a')
    button.setAttribute('rotation', '90 0 0')
    this.wristButton.appendChild(button)

    // Button icon (menu dots)
    const icon = document.createElement('a-text')
    icon.setAttribute('value', '⋮')
    icon.setAttribute('align', 'center')
    icon.setAttribute('color', 'white')
    icon.setAttribute('scale', '0.08 0.08 0.08')
    icon.setAttribute('position', '0 3 0')
    icon.setAttribute('rotation', '-90 0 0')
    this.wristButton.appendChild(icon)

    this.el.sceneEl.appendChild(this.wristButton)
  },

  createPalmMenu: function () {
    // Create palm menu container
    this.palmMenu = document.createElement('a-entity')
    this.palmMenu.setAttribute('id', `${this.data.hand}-palm-menu`)
    this.palmMenu.setAttribute('visible', false)

    // Create color swatches in a circular pattern
    const radius = 0.04
    this.colorOptions.forEach((color, index) => {
      const angle = (index / this.colorOptions.length) * Math.PI * 2
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius

      const swatch = document.createElement('a-circle')
      swatch.setAttribute('radius', 0.012)
      swatch.setAttribute('color', color)
      swatch.setAttribute('position', `${x} ${y} 0.01`)
      swatch.setAttribute('color-value', color)

      this.palmMenu.appendChild(swatch)
    })

    // Center color indicator
    this.colorIndicator = document.createElement('a-circle')
    this.colorIndicator.setAttribute('radius', 0.018)
    this.colorIndicator.setAttribute('color', this.currentColor)
    this.colorIndicator.setAttribute('position', '0 0 0.012')
    this.colorIndicator.setAttribute('opacity', 0.9)
    this.palmMenu.appendChild(this.colorIndicator)

    // Drawing toggle button
    this.drawToggleButton = document.createElement('a-entity')
    this.drawToggleButton.setAttribute('position', '-0.015 -0.08 0.01') // Shifted left and down

    // Use texture instead of text
    const toggleButton = document.createElement('a-plane')
    toggleButton.setAttribute('width', 0.03)
    toggleButton.setAttribute('height', 0.03)
    toggleButton.setAttribute('src', '/textures/on-off-btn.png')
    toggleButton.setAttribute('material', {
      transparent: true,
      opacity: this.drawingEnabled ? 1 : 0.7,
      alphaTest: 0.1,
      side: 'double',
    })
    this.drawToggleButton.appendChild(toggleButton)
    this.toggleButtonPlane = toggleButton

    this.palmMenu.appendChild(this.drawToggleButton)

    // Sphere mode button
    this.sphereButton = document.createElement('a-entity')
    this.sphereButton.setAttribute('position', '0.03 -0.08 0.01') // Shifted left

    const sphereButtonPlane = document.createElement('a-plane')
    sphereButtonPlane.setAttribute('width', 0.03)
    sphereButtonPlane.setAttribute('height', 0.03)
    sphereButtonPlane.setAttribute('src', '/textures/sphere-btn.png')
    sphereButtonPlane.setAttribute('material', {
      transparent: true,
      opacity: this.sphereModeEnabled ? 1 : 0.7,
      alphaTest: 0.1,
      side: 'double',
    })
    this.sphereButton.appendChild(sphereButtonPlane)
    this.sphereButtonPlane = sphereButtonPlane

    this.palmMenu.appendChild(this.sphereButton)

    // Grass growth button
    this.grassButton = document.createElement('a-entity')
    this.grassButton.setAttribute('position', '-0.057 -0.08 0.01') // Further left

    const grassButtonPlane = document.createElement('a-plane')
    grassButtonPlane.setAttribute('width', 0.032)
    grassButtonPlane.setAttribute('height', 0.032)
    grassButtonPlane.setAttribute('src', '/textures/grass-btn.png')
    grassButtonPlane.setAttribute('material', {
      transparent: true,
      opacity: this.grassGrowthEnabled ? 1 : 0.7,
      alphaTest: 0.1,
      side: 'double',
    })
    this.grassButton.appendChild(grassButtonPlane)
    this.grassButtonPlane = grassButtonPlane

    this.palmMenu.appendChild(this.grassButton)

    // Weather auto-change button
    this.weatherButton = document.createElement('a-entity')
    this.weatherButton.setAttribute('position', '0.075 -0.08 0.01') // Shifted left

    const weatherButtonPlane = document.createElement('a-plane')
    weatherButtonPlane.setAttribute('width', 0.032)
    weatherButtonPlane.setAttribute('height', 0.032)
    weatherButtonPlane.setAttribute('src', '/textures/weather-btn.png')
    weatherButtonPlane.setAttribute('material', {
      transparent: true,
      opacity: this.weatherAutoChangeEnabled ? 1 : 0.7,
      alphaTest: 0.1,
      side: 'double',
    })
    this.weatherButton.appendChild(weatherButtonPlane)
    this.weatherButtonPlane = weatherButtonPlane

    this.palmMenu.appendChild(this.weatherButton)

    this.el.sceneEl.appendChild(this.palmMenu)
  },

  toggleMenu: function () {
    this.isMenuVisible = !this.isMenuVisible
    this.palmMenu.setAttribute('visible', this.isMenuVisible)

    // Update button color for feedback
    const button = this.wristButton.querySelector('a-cylinder')
    if (button) {
      button.setAttribute('color', this.isMenuVisible ? '#6a6a6a' : '#4a4a4a')
    }
  },

  toggleDrawing: function () {
    this.drawingEnabled = !this.drawingEnabled

    // Update button opacity
    if (this.toggleButtonPlane) {
      this.toggleButtonPlane.setAttribute(
        'material',
        'opacity',
        this.drawingEnabled ? 1 : 0.7
      )
    }

    // When drawing is enabled, disable sphere mode
    if (this.drawingEnabled && this.sphereModeEnabled) {
      this.sphereModeEnabled = false
      if (this.sphereButtonPlane) {
        this.sphereButtonPlane.setAttribute('material', 'opacity', 0.7)
      }
    }

    // Update drawing component
    const drawComponent = this.el.components['hand-xr-draw']
    if (drawComponent) {
      drawComponent.isDrawing = this.drawingEnabled
    }
  },

  toggleSphereMode: function () {
    this.sphereModeEnabled = !this.sphereModeEnabled

    // Update sphere button opacity
    if (this.sphereButtonPlane) {
      this.sphereButtonPlane.setAttribute(
        'material',
        'opacity',
        this.sphereModeEnabled ? 1 : 0.7
      )
    }

    // When sphere mode is enabled, disable drawing
    if (this.sphereModeEnabled && this.drawingEnabled) {
      this.toggleDrawing()
    }
  },

  toggleGrassGrowth: function () {
    this.grassGrowthEnabled = !this.grassGrowthEnabled

    // Update grass button opacity
    if (this.grassButtonPlane) {
      this.grassButtonPlane.setAttribute(
        'material',
        'opacity',
        this.grassGrowthEnabled ? 1 : 0.7
      )
    }

    // Get the grass field component
    const grassField = this.el.sceneEl.querySelector('[grass-field]')
    if (grassField && grassField.components['grass-field']) {
      const grassComponent = grassField.components['grass-field']

      if (this.grassGrowthEnabled) {
        // Start growth animation
        grassComponent.growStartTime = Date.now()
        grassComponent.shrinkStartTime = null // Cancel any shrinking
        grassComponent.currentGrowFactor = 0
        grassComponent.grassMaterial.uniforms.uGrowFactor.value = 0
      } else {
        // Start shrink animation from current growth state
        grassComponent.growStartTime = null // Cancel any growing
        grassComponent.shrinkStartTime = Date.now()
        grassComponent.startShrinkValue = grassComponent.currentGrowFactor
      }
    }

    // Control growth particles
    const growthParticles = this.el.sceneEl.querySelector('[growth-particles]')
    if (growthParticles && growthParticles.components['growth-particles']) {
      const particlesComponent = growthParticles.components['growth-particles']
      if (this.grassGrowthEnabled) {
        particlesComponent.show()
      } else {
        particlesComponent.hide()
      }
    }
  },

  toggleWeatherAutoChange: function () {
    this.weatherAutoChangeEnabled = !this.weatherAutoChangeEnabled

    // Update weather button opacity
    if (this.weatherButtonPlane) {
      this.weatherButtonPlane.setAttribute(
        'material',
        'opacity',
        this.weatherAutoChangeEnabled ? 1 : 0.7
      )
    }

    // Get the weather system component
    const weatherSystem = this.el.sceneEl.querySelector('[weather-system]')
    if (weatherSystem && weatherSystem.components['weather-system']) {
      const weatherComponent = weatherSystem.components['weather-system']

      // Update the autoChange property
      weatherComponent.data.autoChange = this.weatherAutoChangeEnabled

      // If enabling, schedule next weather change
      if (this.weatherAutoChangeEnabled) {
        weatherComponent.nextWeatherChangeTime =
          Date.now() + weatherComponent.getRandomDuration()
      }
    }
  },

  selectColor: function (color) {
    this.currentColor = color
    this.colorIndicator.setAttribute('color', color)

    // Update drawing component
    const drawComponent = this.el.components['hand-xr-draw']
    if (drawComponent) {
      drawComponent.currentColor = color
    }
  },

  tick: function () {
    const handControls = this.el.components['hand-tracking-controls']
    if (!handControls || !handControls.el.object3D.visible) {
      this.wristButton.setAttribute('visible', false)
      this.palmMenu.setAttribute('visible', false)
      return
    }

    // Get hand model
    const handModel = handControls.el.object3D
    if (!handModel || handModel.children.length === 0) return

    // Position wrist button
    const wrist = handModel.getObjectByName('wrist')
    const middleMeta = handModel.getObjectByName('middle-finger-metacarpal')
    const indexMeta = handModel.getObjectByName('index-finger-metacarpal')

    if (wrist && middleMeta) {
      const wristPos = new THREE.Vector3()
      const palmPos = new THREE.Vector3()
      wrist.getWorldPosition(wristPos)
      middleMeta.getWorldPosition(palmPos)

      // Position button between wrist and palm
      this.wristButton.object3D.position.lerpVectors(wristPos, palmPos, -0.05)

      // Calculate the palm plane normal
      if (indexMeta) {
        const indexPos = new THREE.Vector3()
        indexMeta.getWorldPosition(indexPos)

        // Vector from wrist to middle metacarpal
        const wristToPalm = new THREE.Vector3()
        wristToPalm.subVectors(palmPos, wristPos).normalize()

        // Vector from middle to index metacarpal
        const palmToIndex = new THREE.Vector3()
        palmToIndex.subVectors(indexPos, palmPos).normalize()

        // Palm normal is perpendicular to both vectors
        const palmNormal = new THREE.Vector3()
        palmNormal.crossVectors(wristToPalm, palmToIndex).normalize()

        // For left hand, invert the normal
        if (this.data.hand === 'left') {
          palmNormal.multiplyScalar(-1)
        }

        // Offset button along NEGATIVE palm normal (on back of wrist)
        this.wristButton.object3D.position.addScaledVector(palmNormal, -0.025)

        // Orient button to match palm plane
        const lookAtPos = new THREE.Vector3()
        lookAtPos.copy(this.wristButton.object3D.position)
        lookAtPos.add(palmNormal)
        this.wristButton.object3D.lookAt(lookAtPos)

        // Align button rotation with wrist-to-palm direction
        this.wristButton.object3D.rotateOnAxis(
          new THREE.Vector3(0, 0, 1),
          Math.PI / 2
        )
      }

      this.wristButton.setAttribute('visible', true)
    }

    // Position palm menu if visible
    if (this.isMenuVisible && wrist && middleMeta && indexMeta) {
      const palmPos = new THREE.Vector3()
      const wristPos = new THREE.Vector3()
      const indexPos = new THREE.Vector3()

      middleMeta.getWorldPosition(palmPos)
      wrist.getWorldPosition(wristPos)
      indexMeta.getWorldPosition(indexPos)

      // Position menu at palm center
      this.palmMenu.object3D.position.copy(palmPos)

      // Calculate palm plane normal (same as button logic)
      const wristToPalm = new THREE.Vector3()
      wristToPalm.subVectors(palmPos, wristPos).normalize()

      const palmToIndex = new THREE.Vector3()
      palmToIndex.subVectors(indexPos, palmPos).normalize()

      const palmNormal = new THREE.Vector3()
      palmNormal.crossVectors(wristToPalm, palmToIndex).normalize()

      // For left hand, invert the normal
      if (this.data.hand === 'left') {
        palmNormal.multiplyScalar(-1)
      }

      // Position menu on palm surface
      this.palmMenu.object3D.position.addScaledVector(palmNormal, 0.02)

      // Orient menu to face along palm normal
      const lookAtPos = new THREE.Vector3()
      lookAtPos.copy(this.palmMenu.object3D.position)
      lookAtPos.add(palmNormal)
      this.palmMenu.object3D.lookAt(lookAtPos)

      // Keep toggle button at fixed position below color circle
      // The dynamic positioning was causing visibility issues
      // Position is already set in createPalmMenu at 0, -0.08, 0.01
    }

    // Check for interactions
    this.checkInteractions()
  },

  checkInteractions: function () {
    // Get opposite hand for interaction
    const oppositeHand = this.data.hand === 'left' ? 'right' : 'left'
    const oppositeHandEl = document.querySelector(`#${oppositeHand}Hand`)
    if (!oppositeHandEl) return

    const oppositeHandControls =
      oppositeHandEl.components['hand-tracking-controls']
    if (!oppositeHandControls || !oppositeHandControls.indexTipPosition) return

    const fingerPos = oppositeHandControls.indexTipPosition
    const touchDistance = 0.025

    // Check wrist button
    const wristButtonPos = new THREE.Vector3()
    this.wristButton.object3D.getWorldPosition(wristButtonPos)

    if (fingerPos.distanceTo(wristButtonPos) < touchDistance) {
      if (!this.wristButtonTouched) {
        this.toggleMenu()
        this.wristButtonTouched = true
      }
    } else {
      this.wristButtonTouched = false
    }

    // Only check menu interactions if visible
    if (!this.isMenuVisible) return

    // Check color swatches
    const swatches = this.palmMenu.querySelectorAll('a-circle[color-value]')
    let touchingAnySwatch = false
    let touchedColor = null

    swatches.forEach((swatch) => {
      const swatchPos = new THREE.Vector3()
      swatch.object3D.getWorldPosition(swatchPos)

      if (fingerPos.distanceTo(swatchPos) < touchDistance) {
        touchingAnySwatch = true
        touchedColor = swatch.getAttribute('color-value')
      }
    })

    if (touchingAnySwatch && !this.colorSwatchTouched) {
      if (touchedColor) {
        this.selectColor(touchedColor)
      }
    }
    this.colorSwatchTouched = touchingAnySwatch

    // Check drawing toggle button
    const togglePos = new THREE.Vector3()
    this.drawToggleButton.object3D.getWorldPosition(togglePos)

    if (fingerPos.distanceTo(togglePos) < touchDistance) {
      if (!this.drawToggleTouched) {
        this.toggleDrawing()
        this.drawToggleTouched = true
      }
    } else {
      this.drawToggleTouched = false
    }

    // Check sphere button
    const spherePos = new THREE.Vector3()
    this.sphereButton.object3D.getWorldPosition(spherePos)

    if (fingerPos.distanceTo(spherePos) < touchDistance) {
      if (!this.sphereButtonTouched) {
        this.toggleSphereMode()
        this.sphereButtonTouched = true
      }
    } else {
      this.sphereButtonTouched = false
    }

    // Check grass button
    const grassPos = new THREE.Vector3()
    this.grassButton.object3D.getWorldPosition(grassPos)

    if (fingerPos.distanceTo(grassPos) < touchDistance) {
      if (!this.grassButtonTouched) {
        this.toggleGrassGrowth()
        this.grassButtonTouched = true
      }
    } else {
      this.grassButtonTouched = false
    }

    // Check weather button
    const weatherPos = new THREE.Vector3()
    this.weatherButton.object3D.getWorldPosition(weatherPos)

    if (fingerPos.distanceTo(weatherPos) < touchDistance) {
      if (!this.weatherButtonTouched) {
        this.toggleWeatherAutoChange()
        this.weatherButtonTouched = true
      }
    } else {
      this.weatherButtonTouched = false
    }
  },

  remove: function () {
    if (this.wristButton) {
      this.wristButton.remove()
    }
    if (this.palmMenu) {
      this.palmMenu.remove()
    }
  },
}
