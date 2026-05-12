export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '技能管理' })
  : { navigationBarTitleText: '技能管理' }
