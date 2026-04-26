export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '创建订单',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '创建订单',
      navigationStyle: 'custom'
    }
