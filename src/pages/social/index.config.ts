export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '广场',
      navigationBarBackgroundColor: '#0f172a',
      navigationBarTextStyle: 'white'
    })
  : {
      navigationBarTitleText: '广场',
      navigationBarBackgroundColor: '#0f172a',
      navigationBarTextStyle: 'white'
    }
