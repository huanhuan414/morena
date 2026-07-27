function parseScene(options = {}) {
  let scene = options.scene || options.public_code || ''
  try {
    scene = decodeURIComponent(scene)
  } catch (error) {
    scene = String(scene || '')
  }
  if (scene.includes('=')) {
    const values = {}
    scene.split('&').forEach(item => {
      const index = item.indexOf('=')
      if (index > -1) values[item.slice(0, index)] = item.slice(index + 1)
    })
    return values.p || values.product || values.public_code || ''
  }
  return scene.trim()
}

module.exports = { parseScene }
