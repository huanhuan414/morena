export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '任务管理',
      navigationBarBackgroundColor: '#0a0a0f',
      navigationBarTextStyle: 'white',
      backgroundColor: '#0a0a0f',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '任务管理',
      navigationBarBackgroundColor: '#0a0a0f',
      navigationBarTextStyle: 'white',
      backgroundColor: '#0a0a0f',
      navigationStyle: 'custom'
    }
