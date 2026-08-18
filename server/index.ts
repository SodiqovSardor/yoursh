import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { connectSsh, resizeSsh, inputSsh } from './ssh'

const PORT = Number(process.env.PORT) || 3000
const DIST = fileURLToPath(new URL('../dist', import.meta.url))

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
}

const server = createServer(async (req, res) => {
  if ((req.url || '/').split('?')[0] === '/ssh') return // websocket, handled below
  const url = (req.url || '/').split('?')[0]
  let path = join(DIST, normalize(url === '/' ? '/index.html' : url))
  // ponytail: minimal path-traversal guard
  if (!path.startsWith(DIST)) {
    res.writeHead(403)
    return res.end('forbidden')
  }
  try {
    const data = await readFile(path)
    res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    // SPA fallback -> index.html
    try {
      const data = await readFile(join(DIST, 'index.html'))
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(data)
    } catch {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('YourSH — build the frontend first (npm run build)')
    }
  }
})

const wss = new WebSocketServer({ server, path: '/ssh' })
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'ready' }))
  ws.on('message', (data) => {
    const text = typeof data === 'string' ? data : data.toString()
    let msg: any
    try { msg = JSON.parse(text) } catch { msg = null }
    if (!msg) return inputSsh(ws, text)
    if (msg.type === 'connect') connectSsh(ws, msg)
    else if (msg.type === 'resize') resizeSsh(ws, msg.cols, msg.rows)
    else inputSsh(ws, text)
  })
  ws.on('close', () => { ;(ws as any).stream?.end?.() })
})

server.listen(PORT, () => console.log(`YourSH listening on :${PORT}`))
