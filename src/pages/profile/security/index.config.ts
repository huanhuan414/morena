export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '账户安全' })
  : { navigationBarTitleText: '账户安全' }
