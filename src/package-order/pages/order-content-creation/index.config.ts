export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '内容创作',
      navigationStyle: 'custom',
      navigationBarTextStyle: 'white',
      enablePullDownRefresh: false
    })
  : { navigationBarTitleText: '内容创作', navigationStyle: 'custom', navigationBarTextStyle: 'white', enablePullDownRefresh: false }
