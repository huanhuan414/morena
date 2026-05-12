export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '关注列表',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '关注列表',
      navigationStyle: 'custom'
    }
