import { Client } from 'ssh2'
import type { WebSocket } from 'ws'

// ponytail: password auth only for now; add privateKey when you need key login
export function connectSsh(ws: WebSocket, cfg: any) {
  const conn = new Client()
  conn.on('ready', () => {
    conn.shell(
      { term: 'xterm-256color', cols: cfg.cols || 80, rows: cfg.rows || 24 },
      (err, stream) => {
        if (err) {
          ws.send(JSON.stringify({ type: 'error', msg: err.message }))
          return
        }
        ;(ws as any).stream = stream
        stream.on('data', (d: Buffer) => { if (ws.readyState === ws.OPEN) ws.send(d) })
        stream.stderr?.on('data', (d: Buffer) => { if (ws.readyState === ws.OPEN) ws.send(d) })
        stream.on('close', () => conn.end())
        // attach existing session or create it -> persistent tmux
        const sess = (cfg.session || 'yoursh').replace(/"/g, '')
        stream.write(`tmux new -A -s "${sess}"\n`)
      },
    )
  })
  conn.on('error', (e) => ws.send(JSON.stringify({ type: 'error', msg: (e as Error).message })))
  conn.connect({
    host: cfg.host,
    port: cfg.port || 22,
    username: cfg.username,
    password: cfg.password,
  })
}

export function resizeSsh(ws: WebSocket, cols: number, rows: number) {
  ;(ws as any).stream?.setWindow?.(rows, cols, 0, 0)
}

export function inputSsh(ws: WebSocket, data: string) {
  ;(ws as any).stream?.write(data)
}
