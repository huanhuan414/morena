export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '订单处理' })
  : { navigationBarTitleText: '订单处理' }
