<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUiStore } from '../stores/ui'
import { useBizStore, APPLICATION_STATUSES, STATUS_META } from '../stores/biz'
import AppIcon from '../components/AppIcon.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import { formatDateTime as fmt } from '../utils/format'

const ui = useUiStore()
const biz = useBizStore()
const route = useRoute()
const router = useRouter()

const activeTab = ref('all')
const query = ref('')
const selectedId = ref(null)
const note = ref('')
const savingNote = ref(false)
const noteSaved = ref(false)

const tabs = computed(() => [
  { key: 'all', label: ui.t('common.all'), count: biz.applications.length },
  ...APPLICATION_STATUSES.map((status) => ({
    key: status,
    label: ui.t(STATUS_META[status].labelKey),
    count: biz.applications.filter((a) => a.status === status).length,
  })),
])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return biz.applications.filter((item) => {
    if (activeTab.value !== 'all' && item.status !== activeTab.value) return false
    if (!q) return true
    return [item.student_name, item.student_phone, item.student_email, item.course_name]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q))
  })
})

const selected = computed(
  () => biz.applications.find((item) => item.id === selectedId.value) ?? null,
)

function formatDateTime(value) {
  return fmt(value, ui.locale)
}

async function open(item) {
  selectedId.value = item.id
  note.value = item.internal_note ?? ''
  noteSaved.value = false
  // Yangi arizani ochganda avtomatik "ko'rilgan" qilamiz
  if (item.status === 'new') {
    try {
      await biz.setStatus(item.id, 'seen')
    } catch {
      /* jim o'tamiz */
    }
  }
}

function close() {
  selectedId.value = null
  if (route.query.id) router.replace({ query: {} })
}

async function changeStatus(status) {
  if (!selected.value) return
  try {
    await biz.setStatus(selected.value.id, status)
  } catch (error) {
    console.warn('[FindTheWay Biznes]', error?.message)
  }
}

async function saveNote() {
  if (!selected.value) return
  savingNote.value = true
  noteSaved.value = false
  try {
    await biz.updateApplication(selected.value.id, { internal_note: note.value })
    noteSaved.value = true
  } catch (error) {
    console.warn('[FindTheWay Biznes]', error?.message)
  } finally {
    savingNote.value = false
  }
}

function syncFromQuery() {
  const id = route.query.id
  if (!id) return
  const found = biz.applications.find((item) => item.id === id)
  if (found) open(found)
}

