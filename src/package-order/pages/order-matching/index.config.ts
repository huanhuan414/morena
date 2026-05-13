export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '智能匹配',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '智能匹配',
      navigationStyle: 'custom'
    }
