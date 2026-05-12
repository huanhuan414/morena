export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '设置',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '设置',
      navigationStyle: 'custom'
    }
