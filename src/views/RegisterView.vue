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

const form = reactive({
  centerName: '',
  ownerName: '',
  phone: '',
  email: '',
  password: '',
  passwordConfirm: '',
})

const showPassword = ref(false)
const loading = ref(false)
const errorText = ref('')
const successText = ref('')

function validate() {
  const required = [form.centerName, form.ownerName, form.phone, form.email, form.password]
  if (required.some((value) => !String(value).trim())) return ui.t('auth.errRequired')
  if (form.password.length < 6) return ui.t('auth.errPasswordShort')
  if (form.password !== form.passwordConfirm) return ui.t('auth.errPasswordMatch')
  return ''
}

async function handleSubmit() {
  errorText.value = ''
  successText.value = ''

  const problem = validate()
  if (problem) {
    errorText.value = problem
    return
  }

  loading.value = true
  try {
    const data = await auth.signUpOwner({
      email: form.email.trim(),
      password: form.password,
      centerName: form.centerName.trim(),
      ownerName: form.ownerName.trim(),
      phone: form.phone.trim(),
    })
    if (data.session) router.push('/markazim')
    else successText.value = ui.t('auth.successRegister')
  } catch (error) {
    errorText.value = error?.message || ui.t('common.error')
  } finally {
    loading.value = false
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
      <span
        class="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
        <AppIcon name="building" :size="13" />
        {{ ui.t('settings.roleOwner') }}
      </span>

      <h1 class="mt-4 text-2xl font-black leading-tight tracking-tight sm:text-3xl">
        {{ ui.t('auth.registerTitle') }}
      </h1>
      <p class="mt-2 text-sm opacity-65">{{ ui.t('auth.registerSubtitle') }}</p>

      <div
        v-if="errorText"
        class="mt-5 flex items-start gap-2.5 rounded-xl border border-error/30 bg-error/10 px-3.5 py-3 text-sm text-error">
        <AppIcon name="alert" :size="17" class="mt-0.5 shrink-0" />
        <span>{{ errorText }}</span>
      </div>

      <div
        v-if="successText"
        class="mt-5 flex items-start gap-2.5 rounded-xl border border-success/30 bg-success/10 px-3.5 py-3 text-sm text-success">
        <AppIcon name="checkCircle" :size="17" class="mt-0.5 shrink-0" />
        <span>{{ successText }}</span>
      </div>

      <form class="mt-6 space-y-4" @submit.prevent="handleSubmit">
        <div>
          <label class="mb-1.5 block text-sm font-semibold" for="centerName">
            {{ ui.t('auth.centerName') }}
          </label>
          <div class="relative">
            <AppIcon
              name="building"
              :size="17"
              class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 opacity-45" />
            <input
              id="centerName"
              v-model="form.centerName"
              type="text"
              class="input input-bordered h-12 w-full rounded-xl pl-11"
              :placeholder="ui.t('auth.centerNamePlaceholder')" />
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-semibold" for="ownerName">
              {{ ui.t('auth.ownerName') }}
            </label>
            <div class="relative">
              <AppIcon
                name="user"
                :size="17"
                class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 opacity-45" />
              <input
                id="ownerName"
                v-model="form.ownerName"
                type="text"
                class="input input-bordered h-12 w-full rounded-xl pl-11"
                :placeholder="ui.t('auth.ownerNamePlaceholder')" />
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-semibold" for="phone">
              {{ ui.t('auth.phone') }}
            </label>
            <div class="relative">
              <AppIcon
                name="phone"
                :size="17"
                class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 opacity-45" />
              <input
                id="phone"
                v-model="form.phone"
                type="tel"
                class="input input-bordered h-12 w-full rounded-xl pl-11"
                :placeholder="ui.t('auth.phonePlaceholder')" />
            </div>
          </div>
        </div>

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

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-semibold" for="password">
              {{ ui.t('auth.password') }}
            </label>
            <div class="relative">
              <AppIcon
                name="lock"
                :size="17"
                class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 opacity-45" />
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
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

          <div>
            <label class="mb-1.5 block text-sm font-semibold" for="passwordConfirm">
              {{ ui.t('auth.passwordConfirm') }}
            </label>
            <div class="relative">
              <AppIcon
                name="lock"
                :size="17"
                class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 opacity-45" />
              <input
                id="passwordConfirm"
                v-model="form.passwordConfirm"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                class="input input-bordered h-12 w-full rounded-xl pl-11"
                :placeholder="ui.t('auth.passwordPlaceholder')" />
            </div>
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-block h-12 rounded-xl" :disabled="loading">
          <span v-if="loading" class="loading loading-spinner loading-sm" />
          {{ ui.t('auth.submitRegister') }}
        </button>
      </form>

      <div class="my-5 flex items-center gap-3 text-xs uppercase tracking-widest opacity-45">
        <span class="h-px flex-1 bg-base-content/15" />
        {{ ui.t('auth.or') }}
        <span class="h-px flex-1 bg-base-content/15" />
      </div>

      <GoogleButton :label="ui.t('auth.google')" :loading="loading" @click="handleGoogle" />

      <p class="mt-6 text-center text-sm opacity-70">
        {{ ui.t('auth.haveAccount') }}
        <RouterLink to="/login" class="font-bold text-primary hover:underline">
          {{ ui.t('auth.goLogin') }}
        </RouterLink>
      </p>

      <p class="mt-4 text-center text-xs leading-relaxed opacity-45">
        {{ ui.t('auth.terms') }}
        <a class="underline" href="#">{{ ui.t('auth.termsLink') }}</a>
        {{ ui.t('auth.termsAnd') }}
        <a class="underline" href="#">{{ ui.t('auth.privacyLink') }}</a>
        {{ ui.t('auth.termsEnd') }}
      </p>
    </div>
  </AuthLayout>
</template>
