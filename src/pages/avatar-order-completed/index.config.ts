export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '任务完成',
      enableShareAppMessage: true,
      enableShareTimeline: true
    })
  : { navigationBarTitleText: '任务完成' }
