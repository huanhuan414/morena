export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '我的',
      navigationStyle: 'default',
    })
  : {
      navigationBarTitleText: '我的',
      navigationStyle: 'default',
    }
