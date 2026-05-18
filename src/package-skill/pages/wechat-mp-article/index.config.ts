export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '公众号爆款生成', navigationStyle: 'custom' })
  : { navigationBarTitleText: '公众号爆款生成', navigationStyle: 'custom' }
