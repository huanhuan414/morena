export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '掌相阅读', navigationStyle: 'custom' })
  : { navigationBarTitleText: '掌相阅读', navigationStyle: 'custom' }
