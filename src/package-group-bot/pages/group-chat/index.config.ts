export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '群聊详情' })
  : { navigationBarTitleText: '群聊详情' }
