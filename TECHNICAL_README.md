# 8th Wall AR Invisibility Effects - TECHNICAL DETAILS

This project implements two different invisibility effects for AR applications using 8th Wall and A-Frame, each utilizing different computer vision techniques to achieve the "invisibility cloak" effect.

## 🎭 Components Overview

### 1. `invisibilityComponent` - Full Body Invisibility
Uses **MediaPipe SelfieSegmentation** for person detection and removal

### 2. `invisibilityCloakComponent` - White Cloth Invisibility 
Uses **color-based segmentation** for white cloth detection and replacement

---

## 🧠 Technical Deep Dive

## invisibilityComponent

### **Core Technique: Person Segmentation**

This component uses Google's MediaPipe SelfieSegmentation model to detect and segment human bodies in real-time.

#### **How It Works:**

1. **MediaPipe Integration**
   ```javascript
   this.segmenter = new SelfieSegmentation({
     locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}`,
   })
   this.segmenter.setOptions({ modelSelection: 1 }) // High accuracy model
   ```

2. **Real-time Processing Pipeline**
   - **Video Input**: Captures live camera feed from 8th Wall
   - **ML Processing**: Sends video frames to MediaPipe for segmentation
   - **Mask Generation**: Receives binary mask identifying person pixels
   - **Canvas Compositing**: Applies invisibility effect using canvas operations

3. **Background Replacement Technique**
   ```javascript
   // Apply segmentation mask
   ctx.globalCompositeOperation = 'destination-out'
   ctx.drawImage(results.segmentationMask, 0, 0, vw, vh, dx, dy, dw, dh)
   
   // Draw background where person was removed
   ctx.globalCompositeOperation = 'destination-over'
   ctx.drawImage(this.bgCanvas, 0, 0, W, H)
   ```

4. **Advanced Edge Blurring**
   - Multi-pass blur for values > 12px
   - DPR (Device Pixel Ratio) scaling for consistent quality
   - Configurable blur intensity (0-24px)

#### **Key Features:**
- ✅ **Full body detection** (head to toe)
- ✅ **High accuracy** using ML model
- ✅ **Real-time performance** with ML processing overhead
- ✅ **Automatic person tracking**
- ✅ **Advanced edge smoothing**

---

## invisibilityCloakComponent

### **Core Technique: Color-Based Segmentation**

This component implements a sophisticated multi-tier white detection algorithm to identify white cloth and create the "Harry Potter invisibility cloak" effect.

#### **How It Works:**

1. **Multi-Pathway White Detection**
   
   The algorithm uses **3 different detection methods** to catch various cloth conditions:

   **Method 1: Bright White Areas** (Well-lit cloth)
   ```javascript
   const isHighBrightness = brightness > threshold * 0.75 && 
                           saturation < 0.25
   ```

   **Method 2: High Brightness Override**
   ```javascript
   const isSuperBright = brightness > threshold + 30 // Very bright areas
   ```

   **Method 3: Balanced White Detection**
   ```javascript
   const isWhiteish = r > threshold * 0.7 && g > threshold * 0.7 && b > threshold * 0.7
   const hasWhiteBalance = Math.abs(r-g) < 40 && Math.abs(g-b) < 40 && Math.abs(b-r) < 40
   ```

2. **Color Space Analysis**
   ```javascript
   // HSV-like calculations
   const brightness = (r + g + b) / 3
   const maxChannel = Math.max(r, g, b)
   const minChannel = Math.min(r, g, b)
   const saturation = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0
   ```

3. **Morphological Operations for Gap Filling**
   ```javascript
   // 3x3 kernel dilation to fill cloth texture gaps
   for (let dy = -kernelSize; dy <= kernelSize; dy++) {
     for (let dx = -kernelSize; dx <= kernelSize; dx++) {
       // Check neighborhood for white pixels
       if (maskData[nIdx + 3] > 0) whiteNeighbors++
     }
   }
   
   // Fill gaps if 30% of neighbors are white
   if (whiteRatio > 0.3 || maskData[idx + 3] > 0) {
     // Mark as white cloth
   }
   ```

4. **Adaptive Thresholding System**
   - **User-configurable threshold**: `whiteThreshold` (0-255)
   - **Multiple brightness levels**: Bright (75%), Medium (70%), Super-bright (+30)
   - **Saturation tolerance**: 0.25 for texture variations
   - **Color balance tolerance**: 40 RGB units for fabric imperfections

#### **Advanced Features:**

**🎯 Real-World Cloth Handling:**
- **Lighting variations**: Adapts to shadows and highlights
- **Fabric texture**: Handles wrinkles, creases, and surface irregularities  
- **Color variations**: Detects slightly off-white or gray-white areas
- **Edge smoothing**: Morphological operations prevent detection gaps

**🚫 False Positive Prevention:**
- **No skin tone detection**: Avoids detecting light skin
- **No beige clothing**: Filters out tan/beige fabrics
- **Smart thresholding**: Multiple criteria prevent random light objects

#### **Technical Parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `whiteThreshold` | 200 | Base brightness threshold (0-255) |
| `sensitivity` | 0.3 | Morphological operation aggressiveness |
| `blur` | 6 | Edge blur amount in pixels |
| `mirror` | true | Mirror video feed |

---

## 🎨 Canvas Compositing Techniques

Both components use sophisticated HTML5 Canvas operations for real-time compositing:

### **Global Composite Operations:**
```javascript
// Remove detected areas (person/cloth)
ctx.globalCompositeOperation = 'destination-out'
ctx.drawImage(maskCanvas, 0, 0)

