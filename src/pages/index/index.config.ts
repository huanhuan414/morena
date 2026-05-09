export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '首页',
      navigationStyle: 'custom',
      disableScroll: false
    })
  : {
      navigationBarTitleText: '首页',
      navigationStyle: 'custom',
      disableScroll: false
    }
