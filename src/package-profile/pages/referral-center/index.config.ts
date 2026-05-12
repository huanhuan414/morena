export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '推广中心',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '推广中心',
      navigationStyle: 'custom'
    }
