export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '分身设置',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '分身设置',
      navigationStyle: 'custom'
    }
