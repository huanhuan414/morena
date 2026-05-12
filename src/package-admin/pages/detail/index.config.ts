export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '用户详情' })
  : { navigationBarTitleText: '用户详情' }
