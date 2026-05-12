export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '登录',
      navigationStyle: 'custom',
      backgroundColor: '#F8F7FC'
    })
  : {
      navigationBarTitleText: '登录',
      navigationStyle: 'custom',
      backgroundColor: '#F8F7FC'
    }
