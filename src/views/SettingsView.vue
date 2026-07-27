<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'
import { useBizStore } from '../stores/biz'
import AppIcon from '../components/AppIcon.vue'

const ui = useUiStore()
const auth = useAuthStore()
const biz = useBizStore()
const router = useRouter()

const newPassword = ref('')
const changing = ref(false)
const okText = ref('')
const errorText = ref('')

async function handlePassword() {
  okText.value = ''
  errorText.value = ''
  if (newPassword.value.length < 6) {
    errorText.value = ui.t('auth.errPasswordShort')
    return
  }
  changing.value = true
  try {
    await auth.updatePassword(newPassword.value)
    newPassword.value = ''
    okText.value = ui.t('settings.passwordChanged')
  } catch (error) {
    errorText.value = error?.message || ui.t('common.error')
  } finally {
    changing.value = false
  }
}

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
  <div class="max-w-2xl space-y-6">
    <div>
      <h2 class="text-2xl font-black tracking-tight">{{ ui.t('settings.title') }}</h2>
      <p class="mt-1 text-sm opacity-60">{{ ui.t('settings.subtitle') }}</p>
    </div>

    <!-- Ko'rinish -->
    <section class="ftw-card space-y-5 p-5">
      <h3 class="text-sm font-bold">{{ ui.t('settings.appearance') }}</h3>

      <div>
        <p class="mb-2.5 text-sm font-semibold">{{ ui.t('settings.themeLabel') }}</p>
        <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <button
            v-for="item in ui.themes"
            :key="item.name"
            type="button"
            class="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors"
            :class="
              item.name === ui.theme
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-base-content/12 hover:bg-base-200'
            "
            @click="ui.setTheme(item.name)">
            <span class="flex shrink-0 items-center -space-x-1.5">
              <span
                v-for="(color, index) in item.swatch"
                :key="index"
                class="size-4 rounded-full ring-1 ring-base-content/20"
                :style="{ backgroundColor: color }" />
            </span>
            <span class="flex-1 truncate">{{ ui.t(item.labelKey) }}</span>
          </button>
        </div>
      </div>

      <div>
        <p class="mb-2.5 text-sm font-semibold">{{ ui.t('settings.languageLabel') }}</p>
        <div class="flex gap-2.5">
          <button
            v-for="item in ui.locales"
            :key="item.code"
            type="button"
            class="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors"
            :class="
              item.code === ui.locale
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-base-content/12 hover:bg-base-200'
            "
            @click="ui.setLocale(item.code)">
            <span class="text-base leading-none">{{ item.flag }}</span>
            {{ item.label }}
          </button>
        </div>
      </div>
    </section>

    <!-- Hisob -->
    <section class="ftw-card space-y-3 p-5">
      <h3 class="text-sm font-bold">{{ ui.t('settings.account') }}</h3>
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="opacity-60">{{ ui.t('settings.accountEmail') }}</span>
        <span class="truncate font-semibold">{{ auth.user?.email }}</span>
      </div>
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="opacity-60">{{ ui.t('settings.accountRole') }}</span>
        <span class="badge badge-primary badge-sm font-semibold">
          {{ ui.t('settings.roleOwner') }}
        </span>
      </div>
    </section>

    <!-- Xavfsizlik -->
    <section class="ftw-card space-y-4 p-5">
      <h3 class="text-sm font-bold">{{ ui.t('settings.security') }}</h3>

      <p
        v-if="errorText"
        class="rounded-xl border border-error/30 bg-error/10 px-3.5 py-2.5 text-sm text-error">
        {{ errorText }}
      </p>
      <p
        v-if="okText"
        class="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm text-success">
        <AppIcon name="checkCircle" :size="16" />
        {{ okText }}
      </p>

      <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="handlePassword">
        <input
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          class="input input-bordered h-12 flex-1 rounded-xl"
          :placeholder="ui.t('settings.newPassword')" />
        <button type="submit" class="btn h-12 rounded-xl" :disabled="changing">
          <span v-if="changing" class="loading loading-spinner loading-sm" />
          {{ ui.t('settings.changePassword') }}
        </button>
      </form>
    </section>

    <!-- Chiqish -->
    <section class="ftw-card flex flex-wrap items-center justify-between gap-4 p-5">
      <div>
        <h3 class="text-sm font-bold">{{ ui.t('settings.danger') }}</h3>
        <p class="mt-1 text-sm opacity-60">{{ ui.t('settings.dangerText') }}</p>
      </div>
      <button type="button" class="btn btn-outline btn-error rounded-xl" @click="handleLogout">
        <AppIcon name="logout" :size="17" />
        {{ ui.t('settings.logout') }}
      </button>
    </section>
  </div>
</template>
