export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '好友列表',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '好友列表',
      navigationStyle: 'custom'
    }
