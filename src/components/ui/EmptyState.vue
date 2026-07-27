<script setup>
import AppIcon from '../AppIcon.vue'

defineProps({
  icon: { type: String, default: 'inbox' },
  title: { type: String, required: true },
  text: { type: String, default: '' },
})
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-14 text-center">
    <span
      class="flex size-14 items-center justify-center rounded-2xl bg-base-200 text-base-content/45">
      <AppIcon :name="icon" :size="26" />
    </span>
    <p class="mt-4 text-base font-bold">{{ title }}</p>
    <p v-if="text" class="mt-1.5 max-w-sm text-sm leading-relaxed opacity-60">{{ text }}</p>
    <div class="mt-5">
      <slot />
    </div>
  </div>
</template>
