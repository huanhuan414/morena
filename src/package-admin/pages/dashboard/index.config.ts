export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '指标看板' })
  : { navigationBarTitleText: '指标看板' }
