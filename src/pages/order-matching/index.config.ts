export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '分身匹配',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '分身匹配',
      navigationStyle: 'custom'
    }
