<script setup lang="ts">
import { ref } from 'vue'
import ConnectForm from './components/ConnectForm.vue'
import TerminalView from './components/TerminalView.vue'
import type { SshConfig } from './types'

const config = ref<SshConfig | null>(null)
</script>

<template>
  <ConnectForm v-if="!config" @connect="config = $event" />
  <TerminalView v-else :config="config" @disconnect="config = null" />
</template>
