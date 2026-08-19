// Custom canvas terminal — no xterm, no FitAddon.
// Canvas is sized to the container (viewport); cols/rows derived from real
// pixel size. Handles the ANSI subset tmux actually emits.

const WS_URL =
  (import.meta.env.VITE_WS_URL as string) ||
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ssh`

const FONT_SIZE = 14
const LINE_H = Math.round(FONT_SIZE * 1.2)
const DEF_FG = '#cccccc'
const DEF_BG = '#000000'
const PALETTE16 = [
  '#000000', '#cd0000', '#00cd00', '#cdcd00', '#0000cd', '#cd00cd',
  '#00cdcd', '#e5e5e5', '#7f7f7f', '#ff0000', '#00ff00', '#ffff00',
  '#0000ff', '#ff00ff', '#00ffff', '#ffffff',
]

function color256(i: number): string {
  if (i < 16) return PALETTE16[i]
  if (i < 232) {
    const j = i - 16
    const r = (Math.floor(j / 36) % 6) * 51
    const g = (Math.floor(j / 6) % 6) * 51
    const b = (j % 6) * 51
    return `rgb(${r},${g},${b})`
  }
  const v = 8 + (i - 232) * 10
  return `rgb(${v},${v},${v})`
}

type Cell = { ch: string; fg: string; bg: string }

export function useTerminal(container: HTMLElement, config: any) {
  const canvas = document.createElement('canvas')
  canvas.tabIndex = 0
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  canvas.style.background = DEF_BG
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')!

  let cols = 0
  let rows = 0
  let charW = FONT_SIZE * 0.6
  let buf: Cell[][] = []
  let cx = 0
  let cy = 0
  let scrollTop = 0
  let scrollBottom = 0
  let fg = DEF_FG
  let bg = DEF_BG
  let saved = { x: 0, y: 0, fg: DEF_FG, bg: DEF_BG }

  const blankRow = (): Cell[] =>
    Array.from({ length: cols }, () => ({ ch: ' ', fg: DEF_FG, bg: DEF_BG }))
  const blankBuf = () => {
    buf = Array.from({ length: rows }, () => blankRow())
  }

  function setup() {
    const dpr = window.devicePixelRatio || 1
    const w = container.clientWidth || window.innerWidth
    const h = container.clientHeight || window.innerHeight
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.font = `${FONT_SIZE}px monospace`
    ctx.textBaseline = 'top'
    charW = ctx.measureText('M').width || FONT_SIZE * 0.6
    const newCols = Math.max(1, Math.floor(w / charW))
    const newRows = Math.max(1, Math.floor(h / LINE_H))
    cols = newCols
    rows = newRows
    scrollTop = 0
    scrollBottom = rows - 1
    blankBuf()
    cx = 0
    cy = 0
  }

  function draw() {
    ctx.fillStyle = DEF_BG
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.font = `${FONT_SIZE}px monospace`
    for (let y = 0; y < rows; y++) {
      const row = buf[y]
      for (let x = 0; x < cols; x++) {
        const c = row[x]
        if (c.bg !== DEF_BG) {
          ctx.fillStyle = c.bg
          ctx.fillRect(x * charW, y * LINE_H, Math.ceil(charW), LINE_H)
        }
        if (c.ch !== ' ') {
          ctx.fillStyle = c.fg
          ctx.fillText(c.ch, x * charW, y * LINE_H)
        }
      }
    }
  }

  const put = (ch: string) => {
    buf[cy][cx] = { ch, fg, bg }
    cx++
    if (cx >= cols) {
      cx = 0
      newline()
    }
  }
  const newline = () => {
    if (cy >= scrollBottom) scrollUp()
    else cy++
  }
  const scrollUp = () => {
    for (let y = scrollTop; y < scrollBottom; y++) buf[y] = buf[y + 1]
    buf[scrollBottom] = blankRow()
  }
  const eraseLine = (mode: number) => {
    if (mode === 0 || mode === 2) buf[cy] = blankRow()
    else if (mode === 1)
      for (let x = 0; x <= cx; x++) buf[cy][x] = { ch: ' ', fg: DEF_FG, bg: DEF_BG }
  }
  const eraseScreen = (mode: number) => {
    if (mode === 2) {
      blankBuf()
      cx = 0
      cy = 0
    } else if (mode === 0) {
      for (let y = cy; y < rows; y++)
        for (let x = 0; x < cols; x++) buf[y][x] = { ch: ' ', fg: DEF_FG, bg: DEF_BG }
    } else if (mode === 1) {
      for (let y = 0; y <= cy; y++)
        for (let x = 0; x < cols; x++) buf[y][x] = { ch: ' ', fg: DEF_FG, bg: DEF_BG }
    }
  }

  function applySGR(p: number[]) {
    let i = 0
    while (i < p.length) {
      const v = p[i]
      if (v === 0) { fg = DEF_FG; bg = DEF_BG }
      else if (v === 39) fg = DEF_FG
      else if (v === 49) bg = DEF_BG
      else if (v >= 30 && v <= 37) fg = PALETTE16[v - 30]
      else if (v >= 90 && v <= 97) fg = PALETTE16[v - 90 + 8]
      else if (v >= 40 && v <= 47) bg = PALETTE16[v - 40]
      else if (v >= 100 && v <= 107) bg = PALETTE16[v - 100 + 8]
      else if (v === 38 || v === 48) {
        const mode = p[i + 1]
        if (mode === 5) { const n = p[i + 2]; if (v === 38) fg = color256(n); else bg = color256(n); i += 3; continue }
        else if (mode === 2) { const r = p[i + 2], g = p[i + 3], b = p[i + 4]; if (v === 38) fg = `rgb(${r},${g},${b})`; else bg = `rgb(${r},${g},${b})`; i += 5; continue }
        else { i += 1; continue }
      }
      i++
    }
  }

  let state: 'text' | 'esc' | 'csi' | 'osc' | 'charset' = 'text'
  let csi = ''
  let osc = ''

  function feed(s: string) {
    for (let k = 0; k < s.length; k++) {
      const ch = s[k]
      const code = ch.charCodeAt(0)
      if (state === 'text') {
        if (code === 0x1b) { state = 'esc'; continue }
        if (code === 0x0d) { cx = 0; continue }
        if (code === 0x0a) { newline(); continue }
        if (code === 0x08) { if (cx > 0) cx--; continue }
        if (code === 0x09) { cx = Math.min(cols - 1, (cx + 8) & ~7); continue }
        if (code < 0x20) continue
        put(ch)
      } else if (state === 'esc') {
        if (ch === '[') { state = 'csi'; csi = ''; continue }
        if (ch === ']') { state = 'osc'; osc = ''; continue }
        if (ch === '(' || ch === ')') { state = 'charset'; continue }
        if (ch === 'c') { blankBuf(); cx = 0; cy = 0; fg = DEF_FG; bg = DEF_BG }
        else if (ch === '7') { saved = { x: cx, y: cy, fg, bg } }
        else if (ch === '8') { cx = saved.x; cy = saved.y; fg = saved.fg; bg = saved.bg }
        state = 'text'
      } else if (state === 'csi') {
        if ((ch >= '0' && ch <= '9') || ch === ';' || ch === '?') { csi += ch; continue }
        const priv = csi.startsWith('?')
        const params = (priv ? csi.slice(1) : csi).split(';').map((x) => (x === '' ? 0 : parseInt(x, 10)))
        const n0 = params[0] || 1
        const n1 = params[1] || 1
        switch (ch) {
          case 'A': cy = Math.max(scrollTop, cy - n0); break
          case 'B': cy = Math.min(scrollBottom, cy + n0); break
          case 'C': cx = Math.min(cols - 1, cx + n0); break
          case 'D': cx = Math.max(0, cx - n0); break
          case 'E': cy = Math.min(scrollBottom, cy + n0); cx = 0; break
          case 'F': cy = Math.max(scrollTop, cy - n0); cx = 0; break
          case 'G': cx = Math.max(0, Math.min(cols - 1, n0 - 1)); break
          case 'H': case 'f': cy = Math.min(rows - 1, Math.max(0, n0 - 1)); cx = Math.min(cols - 1, Math.max(0, n1 - 1)); break
          case 'd': cy = Math.min(rows - 1, Math.max(0, n0 - 1)); break
          case 'J': eraseScreen(n0); break
          case 'K': eraseLine(n0); break
          case 'L': for (let y = scrollBottom; y > cy; y--) buf[y] = buf[y - 1]; buf[cy] = blankRow(); break
          case 'M': for (let y = cy; y < scrollBottom; y++) buf[y] = buf[y + 1]; buf[scrollBottom] = blankRow(); break
          case 'P': for (let x = cx; x < cols - 1; x++) buf[cy][x] = buf[cy][x + 1]; buf[cy][cols - 1] = { ch: ' ', fg: DEF_FG, bg: DEF_BG }; break
          case '@': for (let x = cols - 1; x > cx; x--) buf[cy][x] = buf[cy][x - 1]; buf[cy][cx] = { ch: ' ', fg: DEF_FG, bg: DEF_BG }; break
          case 'r': scrollTop = Math.max(0, n0 - 1); scrollBottom = Math.min(rows - 1, n1 - 1); cy = scrollTop; cx = 0; break
          case 'm': applySGR(params); break
          case 'h': if (priv && n0 === 1049) { blankBuf(); cx = 0; cy = 0 }; break
          case 'l': if (priv && n0 === 1049) { blankBuf(); cx = 0; cy = 0 }; break
          case 's': saved = { x: cx, y: cy, fg, bg }; break
          case 'u': cx = saved.x; cy = saved.y; fg = saved.fg; bg = saved.bg; break
        }
        state = 'text'
      } else if (state === 'osc') {
        if (ch === '\x07' || (ch === '\\' && s[k - 1] === '\x1b')) state = 'text'
        else osc += ch
      } else if (state === 'charset') {
        state = 'text'
      }
    }
    draw()
  }

  const ws = new WebSocket(WS_URL)
  ws.binaryType = 'arraybuffer'
  const decoder = new TextDecoder('utf-8')
  setup()

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'connect', ...config, cols, rows }))
  }
  ws.onmessage = (e) => {
    if (typeof e.data === 'string') {
      let msg: any
      try { msg = JSON.parse(e.data) } catch { msg = null }
      if (msg?.type === 'error') feed('\r\n\x1b[31m' + msg.msg + '\x1b[0m\r\n')
      else if (msg?.type === 'waiting') feed('\r\nWaiting for terminal to connect… run the command in Termux.\r\n')
      return
    }
    feed(decoder.decode(e.data as ArrayBuffer))
  }

  const sendKey = (e: KeyboardEvent) => {
    let d: string | null = null
    if (e.ctrlKey && /^[a-z]$/.test(e.key)) d = String.fromCharCode(e.key.toLowerCase().charCodeAt(0) - 96)
    else if (e.key === 'Enter') d = '\r'
    else if (e.key === 'Backspace') d = '\x7f'
    else if (e.key === 'Tab') d = '\t'
    else if (e.key === 'ArrowUp') d = '\x1b[A'
    else if (e.key === 'ArrowDown') d = '\x1b[B'
    else if (e.key === 'ArrowRight') d = '\x1b[C'
    else if (e.key === 'ArrowLeft') d = '\x1b[D'
    else if (e.key.length === 1) d = e.key
    if (d !== null) {
      e.preventDefault()
      if (ws.readyState === 1) ws.send(d)
    }
  }
  canvas.addEventListener('keydown', sendKey)
  canvas.addEventListener('click', () => canvas.focus())
  canvas.focus()

  const onResize = () => {
    setup()
    draw()
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'resize', cols, rows }))
  }
  window.addEventListener('resize', onResize)

  return () => {
    window.removeEventListener('resize', onResize)
    ws.close()
  }
}
