import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'
import { connectSsh, resizeSsh, inputSsh } from './ssh'

const PORT = Number(process.env.PORT) || 3000
const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const AGENT_PY = fileURLToPath(new URL('./agent.py', import.meta.url))

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.py': 'text/x-python',
}

const server = createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0]
  if (url === '/ssh' || url === '/agent') return // websockets, handled below
  if (url === '/agent.py') {
    try {
      const data = await readFile(AGENT_PY)
      res.writeHead(200, { 'content-type': 'text/x-python' })
      return res.end(data)
    } catch {
      /* fall through to 404 */
    }
  }
  let path = join(DIST, normalize(url === '/' ? '/index.html' : url))
  if (!path.startsWith(DIST)) {
    res.writeHead(403)
    return res.end('forbidden')
  }
  try {
    const data = await readFile(path)
    res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    try {
      const data = await readFile(join(DIST, 'index.html'))
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(data)
    } catch {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('YourSH — run npm run build first')
    }
  }
})

type Pair = { agent?: WebSocket; browser?: WebSocket }
const sessions = new Map<string, Pair>()
const pair = (id: string, role: 'agent' | 'browser', ws: WebSocket) => {
  const e = sessions.get(id) || {}
  e[role] = ws
  sessions.set(id, e)
}

// Single WS server; route by path.
const wss = new WebSocketServer({ server })
wss.on('connection', (ws, req) => {
  const u = new URL(req.url || '', 'http://x')
  const path = u.pathname

  // --- Phone (Termux) agent: connects outbound, relays to paired browser ---
  if (path === '/agent') {
    const id = u.searchParams.get('session') || ''
    if (!id) return ws.close()
    pair(id, 'agent', ws)
    ws.on('message', (data) => {
      const b = sessions.get(id)?.browser
      if (b && b.readyState === WebSocket.OPEN) b.send(data)
    })
    ws.on('close', () => {
      const e = sessions.get(id)
      if (e?.browser) e.browser.send(JSON.stringify({ type: 'error', msg: 'Terminal disconnected' }))
      if (e) e.agent = undefined
    })
    return
  }

  // --- Browser terminal ---
  if (path !== '/ssh') return ws.close()
  ws.send(JSON.stringify({ type: 'ready' }))
  ;(ws as any).meta = {}
  ws.on('message', (data) => {
    const text = typeof data === 'string' ? data : data.toString()
    let msg: any
    try { msg = JSON.parse(text) } catch { msg = null }
    const meta = (ws as any).meta

    if (!meta.mode) {
      if (!msg || msg.type !== 'connect') return
      if (msg.mode === 'agent') {
        meta.mode = 'agent'
        meta.session = msg.session
        pair(msg.session, 'browser', ws)
        if (!sessions.get(msg.session)?.agent) ws.send(JSON.stringify({ type: 'waiting' }))
        return
      }
      meta.mode = 'ssh'
      return connectSsh(ws, msg)
    }

    if (meta.mode === 'agent') {
      const a = sessions.get(meta.session)?.agent
      if (a && a.readyState === WebSocket.OPEN) a.send(text)
      return
    }

    if (!msg) return inputSsh(ws, text)
    if (msg.type === 'resize') return resizeSsh(ws, msg.cols, msg.rows)
    inputSsh(ws, text)
  })
  ws.on('close', () => {
    const meta = (ws as any).meta
    if (meta?.mode === 'agent') {
      const e = sessions.get(meta.session)
      if (e?.agent) e.agent.send(JSON.stringify({ type: 'error', msg: 'Browser disconnected' }))
      if (e) e.browser = undefined
    } else {
      ;(ws as any).stream?.end?.()
    }
  })
})

server.listen(PORT, () => console.log(`YourSH listening on :${PORT}`))
