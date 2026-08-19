<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { SshConfig } from '../types'

const emit = defineEmits<{ (e: 'connect', cfg: SshConfig): void }>()
const mode = ref<'local' | 'phone' | 'ssh'>('local')
const useTmux = ref(false)

const form = reactive<SshConfig>({
  host: '',
  port: 22,
  username: '',
  password: '',
  session: 'yoursh',
})

// ponytail: random pairing id, embedded in the command the phone runs
const pairId = Math.random().toString(36).slice(2, 8)
const ORIGIN = location.origin
const WSS = ORIGIN.replace(/^http/, 'ws')
const cmd = `pkg install -y nodejs tmux util-linux && curl -s ${ORIGIN}/agent.js | node - ${pairId} ${WSS}`

function connect() {
  if (mode.value === 'local') emit('connect', { ...form, mode: 'local', useTmux: useTmux.value, session: useTmux.value ? form.session : undefined })
  else if (mode.value === 'phone') emit('connect', { ...form, mode: 'agent', session: pairId })
  else emit('connect', { ...form, mode: 'ssh' })
}

function copy() {
  navigator.clipboard.writeText(cmd)
}
</script>

<template>
  <form class="connect" @submit.prevent="connect">
    <h1>YourSH</h1>
    <div class="tabs">
      <button type="button" :class="{ on: mode === 'local' }" @click="mode = 'local'">Local</button>
      <button type="button" :class="{ on: mode === 'phone' }" @click="mode = 'phone'">Phone</button>
      <button type="button" :class="{ on: mode === 'ssh' }" @click="mode = 'ssh'">SSH</button>
    </div>

    <template v-if="mode === 'local'">
      <p>Runs a shell <b>on this device</b> and streams to your browser. tmux is optional.</p>
      <label class="check"><input type="checkbox" v-model="useTmux" /> Launch inside tmux (persistent session)</label>
      <label v-if="useTmux">tmux session<input v-model="form.session" placeholder="yoursh" /></label>
    </template>

    <template v-else-if="mode === 'phone'">
      <p>Paste this in Termux, then hit Connect:</p>
      <pre class="cmd">{{ cmd }}</pre>
      <button type="button" class="copy" @click="copy">Copy command</button>
    </template>

    <template v-else>
      <label>Host<input v-model="form.host" required placeholder="1.2.3.4" /></label>
      <label>Port<input v-model.number="form.port" type="number" required /></label>
      <label>Username<input v-model="form.username" required /></label>
      <label>Password<input v-model="form.password" type="password" required /></label>
      <label>tmux session<input v-model="form.session" placeholder="yoursh" /></label>
    </template>

    <button type="submit">Connect</button>
  </form>
</template>
