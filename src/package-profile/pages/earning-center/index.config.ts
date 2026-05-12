export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '收益中心',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '收益中心',
      navigationStyle: 'custom'
    }
