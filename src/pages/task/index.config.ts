export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '任务',
      navigationBarBackgroundColor: '#0f172a',
      navigationBarTextStyle: 'white'
    })
  : {
      navigationBarTitleText: '任务',
      navigationBarBackgroundColor: '#0f172a',
      navigationBarTextStyle: 'white'
    }
