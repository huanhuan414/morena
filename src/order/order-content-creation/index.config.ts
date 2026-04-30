export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '内容创作',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '内容创作',
      navigationStyle: 'custom'
    }
