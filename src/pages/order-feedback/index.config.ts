export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '订单反馈',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '订单反馈',
      navigationStyle: 'custom'
    }
