export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '订单广场' })
  : { navigationBarTitleText: '订单广场' }
