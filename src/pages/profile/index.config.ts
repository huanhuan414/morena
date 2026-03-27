export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '我的',
      navigationBarBackgroundColor: '#0f172a',
      navigationBarTextStyle: 'white'
    })
  : {
      navigationBarTitleText: '我的',
      navigationBarBackgroundColor: '#0f172a',
      navigationBarTextStyle: 'white'
    }
