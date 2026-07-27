<script setup>
import { ref, reactive } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useUiStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'
import AuthLayout from '../layouts/AuthLayout.vue'
import AppIcon from '../components/AppIcon.vue'
import GoogleButton from '../components/ui/GoogleButton.vue'

const ui = useUiStore()
const auth = useAuthStore()
const router = useRouter()

const form = reactive({ email: '', password: '' })
const showPassword = ref(false)
const loading = ref(false)
const errorText = ref('')
// Hisob bor, lekin roli 'owner' emas — aylantirishni taklif qilamiz
const canUpgrade = ref(false)
const upgrading = ref(false)

async function handleSubmit() {
  errorText.value = ''
  canUpgrade.value = false
  if (!form.email.trim() || !form.password) {
    errorText.value = ui.t('auth.errRequired')
    return
  }

  loading.value = true
  try {
    await auth.signInWithPassword(form.email.trim(), form.password)
    if (!auth.isOwner) {
      // Darhol chiqarib yubormaymiz — hisobni markaz hisobiga
      // aylantirish imkoniyati qolsin.
      errorText.value = ui.t('auth.errNotOwner')
      canUpgrade.value = true
      return
    }
    router.push('/')
  } catch (error) {
    errorText.value = error?.message || ui.t('common.error')
  } finally {
    loading.value = false
  }
}

async function handleUpgrade() {
  errorText.value = ''
  upgrading.value = true
  try {
    await auth.ensureOwnerProfile()
    canUpgrade.value = false
    router.push('/markazim')
  } catch (error) {
    errorText.value = error?.message || ui.t('common.error')
  } finally {
    upgrading.value = false
  }
}

async function handleGoogle() {
  errorText.value = ''
  loading.value = true
  try {
    await auth.signInWithGoogle()
  } catch (error) {
    errorText.value = error?.message || ui.t('common.error')
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <div class="ftw-rise">
      <h1 class="text-2xl font-black tracking-tight sm:text-3xl">{{ ui.t('auth.loginTitle') }}</h1>
      <p class="mt-2 text-sm opacity-65">{{ ui.t('auth.loginSubtitle') }}</p>

      <div
        v-if="errorText"
        class="mt-5 flex items-start gap-2.5 rounded-xl border border-error/30 bg-error/10 px-3.5 py-3 text-sm text-error">
        <AppIcon name="alert" :size="17" class="mt-0.5 shrink-0" />
        <span>{{ errorText }}</span>
      </div>

      <div v-if="canUpgrade" class="mt-3 rounded-xl border border-primary/30 bg-primary/8 p-4">
        <p class="text-sm leading-relaxed opacity-75">{{ ui.t('auth.upgradeHint') }}</p>
        <button
          type="button"
          class="btn btn-primary mt-3 w-full rounded-xl"
          :disabled="upgrading"
          @click="handleUpgrade">
          <span v-if="upgrading" class="loading loading-spinner loading-sm" />
          {{ ui.t('auth.upgradeAction') }}
        </button>
      </div>

      <form class="mt-6 space-y-4" @submit.prevent="handleSubmit">
        <div>
          <label class="mb-1.5 block text-sm font-semibold" for="email">
            {{ ui.t('auth.email') }}
          </label>
          <div class="relative">
            <AppIcon
              name="mail"
              :size="17"
              class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 opacity-45" />
            <input
              id="email"
              v-model="form.email"
              type="email"
              autocomplete="email"
              class="input input-bordered h-12 w-full rounded-xl pl-11"
              :placeholder="ui.t('auth.emailPlaceholder')" />
          </div>
        </div>

        <div>
          <div class="mb-1.5 flex items-center justify-between">
            <label class="text-sm font-semibold" for="password">{{ ui.t('auth.password') }}</label>
            <button type="button" class="text-xs font-semibold text-primary hover:underline">
              {{ ui.t('auth.forgot') }}
            </button>
          </div>
          <div class="relative">
            <AppIcon
              name="lock"
              :size="17"
              class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 opacity-45" />
            <input
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              class="input input-bordered h-12 w-full rounded-xl pl-11 pr-11"
              :placeholder="ui.t('auth.passwordPlaceholder')" />
            <button
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 transition-opacity hover:opacity-90"
              @click="showPassword = !showPassword">
              <AppIcon :name="showPassword ? 'eyeOff' : 'eye'" :size="17" />
            </button>
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-block h-12 rounded-xl" :disabled="loading">
          <span v-if="loading" class="loading loading-spinner loading-sm" />
          {{ ui.t('auth.submitLogin') }}
        </button>
      </form>

      <div class="my-5 flex items-center gap-3 text-xs uppercase tracking-widest opacity-45">
        <span class="h-px flex-1 bg-base-content/15" />
        {{ ui.t('auth.or') }}
        <span class="h-px flex-1 bg-base-content/15" />
      </div>

      <GoogleButton :label="ui.t('auth.google')" :loading="loading" @click="handleGoogle" />

      <p class="mt-6 text-center text-sm opacity-70">
        {{ ui.t('auth.noAccount') }}
        <RouterLink to="/register" class="font-bold text-primary hover:underline">
          {{ ui.t('auth.goRegister') }}
        </RouterLink>
      </p>
    </div>
  </AuthLayout>
</template>
