export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '帮助中心',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '帮助中心',
      navigationStyle: 'custom'
    }
