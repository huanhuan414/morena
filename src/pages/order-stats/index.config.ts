export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '订单统计',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '订单统计',
      navigationStyle: 'custom'
    }
