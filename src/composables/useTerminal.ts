import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import type { SshConfig } from '../types'

const WS_URL =
  (import.meta.env.VITE_WS_URL as string) ||
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ssh`

export function useTerminal(container: HTMLElement, config: SshConfig) {
  const term = new Terminal({ cursorBlink: true, fontSize: 14, theme: { background: '#000' } })
  term.open(container)
  // force container to fill the viewport (CSS also does this; belt + suspenders)
  container.style.position = 'absolute'
  container.style.top = '0'
  container.style.left = '0'
  container.style.width = '100vw'
  container.style.height = '100vh'

  // Deterministic sizing from the window — no FitAddon auto-measure (it was
  // returning 80x24 because cell metrics weren't ready). ponytail: if the
  // internal cell path is missing we fall back to ~8x16 for 14px mono.
  const cell = () => {
    const c = (term as any)._core?._renderService?.dimensions?.css?.cell
    return { w: c?.width || 8, h: c?.height || 16 }
  }
  const resize = () => {
    const { w, h } = cell()
    const vw = window.innerWidth || document.documentElement.clientWidth
    const vh = window.innerHeight || document.documentElement.clientHeight
    const cols = Math.max(1, Math.floor(vw / w))
    const rows = Math.max(1, Math.floor(vh / h))
    try {
      term.resize(cols, rows)
    } catch {
      /* not ready yet */
    }
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols, rows }))
  }

  const ws = new WebSocket(WS_URL)
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    resize()
    term.writeln('\r\nConnecting…\r\n')
    ws.send(JSON.stringify({ type: 'connect', ...config, cols: term.cols, rows: term.rows }))
  }
  ws.onmessage = (e) => {
    if (typeof e.data === 'string') {
      let msg: any
      try {
        msg = JSON.parse(e.data)
      } catch {
        msg = null
      }
      if (msg?.type === 'error') term.writeln(`\r\n\x1b[31m${msg.msg}\x1b[0m`)
      else if (msg?.type === 'waiting')
        term.writeln('\r\nWaiting for terminal to connect… run the command in Termux.\r\n')
      return
    }
    term.write(new Uint8Array(e.data))
  }

  term.onData((d) => ws.readyState === 1 && ws.send(d))

  // re-size once cell metrics are known + on window resize
  requestAnimationFrame(resize)
  setTimeout(resize, 50)
  setTimeout(resize, 200)
  setTimeout(resize, 500)
  window.addEventListener('resize', resize)

  return () => {
    window.removeEventListener('resize', resize)
    ws.close()
    term.dispose()
  }
}
