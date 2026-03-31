export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '',
      navigationStyle: 'custom',
      backgroundColor: '#050508',
      backgroundTextStyle: 'dark',
      enablePullDownRefresh: true,
      onReachBottomDistance: 100
    })
  : {
      navigationBarTitleText: '',
      navigationStyle: 'custom',
      backgroundColor: '#050508',
      backgroundTextStyle: 'dark',
      enablePullDownRefresh: true,
      onReachBottomDistance: 100
    }
