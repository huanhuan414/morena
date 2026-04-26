export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '待处理订单',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '待处理订单',
      navigationStyle: 'custom'
    }
