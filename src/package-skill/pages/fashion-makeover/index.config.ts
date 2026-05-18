export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '衣品改造', navigationStyle: 'custom' })
  : { navigationBarTitleText: '衣品改造', navigationStyle: 'custom' }
