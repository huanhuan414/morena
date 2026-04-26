export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '订单列表',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '订单列表',
      navigationStyle: 'custom'
    }
