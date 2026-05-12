export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationStyle: 'custom', navigationBarTitleText: '待接订单' })
  : { navigationStyle: 'custom', navigationBarTitleText: '待接订单' }
