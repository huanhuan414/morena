export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationStyle: 'custom',
      backgroundColor: '#f8fafc',
    })
  : {
      navigationStyle: 'custom',
      backgroundColor: '#f8fafc',
    }