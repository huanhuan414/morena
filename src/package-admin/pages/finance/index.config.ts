export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '财务管理' })
  : { navigationBarTitleText: '财务管理' }
