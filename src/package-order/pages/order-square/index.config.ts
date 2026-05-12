export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationStyle: 'custom', navigationBarTitleText: '订单广场' })
  : { navigationStyle: 'custom', navigationBarTitleText: '订单广场' }
