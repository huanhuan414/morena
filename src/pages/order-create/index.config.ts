export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '发布订单' })
  : { navigationBarTitleText: '发布订单' }
