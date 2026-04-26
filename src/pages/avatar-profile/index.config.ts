export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '分身画像',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '分身画像',
      navigationStyle: 'custom'
    }
