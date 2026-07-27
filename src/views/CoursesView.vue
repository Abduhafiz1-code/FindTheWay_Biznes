<script setup>
import { ref, reactive } from 'vue'
import { RouterLink } from 'vue-router'
import { useUiStore } from '../stores/ui'
import { useBizStore } from '../stores/biz'
import AppIcon from '../components/AppIcon.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import { formatPrice as fmtPrice } from '../utils/format'

const ui = useUiStore()
const biz = useBizStore()

const dialogOpen = ref(false)
const saving = ref(false)
const errorText = ref('')

const empty = {
  id: null,
  name: '',
  level: '',
  price: null,
  duration: '',
  group_size: null,
  schedule: '',
  is_active: true,
}

const form = reactive({ ...empty })

function openCreate() {
  Object.assign(form, empty)
  errorText.value = ''
  dialogOpen.value = true
}

function openEdit(course) {
  Object.assign(form, { ...empty, ...course })
  errorText.value = ''
  dialogOpen.value = true
}

function formatPrice(value) {
  if (!value) return '—'
  return `${fmtPrice(value)} ${ui.t('common.soum')}`
}

async function handleSubmit() {
  errorText.value = ''
  if (!form.name.trim()) {
    errorText.value = ui.t('auth.errRequired')
    return
  }
  saving.value = true
  try {
    await biz.saveCourse({
      id: form.id ?? undefined,
      name: form.name.trim(),
      level: form.level.trim() || null,
      price: form.price ? Number(form.price) : null,
      duration: form.duration.trim() || null,
      group_size: form.group_size ? Number(form.group_size) : null,
      schedule: form.schedule.trim() || null,
      is_active: form.is_active,
    })
    dialogOpen.value = false
  } catch (error) {
    errorText.value = error?.message || ui.t('common.error')
  } finally {
    saving.value = false
  }
}

