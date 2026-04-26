export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '订阅管理',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '订阅管理',
      navigationStyle: 'custom'
    }
