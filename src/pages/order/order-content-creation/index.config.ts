export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '内容创作',
      enablePullDownRefresh: false
    })
  : { navigationBarTitleText: '内容创作', enablePullDownRefresh: false }
