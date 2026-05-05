export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '分身详情' })
  : { navigationBarTitleText: '分身详情' }
