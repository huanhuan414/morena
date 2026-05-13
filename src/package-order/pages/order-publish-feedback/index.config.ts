export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '发布反馈',
      navigationStyle: 'custom',
      navigationBarTextStyle: 'white'
    })
  : { navigationBarTitleText: '发布反馈', navigationStyle: 'custom', navigationBarTextStyle: 'white' }
