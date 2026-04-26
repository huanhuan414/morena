export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '分身订单',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '分身订单',
      navigationStyle: 'custom'
    }
