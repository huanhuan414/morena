export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '关于我们',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '关于我们',
      navigationStyle: 'custom'
    }
