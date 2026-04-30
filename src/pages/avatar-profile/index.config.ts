export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '分身资料',
      enableShareAppMessage: true,
      enableShareTimeline: true
    })
  : { navigationBarTitleText: '分身资料' }
