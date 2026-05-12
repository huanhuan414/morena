export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '内容管理' })
  : { navigationBarTitleText: '内容管理' }
