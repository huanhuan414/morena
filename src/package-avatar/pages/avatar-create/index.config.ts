export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '创建分身',
      navigationStyle: 'custom',
      disableScroll: false
    })
  : {
      navigationBarTitleText: '创建分身',
      navigationStyle: 'custom',
      disableScroll: false
    }