async function handleDelete(course) {
  if (!window.confirm(ui.t('common.confirmDelete'))) return
  try {
    await biz.deleteCourse(course.id)
  } catch (error) {
    console.warn('[FindTheWay Biznes]', error?.message)
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-2xl font-black tracking-tight">{{ ui.t('courses.title') }}</h2>
        <p class="mt-1 text-sm opacity-60">{{ ui.t('courses.subtitle') }}</p>
      </div>
      <button
        v-if="biz.hasCenter"
        type="button"
        class="btn btn-primary rounded-xl"
        @click="openCreate">
        <AppIcon name="plus" :size="17" />
        {{ ui.t('courses.addCourse') }}
      </button>
    </div>

    <!-- Markaz yo'q -->
    <div v-if="!biz.hasCenter" class="ftw-card">
      <EmptyState
        icon="building"
        :title="ui.t('center.noCenter')"
        :text="ui.t('center.noCenterHint')">
        <RouterLink to="/markazim" class="btn btn-primary rounded-xl">
          {{ ui.t('center.createCenter') }}
        </RouterLink>
      </EmptyState>
    </div>

    <div v-else-if="!biz.courses.length" class="ftw-card">
      <EmptyState icon="book" :title="ui.t('courses.empty')" :text="ui.t('courses.emptyHint')">
        <button type="button" class="btn btn-primary rounded-xl" @click="openCreate">
          <AppIcon name="plus" :size="17" />
          {{ ui.t('courses.addCourse') }}
        </button>
      </EmptyState>
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="course in biz.courses" :key="course.id" class="ftw-card flex flex-col p-5">
        <div class="flex items-start justify-between gap-3">
          <h3 class="text-base font-bold leading-snug">{{ course.name }}</h3>
          <span
            class="badge badge-sm shrink-0 font-semibold"
            :class="course.is_active === false ? 'badge-ghost' : 'badge-success'">
            {{ course.is_active === false ? ui.t('courses.inactive') : ui.t('courses.active') }}
          </span>
        </div>

        <p v-if="course.level" class="mt-1 text-xs font-semibold text-primary">
          {{ course.level }}
        </p>

        <dl class="mt-4 flex-1 space-y-2 text-sm">
          <div v-if="course.price" class="flex items-center gap-2">
            <AppIcon name="wallet" :size="15" class="opacity-45" />
            <span class="font-semibold">{{ formatPrice(course.price) }}</span>
          </div>
          <div v-if="course.duration" class="flex items-center gap-2 opacity-70">
            <AppIcon name="clock" :size="15" class="opacity-70" />
            <span>{{ course.duration }}</span>
          </div>
          <div v-if="course.group_size" class="flex items-center gap-2 opacity-70">
            <AppIcon name="users" :size="15" class="opacity-70" />
            <span>{{ course.group_size }} {{ ui.t('courses.people') }}</span>
          </div>
          <div v-if="course.schedule" class="flex items-center gap-2 opacity-70">
            <AppIcon name="calendar" :size="15" class="opacity-70" />
            <span>{{ course.schedule }}</span>
          </div>
        </dl>

        <div class="mt-5 flex gap-2 border-t border-base-content/8 pt-4">
          <button type="button" class="btn btn-sm flex-1 rounded-lg" @click="openEdit(course)">
            <AppIcon name="pencil" :size="15" />
            {{ ui.t('common.edit') }}
          </button>
          <button
            type="button"
            class="btn btn-sm btn-ghost rounded-lg text-error hover:bg-error/10"
            @click="handleDelete(course)">
            <AppIcon name="trash" :size="15" />
          </button>
        </div>
      </article>
    </div>

    <!-- Modal -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0">
      <div
        v-if="dialogOpen"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
        @click.self="dialogOpen = false">
        <div
          class="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-base-content/10 bg-base-100 p-6 shadow-2xl sm:rounded-3xl">
          <div class="mb-5 flex items-center justify-between gap-3">
            <h3 class="text-lg font-bold">
              {{ form.id ? ui.t('courses.editCourse') : ui.t('courses.addCourse') }}
            </h3>
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-circle"
              @click="dialogOpen = false">
              <AppIcon name="close" :size="18" />
            </button>
          </div>

          <p
            v-if="errorText"
            class="mb-4 rounded-xl border border-error/30 bg-error/10 px-3.5 py-2.5 text-sm text-error">
            {{ errorText }}
          </p>

          <form class="space-y-4" @submit.prevent="handleSubmit">
            <div>
              <label class="mb-1.5 block text-sm font-semibold" for="k-name">
                {{ ui.t('courses.name') }}
              </label>
              <input
                id="k-name"
                v-model="form.name"
                type="text"
                class="input input-bordered h-12 w-full rounded-xl"
                :placeholder="ui.t('courses.namePlaceholder')" />
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-1.5 block text-sm font-semibold" for="k-level">
                  {{ ui.t('courses.level') }}
                </label>
                <input
                  id="k-level"
                  v-model="form.level"
                  type="text"
                  class="input input-bordered h-12 w-full rounded-xl"
                  :placeholder="ui.t('courses.levelPlaceholder')" />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-semibold" for="k-price">
                  {{ ui.t('courses.price') }}
                </label>
                <input
                  id="k-price"
                  v-model="form.price"
                  type="number"
                  min="0"
                  step="10000"
                  class="input input-bordered h-12 w-full rounded-xl"
                  placeholder="450000" />
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-1.5 block text-sm font-semibold" for="k-duration">
                  {{ ui.t('courses.duration') }}
                </label>
                <input
                  id="k-duration"
                  v-model="form.duration"
                  type="text"
                  class="input input-bordered h-12 w-full rounded-xl"
                  :placeholder="ui.t('courses.durationPlaceholder')" />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-semibold" for="k-group">
                  {{ ui.t('courses.groupSize') }}
                </label>
                <input
                  id="k-group"
                  v-model="form.group_size"
                  type="number"
                  min="1"
                  class="input input-bordered h-12 w-full rounded-xl"
                  placeholder="12" />
              </div>
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-semibold" for="k-schedule">
                {{ ui.t('courses.schedule') }}
              </label>
              <input
                id="k-schedule"
                v-model="form.schedule"
                type="text"
                class="input input-bordered h-12 w-full rounded-xl"
                :placeholder="ui.t('courses.schedulePlaceholder')" />
            </div>

            <label class="flex cursor-pointer items-center gap-3 text-sm font-semibold">
              <input v-model="form.is_active" type="checkbox" class="toggle toggle-primary" />
              {{ ui.t('courses.active') }}
            </label>

            <div class="flex gap-3 pt-2">
              <button
                type="button"
                class="btn flex-1 rounded-xl"
                @click="dialogOpen = false">
                {{ ui.t('common.cancel') }}
              </button>
              <button type="submit" class="btn btn-primary flex-1 rounded-xl" :disabled="saving">
                <span v-if="saving" class="loading loading-spinner loading-sm" />
                {{ ui.t('common.save') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </div>
</template>
