<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ConnectForm from './components/ConnectForm.vue'
import TerminalWindow from './components/TerminalWindow.vue'
import type { SshConfig } from './types'

type Win = { id: number; config: SshConfig; x: number; y: number; z: number; w: number; h: number }
const windows = ref<Win[]>([])
const showForm = ref(false)
let nextId = 1
let zTop = 10

function spawn(cfg: SshConfig) {
  showForm.value = false
  const n = windows.value.length
  windows.value.push({
    id: nextId++,
    config: cfg,
    x: 70 + (n % 6) * 34,
    y: 70 + (n % 6) * 34,
    z: ++zTop,
    w: Math.min(780, window.innerWidth - 140),
    h: Math.min(480, window.innerHeight - 160),
  })
}
function close(id: number) { windows.value = windows.value.filter((w) => w.id !== id) }
function focus(id: number) { const w = windows.value.find((p) => p.id === id); if (w) w.z = ++zTop }
function move(id: number, x: number, y: number) { const w = windows.value.find((p) => p.id === id); if (w) { w.x = x; w.y = y } }
function resize(id: number, w: number, h: number) { const o = windows.value.find((p) => p.id === id); if (o) { o.w = w; o.h = h } }

onMounted(() => {
  // open one terminal immediately (local shell — tmux is opt-in)
  spawn({ mode: 'local', host: '', port: 22, username: '', password: '', session: 'yoursh', useTmux: false })
})
</script>

<template>
  <div class="desktop">
    <div class="topbar">
      <span class="logo">⌘ YourSH</span>
      <span class="hint">drag titlebars · resize from corner · spawn more</span>
      <button class="newbtn" @click="showForm = true">+ New Terminal</button>
    </div>

    <TerminalWindow
      v-for="win in windows"
      :key="win.id"
      :config="win.config"
      :x="win.x"
      :y="win.y"
      :z="win.z"
      :width="win.w"
      :height="win.h"
      @close="close(win.id)"
      @focus="focus(win.id)"
      @move="(p) => move(win.id, p.x, p.y)"
      @resize="(p) => resize(win.id, p.width, p.height)"
    />

    <div v-if="showForm" class="modal-backdrop" @click.self="showForm = false">
      <ConnectForm @connect="spawn" />
    </div>
  </div>
</template>
