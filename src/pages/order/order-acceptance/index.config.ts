export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '订单确认',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '订单确认',
      navigationStyle: 'custom'
    }
