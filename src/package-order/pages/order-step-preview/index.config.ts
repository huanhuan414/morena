export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '任务步骤预览',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '任务步骤预览',
      navigationStyle: 'custom'
    }