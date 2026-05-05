export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '收益排行榜',
      navigationStyle: 'custom'
    })
  : { navigationBarTitleText: '收益排行榜' }
