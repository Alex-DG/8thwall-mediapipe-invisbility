# 8th Wall AR Invisibility Effects - SETUP

- This project implements two different invisibility effects for AR applications using 8th Wall and A-Frame, each utilizing different computer vision techniques to achieve the "invisibility" effect.
- Checkout the [TECHNICAL_README.md](./TECHNICAL_README.md) for more details.

## 🎥 Demo

*Watch the invisibility effects in action!*

https://github.com/user-attachments/assets/0acc01ca-90d8-4a41-808b-6ce1bbb7e88f


Test it [live](https://8thwall-invisbility.vercel.app/) on your mobile phone.

## Development Commands

```bash
# Install dependencies
yarn install

# Start development server (with HTTPS for camera access)
yarn dev

# Build for production
yarn build

# Preview production build
yarn preview
```

## Environment Setup

Create `.env.local` file in the project root with your 8th Wall app key:
```
VITE_8THWALL_APP_KEY=your_8thwall_app_key_here
```

## Architecture

### Core Components

- **invisibility.js** (`js/components/invisibility.js`): Main AR invisibility effect component
  - Uses MediaPipe SelfieSegmentation for real-time person detection
  - Manages background capture and compositing
  - Handles canvas overlay for invisibility effect
  - Provides API methods: `enable()`, `disable()`, `toggleCloak()`, `captureBackground()`

- **ui.js** (`js/components/ui.js`): UI management component
  - Connects HTML controls to invisibility component
  - Manages button states and user interactions
  - Handles blur slider and mirror toggle

- **app.js** (`js/app.js`): Application entry point
  - Registers A-Frame components
  - Imports CSS styles

### Tech Stack

- **8th Wall**: AR platform for camera access and tracking
- **A-Frame**: WebXR framework for 3D/AR scenes
- **MediaPipe**: Google's ML framework for person segmentation
- **Vite**: Build tool with HTTPS development server
- **Canvas API**: Real-time image compositing

### Key Features

- Real-time person segmentation using MediaPipe
- Background capture and replacement
- Configurable edge blur (0-12px)
- Mirror mode toggle
- Canvas-based overlay system with proper viewport scaling

## File Structure

```
js/
├── app.js              # Main entry point
├── components/
│   ├── invisibility.js # Core AR invisibility logic
│   └── ui.js           # UI controls management
styles/
└── app.css             # UI styling
index.html              # Main HTML with A-Frame scene
```

## Development Notes

- The app requires HTTPS for camera access (handled by Vite dev server)
- MediaPipe assets are loaded from CDN
- Canvas overlay is positioned above AR scene but below UI controls
- Background capture should be done when user steps out of frame for best results
- Edge blur helps blend the invisibility effect naturally
