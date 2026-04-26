export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '',
      navigationStyle: 'custom'
    }
