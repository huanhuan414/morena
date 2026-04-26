export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '语音通话',
      navigationBarBackgroundColor: '#0a0a0f',
      navigationBarTextStyle: 'white'
    })
  : {
      navigationBarTitleText: '语音通话',
      navigationBarBackgroundColor: '#0a0a0f',
      navigationBarTextStyle: 'white'
    }
