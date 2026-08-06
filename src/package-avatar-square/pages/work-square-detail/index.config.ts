export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationStyle: 'custom',
      backgroundColor: '#f6f4ff',
    })
  : {
      navigationStyle: 'custom',
      backgroundColor: '#f6f4ff',
    }