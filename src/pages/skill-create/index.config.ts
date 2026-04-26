export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '创建技能',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '创建技能',
      navigationStyle: 'custom'
    }
