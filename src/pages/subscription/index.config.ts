export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '订阅中心',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '订阅中心',
      navigationStyle: 'custom'
    }
