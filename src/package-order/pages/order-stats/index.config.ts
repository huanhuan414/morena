export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '订单统计' })
  : { navigationBarTitleText: '订单统计' }
