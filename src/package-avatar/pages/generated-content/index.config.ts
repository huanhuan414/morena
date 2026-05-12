export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '已生成内容', navigationStyle: 'custom' })
  : { navigationBarTitleText: '已生成内容', navigationStyle: 'custom' }
