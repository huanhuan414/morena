export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '订单匹配' })
  : { navigationBarTitleText: '订单匹配' }
