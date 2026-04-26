export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '关于我们' })
  : { navigationBarTitleText: '关于我们' }
