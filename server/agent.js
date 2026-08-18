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

const ws = new WebSocket(base + '/agent?session=' + id)
// ponytail: script allocates a pty so tmux is happy; no node-pty (no native build)
const child = spawn('script', ['-qfc', 'tmux new -A -s ' + tmux, '/dev/null'], {
  stdio: ['pipe', 'pipe', 'pipe'],
})

child.stdout.on('data', (d) => { if (ws.readyState === 1) ws.send(d) })
child.stderr.on('data', (d) => { if (ws.readyState === 1) ws.send(d) })
ws.on('message', (d) => child.stdin.write(typeof d === 'string' ? Buffer.from(d) : d))
child.on('exit', () => ws.close())
ws.on('open', () => console.log('connected to YourSH'))
