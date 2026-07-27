<script setup>
import { RouterLink } from 'vue-router'
import { useUiStore } from '../stores/ui'
import AppIcon from '../components/AppIcon.vue'

const ui = useUiStore()
</script>

<template>
  <div class="relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
    <div class="ftw-glow pointer-events-none absolute inset-0" />
    <div class="relative text-center">
      <span
        class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-content">
        <AppIcon name="compass" :size="26" />
      </span>
      <p class="ftw-gradient-text mt-6 text-7xl font-black tracking-tight">404</p>
      <h1 class="mt-3 text-2xl font-bold">{{ ui.t('notFound.title') }}</h1>
      <p class="mx-auto mt-2 max-w-sm text-sm leading-relaxed opacity-60">
        {{ ui.t('notFound.subtitle') }}
      </p>
      <RouterLink to="/" class="btn btn-primary mt-7 rounded-xl px-6">
        {{ ui.t('notFound.button') }}
      </RouterLink>
    </div>
  </div>
</template>
