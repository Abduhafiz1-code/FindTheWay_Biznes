<script setup>
import { useUiStore } from '../stores/ui'
import BaseDropdown from './BaseDropdown.vue'
import AppIcon from './AppIcon.vue'

const ui = useUiStore()
</script>

<template>
  <BaseDropdown width="w-60">
    <template #trigger>
      <AppIcon name="palette" :size="17" />
      <span class="hidden sm:inline font-semibold">{{ ui.t('nav.theme') }}</span>
      <AppIcon name="chevronDown" :size="14" class="opacity-60" />
    </template>

    <p class="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider opacity-50">
      {{ ui.t('nav.theme') }}
    </p>
    <button
      v-for="item in ui.themes"
      :key="item.name"
      type="button"
      class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-base-200"
      :class="item.name === ui.theme ? 'bg-base-200 font-semibold' : ''"
      @click="ui.setTheme(item.name)">
      <span class="flex shrink-0 items-center -space-x-1.5">
        <span
          v-for="(color, index) in item.swatch"
          :key="index"
          class="size-4 rounded-full ring-1 ring-base-content/20"
          :style="{ backgroundColor: color }" />
      </span>
      <span class="flex-1">{{ ui.t(item.labelKey) }}</span>
      <AppIcon v-if="item.name === ui.theme" name="check" :size="15" class="text-primary" />
    </button>
  </BaseDropdown>
</template>
