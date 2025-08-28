import '../styles/app.css'

import { sceneStateComponent } from './components/scene-state'
import { scenePortalHandComponent } from './components/scene-portal-hand'
import { drawingUIComponent } from './components/drawing-ui'
import { portalHandUIComponent } from './components/portal-hand-ui'
import { mediapipeHandComponent } from './components/mediapipe-hand'
import { mediapipePortalHandComponent } from './components/mediapipe-portal-hand'
import { mediapipeGestureComponent } from './components/mediapipe-gesture'
import { enterXrComponent } from './components/enter-xr'
import { pinchableXrComponent } from './components/pinchable-xr'
import { pinchableLineComponent } from './components/pinchable-line'
import { handXrDrawComponent } from './components/hand-xr-draw'
import { handXrWristMenuComponent } from './components/hand-xr-wrist-menu'
import { wobblySphereComponent } from './components/wobbly-sphere'
import { handXrSphereSpawnerComponent } from './components/hand-xr-sphere-spawner'
import { cyberpunkSkyComponent } from './components/cyberpunk-sky'
import { grassFieldComponent } from './components/grass-field'
import { fadedGroundComponent } from './components/faded-ground'
import { growthParticlesComponent } from './components/growth-particles'
import { pathAnimatorSimpleComponent } from './components/path-animator-simple'
import { pathSphereSpawnerComponent } from './components/path-sphere-spawner'
import { handXrPinchDetectorComponent } from './components/hand-xr-pinch-detector'
import { cloudSystemComponent } from './components/cloud-system'
import { sunSystemComponent } from './components/sun-system'
import { weatherSystemComponent } from './components/weather-system'
import { faceUserWhenPinchedComponent } from './components/face-user-when-pinched'
import { handOccluderComponent } from './components/hand-occluder'
import { actionMenuComponent } from './components/action-menu'
import { ovalGestureDetectorComponent } from './components/oval-gesture-detector'
import { handArSphereSpawnerComponent } from './components/hand-ar-sphere-spawner'
import { pinchableArComponent } from './components/pinchable-ar'
import { pinchableLineArComponent } from './components/pinchable-line-ar'

// Register components
AFRAME.registerComponent('scene-state', sceneStateComponent)
AFRAME.registerComponent('scene-portal-hand', scenePortalHandComponent)
AFRAME.registerComponent('drawing-ui', drawingUIComponent)
AFRAME.registerComponent('portal-hand-ui', portalHandUIComponent)
AFRAME.registerComponent('mediapipe-hand', mediapipeHandComponent)
AFRAME.registerComponent('mediapipe-portal-hand', mediapipePortalHandComponent)
AFRAME.registerComponent('mediapipe-gesture', mediapipeGestureComponent)
AFRAME.registerComponent('enter-xr', enterXrComponent)
AFRAME.registerComponent('pinchable-xr', pinchableXrComponent)
AFRAME.registerComponent('pinchable-line', pinchableLineComponent)
AFRAME.registerComponent('hand-xr-draw', handXrDrawComponent)
AFRAME.registerComponent('hand-xr-wrist-menu', handXrWristMenuComponent)
AFRAME.registerComponent('wobbly-sphere', wobblySphereComponent)
AFRAME.registerComponent('hand-xr-sphere-spawner', handXrSphereSpawnerComponent)
AFRAME.registerComponent('cyberpunk-sky', cyberpunkSkyComponent)
AFRAME.registerComponent('grass-field', grassFieldComponent)
AFRAME.registerComponent('faded-ground', fadedGroundComponent)
AFRAME.registerComponent('growth-particles', growthParticlesComponent)
AFRAME.registerComponent('path-animator-simple', pathAnimatorSimpleComponent)
AFRAME.registerComponent('path-sphere-spawner', pathSphereSpawnerComponent)
AFRAME.registerComponent('hand-xr-pinch-detector', handXrPinchDetectorComponent)
AFRAME.registerComponent('cloud-system', cloudSystemComponent)
AFRAME.registerComponent('sun-system', sunSystemComponent)
AFRAME.registerComponent('weather-system', weatherSystemComponent)
AFRAME.registerComponent('face-user-when-pinched', faceUserWhenPinchedComponent)
AFRAME.registerComponent('hand-occluder', handOccluderComponent)
AFRAME.registerComponent('action-menu', actionMenuComponent)
AFRAME.registerComponent('oval-gesture-detector', ovalGestureDetectorComponent)
AFRAME.registerComponent('hand-ar-sphere-spawner', handArSphereSpawnerComponent)
AFRAME.registerComponent('pinchable-ar', pinchableArComponent)
AFRAME.registerComponent('pinchable-line-ar', pinchableLineArComponent)

// Detect if we're in a WebXR headset environment
const isWebXRHeadset = () => {
  const userAgent = navigator.userAgent
  return /OculusBrowser|Quest|Pico/i.test(userAgent)
}

// Determine which scene to load based on environment
const getSceneName = () => {
  const params = new URLSearchParams(document.location.search.substring(1))
  const urlScene = params.get('scene')

  // If scene is specified in URL, use that
  if (urlScene) {
    return urlScene
  }

  // Otherwise, detect environment and load appropriate scene
  if (isWebXRHeadset()) {
    console.log('WebXR headset detected - loading webxr-hand scene')
    return 'webxr-hand'
  } else {
    console.log('Mobile/Desktop detected - loading webar-hand scene')
    return 'webar-hand'
  }
}

const sceneName = getSceneName()
window.DEFAULT_SCENE_NAME = sceneName
console.log('Loading scene:', sceneName)

// Function to load scene dynamically
const loadScene = async (name) => {
  try {
    // Use absolute path for production
    const scenePath = import.meta.env.PROD
      ? `/scenes/${name}.html`
      : `../scenes/${name}.html`
    const response = await fetch(scenePath)
    if (!response.ok) {
      throw new Error(`Scene '${name}' not found`)
    }

    const sceneHtml = await response.text()
    document.body.insertAdjacentHTML('beforeend', sceneHtml)
  } catch (error) {
    console.error('Error loading scene:', error)

    // If scene not found and it's not the default, try loading the default
    if (name !== DEFAULT_SCENE_NAME) {
      console.log(`Falling back to default scene: ${DEFAULT_SCENE_NAME}`)
      loadScene(DEFAULT_SCENE_NAME)
    }
  }
}

// Load the scene
loadScene(sceneName)
