export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '发布引导',
      navigationStyle: 'custom',
      navigationBarTextStyle: 'white'
    })
  : { navigationBarTitleText: '发布引导', navigationStyle: 'custom', navigationBarTextStyle: 'white' }
