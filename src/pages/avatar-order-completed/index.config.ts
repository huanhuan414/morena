export default typeof definePageConfig === 'function'
  ? definePageConfig({
    navigationBarTitleText: '订单完成',
    enableShareAppMessage: false,
    enableShareTimeline: false
  })
  : {
    navigationBarTitleText: '订单完成',
    enableShareAppMessage: false,
    enableShareTimeline: false
  }
