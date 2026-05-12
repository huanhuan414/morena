export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '推荐分身',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '推荐分身',
      navigationStyle: 'custom'
    }
