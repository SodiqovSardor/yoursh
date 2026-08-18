<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useTerminal } from '../composables/useTerminal'
import type { SshConfig } from '../types'

const props = defineProps<{ config: SshConfig }>()
defineEmits<{ (e: 'disconnect'): void }>()

const el = ref<HTMLElement>()
let dispose: (() => void) | undefined

onMounted(() => { dispose = useTerminal(el.value!, props.config) })
onBeforeUnmount(() => dispose?.())
</script>

<template>
  <div class="term-wrap">
    <button class="disconnect" @click="$emit('disconnect')">Disconnect</button>
    <div ref="el" class="term"></div>
  </div>
</template>
