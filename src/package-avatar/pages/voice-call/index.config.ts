export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '语音通话',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '语音通话',
      navigationStyle: 'custom'
    }
