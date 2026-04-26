export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '我的',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '我的',
      navigationStyle: 'custom'
    }
