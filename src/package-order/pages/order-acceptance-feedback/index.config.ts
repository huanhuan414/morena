export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '待验收',
      enableShareAppMessage: true
    })
  : { navigationBarTitleText: '待验收' }
