export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '待验收',
      navigationStyle: 'custom'
    })
  : {
    navigationBarTitleText: '待验收',
    navigationStyle: 'custom'
   }
