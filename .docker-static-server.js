const http = require('http')
const fs = require('fs')
const path = require('path')

const HOST = '0.0.0.0'
const PORT = Number(process.env.PORT || 5000)
const API_TARGET_HOST = process.env.API_TARGET_HOST || 'host.docker.internal'
const API_TARGET_PORT = Number(process.env.API_TARGET_PORT || 3000)
const STATIC_ROOT = process.env.STATIC_ROOT || '/site'

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function sendError(res, statusCode, message) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(message)
}

function serveFile(filePath, res) {
  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      sendError(res, 404, 'Not Found')
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': contentType })
    fs.createReadStream(filePath).pipe(res)
  })
}

function proxyApi(req, res) {
  const options = {
    hostname: API_TARGET_HOST,
    port: API_TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${API_TARGET_HOST}:${API_TARGET_PORT}`,
    },
  }

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (error) => {
    sendError(res, 502, `API proxy error: ${error.message}`)
  })

  req.pipe(proxyReq)
}

function resolveStaticPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0])
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '')
  const requestedPath = normalizedPath === '/' ? '/index.html' : normalizedPath
  return path.join(STATIC_ROOT, requestedPath)
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    sendError(res, 400, 'Bad Request')
    return
  }

  if (req.url.startsWith('/api/')) {
    proxyApi(req, res)
    return
  }

  const filePath = resolveStaticPath(req.url)
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      serveFile(filePath, res)
      return
    }

    serveFile(path.join(STATIC_ROOT, 'index.html'), res)
  })
})

server.listen(PORT, HOST, () => {
  console.log(`Static app running at http://${HOST}:${PORT}`)
  console.log(`Proxying /api to http://${API_TARGET_HOST}:${API_TARGET_PORT}`)
})
