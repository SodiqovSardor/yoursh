import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import type { SshConfig } from '../types'

const WS_URL =
  (import.meta.env.VITE_WS_URL as string) ||
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ssh`

export function useTerminal(container: HTMLElement, config: SshConfig) {
  const term = new Terminal({ cursorBlink: true, fontSize: 14, theme: { background: '#000' } })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.open(container)
  const fit = new FitAddon()
  term.loadAddon(fit)
  // bulletproof: force container to viewport via JS too (don't trust CSS timing)
  container.style.position = 'absolute'
  container.style.top = '0'
  container.style.left = '0'
  container.style.width = '100vw'
  container.style.height = '100vh'
  const doFit = () => fit.fit()
  doFit()
  requestAnimationFrame(doFit)
  setTimeout(doFit, 50)
  setTimeout(doFit, 200)
  setTimeout(doFit, 500)

  const ws = new WebSocket(WS_URL)
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    term.writeln('\r\nConnecting…\r\n')
    ws.send(JSON.stringify({ type: 'connect', ...config, cols: term.cols, rows: term.rows }))
  }
  ws.onmessage = (e) => {
    if (typeof e.data === 'string') {
      let msg: any
      try { msg = JSON.parse(e.data) } catch { msg = null }
      if (msg?.type === 'error') term.writeln(`\r\n\x1b[31m${msg.msg}\x1b[0m`)
      else if (msg?.type === 'waiting')
        term.writeln('\r\nWaiting for terminal to connect… run the command in Termux.\r\n')
      return
    }
    term.write(new Uint8Array(e.data))
  }

  term.onData((d) => ws.readyState === 1 && ws.send(d))

  const onResize = () => {
    fit.fit()
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
  }
  window.addEventListener('resize', onResize)

  return () => {
    window.removeEventListener('resize', onResize)
    ws.close()
    term.dispose()
  }
}
