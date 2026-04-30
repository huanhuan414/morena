export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '发布反馈',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '发布反馈',
      navigationStyle: 'custom'
    }
