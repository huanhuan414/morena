export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '任务中心',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '任务中心',
      navigationStyle: 'custom'
    }
