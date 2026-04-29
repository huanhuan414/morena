export default typeof definePageConfig === 'function'
  ? definePageConfig({
    navigationBarTitleText: '掌象阅读',
    navigationStyle: 'custom'
  })
  : {
    navigationBarTitleText: '掌象阅读',
    navigationStyle: 'custom'
  }
