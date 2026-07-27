<script setup>
import { RouterLink } from 'vue-router'
import { useUiStore } from '../stores/ui'
import AppIcon from '../components/AppIcon.vue'
import LocaleSwitcher from '../components/LocaleSwitcher.vue'
import ThemeSwitcher from '../components/ThemeSwitcher.vue'

const ui = useUiStore()
</script>

<template>
  <div class="min-h-dvh bg-base-100 lg:grid lg:grid-cols-[1fr_1.05fr]">
    <!-- Chap taraf: brend va afzalliklar -->
    <aside
      class="relative hidden overflow-hidden bg-base-200/60 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div class="ftw-glow pointer-events-none absolute inset-0" />
      <div class="ftw-grid pointer-events-none absolute inset-0" />

      <RouterLink to="/login" class="relative flex items-center gap-2.5">
        <span
          class="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-content">
          <AppIcon name="compass" :size="21" />
        </span>
        <span class="text-lg font-extrabold tracking-tight">
          {{ ui.t('brand.name') }}
          <span class="text-primary">{{ ui.t('brand.suffix') }}</span>
        </span>
      </RouterLink>

      <div class="relative max-w-md">
        <h2 class="ftw-gradient-text text-4xl font-black leading-tight tracking-tight">
          {{ ui.t('brand.tagline') }}
        </h2>
        <p class="mt-4 text-sm leading-relaxed opacity-70">
          {{ ui.t('auth.registerSubtitle') }}
        </p>

        <ul class="mt-8 space-y-3.5">
          <li
            v-for="(item, index) in ui.t('auth.benefits')"
            :key="index"
            class="flex items-start gap-3 text-sm">
            <span
              class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <AppIcon name="check" :size="13" :stroke="3" />
            </span>
            <span class="opacity-85">{{ item }}</span>
          </li>
        </ul>
      </div>

      <p class="relative text-xs opacity-45">© 2026 FindTheWay</p>
    </aside>

    <!-- O'ng taraf: forma -->
    <main class="flex min-h-dvh flex-col">
      <header class="flex items-center justify-between gap-2 px-5 py-5 sm:px-8">
        <RouterLink to="/login" class="flex items-center gap-2 lg:invisible">
          <span
            class="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-content">
            <AppIcon name="compass" :size="19" />
          </span>
          <span class="text-base font-extrabold tracking-tight">
            {{ ui.t('brand.name') }}
            <span class="text-primary">{{ ui.t('brand.suffix') }}</span>
          </span>
        </RouterLink>

        <div class="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeSwitcher />
        </div>
      </header>

      <div class="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
        <div class="w-full max-w-md">
          <slot />
        </div>
      </div>
    </main>
  </div>
</template>
