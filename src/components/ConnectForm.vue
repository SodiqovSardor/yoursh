<script setup lang="ts">
import { reactive } from 'vue'
import type { SshConfig } from '../types'

const emit = defineEmits<{ (e: 'connect', cfg: SshConfig): void }>()

const form = reactive<SshConfig>({
  host: '',
  port: 22,
  username: '',
  password: '',
  session: 'yoursh',
})
</script>

<template>
  <form class="connect" @submit.prevent="emit('connect', { ...form })">
    <h1>YourSH</h1>
    <p>SSH into a host and attach a tmux session.</p>

    <label>Host<input v-model="form.host" required placeholder="192.168.1.10" /></label>
    <label>Port<input v-model.number="form.port" type="number" required /></label>
    <label>Username<input v-model="form.username" required /></label>
    <label>Password<input v-model="form.password" type="password" required /></label>
    <label>tmux session<input v-model="form.session" placeholder="yoursh" /></label>

    <button type="submit">Connect</button>
  </form>
</template>
