export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '我的分身',
      navigationStyle: 'default',
    })
  : {
      navigationBarTitleText: '我的分身',
      navigationStyle: 'default',
    }
