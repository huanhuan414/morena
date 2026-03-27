export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '莫瑞娜',
      navigationBarBackgroundColor: '#0f172a',
      navigationBarTextStyle: 'white'
    })
  : {
      navigationBarTitleText: '莫瑞娜',
      navigationBarBackgroundColor: '#0f172a',
      navigationBarTextStyle: 'white'
    }
