// Dynamic weather system with smooth transitions between sunny and rainy conditions
export const weatherSystemComponent = {
  schema: {
    transitionDuration: { type: 'number', default: 10000 }, // 10 seconds for weather transitions
    minWeatherDuration: { type: 'number', default: 30000 }, // Min 30 seconds per weather
    maxWeatherDuration: { type: 'number', default: 90000 }, // Max 90 seconds per weather
    startWeather: {
      type: 'string',
      default: 'sunny',
      oneOf: ['sunny', 'rainy'],
    },
    autoChange: { type: 'boolean', default: false },
    rainIntensity: { default: 0.2 },
    sunflowerMinScale: { type: 'number', default: 0.4 },
    sunflowerMaxScale: { type: 'number', default: 0.85 },
    sunflowerMinCount: { type: 'number', default: 10 },
    sunflowerMaxCount: { type: 'number', default: 12 },
    sunflowerMaxTotal: { type: 'number', default: 100 },
    rainColor: { type: 'color', default: '#e6f2ff' },
    rainOpacity: { type: 'number', default: 0.3 },
    rainLineWidth: { type: 'number', default: 2 },
    rainCount: { type: 'number', default: 5000 },
  },

  init: function () {
    this.currentWeather = this.data.startWeather
    this.targetWeather = this.data.startWeather
    this.transitionProgress = 1 // 1 = fully transitioned
    this.nextWeatherChangeTime = Date.now() + this.getRandomDuration()

    // Weather states
    this.weatherStates = {
      sunny: {
        skyTopColor: '#87CEEB',
        skyHorizonColor: '#E0F6FF',
        skyBottomColor: '#98D8E8',
        cloudOpacity: 0.7,
        cloudBrightness: 1.2,
        sunIntensity: 1.8,
        sunVisible: true,
        windSpeed: 0.5, // Reduced for gentler breeze
        rainIntensity: 0,
      },
      rainy: {
        skyTopColor: '#4A5568',
        skyHorizonColor: '#718096',
        skyBottomColor: '#2D3748',
        cloudOpacity: 0.9,
        cloudBrightness: 0.4,
        sunIntensity: 0, // Fully fade sun
        sunVisible: true, // Keep visible for smooth transition
        windSpeed: 1.5, // Reduced difference for smoother transition
        rainIntensity: this.data.rainIntensity,
      },
    }

    // Get references to components we'll control
    this.sky = this.el.sceneEl.querySelector('[cyberpunk-sky]')
    this.sun = this.el.sceneEl.querySelector('[sun-system]')
    this.clouds = this.el.sceneEl.querySelector('[cloud-system]')
    this.grass = this.el.sceneEl.querySelector('[grass-field]')

    // Create rain system
    this.createRainSystem()

    // Create lightning system
    this.createLightningSystem()

    // Lightning timing
    this.nextLightningTime = Date.now() + 5000 // First lightning after 5 seconds
    this.lightningActive = false
    this.lightningDuration = 200 // milliseconds
    this.lightningEndTime = 0

    // Sunflower system
    this.sunflowers = []
    this.maxSunflowers = this.data.sunflowerMaxTotal
    this.sunflowersToGrow = []
    this.lastWeatherState = this.currentWeather
    this.sunflowerGrowthTriggered = false

    // Apply initial weather
    this.applyWeatherState(this.currentWeather, 1)
  },

  createRainSystem: function () {
    // Create rain particles
    this.rainContainer = document.createElement('a-entity')
    this.rainContainer.setAttribute('id', 'rain-system')

    // Rain particle geometry - long thin lines for rain drops
    const rainCount = this.data.rainCount // Configurable particle count
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(rainCount * 6) // 2 vertices per line * 3 coords
    const velocities = new Float32Array(rainCount * 3)
    const colors = new Float32Array(rainCount * 6) // Color per vertex

    // Initialize rain drops
    for (let i = 0; i < rainCount; i++) {
      const i3 = i * 3
      const i6 = i * 6

      // Random starting position - spread across scene
      const x = (Math.random() - 0.5) * 80
      const y = Math.random() * 25 + 15
      const z = (Math.random() - 0.5) * 80

      // Line start point
      positions[i6] = x
      positions[i6 + 1] = y
      positions[i6 + 2] = z

      // Line end point (visible rain streaks)
      positions[i6 + 3] = x - 0.3 // Diagonal rain
      positions[i6 + 4] = y - 1.5 // Longer visible streaks
      positions[i6 + 5] = z - 0.3

      // White-blue rain color
      colors[i6] = colors[i6 + 3] = 0.9
      colors[i6 + 1] = colors[i6 + 4] = 0.95
      colors[i6 + 2] = colors[i6 + 5] = 1.0

      // Velocity (falling speed with wind)
      velocities[i3] = -1.0 - Math.random() * 0.5 // Wind X
      velocities[i3 + 1] = -10 - Math.random() * 5 // Fall speed Y
      velocities[i3 + 2] = -1.0 - Math.random() * 0.5 // Wind Z
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    // Rain material with better visibility - configurable for AR
    this.rainMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.data.rainColor),
      opacity: 0,
      transparent: true,
      linewidth: this.data.rainLineWidth,
      vertexColors: true,
      blending: THREE.AdditiveBlending, // Better for AR visibility
    })

    this.rainMesh = new THREE.LineSegments(geometry, this.rainMaterial)
    this.rainContainer.object3D.add(this.rainMesh)

    // Store velocities for animation
    this.rainVelocities = velocities
    this.rainPositions = positions

    this.el.sceneEl.appendChild(this.rainContainer)
  },

  createLightningSystem: function () {
    // Create lightning light for scene illumination only (no visible plane)
    this.lightningLight = document.createElement('a-entity')
    this.lightningLight.setAttribute('light', {
      type: 'ambient',
      color: '#E8EEFF',
      intensity: 0,
    })

    // Create directional light for more dramatic effect
    this.lightningDirectional = document.createElement('a-entity')
    this.lightningDirectional.setAttribute('light', {
      type: 'directional',
      color: '#FFFFFF',
      intensity: 0,
      castShadow: false,
    })
    this.lightningDirectional.setAttribute('position', '0 100 0')
    this.lightningDirectional.setAttribute('rotation', '-90 0 0')

    this.el.sceneEl.appendChild(this.lightningLight)
    this.el.sceneEl.appendChild(this.lightningDirectional)

    // Store original sky colors for flash effect
    this.originalSkyColors = null
  },

  getRandomDuration: function () {
    return (
      this.data.minWeatherDuration +
      Math.random() *
        (this.data.maxWeatherDuration - this.data.minWeatherDuration)
    )
  },

  tick: function (_, deltaTime) {
    const now = Date.now()

    // Check if it's time to change weather
    if (
      this.data.autoChange &&
      now > this.nextWeatherChangeTime &&
      this.transitionProgress >= 1
    ) {
      this.targetWeather = this.currentWeather === 'sunny' ? 'rainy' : 'sunny'
      this.transitionProgress = 0
      this.nextWeatherChangeTime =
        now + this.getRandomDuration() + this.data.transitionDuration
    }

    // Handle weather transition with three phases
    if (this.transitionProgress < 1) {
      this.transitionProgress += deltaTime / this.data.transitionDuration
      this.transitionProgress = Math.min(1, this.transitionProgress)

      // Three-phase transition for dramatic sun-to-rain effect:
      // For Rainy: Sky darkens first, then sun fades just before rain
      // For Sunny: Rain stops, sky clears, then sun appears

      if (this.targetWeather === 'rainy') {
        // Going to rainy: sky changes, then sun fades, then rain starts

        // Sun fading (50-70% of transition) - just before rain
        if (this.transitionProgress < 0.5) {
          // Sun stays fully visible while sky is changing
          this.fadeSun(1)
        } else if (this.transitionProgress < 0.7) {
          // Rapid sun fade just before rain (0.5-0.7 mapped to 1-0)
          const sunFadeProgress = (this.transitionProgress - 0.5) / 0.2
          const easedSunFade = this.easeInOutSine(sunFadeProgress)
          this.fadeSun(1 - easedSunFade)
        } else {
          // Sun completely hidden when rain starts
          this.fadeSun(0)
        }

        // Weather transition (sky/clouds change throughout, rain starts at 70%)
        const weatherProgress = this.transitionProgress
        this.interpolateWeatherWithRainDelay(
          this.currentWeather,
          this.targetWeather,
          this.easeInOutCubic(weatherProgress)
        )
      } else {
        // Going to sunny: rain stops, sky clears, then sun appears

        // Check if we should start growing sunflowers (start at 30% - exactly when rain stops)
        if (
          this.transitionProgress >= 0.3 &&
          !this.sunflowerGrowthTriggered &&
          this.targetWeather === 'sunny'
        ) {
          this.sunflowerGrowthTriggered = true
          // Schedule sunflowers to grow based on min/max count
          const countRange = this.data.sunflowerMaxCount - this.data.sunflowerMinCount
          const numSunflowers = this.data.sunflowerMinCount + Math.floor(Math.random() * (countRange + 1))
          this.sunflowersToGrow = []

          for (let i = 0; i < numSunflowers; i++) {
            // Staggered start for natural appearance
            this.sunflowersToGrow.push({
              delay: i * 50 + Math.random() * 100, // Staggered delays 0-1600ms
              growDuration: 2500 + Math.random() * 2500, // 2.5-5 seconds growth time
            })
          }
        }

        // Sun fading (40-80% of transition) - starts earlier while sky is clearing
        if (this.transitionProgress < 0.4) {
          // Sun stays hidden while rain is stopping
          this.fadeSun(0)
        } else if (this.transitionProgress < 0.8) {
          // Sun fades in gradually as sky clears (0.4-0.8 mapped to 0-1)
          const sunFadeProgress = (this.transitionProgress - 0.4) / 0.4
          const easedSunFade = this.easeInOutSine(sunFadeProgress)
          this.fadeSun(easedSunFade)
        } else {
          // Sun fully visible
          this.fadeSun(1)
        }

        // Weather transition (rain stops first at 30%, sky continues clearing)
        const weatherProgress = this.transitionProgress
        this.interpolateWeatherWithRainDelay(
          this.currentWeather,
          this.targetWeather,
          this.easeInOutCubic(weatherProgress)
        )
      }

      // Update current weather when transition completes
      if (this.transitionProgress >= 1) {
        this.currentWeather = this.targetWeather
        this.lastWeatherState = this.currentWeather
        // Reset the trigger flag for next transition
        this.sunflowerGrowthTriggered = false
      }
    }

    // Animate rain
    this.animateRain(deltaTime)

    // Handle lightning during rainy weather
    this.updateLightning(now)

    // Handle sunflower growing
    this.updateSunflowers(deltaTime)
  },

  updateLightning: function (now) {
    // Only show lightning during full rainy weather (not during transitions)
    const showLightning =
      this.currentWeather === 'rainy' &&
      this.targetWeather === 'rainy' &&
      this.transitionProgress >= 1

    if (showLightning) {
      // Schedule next lightning if needed
      if (now > this.nextLightningTime && !this.lightningActive) {
        // Random delay between lightning strikes (5-15 seconds)
        const minDelay = 5000
        const maxDelay = 15000
        this.nextLightningTime =
          now + minDelay + Math.random() * (maxDelay - minDelay)

        // Trigger lightning
        this.triggerLightning()
      }

      // Handle active lightning
      if (this.lightningActive && now > this.lightningEndTime) {
        this.endLightning()
      }
    } else {
      // Make sure lightning is off during transitions and sunny weather
      if (this.lightningActive) {
        this.endLightning()
      }
      // Reset timer when not rainy
      this.nextLightningTime = now + 5000
    }
  },

  triggerLightning: function () {
    this.lightningActive = true
    this.lightningEndTime = Date.now() + this.lightningDuration

    // Store current sky colors if not already stored
    if (!this.originalSkyColors && this.sky) {
      const skyData = this.sky.getAttribute('cyberpunk-sky')
      this.originalSkyColors = {
        topColor: skyData.topColor,
        horizonColor: skyData.horizonColor,
        bottomColor: skyData.bottomColor,
      }
    }

    // Random intensity
    const intensity = 0.3 + Math.random() * 0.4

    // Flash effect with lights only
    this.lightningLight.setAttribute('light', 'intensity', intensity * 0.3)
    this.lightningDirectional.setAttribute('light', 'intensity', intensity * 2)

    // Flash the sky briefly
    if (this.sky) {
      this.sky.setAttribute('cyberpunk-sky', {
        topColor: '#6A7A8C',
        horizonColor: '#8896A8',
        bottomColor: '#4A5A6C',
      })
    }

    // Double flash effect (common in real lightning)
    setTimeout(() => {
      if (this.lightningActive) {
        this.lightningLight.setAttribute('light', 'intensity', intensity * 0.1)
        this.lightningDirectional.setAttribute(
          'light',
          'intensity',
          intensity * 0.5
        )
        // Return sky to stormy colors
        if (this.sky && this.originalSkyColors) {
          this.sky.setAttribute('cyberpunk-sky', this.originalSkyColors)
        }
      }
    }, 50)

    setTimeout(() => {
      if (this.lightningActive) {
        this.lightningLight.setAttribute('light', 'intensity', intensity * 0.25)
        this.lightningDirectional.setAttribute(
          'light',
          'intensity',
          intensity * 1.5
        )
        // Brief sky flash again
        if (this.sky) {
          this.sky.setAttribute('cyberpunk-sky', {
            topColor: '#5A6A7C',
            horizonColor: '#7886A8',
            bottomColor: '#3A4A5C',
          })
        }
      }
    }, 100)
  },

  endLightning: function () {
    this.lightningActive = false
    this.lightningLight.setAttribute('light', 'intensity', 0)
    this.lightningDirectional.setAttribute('light', 'intensity', 0)

    // Restore original sky colors
    if (this.sky && this.originalSkyColors) {
      this.sky.setAttribute('cyberpunk-sky', this.originalSkyColors)
    }
  },

  updateSunflowers: function (deltaTime) {
    // Process scheduled sunflowers during transition to sunny weather
    if (this.targetWeather === 'sunny' && this.transitionProgress >= 0.3) {
      // Process scheduled sunflowers
      for (let i = this.sunflowersToGrow.length - 1; i >= 0; i--) {
        const sunflowerData = this.sunflowersToGrow[i]
        sunflowerData.delay -= deltaTime

        if (
          sunflowerData.delay <= 0 &&
          this.sunflowers.length < this.maxSunflowers
        ) {
          this.growSunflower(sunflowerData.growDuration)
          this.sunflowersToGrow.splice(i, 1)
        }
      }
    }

    // Update growing animations
    this.sunflowers.forEach((sunflower) => {
      if (sunflower.growing) {
        sunflower.growProgress += deltaTime / sunflower.growDuration
        if (sunflower.growProgress >= 1) {
          sunflower.growProgress = 1
          sunflower.growing = false
        }

        // Apply eased scale
        const scale =
          this.easeInOutCubic(sunflower.growProgress) * sunflower.targetScale
        sunflower.entity.setAttribute('scale', `${scale} ${scale} ${scale}`)
      }
    })
  },

  growSunflower: function (growDuration) {
    if (this.sunflowers.length >= this.maxSunflowers) return

    // Random position within grass field radius, but outside dead zone
    const angle = Math.random() * Math.PI * 2
    const deadZoneRadius = 0.7 // No sunflowers within 0.7 units of center
    const maxRadius = 4.5 // Grass field is about 6 units radius

    // Generate radius between deadZoneRadius and maxRadius
    const radius = deadZoneRadius + Math.random() * (maxRadius - deadZoneRadius)
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius

    // Get camera/user position
    const camera = this.el.sceneEl.querySelector('#camera')
    const cameraPos = camera.getAttribute('position')

    // Calculate rotation to face user/camera (same as face-user component)
    const dx = cameraPos.x - x
    const dz = cameraPos.z - z
    const angleToUser = Math.atan2(dx, dz) * (180 / Math.PI)

    // Random scale between min and max
    const scaleRange = this.data.sunflowerMaxScale - this.data.sunflowerMinScale
    const targetScale = this.data.sunflowerMinScale + Math.random() * scaleRange

    // Create container entity at ground level
    const sunflowerEntity = document.createElement('a-entity')
    sunflowerEntity.setAttribute('position', `${x} 0 ${z}`) // Position at ground level
    sunflowerEntity.setAttribute('rotation', `0 ${angleToUser} 0`)
    sunflowerEntity.setAttribute('scale', '0 0 0') // Start at 0 for grow animation

    // Add pinchable component with smaller grab distance to prevent multi-grab
    sunflowerEntity.setAttribute('pinchable-xr', 'grabDistance: 0.4')

    // Add face-user component for smooth rotation when pinched
    sunflowerEntity.setAttribute(
      'face-user-when-pinched',
      'speed: 5; offset: 0'
    )

    // Add the GLTF model as a child
    const modelEntity = document.createElement('a-entity')
    modelEntity.setAttribute('gltf-model', '#sunflowerModel')
    modelEntity.setAttribute('shadow', '')
    modelEntity.setAttribute('position', '0 0 0') // Model at same position as parent
    sunflowerEntity.appendChild(modelEntity)

    // Add invisible collision box for better pinch detection
    const collisionBox = document.createElement('a-box')
    collisionBox.setAttribute('width', '0.6')
    collisionBox.setAttribute('height', '1.6') // Match approximate sunflower height
    collisionBox.setAttribute('depth', '0.6')
    collisionBox.setAttribute('position', '0 0.8 0') // Center at half height of flower
    collisionBox.setAttribute('material', 'visible: false; opacity: 0')
    sunflowerEntity.appendChild(collisionBox)

    // Add to scene
    this.el.sceneEl.appendChild(sunflowerEntity)

    // Track sunflower data
    this.sunflowers.push({
      entity: sunflowerEntity,
      targetScale: targetScale,
      growProgress: 0,
      growing: true,
      growDuration: growDuration,
    })
  },

  fadeSun: function (opacity) {
    if (this.sun && this.sun.object3D) {
      // Keep sun always visible but control opacity
      this.sun.object3D.visible = true

      // Apply opacity to all sun materials
      this.sun.object3D.traverse((child) => {
        if (child.material) {
          child.material.transparent = true
          child.material.opacity = opacity

          // Also update shader uniforms if they exist
          if (child.material.uniforms && child.material.uniforms.opacity) {
            child.material.uniforms.opacity.value = opacity
          }
        }
      })

      // Update sun component materials directly
      const sunComponent = this.sun.components['sun-system']
      if (sunComponent) {
        if (sunComponent.coreMaterial) {
          sunComponent.coreMaterial.transparent = true
          sunComponent.coreMaterial.opacity = opacity
          if (sunComponent.coreMaterial.uniforms.opacity) {
            sunComponent.coreMaterial.uniforms.opacity.value = opacity
          }
        }
        if (sunComponent.glowMaterial) {
          sunComponent.glowMaterial.transparent = true
          sunComponent.glowMaterial.opacity = opacity * 0.5 // Glow fades faster
          if (sunComponent.glowMaterial.uniforms.opacity) {
            sunComponent.glowMaterial.uniforms.opacity.value = opacity * 0.5
          }
        }
      }

      // Also fade intensity for better effect
      const baseIntensity = this.weatherStates.sunny.sunIntensity
      this.sun.setAttribute('sun-system', 'intensity', baseIntensity * opacity)

      // Fade the sun light as well
      if (sunComponent && sunComponent.sunLight) {
        sunComponent.sunLight.setAttribute('light', 'intensity', 0.3 * opacity)
      }
    }
  },

  interpolateWeatherWithRainDelay: function (fromWeather, toWeather, progress) {
    const from = this.weatherStates[fromWeather]
    const to = this.weatherStates[toWeather]

    // Interpolate sky colors throughout
    if (this.sky) {
      const topColor = this.lerpColor(
        from.skyTopColor,
        to.skyTopColor,
        progress
      )
      const horizonColor = this.lerpColor(
        from.skyHorizonColor,
        to.skyHorizonColor,
        progress
      )
      const bottomColor = this.lerpColor(
        from.skyBottomColor,
        to.skyBottomColor,
        progress
      )

      this.sky.setAttribute('cyberpunk-sky', {
        topColor: topColor,
        horizonColor: horizonColor,
        bottomColor: bottomColor,
      })
    }

    // Interpolate cloud appearance throughout
    if (this.clouds) {
      const cloudOpacity =
        from.cloudOpacity + (to.cloudOpacity - from.cloudOpacity) * progress
      this.clouds.setAttribute('cloud-system', 'opacity', cloudOpacity)

      // Update cloud brightness through shader
      const cloudMaterial = this.clouds.components['cloud-system'].cloudMaterial
      if (cloudMaterial) {
        const brightness =
          from.cloudBrightness +
          (to.cloudBrightness - from.cloudBrightness) * progress
        cloudMaterial.uniforms.color.value.setRGB(
          brightness,
          brightness,
          brightness
        )
      }
    }

    // Interpolate wind throughout with gentle easing
    if (this.grass) {
      // Use subtle easing for natural wind transitions
      let windProgress = progress

      // Apply gentle easing curves
      if (toWeather === 'rainy') {
        // Gradual wind increase as storm approaches
        windProgress = this.easeInOutSine(progress)
      } else {
        // Wind calms down smoothly
        windProgress = this.easeInOutSine(progress)
      }

      const windSpeed = this.lerp(from.windSpeed, to.windSpeed, windProgress)

      // Apply wind speed
      this.grass.setAttribute('grass-field', 'windSpeed', windSpeed)
    }

    // Handle rain with delay
    let rainIntensity = from.rainIntensity
    if (toWeather === 'rainy') {
      // Rain starts at 70% progress (after sun has faded)
      if (progress > 0.7) {
        const rainProgress = (progress - 0.7) / 0.3
        rainIntensity =
          from.rainIntensity +
          (to.rainIntensity - from.rainIntensity) * rainProgress
      }
    } else {
      // Rain stops at 30% progress (before sun appears)
      if (progress < 0.3) {
        const rainProgress = 1 - progress / 0.3
        rainIntensity =
          to.rainIntensity +
          (from.rainIntensity - to.rainIntensity) * rainProgress
      } else {
        rainIntensity = to.rainIntensity
      }
    }
    this.rainMaterial.opacity = rainIntensity * this.data.rainOpacity * 2
  },

  interpolateWeather: function (fromWeather, toWeather, progress) {
    const from = this.weatherStates[fromWeather]
    const to = this.weatherStates[toWeather]

    // Interpolate sky colors
    if (this.sky) {
      const topColor = this.lerpColor(
        from.skyTopColor,
        to.skyTopColor,
        progress
      )
      const horizonColor = this.lerpColor(
        from.skyHorizonColor,
        to.skyHorizonColor,
        progress
      )
      const bottomColor = this.lerpColor(
        from.skyBottomColor,
        to.skyBottomColor,
        progress
      )

      this.sky.setAttribute('cyberpunk-sky', {
        topColor: topColor,
        horizonColor: horizonColor,
        bottomColor: bottomColor,
      })
    }

    // Interpolate cloud appearance
    if (this.clouds) {
      const cloudOpacity =
        from.cloudOpacity + (to.cloudOpacity - from.cloudOpacity) * progress
      this.clouds.setAttribute('cloud-system', 'opacity', cloudOpacity)

      // Update cloud brightness through shader
      const cloudMaterial = this.clouds.components['cloud-system'].cloudMaterial
      if (cloudMaterial) {
        const brightness =
          from.cloudBrightness +
          (to.cloudBrightness - from.cloudBrightness) * progress
        cloudMaterial.uniforms.color.value.setRGB(
          brightness,
          brightness,
          brightness
        )
      }
    }

    // Interpolate wind with linear transition
    if (this.grass) {
      // Use simple linear interpolation
      const windSpeed = this.lerp(from.windSpeed, to.windSpeed, progress)
      this.grass.setAttribute('grass-field', 'windSpeed', windSpeed)
    }

    // Fade rain in/out
    const rainIntensity =
      from.rainIntensity + (to.rainIntensity - from.rainIntensity) * progress
    this.rainMaterial.opacity = rainIntensity * this.data.rainOpacity * 2 // Visible but not too bright
  },

  animateRain: function (deltaTime) {
    if (!this.rainMesh) return

    const positions = this.rainMesh.geometry.attributes.position.array
    const velocities = this.rainVelocities
    const dt = deltaTime * 0.001

    // Update each raindrop
    for (let i = 0; i < positions.length / 6; i++) {
      const i3 = i * 3
      const i6 = i * 6

      // Update positions
      positions[i6] += velocities[i3] * dt
      positions[i6 + 1] += velocities[i3 + 1] * dt
      positions[i6 + 2] += velocities[i3 + 2] * dt

      positions[i6 + 3] += velocities[i3] * dt
      positions[i6 + 4] += velocities[i3 + 1] * dt
      positions[i6 + 5] += velocities[i3 + 2] * dt

      // Reset raindrop when it hits the ground
      if (positions[i6 + 1] < 0) {
        positions[i6] = (Math.random() - 0.5) * 80
        positions[i6 + 1] = 25 + Math.random() * 15
        positions[i6 + 2] = (Math.random() - 0.5) * 80

        positions[i6 + 3] = positions[i6] - 0.3
        positions[i6 + 4] = positions[i6 + 1] - 1.5
        positions[i6 + 5] = positions[i6 + 2] - 0.3
      }
    }

    this.rainMesh.geometry.attributes.position.needsUpdate = true
  },

  applyWeatherState: function (weather, progress) {
    const state = this.weatherStates[weather]

    if (this.sky) {
      this.sky.setAttribute('cyberpunk-sky', {
        topColor: state.skyTopColor,
        horizonColor: state.skyHorizonColor,
        bottomColor: state.skyBottomColor,
      })
    }

    if (this.clouds) {
      this.clouds.setAttribute('cloud-system', 'opacity', state.cloudOpacity)
    }

    if (this.sun) {
      // Set sun visibility based on weather
      if (weather === 'sunny') {
        this.fadeSun(1.0) // Fully visible
      } else {
        this.fadeSun(0) // Fully hidden
      }
    }

    if (this.grass) {
      this.grass.setAttribute('grass-field', 'windSpeed', state.windSpeed)
    }

    this.rainMaterial.opacity = state.rainIntensity * progress * this.data.rainOpacity * 2
  },

  lerpColor: function (color1, color2, progress) {
    const c1 = new THREE.Color(color1)
    const c2 = new THREE.Color(color2)
    const result = c1.lerp(c2, progress)
    return '#' + result.getHexString()
  },

  lerp: function (a, b, t) {
    return a + (b - a) * t
  },

  easeInOutCubic: function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  },

  easeInOutSine: function (t) {
    return -(Math.cos(Math.PI * t) - 1) / 2
  },

  changeWeather: function (weather) {
    if (weather !== this.currentWeather && weather !== this.targetWeather) {
      this.targetWeather = weather
      this.transitionProgress = 0
    }
  },

  remove: function () {
    if (this.rainContainer) {
      this.rainContainer.remove()
    }
    if (this.lightningLight) {
      this.lightningLight.remove()
    }
    if (this.lightningDirectional) {
      this.lightningDirectional.remove()
    }
    // Remove all sunflowers
    this.sunflowers.forEach((sunflower) => {
      sunflower.entity.remove()
    })
    this.sunflowers = []
  },
}
