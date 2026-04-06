export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '关注与粉丝',
      navigationBarBackgroundColor: '#0a0a0f',
      navigationBarTextStyle: 'white',
      backgroundColor: '#0a0a0f',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '关注与粉丝',
      navigationBarBackgroundColor: '#0a0a0f',
      navigationBarTextStyle: 'white',
      backgroundColor: '#0a0a0f',
      navigationStyle: 'custom'
    }
