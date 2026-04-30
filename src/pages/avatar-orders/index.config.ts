export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '商单管理'
    })
  : { navigationBarTitleText: '商单管理' }
