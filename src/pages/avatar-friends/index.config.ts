export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '好友列表' })
  : { navigationBarTitleText: '好友列表' }
