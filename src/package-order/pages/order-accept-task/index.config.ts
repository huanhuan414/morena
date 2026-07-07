export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '引导发布',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '引导发布',
      navigationStyle: 'custom'
    }
