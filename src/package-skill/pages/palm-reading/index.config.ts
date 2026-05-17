export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '掌相阅读' })
  : { navigationBarTitleText: '掌相阅读' }
