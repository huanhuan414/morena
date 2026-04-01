export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '订单管理' })
  : { navigationBarTitleText: '订单管理' }
