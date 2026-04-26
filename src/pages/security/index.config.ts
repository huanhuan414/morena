export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '安全中心',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '安全中心',
      navigationStyle: 'custom'
    }
