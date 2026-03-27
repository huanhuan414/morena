export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '登录',
      navigationStyle: 'custom',
      backgroundColor: '#0a0a0f'
    })
  : {
      navigationBarTitleText: '登录',
      navigationStyle: 'custom',
      backgroundColor: '#0a0a0f'
    }
