export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '待接订单' })
  : { navigationBarTitleText: '待接订单' }