// Fill with background 
ctx.globalCompositeOperation = 'destination-over'  
ctx.drawImage(backgroundCanvas, 0, 0)
```

### **Viewport Scaling:**
```javascript
// Device pixel ratio scaling for crisp rendering
const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))
canvas.width = cssWidth * dpr
canvas.height = cssHeight * dpr

// Cover scaling to match 8th Wall's camera feed
const scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight)
```

---

## 🔧 Performance Optimizations

### **Frame Rate Management:**
- Throttled processing to prevent overwhelming the system
- `sending` flag prevents concurrent processing
- RequestAnimationFrame for smooth rendering

### **Memory Management:**
- Reused canvas contexts
- Efficient TypedArray operations for pixel data
- Automatic cleanup on component removal

### **Rendering Optimizations:**
- DPR-aware rendering for high-density displays
- Efficient mask scaling and compositing
- Background caching to avoid redundant processing

---

## 🚀 Usage Examples

### **Single Scene Setup with Mode Switching:**
```html
<!-- Single scene with both invisibility modes -->
<a-scene ui-manager>
  <!-- Scene content -->
</a-scene>
```

### **Advanced Configuration:**
```javascript
// Configure white cloth detection
el.setAttribute('invisibility-cloak', {
  whiteThreshold: 180,  // Lower = more sensitive
  sensitivity: 0.7,     // Higher = more coverage
  blur: 8              // Edge smoothing
})
```

---

## 🎪 Mode Switching Architecture

The `uiManagerComponent` implements a **single-scene architecture** with dynamic mode switching:

### **Component Management:**
```javascript
// Both components are attached simultaneously
if (!this.el.components['invisibility']) {
  this.el.setAttribute('invisibility', '') // defaults
}
if (!this.el.components['invisibility-cloak']) {
  this.el.setAttribute('invisibility-cloak', '') // defaults
}

// Dynamic mode switching
this.currentMode = this.currentMode === 'full' ? 'cloak' : 'full'
```

### **Mode Switching Behavior:**
- **Full Mode**: Uses `invisibilityComponent` (person segmentation)
- **Cloak Mode**: Uses `invisibilityCloakComponent` (white cloth detection)
- **Automatic Management**: Components are enabled/disabled based on active mode
- **UI State Reset**: Button states and labels update automatically

---

## 🔬 Algorithm Comparison

| Aspect | invisibilityComponent | invisibilityCloakComponent |
|--------|----------------------|---------------------------|
| **Detection Method** | ML-based person segmentation | Color-based cloth detection |
| **Accuracy** | High (ML model-based) | Good (algorithm-based) |
| **Performance** | Medium (ML processing overhead) | High (pixel operations) |
| **Flexibility** | Automatic person detection | Requires white cloth |
| **Use Case** | Full body invisibility | Props-based effects |
| **Robustness** | Excellent in all conditions | Good with proper lighting |

---

## 📱 Browser Compatibility

- **WebRTC**: Required for camera access
- **WebGL**: Required for 8th Wall AR
- **Canvas 2D**: Required for compositing
- **MediaPipe**: Modern browsers with WASM support
- **HTTPS**: Required for camera permissions

---

## 🛠️ Development Commands

```bash
# Install dependencies
yarn install

# Start development server (HTTPS for camera)
yarn dev

# Build for production  
yarn build
```

---

## 📋 Technical Requirements

- **8th Wall License**: For AR camera access
- **HTTPS Environment**: Camera permissions requirement
- **MediaPipe CDN**: External ML model loading
- **WebGL Support**: Hardware-accelerated rendering
- **High-performance device**: Real-time video processing

---

## 🏗️ Architecture Notes

### **Component Registration:**
- `invisibility`: Full body invisibility component
- `invisibility-cloak`: White cloth detection component
- `ui-manager`: Main UI controller with mode switching
- `ui-manager2`: Alternative UI controller (currently unused)

### **Scene Structure:**
- **Single A-Frame scene** with `ui-manager` component
- **Both invisibility components** attached simultaneously
- **Dynamic mode switching** without scene reloading
- **Unified UI controls** for both modes

---

This implementation demonstrates advanced computer vision techniques in web browsers, combining machine learning models with real-time image processing to create compelling AR invisibility effects. The architecture provides seamless switching between different invisibility techniques while maintaining a single, cohesive user experience.