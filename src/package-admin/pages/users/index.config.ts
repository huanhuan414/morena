export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '用户管理' })
  : { navigationBarTitleText: '用户管理' }
