export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '订单反馈' })
  : { navigationBarTitleText: '订单反馈' }
