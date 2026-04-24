export default typeof definePageConfig === 'function'
  ? definePageConfig({
    navigationBarTitleText: '浏览器',
    enableShareAppMessage: false,
    enableShareTimeline: false
  })
  : {
    navigationBarTitleText: '浏览器',
    enableShareAppMessage: false,
    enableShareTimeline: false
  }
