export const scenePortalHandComponent = {
  setup() {
    this.el.setAttribute('portal-hand-ui', '')
    
    // Only hide loading UI after setup is complete and videos are loaded
    if (this.videosLoaded) {
      this.hideLoadingUI()
    }
  },
  
  init() {
    this.videosLoaded = false
    
    // Get loading UI elements
    this.loadingOverlay = document.getElementById('portal-hand-loading-overlay')
    this.loadingText = document.getElementById('portal-hand-loading-text')
    this.progressBar = document.getElementById('portal-hand-loading-progress-bar')
    
    // Ensure loading UI is visible initially
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.remove('hidden')
    }
    
    // Listen for video loading progress
    this.el.addEventListener('video-loading-progress', (event) => {
      this.updateLoadingProgress(event.detail.loaded, event.detail.total)
    })
    
    // Listen for all videos loaded
    this.el.addEventListener('videos-loaded', () => {
      this.videosLoaded = true
      
      // Only hide if reality is also ready
      if (this.realityReady) {
        this.hideLoadingUI()
      }
    })
    
    this.el.addEventListener('realityready', () => {
      this.realityReady = true
      this.setup()
    })
  },
  
  updateLoadingProgress(loaded, total) {
    const percentage = Math.round((loaded / total) * 100)
    
    if (this.loadingText) {
      this.loadingText.textContent = `Loading videos... ${percentage}%`
      
      // Add more detailed status after a delay if stuck at 0%
      if (percentage === 0 && !this.detailedStatusTimeout) {
        this.detailedStatusTimeout = setTimeout(() => {
          if (this.loadingText && percentage === 0) {
            this.loadingText.innerHTML = `Loading videos... ${percentage}%<br><small style="color: #888; font-size: 14px;">If loading is stuck, please check your network connection</small>`
          }
        }, 5000) // Show after 5 seconds
      } else if (percentage > 0 && this.detailedStatusTimeout) {
        clearTimeout(this.detailedStatusTimeout)
        this.detailedStatusTimeout = null
      }
    }
    
    if (this.progressBar) {
      this.progressBar.style.width = `${percentage}%`
    }
  },
  
  hideLoadingUI() {
    if (this.loadingOverlay) {
      // Add hidden class for fade out
      this.loadingOverlay.classList.add('hidden')
      
      // Remove from DOM after animation
      setTimeout(() => {
        if (this.loadingOverlay && this.loadingOverlay.parentNode) {
          this.loadingOverlay.parentNode.removeChild(this.loadingOverlay)
          this.loadingOverlay = null
        }
      }, 300)
    }
  }
}