export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '设置步骤',
      navigationStyle: 'custom',
    })
  : {
      navigationBarTitleText: '设置步骤',
      navigationStyle: 'custom',
    }
