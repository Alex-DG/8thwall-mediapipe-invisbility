// Hand occluder component for WebAR to hide virtual objects behind real hands
export const handOccluderComponent = {
  schema: {
    hand: { default: 'left', oneOf: ['left', 'right'] },
    debug: { type: 'boolean', default: false },
    debugColor: { type: 'color', default: '#00ff00' },
  },

  init: function () {
    this.handMesh = null
    this.occluderMaterial = null
    this.debugMaterial = null
    this.jointSpheres = []
    this.connections = []
    this.hasLoggedVisibility = false
    this.enabled = false // Start disabled by default

    console.log(
      `Hand occluder initialized for ${this.data.hand} hand, debug: ${this.data.debug}`
    )

    // Create materials
    this.createMaterials()

    // MediaPipe hand connections for creating mesh between joints
    this.handConnections = [
      // Thumb connections
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      // Index finger
      [0, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      // Middle finger
      [0, 9],
      [9, 10],
      [10, 11],
      [11, 12],
      // Ring finger
      [0, 13],
      [13, 14],
      [14, 15],
      [15, 16],
      // Pinky
      [0, 17],
      [17, 18],
      [18, 19],
      [19, 20],
      // Palm connections
      [5, 9],
      [9, 13],
      [13, 17],
    ]

    // Create spheres for each joint (21 landmarks)
    // Much larger sizes for better occlusion coverage
    const jointSizes = {
      0: 0.05, // Wrist - much larger
      1: 0.04, // Thumb CMC
      2: 0.035, // Thumb MCP
      3: 0.035, // Thumb IP
      4: 0.04, // Thumb tip
      5: 0.045, // Index MCP - larger
      6: 0.035, // Index PIP
      7: 0.035, // Index DIP
      8: 0.04, // Index tip
      9: 0.045, // Middle MCP - larger
      10: 0.035, // Middle PIP
      11: 0.035, // Middle DIP
      12: 0.04, // Middle tip
      13: 0.045, // Ring MCP - larger
      14: 0.035, // Ring PIP
      15: 0.035, // Ring DIP
      16: 0.04, // Ring tip
      17: 0.045, // Pinky MCP - larger
      18: 0.035, // Pinky PIP
      19: 0.035, // Pinky DIP
      20: 0.04, // Pinky tip
    }

    for (let i = 0; i < 21; i++) {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(jointSizes[i] || 0.018, 12, 12),
        this.getCurrentMaterial()
      )
      sphere.visible = false
      this.el.object3D.add(sphere)
      this.jointSpheres.push(sphere)
    }

    // Create cylinders for connections between joints
    this.handConnections.forEach(() => {
      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 1, 12), // Much thicker cylinders
        this.getCurrentMaterial()
      )
      cylinder.visible = false
      this.el.object3D.add(cylinder)
      this.connections.push(cylinder)
    })

    // Create a larger sphere for the palm area
    this.palmSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8), // Even larger palm
      this.getCurrentMaterial()
    )
    this.palmSphere.visible = false
    this.el.object3D.add(this.palmSphere)

    // Create additional geometry for better occlusion
    // Finger base spheres (between MCP joints and palm)
    this.fingerBases = []
    for (let i = 0; i < 4; i++) {
      const baseSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8), // Larger base spheres
        this.getCurrentMaterial()
      )
      baseSphere.visible = false
      this.el.object3D.add(baseSphere)
      this.fingerBases.push(baseSphere)
    }
  },

  createMaterials: function () {
    // Occluder material - invisible but writes to depth buffer
    this.occluderMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false, // Don't write color
      depthWrite: true, // Write to depth buffer
      depthTest: true,
      side: THREE.DoubleSide,
      transparent: false,
    })

    // Debug material - visible colored material
    this.debugMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.data.debugColor),
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    })
  },

  getCurrentMaterial: function () {
    return this.data.debug ? this.debugMaterial : this.occluderMaterial
  },

  update: function (oldData) {
    // If debug mode changed, update all mesh materials
    if (
      oldData.debug !== this.data.debug ||
      oldData.debugColor !== this.data.debugColor
    ) {
      // Update debug material color if needed
      if (this.debugMaterial && oldData.debugColor !== this.data.debugColor) {
        this.debugMaterial.color = new THREE.Color(this.data.debugColor)
      }

      // Update all mesh materials
      const material = this.getCurrentMaterial()
      this.jointSpheres.forEach((sphere) => {
        sphere.material = material
      })
      this.connections.forEach((cylinder) => {
        cylinder.material = material
      })
      if (this.palmSphere) {
        this.palmSphere.material = material
      }
      if (this.fingerBases) {
        this.fingerBases.forEach((base) => {
          base.material = material
        })
      }
    }
  },

  tick: function () {
    // Check if occluder is enabled
    if (!this.enabled) {
      this.setOccluderVisibility(false)
      return
    }

    // The hand-occluder is added to the hand entity itself
    // We need to get the mediapipe-hand component from the scene
    const sceneEl = this.el.sceneEl
    const mediapipeHand = sceneEl.components['mediapipe-hand']

    if (!mediapipeHand || !mediapipeHand.handEntities) {
      this.setOccluderVisibility(false)
      return
    }

    // Get the hand data based on which hand this occluder is for
    const handIndex = this.data.hand === 'left' ? 0 : 1
    const handData = mediapipeHand.handEntities[handIndex]

    if (!handData || !handData.landmarks || handData.landmarks.length === 0) {
      this.setOccluderVisibility(false)
      return
    }

    // Since the occluder is added to the hand group itself,
    // and the hand group transforms in world space,
    // we need to get positions relative to the hand group
    const handGroupWorldMatrix = new THREE.Matrix4()
    this.el.object3D.updateMatrixWorld(true)
    handGroupWorldMatrix.copy(this.el.object3D.matrixWorld)
    const handGroupWorldMatrixInverse = new THREE.Matrix4()
      .copy(handGroupWorldMatrix)
      .invert()

    // Get local positions of landmarks relative to hand group
    const landmarks = handData.landmarks.map((landmarkEntity) => {
      const worldPos = new THREE.Vector3()
      landmarkEntity.object3D.getWorldPosition(worldPos)
      // Convert world position to local position relative to hand group
      const localPos = worldPos.applyMatrix4(handGroupWorldMatrixInverse)
      return localPos
    })

    // Log visibility once for debugging
    if (!this.hasLoggedVisibility && landmarks.length > 0) {
      console.log(
        `Hand occluder ${this.data.hand} has landmarks:`,
        landmarks.length
      )
      console.log('Debug mode:', this.data.debug)
      console.log('First landmark position:', landmarks[0])
      console.log('Material:', this.getCurrentMaterial())
      this.hasLoggedVisibility = true
    }

    // Update joint spheres positions
    landmarks.forEach((landmark, i) => {
      if (this.jointSpheres[i]) {
        this.jointSpheres[i].position.copy(landmark)
        this.jointSpheres[i].visible = true
      }
    })

    // Update connections between joints
    this.handConnections.forEach((connection, index) => {
      const start = landmarks[connection[0]]
      const end = landmarks[connection[1]]

      if (start && end && this.connections[index]) {
        const cylinder = this.connections[index]

        // Position cylinder between two points
        const midpoint = new THREE.Vector3()
          .addVectors(start, end)
          .multiplyScalar(0.5)
        cylinder.position.copy(midpoint)

        // Calculate distance and set cylinder height
        const distance = start.distanceTo(end)
        cylinder.scale.y = distance

        // Orient cylinder to connect the two points
        const direction = new THREE.Vector3().subVectors(end, start).normalize()
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction
        )
        cylinder.quaternion.copy(quaternion)

        cylinder.visible = true
      }
    })

    // Update palm sphere (centered around palm landmarks)
    if (
      landmarks[0] &&
      landmarks[5] &&
      landmarks[9] &&
      landmarks[13] &&
      landmarks[17]
    ) {
      const palmCenter = new THREE.Vector3()
        .add(landmarks[0])
        .add(landmarks[5])
        .add(landmarks[9])
        .add(landmarks[13])
        .add(landmarks[17])
        .multiplyScalar(1 / 5)

      this.palmSphere.position.copy(palmCenter)
      this.palmSphere.visible = true

      // Update finger base spheres
      const fingerMCPs = [5, 9, 13, 17]
      fingerMCPs.forEach((mcpIndex, i) => {
        if (landmarks[mcpIndex] && landmarks[0] && this.fingerBases[i]) {
          const basePos = new THREE.Vector3()
            .addVectors(landmarks[mcpIndex], landmarks[0])
            .multiplyScalar(0.5)
          this.fingerBases[i].position.copy(basePos)
          this.fingerBases[i].visible = true
        }
      })
    }
  },

  setOccluderVisibility: function (visible) {
    this.jointSpheres.forEach((sphere) => (sphere.visible = visible))
    this.connections.forEach((connection) => (connection.visible = visible))
    this.palmSphere.visible = visible
    if (this.fingerBases) {
      this.fingerBases.forEach((base) => (base.visible = visible))
    }
  },

  remove: function () {
    // Clean up meshes
    this.jointSpheres.forEach((sphere) => {
      this.el.object3D.remove(sphere)
      sphere.geometry.dispose()
    })
    this.connections.forEach((connection) => {
      this.el.object3D.remove(connection)
      connection.geometry.dispose()
    })
    if (this.palmSphere) {
      this.el.object3D.remove(this.palmSphere)
      this.palmSphere.geometry.dispose()
    }
    if (this.fingerBases) {
      this.fingerBases.forEach((base) => {
        this.el.object3D.remove(base)
        base.geometry.dispose()
      })
    }
    if (this.occluderMaterial) {
      this.occluderMaterial.dispose()
    }
    if (this.debugMaterial) {
      this.debugMaterial.dispose()
    }
  },
}
