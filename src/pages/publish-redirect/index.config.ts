export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '一键发布',
      navigationBarBackgroundColor: '#0a0a1a',
      navigationBarTextStyle: 'white'
    })
  : {
      navigationBarTitleText: '一键发布',
      navigationBarBackgroundColor: '#0a0a1a',
      navigationBarTextStyle: 'white'
    }
