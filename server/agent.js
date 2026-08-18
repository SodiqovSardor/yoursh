import { spawn } from 'node:child_process'

// usage: node agent.js <session> <wss-url> [tmux-session]
const id = process.argv[2]
const base = (process.argv[3] || '').replace(/\/$/, '')
const tmux = process.argv[4] || 'yoursh'

if (!id || !base) {
  console.log('usage: node agent.js <session> <wss-url> [tmux-session]')
  process.exit(1)
}
if (typeof WebSocket === 'undefined') {
  console.log('This Node has no global WebSocket. Update Node or run: npm i ws')
  process.exit(1)
}

// ponytail: script allocates a pty so tmux is happy; no node-pty (no native build)
const child = spawn('script', ['-qfc', 'tmux new -A -s ' + tmux, '/dev/null'], {
  stdio: ['pipe', 'pipe', 'pipe'],
})

const ws = new WebSocket(base + '/agent?session=' + id)
ws.binaryType = 'nodebuffer'

ws.addEventListener('open', () => console.log('connected to YourSH'))
ws.addEventListener('message', (ev) => {
  const d = ev.data
  if (typeof d === 'string') {
    try {
      if (JSON.parse(d).type === 'resize') return // ignore resize control
    } catch {}
  }
  child.stdin.write(typeof d === 'string' ? Buffer.from(d) : Buffer.from(d))
})
ws.addEventListener('error', (e) => console.log('ws error:', e.message || e))

child.stdout.on('data', (d) => { if (ws.readyState === 1) ws.send(d) })
child.stderr.on('data', (d) => { if (ws.readyState === 1) ws.send(d) })
child.on('exit', () => ws.close())
