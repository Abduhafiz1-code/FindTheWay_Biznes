<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { useUiStore } from '../stores/ui'
import { useBizStore } from '../stores/biz'
import AppIcon from '../components/AppIcon.vue'

const ui = useUiStore()
const biz = useBizStore()

const form = reactive({
  name: '',
  description: '',
  district: '',
  address: '',
  phone: '',
  website: '',
  price_from: null,
})

const saving = ref(false)
const savedText = ref('')
const errorText = ref('')

function fill(center) {
  if (!center) return
  form.name = center.name ?? ''
  form.description = center.description ?? ''
  form.district = center.district ?? ''
  form.address = center.address ?? ''
  form.phone = center.phone ?? ''
  form.website = center.website ?? ''
  form.price_from = center.price_from ?? null
}

onMounted(() => fill(biz.center))
watch(() => biz.center, fill)

async function handleSubmit() {
  errorText.value = ''
  savedText.value = ''
  if (!form.name.trim()) {
    errorText.value = ui.t('auth.errRequired')
    return
  }

  saving.value = true
  try {
    await biz.saveCenter({
      name: form.name.trim(),
      description: form.description.trim() || null,
      district: form.district.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      website: form.website.trim() || null,
      price_from: form.price_from ? Number(form.price_from) : null,
    })
    savedText.value = ui.t('common.saved')
    await biz.loadCourses()
    await biz.loadApplications()
    biz.subscribe()
  } catch (error) {
    errorText.value = error?.message || ui.t('common.error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-2xl font-black tracking-tight">{{ ui.t('center.title') }}</h2>
        <p class="mt-1 text-sm opacity-60">{{ ui.t('center.subtitle') }}</p>
      </div>
      <span
        v-if="biz.center"
        class="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
        :class="
          biz.center.is_verified
            ? 'bg-success/12 text-success'
            : 'bg-warning/12 text-warning'
        ">
        <AppIcon :name="biz.center.is_verified ? 'checkCircle' : 'hourglass'" :size="13" />
        {{ biz.center.is_verified ? ui.t('center.verified') : ui.t('center.notVerified') }}
      </span>
    </div>

    <div
      v-if="errorText"
      class="flex items-start gap-2.5 rounded-xl border border-error/30 bg-error/10 px-3.5 py-3 text-sm text-error">
      <AppIcon name="alert" :size="17" class="mt-0.5 shrink-0" />
      <span>{{ errorText }}</span>
    </div>

    <form class="space-y-5" @submit.prevent="handleSubmit">
      <!-- Asosiy -->
      <section class="ftw-card space-y-4 p-5">
        <h3 class="text-sm font-bold">{{ ui.t('center.basic') }}</h3>

        <div>
          <label class="mb-1.5 block text-sm font-semibold" for="c-name">
            {{ ui.t('center.name') }}
          </label>
          <input
            id="c-name"
            v-model="form.name"
            type="text"
            class="input input-bordered h-12 w-full rounded-xl"
            :placeholder="ui.t('auth.centerNamePlaceholder')" />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-semibold" for="c-desc">
            {{ ui.t('center.description') }}
          </label>
          <textarea
            id="c-desc"
            v-model="form.description"
            rows="4"
            class="textarea textarea-bordered w-full rounded-xl"
            :placeholder="ui.t('center.descriptionHint')" />
          <p class="mt-1.5 text-xs opacity-50">{{ ui.t('center.descriptionHint') }}</p>
        </div>
      </section>

      <!-- Aloqa -->
      <section class="ftw-card space-y-4 p-5">
        <h3 class="text-sm font-bold">{{ ui.t('center.contact') }}</h3>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-semibold" for="c-district">
              {{ ui.t('center.district') }}
            </label>
            <input
              id="c-district"
              v-model="form.district"
              type="text"
              class="input input-bordered h-12 w-full rounded-xl"
              :placeholder="ui.t('center.districtPlaceholder')" />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-semibold" for="c-phone">
              {{ ui.t('center.phone') }}
            </label>
            <input
              id="c-phone"
              v-model="form.phone"
              type="tel"
              class="input input-bordered h-12 w-full rounded-xl"
              :placeholder="ui.t('auth.phonePlaceholder')" />
          </div>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-semibold" for="c-address">
            {{ ui.t('center.address') }}
          </label>
          <input
            id="c-address"
            v-model="form.address"
            type="text"
            class="input input-bordered h-12 w-full rounded-xl"
            :placeholder="ui.t('center.addressPlaceholder')" />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-semibold" for="c-web">
            {{ ui.t('center.website') }}
            <span class="ml-1 text-xs font-normal opacity-50">({{ ui.t('common.optional') }})</span>
          </label>
          <input
            id="c-web"
            v-model="form.website"
            type="url"
            class="input input-bordered h-12 w-full rounded-xl"
            placeholder="https://" />
        </div>
      </section>

      <!-- Narx -->
      <section class="ftw-card space-y-4 p-5">
        <h3 class="text-sm font-bold">{{ ui.t('center.pricing') }}</h3>
        <div>
          <label class="mb-1.5 block text-sm font-semibold" for="c-price">
            {{ ui.t('center.priceFrom') }}
          </label>
          <div class="relative">
            <input
              id="c-price"
              v-model="form.price_from"
              type="number"
              min="0"
              step="10000"
              class="input input-bordered h-12 w-full rounded-xl pr-16"
              placeholder="450000" />
            <span
              class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold opacity-50">
              {{ ui.t('common.soum') }}
            </span>
          </div>
          <p class="mt-1.5 text-xs opacity-50">{{ ui.t('center.priceHint') }}</p>
        </div>
      </section>

      <div class="flex items-center gap-3">
        <button type="submit" class="btn btn-primary h-12 rounded-xl px-7" :disabled="saving">
          <span v-if="saving" class="loading loading-spinner loading-sm" />
          {{ saving ? ui.t('common.saving') : ui.t('common.save') }}
        </button>
        <span v-if="savedText" class="flex items-center gap-1.5 text-sm font-semibold text-success">
          <AppIcon name="checkCircle" :size="16" />
          {{ savedText }}
        </span>
      </div>
    </form>
  </div>
</template>
