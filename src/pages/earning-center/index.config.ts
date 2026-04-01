export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '收益中心' })
  : { navigationBarTitleText: '收益中心' }
