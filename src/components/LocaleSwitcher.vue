<script setup>
import { useUiStore } from '../stores/ui'
import BaseDropdown from './BaseDropdown.vue'
import AppIcon from './AppIcon.vue'

const ui = useUiStore()
</script>

<template>
  <BaseDropdown width="w-44">
    <template #trigger>
      <AppIcon name="globe" :size="17" />
      <span class="font-semibold">{{ ui.currentLocale.short }}</span>
      <AppIcon name="chevronDown" :size="14" class="opacity-60" />
    </template>

    <p class="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider opacity-50">
      {{ ui.t('nav.language') }}
    </p>
    <button
      v-for="item in ui.locales"
      :key="item.code"
      type="button"
      class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-base-200"
      :class="item.code === ui.locale ? 'bg-base-200 font-semibold' : ''"
      @click="ui.setLocale(item.code)">
      <span class="text-base leading-none">{{ item.flag }}</span>
      <span class="flex-1">{{ item.label }}</span>
      <AppIcon v-if="item.code === ui.locale" name="check" :size="15" class="text-primary" />
    </button>
  </BaseDropdown>
</template>
