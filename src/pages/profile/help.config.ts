export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '帮助中心' })
  : { navigationBarTitleText: '帮助中心' }
