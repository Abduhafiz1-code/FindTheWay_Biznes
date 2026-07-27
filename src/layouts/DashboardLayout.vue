<script setup>
import { ref, computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useUiStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'
import { useBizStore } from '../stores/biz'
import AppIcon from '../components/AppIcon.vue'
import BaseDropdown from '../components/BaseDropdown.vue'
import LocaleSwitcher from '../components/LocaleSwitcher.vue'
import ThemeSwitcher from '../components/ThemeSwitcher.vue'

const ui = useUiStore()
const auth = useAuthStore()
const biz = useBizStore()
const route = useRoute()
const router = useRouter()

const mobileOpen = ref(false)

const links = [
  { to: '/', icon: 'dashboard', key: 'nav.dashboard' },
  { to: '/arizalar', icon: 'inbox', key: 'nav.applications', badge: true },
  { to: '/markazim', icon: 'building', key: 'nav.center' },
  { to: '/kurslar', icon: 'book', key: 'nav.courses' },
  { to: '/sozlamalar', icon: 'settings', key: 'nav.settings' },
]

const pageTitle = computed(() => ui.t(route.meta?.titleKey ?? 'nav.dashboard'))

const initials = computed(() => {
  const name = auth.displayName || 'F'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
})

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
  },
)

async function handleLogout() {
  try {
    await auth.signOut()
  } finally {
    biz.reset()
    router.push('/login')
  }
}
</script>

<template>
  <div class="min-h-dvh bg-base-200/40">
    <!-- Mobil uchun qorong'i fon -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0">
      <div
        v-if="mobileOpen"
        class="fixed inset-0 z-40 bg-black/50 lg:hidden"
        @click="mobileOpen = false" />
    </Transition>

    <!-- Yon panel -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-base-content/10 bg-base-100 transition-transform duration-300 lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      ]">
      <div class="flex items-center justify-between px-5 py-5">
        <RouterLink to="/" class="flex items-center gap-2.5">
          <span
            class="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-content">
            <AppIcon name="compass" :size="19" />
          </span>
          <span class="text-[15px] font-extrabold leading-tight tracking-tight">
            {{ ui.t('brand.name') }}
            <span class="block text-[11px] font-bold uppercase tracking-widest text-primary">
              {{ ui.t('brand.suffix') }}
            </span>
          </span>
        </RouterLink>
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-circle lg:hidden"
          @click="mobileOpen = false">
          <AppIcon name="close" :size="18" />
        </button>
      </div>

      <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          :class="
            route.path === link.to
              ? 'bg-primary/12 text-primary'
              : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
          ">
          <AppIcon :name="link.icon" :size="18" />
          <span class="flex-1">{{ ui.t(link.key) }}</span>
          <span
            v-if="link.badge && biz.newCount"
            class="badge badge-primary badge-sm font-bold">
            {{ biz.newCount }}
          </span>
        </RouterLink>
      </nav>

      <!-- Markaz holati -->
      <div class="px-3 pb-3">
        <div
          v-if="biz.center"
          class="rounded-2xl border border-base-content/10 bg-base-200/60 p-3.5">
          <p class="truncate text-sm font-bold">{{ biz.center.name }}</p>
          <p class="mt-1 flex items-center gap-1.5 text-xs">
            <AppIcon
              :name="biz.center.is_verified ? 'checkCircle' : 'hourglass'"
              :size="13"
              :class="biz.center.is_verified ? 'text-success' : 'text-warning'" />
            <span class="opacity-70">
              {{ biz.center.is_verified ? ui.t('center.verified') : ui.t('center.notVerified') }}
            </span>
          </p>
        </div>
        <RouterLink
          v-else
          to="/markazim"
          class="block rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-3.5 text-xs leading-relaxed transition-colors hover:bg-primary/10">
          <span class="font-bold text-primary">{{ ui.t('center.createCenter') }}</span>
          <span class="mt-1 block opacity-65">{{ ui.t('center.noCenterHint') }}</span>
        </RouterLink>
      </div>

      <div class="border-t border-base-content/10 p-3">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-base-content/70 transition-colors hover:bg-error/10 hover:text-error"
          @click="handleLogout">
          <AppIcon name="logout" :size="18" />
          {{ ui.t('nav.logout') }}
        </button>
      </div>
    </aside>

    <!-- Asosiy qism -->
    <div class="lg:pl-[264px]">
      <header
        class="sticky top-0 z-30 flex items-center gap-3 border-b border-base-content/10 bg-base-100/85 px-4 py-3 backdrop-blur sm:px-6">
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-circle lg:hidden"
          :aria-label="ui.t('nav.menu')"
          @click.stop="mobileOpen = true">
          <AppIcon name="menu" :size="20" />
        </button>

        <h1 class="flex-1 truncate text-base font-bold tracking-tight sm:text-lg">
          {{ pageTitle }}
        </h1>

        <RouterLink
          to="/arizalar"
          class="btn btn-ghost btn-sm btn-circle relative"
          :aria-label="ui.t('nav.applications')">
          <AppIcon name="bell" :size="18" />
          <span
            v-if="biz.newCount"
            class="absolute right-1 top-1 size-2 rounded-full bg-primary ring-2 ring-base-100" />
        </RouterLink>

        <LocaleSwitcher />
        <ThemeSwitcher />

        <BaseDropdown width="w-64">
          <template #trigger>
            <span
              class="flex size-7 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
              {{ initials }}
            </span>
            <AppIcon name="chevronDown" :size="14" class="opacity-60" />
          </template>

          <div class="border-b border-base-content/10 px-3 pb-2.5 pt-2">
            <p class="truncate text-sm font-bold">{{ auth.displayName }}</p>
            <p class="truncate text-xs opacity-60">{{ auth.user?.email }}</p>
          </div>
          <RouterLink
            to="/sozlamalar"
            class="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-base-200">
            <AppIcon name="settings" :size="16" />
            {{ ui.t('nav.settings') }}
          </RouterLink>
          <button
            type="button"
            class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-error transition-colors hover:bg-error/10"
            @click="handleLogout">
            <AppIcon name="logout" :size="16" />
            {{ ui.t('nav.logout') }}
          </button>
        </BaseDropdown>
      </header>

      <main class="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
        <slot />
      </main>
    </div>
  </div>
</template>
