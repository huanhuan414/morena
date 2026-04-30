export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '新建订单' })
  : { navigationBarTitleText: '新建订单' }
