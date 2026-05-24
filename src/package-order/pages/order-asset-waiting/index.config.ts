export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '素材准备',
      navigationBarBackgroundColor: '#F5F3FF',
      navigationBarTextStyle: 'black',
    })
  : {
      navigationBarTitleText: '素材准备',
      navigationBarBackgroundColor: '#F5F3FF',
      navigationBarTextStyle: 'black',
    }
