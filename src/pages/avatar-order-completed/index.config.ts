export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '订单完成',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '订单完成',
      navigationStyle: 'custom'
    }
