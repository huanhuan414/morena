export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '推广中心',
      navigationStyle: 'custom',
      enableShareAppMessage: true,
      enableShareTimeline: true
    })
  : {
      navigationBarTitleText: '推广中心',
      navigationStyle: 'custom',
      enableShareAppMessage: true,
      enableShareTimeline: true
    }
