<script setup>
import AppIcon from '../AppIcon.vue'

defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  icon: { type: String, default: 'chart' },
  tone: { type: String, default: 'primary' }, // primary | secondary | accent | success | info
  suffix: { type: String, default: '' },
})

const TONES = {
  primary: 'bg-primary/12 text-primary',
  secondary: 'bg-secondary/12 text-secondary',
  accent: 'bg-accent/12 text-accent',
  success: 'bg-success/12 text-success',
  info: 'bg-info/12 text-info',
}
</script>

<template>
  <div class="ftw-card p-4 sm:p-5">
    <div class="flex items-start justify-between gap-3">
      <p class="text-xs font-semibold uppercase tracking-wider opacity-55">{{ label }}</p>
      <span
        class="flex size-9 shrink-0 items-center justify-center rounded-xl"
        :class="TONES[tone] ?? TONES.primary">
        <AppIcon :name="icon" :size="17" />
      </span>
    </div>
    <p class="mt-3 text-3xl font-black tracking-tight">
      {{ value }}<span v-if="suffix" class="text-lg font-bold opacity-60">{{ suffix }}</span>
    </p>
  </div>
</template>
