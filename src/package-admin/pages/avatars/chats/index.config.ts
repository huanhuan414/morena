export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '聊天记录' })
  : { navigationBarTitleText: '聊天记录' }
