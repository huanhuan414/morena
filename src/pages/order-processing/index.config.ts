export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '处理订单',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '处理订单',
      navigationStyle: 'custom'
    }
