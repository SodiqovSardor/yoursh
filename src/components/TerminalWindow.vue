<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { Terminal, type WTerm } from '@wterm/vue'
import '@wterm/vue/css'
import type { SshConfig } from '../types'

const props = defineProps<{
  config: SshConfig
  x: number
  y: number
  z: number
  width: number
  height: number
  focused: boolean
}>()
const emit = defineEmits<{
  close: []
  focus: []
  move: [{ x: number; y: number }]
  resize: [{ width: number; height: number }]
}>()

const WS_URL =
  (import.meta.env.VITE_WS_URL as string) ||
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ssh`

const decoder = new TextDecoder('utf-8')
let wt: WTerm | null = null
let ws: WebSocket | null = null

// Each window gets its own tmux session so they don't collide.
const session = computed(() => {
  const s = props.config.session
  if (props.config.mode === 'local') return s && s !== 'yoursh' ? s : 'yoursh-' + Math.random().toString(36).slice(2, 8)
  return s || ''
})

const title = computed(() => {
  if (props.config.mode === 'local') return 'tmux · ' + (session.value || 'local')
  if (props.config.mode === 'agent') return 'phone · ' + (session.value || 'agent')
  return `${props.config.username || 'user'}@${props.config.host || 'host'}`
})

function openWs() {
  ws = new WebSocket(WS_URL)
  ws.binaryType = 'arraybuffer'
  ws.onopen = () => {
    ws!.send(JSON.stringify({
      type: 'connect', ...props.config, session: session.value,
      cols: wt?.cols ?? 80, rows: wt?.rows ?? 24,
    }))
  }
  ws.onmessage = (e) => {
    if (!wt) return
    if (typeof e.data === 'string') {
      let msg: any
      try { msg = JSON.parse(e.data) } catch { msg = null }
      if (msg?.type === 'error') wt.write('\r\n\x1b[31m' + msg.msg + '\x1b[0m\r\n')
      else if (msg?.type === 'waiting') wt.write('\r\nWaiting for terminal to connect… run the command in Termux.\r\n')
      return
    }
    wt.write(decoder.decode(e.data as ArrayBuffer))
  }
}

function onReady(instance: WTerm) {
  wt = instance
  openWs()
}
function onData(chunk: string) {
  if (ws && ws.readyState === 1) ws.send(chunk)
}
function onResize(cols: number, rows: number) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'resize', cols, rows }))
}

// --- drag ---
let drag = false
let sx = 0, sy = 0, ox = 0, oy = 0
function startDrag(e: PointerEvent) {
  drag = true
  sx = e.clientX; sy = e.clientY; ox = props.x; oy = props.y
  emit('focus')
  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', endDrag)
}
function onDrag(e: PointerEvent) {
  if (!drag) return
  emit('move', { x: Math.max(0, ox + e.clientX - sx), y: Math.max(0, oy + e.clientY - sy) })
}
function endDrag() {
  drag = false
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', endDrag)
}

// --- resize ---
let res = false
let rsx = 0, rsy = 0, rw = 0, rh = 0
function startResize(e: PointerEvent) {
  e.stopPropagation()
  res = true
  rsx = e.clientX; rsy = e.clientY; rw = props.width; rh = props.height
  emit('focus')
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', endResize)
}
function onResizeMove(e: PointerEvent) {
  if (!res) return
  emit('resize', {
    width: Math.max(360, rw + e.clientX - rsx),
    height: Math.max(220, rh + e.clientY - rsy),
  })
}
function endResize() {
  res = false
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', endResize)
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', endResize)
  ws?.close()
})
</script>

<template>
  <div
    class="win"
    :class="{ focused }"
    :style="{ left: x + 'px', top: y + 'px', zIndex: z, width: width + 'px', height: height + 'px' }"
    @pointerdown="emit('focus')"
  >
    <div class="titlebar" @pointerdown="startDrag">
      <div class="dots">
        <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
      </div>
      <div class="title">{{ title }}</div>
      <button class="close" @pointerdown.stop @click="emit('close')">✕</button>
    </div>
    <div class="body">
      <Terminal auto-resize :style="{ width: '100%', height: '100%' }" @ready="onReady" @data="onData" @resize="onResize" />
    </div>
    <div class="resize-handle" @pointerdown="startResize"></div>
  </div>
</template>
