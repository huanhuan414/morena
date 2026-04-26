export default typeof definePageConfig === 'function'
  ? definePageConfig({
    navigationBarTitleText: '制作内容',
    navigationStyle: 'custom'
  })
  : {
      navigationBarTitleText: '制作内容',
      navigationStyle: 'custom'
    }
