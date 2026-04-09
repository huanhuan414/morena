export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '分身画像'
    })
  : { navigationBarTitleText: '分身画像' }
