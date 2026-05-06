export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationStyle: 'custom',
      navigationBarTitleText: '商单管理'
    })
  : { navigationStyle: 'custom', navigationBarTitleText: '商单管理' }
