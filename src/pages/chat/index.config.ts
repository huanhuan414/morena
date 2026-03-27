export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '对话',
      navigationBarBackgroundColor: '#0f172a',
      navigationBarTextStyle: 'white'
    })
  : {
      navigationBarTitleText: '对话',
      navigationBarBackgroundColor: '#0f172a',
      navigationBarTextStyle: 'white'
    }
