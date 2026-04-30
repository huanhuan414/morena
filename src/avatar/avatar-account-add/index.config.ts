export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '添加账号',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '添加账号',
      navigationStyle: 'custom'
    }
