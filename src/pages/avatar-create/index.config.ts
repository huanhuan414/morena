export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '创建AI分身',
      navigationStyle: 'custom',
      backgroundColor: '#0a0a0f'
    })
  : {
      navigationBarTitleText: '创建AI分身',
      navigationStyle: 'custom',
      backgroundColor: '#0a0a0f'
    }