onMounted(syncFromQuery)
watch(() => biz.applications.length, syncFromQuery)
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-2xl font-black tracking-tight">{{ ui.t('applications.title') }}</h2>
        <p class="mt-1 text-sm opacity-60">{{ ui.t('applications.subtitle') }}</p>
      </div>
      <span class="text-sm font-semibold opacity-60">
        {{ biz.applications.length }} {{ ui.t('applications.countLabel') }}
      </span>
    </div>

    <!-- Qidiruv -->
    <div class="relative">
      <AppIcon
        name="search"
        :size="17"
        class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 opacity-45" />
      <input
        v-model="query"
        type="search"
        class="input input-bordered h-12 w-full rounded-xl pl-11"
        :placeholder="ui.t('applications.searchPlaceholder')" />
    </div>

    <!-- Holat bo'yicha filtr -->
    <div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors"
        :class="
          activeTab === tab.key
            ? 'border-primary bg-primary/12 text-primary'
            : 'border-base-content/12 text-base-content/65 hover:bg-base-200'
        "
        @click="activeTab = tab.key">
        {{ tab.label }}
        <span class="rounded-full bg-base-content/10 px-1.5 text-[11px] font-bold">
          {{ tab.count }}
        </span>
      </button>
    </div>

    <!-- Ro'yxat -->
    <div class="ftw-card overflow-hidden">
      <EmptyState
        v-if="!filtered.length"
        icon="inbox"
        :title="query ? ui.t('common.noResults') : ui.t('applications.empty')"
        :text="query ? '' : ui.t('applications.emptyHint')" />

      <div v-else class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr class="text-xs uppercase tracking-wider opacity-55">
              <th>{{ ui.t('applications.colStudent') }}</th>
              <th class="hidden sm:table-cell">{{ ui.t('applications.colCourse') }}</th>
              <th class="hidden md:table-cell">{{ ui.t('applications.colContact') }}</th>
              <th class="hidden lg:table-cell">{{ ui.t('applications.colDate') }}</th>
              <th class="text-right">{{ ui.t('applications.colStatus') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in filtered"
              :key="item.id"
              class="cursor-pointer transition-colors hover:bg-base-200/60"
              @click="open(item)">
              <td>
                <div class="flex items-center gap-3">
                  <span
                    class="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-base-200 text-xs font-bold">
                    {{ (item.student_name || '?').charAt(0).toUpperCase() }}
                    <span
                      v-if="item.status === 'new'"
                      class="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary ring-2 ring-base-100" />
                  </span>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold">{{ item.student_name }}</p>
                    <p class="truncate text-xs opacity-55 sm:hidden">{{ item.course_name }}</p>
                  </div>
                </div>
              </td>
              <td class="hidden text-sm sm:table-cell">{{ item.course_name || '—' }}</td>
              <td class="hidden text-sm opacity-70 md:table-cell">
                {{ item.student_phone || item.student_email || '—' }}
              </td>
              <td class="hidden whitespace-nowrap text-xs opacity-55 lg:table-cell">
                {{ formatDateTime(item.created_at) }}
              </td>
              <td class="text-right">
                <span
                  class="badge badge-sm font-semibold"
                  :class="(STATUS_META[item.status] ?? STATUS_META.new).badge">
                  {{ ui.t((STATUS_META[item.status] ?? STATUS_META.new).labelKey) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tafsilotlar paneli -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0">
      <div v-if="selected" class="fixed inset-0 z-50 bg-black/50" @click="close" />
    </Transition>

    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-x-full"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-to-class="translate-x-full">
      <aside
        v-if="selected"
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-base-content/10 bg-base-100 shadow-2xl">
        <header
          class="flex items-center justify-between gap-3 border-b border-base-content/10 px-5 py-4">
          <h3 class="text-base font-bold">{{ ui.t('applications.detailTitle') }}</h3>
          <button type="button" class="btn btn-ghost btn-sm btn-circle" @click="close">
            <AppIcon name="close" :size="18" />
          </button>
        </header>

        <div class="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <!-- O'quvchi -->
          <div class="flex items-center gap-3.5">
            <span
              class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-base font-bold text-primary">
              {{ (selected.student_name || '?').charAt(0).toUpperCase() }}
            </span>
            <div class="min-w-0">
              <p class="truncate text-lg font-bold">{{ selected.student_name }}</p>
              <p class="text-xs opacity-55">{{ formatDateTime(selected.created_at) }}</p>
            </div>
          </div>

          <!-- Aloqa -->
          <div class="grid gap-2">
            <a
              v-if="selected.student_phone"
              :href="`tel:${selected.student_phone}`"
              class="flex items-center gap-3 rounded-xl border border-base-content/10 px-3.5 py-3 text-sm transition-colors hover:bg-base-200">
              <AppIcon name="phone" :size="16" class="text-primary" />
              <span class="flex-1 font-medium">{{ selected.student_phone }}</span>
              <span class="text-xs font-semibold text-primary">{{ ui.t('applications.call') }}</span>
            </a>
            <a
              v-if="selected.student_email"
              :href="`mailto:${selected.student_email}`"
              class="flex items-center gap-3 rounded-xl border border-base-content/10 px-3.5 py-3 text-sm transition-colors hover:bg-base-200">
              <AppIcon name="mail" :size="16" class="text-primary" />
              <span class="flex-1 truncate font-medium">{{ selected.student_email }}</span>
              <span class="text-xs font-semibold text-primary">
                {{ ui.t('applications.sendEmail') }}
              </span>
            </a>
          </div>

          <!-- Kurs -->
          <div v-if="selected.course_name">
            <p class="mb-1.5 text-xs font-semibold uppercase tracking-wider opacity-50">
              {{ ui.t('applications.colCourse') }}
            </p>
            <p class="text-sm font-medium">{{ selected.course_name }}</p>
          </div>

          <!-- Xabar -->
          <div>
            <p class="mb-1.5 text-xs font-semibold uppercase tracking-wider opacity-50">
              {{ ui.t('applications.message') }}
            </p>
            <p
              class="rounded-xl bg-base-200/70 px-3.5 py-3 text-sm leading-relaxed"
              :class="selected.message ? '' : 'italic opacity-50'">
              {{ selected.message || ui.t('applications.noMessage') }}
            </p>
          </div>

          <!-- Holat -->
          <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-wider opacity-50">
              {{ ui.t('applications.changeStatus') }}
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="status in APPLICATION_STATUSES"
                :key="status"
                type="button"
                class="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                :class="
                  selected.status === status
                    ? 'border-primary bg-primary/12 text-primary'
                    : 'border-base-content/12 hover:bg-base-200'
                "
                @click="changeStatus(status)">
                <span class="size-1.5 rounded-full" :class="STATUS_META[status].dot" />
                {{ ui.t(STATUS_META[status].labelKey) }}
              </button>
            </div>
          </div>

          <!-- Ichki eslatma -->
          <div>
            <p class="mb-1 text-xs font-semibold uppercase tracking-wider opacity-50">
              {{ ui.t('applications.internalNote') }}
            </p>
            <p class="mb-2 text-xs opacity-50">{{ ui.t('applications.internalNoteHint') }}</p>
            <textarea
              v-model="note"
              rows="3"
              class="textarea textarea-bordered w-full rounded-xl text-sm"
              :placeholder="ui.t('applications.notePlaceholder')" />
            <div class="mt-2 flex items-center gap-3">
              <button
                type="button"
                class="btn btn-sm rounded-lg"
                :disabled="savingNote"
                @click="saveNote">
                <span v-if="savingNote" class="loading loading-spinner loading-xs" />
                {{ savingNote ? ui.t('common.saving') : ui.t('common.save') }}
              </button>
              <span v-if="noteSaved" class="text-xs font-semibold text-success">
                {{ ui.t('common.saved') }}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </Transition>
  </div>
</template>
