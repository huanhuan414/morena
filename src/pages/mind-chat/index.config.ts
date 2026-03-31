export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '心智对话',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '心智对话',
      navigationStyle: 'custom'
    }
