export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '群聊值守' })
  : { navigationBarTitleText: '群聊值守' }
