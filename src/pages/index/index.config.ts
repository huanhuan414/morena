export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '首页',
      navigationStyle: 'default',
    })
  : {
      navigationBarTitleText: '首页',
      navigationStyle: 'default',
    }
