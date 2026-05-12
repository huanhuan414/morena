export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '账号配置',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '账号配置',
      navigationStyle: 'custom'
    }
