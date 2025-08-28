export const sceneStateComponent = {
  setup() {
    this.el.setAttribute('drawing-ui', '')
  },
  init() {
    this.el.addEventListener('realityready', () => {
      this.setup()
    })
  },
}
