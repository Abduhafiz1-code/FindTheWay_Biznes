<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useUiStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'
import { useBizStore, STATUS_META } from '../stores/biz'
import AppIcon from '../components/AppIcon.vue'
import StatCard from '../components/ui/StatCard.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import { formatDate } from '../utils/format'

const ui = useUiStore()
const auth = useAuthStore()
const biz = useBizStore()

const recent = computed(() => biz.applications.slice(0, 5))
const maxCount = computed(() => Math.max(1, ...biz.chartData.map((d) => d.count)))

const CHART_HEIGHT = 130 // px — ustunning eng baland qiymati

function barHeight(count) {
  return `${Math.max(4, Math.round((count / maxCount.value) * CHART_HEIGHT))}px`
}

function shortDate(value) {
  return formatDate(value, ui.locale)
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-black tracking-tight">
        {{ ui.t('dashboard.greeting') }}<span v-if="auth.displayName">, {{ auth.displayName }}</span>
      </h2>
      <p class="mt-1 text-sm opacity-60">{{ ui.t('dashboard.subtitle') }}</p>
    </div>

    <!-- Markaz yo'q bo'lsa ogohlantirish -->
    <RouterLink
      v-if="!biz.hasCenter"
      to="/markazim"
      class="flex items-start gap-3.5 rounded-2xl border border-primary/30 bg-primary/8 p-4 transition-colors hover:bg-primary/12 sm:p-5">
      <span
        class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <AppIcon name="building" :size="19" />
      </span>
      <span class="flex-1">
        <span class="block text-sm font-bold">{{ ui.t('center.noCenter') }}</span>
        <span class="mt-1 block text-sm leading-relaxed opacity-65">
          {{ ui.t('center.noCenterHint') }}
        </span>
      </span>
      <AppIcon name="chevronRight" :size="18" class="mt-2 shrink-0 opacity-45" />
    </RouterLink>

    <div
      v-else-if="!biz.center.is_verified"
      class="flex items-start gap-3.5 rounded-2xl border border-warning/30 bg-warning/8 p-4 sm:p-5">
      <span
        class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
        <AppIcon name="hourglass" :size="19" />
      </span>
      <span class="flex-1">
        <span class="block text-sm font-bold">{{ ui.t('dashboard.verifyPending') }}</span>
        <span class="mt-1 block text-sm leading-relaxed opacity-65">
          {{ ui.t('dashboard.verifyPendingText') }}
        </span>
      </span>
    </div>

    <!-- KPI kartalar -->
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        :label="ui.t('dashboard.statNew')"
        :value="biz.newCount"
        icon="inbox"
        tone="primary" />
      <StatCard
        :label="ui.t('dashboard.statTotal')"
        :value="biz.totalCount"
        icon="chart"
        tone="secondary" />
      <StatCard
        :label="ui.t('dashboard.statAccepted')"
        :value="biz.acceptedCount"
        icon="checkCircle"
        tone="success" />
      <StatCard
        :label="ui.t('dashboard.statConversion')"
        :value="biz.conversion"
        suffix="%"
        icon="trending"
        tone="accent" />
    </div>

    <div class="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
      <!-- Grafik -->
      <section class="ftw-card p-5">
        <h3 class="text-sm font-bold">{{ ui.t('dashboard.chartTitle') }}</h3>
        <div class="mt-6 flex items-end gap-1.5">
          <div
            v-for="day in biz.chartData"
            :key="day.key"
            class="group flex flex-1 flex-col items-center gap-2">
            <span class="text-[10px] font-bold text-primary opacity-0 transition-opacity group-hover:opacity-100">
              {{ day.count }}
            </span>
            <div
              class="w-full rounded-t-md bg-primary/70 transition-all duration-300 group-hover:bg-primary"
              :style="{ height: barHeight(day.count) }" />
            <span class="text-[10px] font-medium opacity-45">{{ day.label }}</span>
          </div>
        </div>
      </section>

      <!-- So'nggi arizalar -->
      <section class="ftw-card overflow-hidden">
        <div class="flex items-center justify-between px-5 pt-5">
          <h3 class="text-sm font-bold">{{ ui.t('dashboard.recentTitle') }}</h3>
          <RouterLink to="/arizalar" class="text-xs font-bold text-primary hover:underline">
            {{ ui.t('common.viewAll') }}
          </RouterLink>
        </div>

        <EmptyState
          v-if="!recent.length"
          icon="inbox"
          :title="ui.t('applications.empty')"
          :text="ui.t('dashboard.recentEmpty')" />

        <ul v-else class="mt-3 divide-y divide-base-content/8">
          <li v-for="item in recent" :key="item.id">
            <RouterLink
              :to="`/arizalar?id=${item.id}`"
              class="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-base-200/60">
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-full bg-base-200 text-xs font-bold">
                {{ (item.student_name || '?').charAt(0).toUpperCase() }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold">{{ item.student_name }}</span>
                <span class="block truncate text-xs opacity-55">
                  {{ item.course_name || '—' }}
                </span>
              </span>
              <span class="flex shrink-0 flex-col items-end gap-1">
                <span class="text-[11px] opacity-45">{{ shortDate(item.created_at) }}</span>
                <span
                  class="badge badge-sm font-semibold"
                  :class="(STATUS_META[item.status] ?? STATUS_META.new).badge">
                  {{ ui.t((STATUS_META[item.status] ?? STATUS_META.new).labelKey) }}
                </span>
              </span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
