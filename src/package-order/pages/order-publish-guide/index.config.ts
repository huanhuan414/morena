export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '发布指南' })
  : { navigationBarTitleText: '发布指南' }
