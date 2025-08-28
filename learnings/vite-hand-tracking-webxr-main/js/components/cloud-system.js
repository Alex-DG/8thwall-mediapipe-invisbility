// Performant 360-degree cloud system using instanced geometry
export const cloudSystemComponent = {
  schema: {
    count: { type: 'number', default: 30 },
    minRadius: { type: 'number', default: 15 }, // Minimum distance from center
    maxRadius: { type: 'number', default: 40 }, // Maximum distance from center
    minHeight: { type: 'number', default: 8 },
    maxHeight: { type: 'number', default: 20 },
    minScale: { type: 'number', default: 3 },
    maxScale: { type: 'number', default: 8 },
    opacity: { type: 'number', default: 0.9 },
    speed: { type: 'number', default: 0.02 }, // Rotation speed
    color: { type: 'color', default: '#ffffff' },
    cloudDetail: { type: 'number', default: 5 } // Number of spheres per cloud
  },

  init: function () {
    this.clouds = []
    this.time = 0
    
    // Create cloud material with soft edges
    this.cloudMaterial = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(this.data.color).multiplyScalar(1.2) }, // Brighter base color
        opacity: { value: this.data.opacity },
        lightDirection: { value: new THREE.Vector3(0.5, 1, 0.5).normalize() },
        time: { value: 0 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float opacity;
        uniform vec3 lightDirection;
        uniform float time;
        
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        
        void main() {
          // Very soft cloud edges for more realistic appearance
          float edgeFade = 1.0 - smoothstep(0.1, 0.9, length(vUv - 0.5) * 2.0);
          edgeFade = pow(edgeFade, 1.5); // Make edges even softer
          
          // Brighter lighting for fluffy white clouds
          float light = dot(vNormal, lightDirection) * 0.2 + 0.8;
          light = pow(light, 0.5); // Less contrast, brighter overall
          
          // Add distance-based transparency
          float depth = gl_FragCoord.z / gl_FragCoord.w;
          float distanceFade = 1.0 - smoothstep(40.0, 100.0, depth);
          
          // Very subtle animation
          float animOffset = sin(time * 0.5 + vWorldPosition.x * 0.05) * 0.02;
          
          vec3 finalColor = color * light * (1.2 + animOffset); // Brighter
          float finalOpacity = opacity * edgeFade * distanceFade;
          
          gl_FragColor = vec4(finalColor, finalOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    })
    
    this.createClouds()
  },

  createClouds: function () {
    const geometry = new THREE.SphereGeometry(1, 8, 6)
    
    for (let i = 0; i < this.data.count; i++) {
      const cloud = new THREE.Group()
      
      // More natural random distribution with some clustering
      const angle = Math.random() * Math.PI * 2 // Fully random angle
      const radiusVariation = Math.random() * Math.random() // Squared for more variation
      const radius = this.data.minRadius + radiusVariation * (this.data.maxRadius - this.data.minRadius)
      
      // Height with more variation - some clouds much higher
      const heightVariation = Math.pow(Math.random(), 0.7) // Power for more high clouds
      const height = this.data.minHeight + heightVariation * (this.data.maxHeight - this.data.minHeight)
      
      cloud.position.set(
        Math.cos(angle) * radius + (Math.random() - 0.5) * 10, // Add some noise
        height,
        Math.sin(angle) * radius + (Math.random() - 0.5) * 10
      )
      
      // Create cloud from multiple spheres
      const cloudScale = this.data.minScale + Math.random() * (this.data.maxScale - this.data.minScale)
      
      for (let j = 0; j < this.data.cloudDetail; j++) {
        const sphere = new THREE.Mesh(geometry, this.cloudMaterial)
        
        // Position spheres to create cloud shape
        const offsetX = (Math.random() - 0.5) * 2
        const offsetY = (Math.random() - 0.5) * 0.5
        const offsetZ = (Math.random() - 0.5) * 2
        
        sphere.position.set(offsetX, offsetY, offsetZ)
        
        // Larger sphere sizes for fewer, bigger cloud parts
        const scale = 1.2 + Math.random() * 1.0
        sphere.scale.setScalar(scale)
        
        cloud.add(sphere)
      }
      
      // Overall cloud scale
      cloud.scale.setScalar(cloudScale)
      
      // Random rotation
      cloud.rotation.y = Math.random() * Math.PI * 2
      
      // Store cloud data with much slower movement
      this.clouds.push({
        object: cloud,
        rotationSpeed: (Math.random() - 0.5) * 0.0001, // 10x slower rotation
        floatSpeed: 0.1 + Math.random() * 0.1, // Much slower float
        floatAmount: 0.1 + Math.random() * 0.15, // Smaller float range
        initialY: cloud.position.y
      })
      
      this.el.object3D.add(cloud)
    }
  },

  tick: function (_, deltaTime) {
    this.time += deltaTime * 0.001
    
    // Update shader uniform
    this.cloudMaterial.uniforms.time.value = this.time
    
    // Animate clouds
    this.clouds.forEach((cloudData, i) => {
      const cloud = cloudData.object
      
      // Slow rotation
      cloud.rotation.y += cloudData.rotationSpeed * deltaTime
      
      // Gentle floating motion
      cloud.position.y = cloudData.initialY + 
        Math.sin(this.time * cloudData.floatSpeed + i) * cloudData.floatAmount
      
      // Extremely slow orbit around center
      const orbitSpeed = this.data.speed * 0.01 // Even slower
      const angle = this.time * orbitSpeed + (i / this.data.count) * Math.PI * 2
      const radius = Math.sqrt(cloud.position.x * cloud.position.x + cloud.position.z * cloud.position.z)
      
      cloud.position.x = Math.cos(angle) * radius
      cloud.position.z = Math.sin(angle) * radius
    })
  },

  remove: function () {
    this.clouds.forEach(cloudData => {
      this.el.object3D.remove(cloudData.object)
    })
    
    if (this.cloudMaterial) {
      this.cloudMaterial.dispose()
    }
  }
}