export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '技能中心',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '技能广场',
      navigationStyle: 'custom'
    }
