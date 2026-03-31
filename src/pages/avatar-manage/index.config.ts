export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '分身管理',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '分身管理',
      navigationStyle: 'custom'
    }
