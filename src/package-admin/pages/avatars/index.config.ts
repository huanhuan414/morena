export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '分身管理' })
  : { navigationBarTitleText: '分身管理' }
