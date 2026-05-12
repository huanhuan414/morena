export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '意见反馈' })
  : { navigationBarTitleText: '意见反馈' }
