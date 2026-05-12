export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '订单详情',
      enableShareAppMessage: true
    })
  : { navigationBarTitleText: '订单详情', enableShareAppMessage: true }
