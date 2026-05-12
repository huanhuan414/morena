export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '好友管理' })
  : { navigationBarTitleText: '好友管理' }
