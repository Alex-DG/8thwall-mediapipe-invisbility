import '../styles/app.css'

import {
  invisibilityComponent,
  invisibilityCloakComponent,
} from './components/invisibility'
AFRAME.registerComponent('invisibility', invisibilityComponent)
AFRAME.registerComponent('invisibility-cloak', invisibilityCloakComponent)

import { uiManagerComponent, uiManagerComponent2 } from './components/ui'
AFRAME.registerComponent('ui-manager', uiManagerComponent)
AFRAME.registerComponent('ui-manager2', uiManagerComponent2)
