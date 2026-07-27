<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useBizStore } from './stores/biz'
import DashboardLayout from './layouts/DashboardLayout.vue'

const route = useRoute()
const auth = useAuthStore()
const biz = useBizStore()

const isDashboard = computed(() => route.meta?.layout === 'dashboard')

// Foydalanuvchi kirgach markaz, kurslar va arizalarni yuklaymiz
watch(
  () => auth.user?.id,
  (id, previous) => {
    if (id && id !== previous) biz.bootstrap()
    if (!id) biz.reset()
  },
  { immediate: true },
)
</script>

<template>
  <component :is="isDashboard ? DashboardLayout : 'div'">
    <RouterView v-slot="{ Component }">
      <Transition
        mode="out-in"
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-to-class="opacity-0">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </component>
</template>
