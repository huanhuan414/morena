export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '训练专属技能',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '训练专属技能',
      navigationStyle: 'custom'
    }
