export const enterXrComponent = {
  init() {
    const scene = this.el

    const arButton = document.getElementById('enterARBtn')
    const vrButton = document.getElementById('enterVRBtn')

    if (arButton) {
      arButton.addEventListener('click', async () => {
        if (!navigator.xr) {
          alert('WebXR not supported in this browser')
          return
        }

        const isArSupported = await navigator.xr.isSessionSupported(
          'immersive-ar'
        )
        if (isArSupported) {
          scene.renderer.xr.setReferenceSpaceType('local-floor')
          scene.enterAR()
        } else {
          alert('immersive-ar is not supported on this device.')
        }
      })
    }

    if (vrButton) {
      vrButton.addEventListener('click', async () => {
        if (!navigator.xr) {
          alert('WebXR not supported in this browser')
          return
        }

        const isVrSupported = await navigator.xr.isSessionSupported(
          'immersive-vr'
        )
        if (isVrSupported) {
          scene.renderer.xr.setReferenceSpaceType('local-floor')
          scene.enterVR()
        } else {
          alert('immersive-vr is not supported on this device.')
        }
      })
    }
  },
}
