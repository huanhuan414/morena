export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '订单完成'
    })
  : {
      navigationBarTitleText: '订单完成'
    }
