export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '学习中心',
      navigationStyle: 'custom',
      backgroundColor: '#0a0a0f'
    })
  : {
      navigationBarTitleText: '学习中心',
      navigationStyle: 'custom',
      backgroundColor: '#0a0a0f'
    }
