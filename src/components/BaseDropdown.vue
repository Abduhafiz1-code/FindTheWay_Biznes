<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

defineProps({
  align: { type: String, default: 'end' }, // 'start' | 'end'
  width: { type: String, default: 'w-56' },
})

const open = ref(false)
const root = ref(null)

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function onDocumentClick(event) {
  if (root.value && !root.value.contains(event.target)) close()
}

function onKeydown(event) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})

defineExpose({ close })
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="btn btn-ghost btn-sm gap-1.5 rounded-full"
      :aria-expanded="open"
      aria-haspopup="true"
      @click="toggle">
      <slot name="trigger" :open="open" />
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-1 scale-95">
      <div
        v-if="open"
        :class="[
          'absolute z-50 mt-2 origin-top overflow-hidden rounded-2xl border border-base-content/10 bg-base-100 p-1.5 shadow-2xl shadow-black/20',
          width,
          align === 'end' ? 'right-0' : 'left-0',
        ]"
        @click="close">
        <slot />
      </div>
    </Transition>
  </div>
</template>
