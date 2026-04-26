export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '我的',
      navigationBarBackgroundColor: '#7B3FE4',
      navigationBarTextStyle: 'white'
    })
  : {
      navigationBarTitleText: '我的',
      navigationBarBackgroundColor: '#7B3FE4',
      navigationBarTextStyle: 'white'
    }
