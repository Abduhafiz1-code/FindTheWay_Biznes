<script setup>
import { ref, reactive, computed, watch, onMounted } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { usePanelToolsStore, TOOLS } from "../stores/panelTools";
import AppIcon from "../components/AppIcon.vue";
import EmptyState from "../components/ui/EmptyState.vue";
import StatCard from "../components/ui/StatCard.vue";

const route = useRoute();
const router = useRouter();
const ws = usePanelToolsStore();

const active = ref("");
const form = reactive({});
const message = ref("");
const messageType = ref("success"); // success | error

const TIERS = {
  mini: { label: "Mini", cls: "badge-ghost" },
  small: { label: "Kichik", cls: "badge-info" },
  medium: { label: "O'rta", cls: "badge-primary" },
  large: { label: "Katta", cls: "badge-secondary" },
  flagship: { label: "Flagman", cls: "badge-warning" },
};

const tabs = computed(() =>
  ws.tools.map((key) => ({ key, ...(TOOLS[key] ?? {}) })).filter((t) => t.label),
);

const current = computed(() => TOOLS[active.value] ?? null);
const rows = computed(() =>
  current.value?.table ? ws.rowsOf(active.value) : [],
);

function initForm() {
  Object.keys(form).forEach((k) => delete form[k]);
  message.value = "";
  const fields = current.value?.fields ?? [];
  fields.forEach((f) => {
    if (f.default !== undefined) {
      form[f.key] =
        typeof f.default === "function" ? f.default() : f.default;
    } else if (f.type === "number") {
      form[f.key] = null;
    } else {
      form[f.key] = "";
    }
  });
}

function pickTool(key) {
  if (!TOOLS[key]) return;
  active.value = key;
  router.replace({ query: { ...route.query, tool: key } });
}

watch(active, initForm);

watch(
  () => route.query.tool,
  (value) => {
    if (typeof value === "string" && TOOLS[value] && ws.tools.includes(value)) {
      active.value = value;
    }
  },
  { immediate: true },
);

async function submit() {
  message.value = "";
  const fields = current.value?.fields ?? [];
  for (const f of fields) {
    if (f.required) {
      const v = form[f.key];
      if (v === "" || v === null || v === undefined) {
        messageType.value = "error";
        message.value = `«${f.label}» maydoni majburiy.`;
        return;
      }
    }
  }
  try {
    await ws.add(active.value, { ...form });
    messageType.value = "success";
    message.value = "Saqlandi.";
    initForm();
  } catch (error) {
    messageType.value = "error";
    message.value = error?.message || "Xatolik yuz berdi.";
  }
}

async function onDelete(row) {
  if (!confirm("Bu yozuv o'chirilsinmi?")) return;
  message.value = "";
  try {
    await ws.remove(active.value, row.id);
    messageType.value = "success";
    message.value = "O'chirildi.";
  } catch (error) {
    messageType.value = "error";
    message.value = error?.message || "Xatolik yuz berdi.";
  }
}

function cellText(col, row) {
  const value = row[col.key];
  if (value === null || value === undefined || value === "") return "—";
  if (col.type === "date")
    return new Date(value).toLocaleDateString("uz-UZ");
  if (col.type === "money")
    return Number(value).toLocaleString("uz-UZ") + " so'm";
  return value;
}

function formatUntil(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("uz-UZ");
}

function formatMoney(value) {
  return Number(value ?? 0).toLocaleString("uz-UZ");
}

onMounted(async () => {
  await ws.load();
  if (!active.value && ws.tools.length) {
    const fromQuery =
      typeof route.query.tool === "string" && ws.tools.includes(route.query.tool)
        ? route.query.tool
        : ws.tools[0];
    active.value = fromQuery;
  }
});
</script>

<template>
  <div class="space-y-6">
    <!-- Hech nima sotib olinmagan -->
    <div v-if="!ws.hasAnything && !ws.loading" class="ftw-card p-5">
      <EmptyState
        icon="briefcase"
        title="Panel hali sotib olinmagan"
        text="Tayyor admin panelni sotib oling — kassa, CRM, jadval, davomat, test va boshqa ish maydonlari shu yerda ochiladi. Modullar orqali alohida bitta maydonni ham olish mumkin.">
        <div class="flex flex-wrap justify-center gap-2">
          <RouterLink to="/panellar" class="btn btn-primary btn-sm rounded-xl">
            <AppIcon name="briefcase" :size="14" />
            Panellarni ko'rish
          </RouterLink>
          <RouterLink to="/modullar" class="btn btn-outline btn-sm rounded-xl">
            Modullar do'koni
          </RouterLink>
        </div>
      </EmptyState>
    </div>

    <template v-else>
      <!-- Panel sarlavhasi -->
      <div class="ftw-card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-xl font-black tracking-tight">
                {{
                  ws.activePanel?.panel_products?.name ?? "Ish maydoni"
                }}
              </h2>
              <span
                v-if="ws.activePanel"
                class="badge badge-sm"
                :class="TIERS[ws.activePanel.panel_products?.tier]?.cls">
                {{ TIERS[ws.activePanel.panel_products?.tier]?.label }}
              </span>
              <span
                v-if="ws.activePanel?.paid_until"
                class="badge badge-ghost badge-sm">
                {{ formatUntil(ws.activePanel.paid_until) }} gacha
              </span>
            </div>
            <p class="mt-1 text-sm opacity-60">
              {{
                ws.activePanel?.panel_products?.short ??
                "Sotib olingan modullardan ochilgan maydonlar."
              }}
            </p>
          </div>
          <RouterLink
            to="/panellar"
            class="btn btn-ghost btn-sm rounded-xl shrink-0">
            Boshqa panellar
            <AppIcon name="chevronRight" :size="14" />
          </RouterLink>
        </div>

        <!-- Rollar -->
        <div v-if="ws.roles.length" class="mt-3 flex flex-wrap gap-1.5">
          <span
            v-for="role in ws.roles"
            :key="role"
            class="badge badge-outline badge-sm">
            {{ role }}
          </span>
        </div>
      </div>

      <!-- Ish maydonlari tabs -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="btn btn-sm rounded-xl"
          :class="
            active === tab.key ? 'btn-primary' : 'btn-ghost border border-base-content/10'
          "
          @click="pickTool(tab.key)">
          <AppIcon :name="tab.icon" :size="15" />
          {{ tab.label }}
        </button>
      </div>

      <p v-if="ws.lastError" class="text-sm text-error">{{ ws.lastError }}</p>
      <p v-if="message" class="text-sm" :class="messageType === 'error' ? 'text-error' : 'text-success'">
        {{ message }}
      </p>

      <!-- ====== TABLE (CRUD) ====== -->
      <template v-if="current?.kind === 'table'">
        <div class="ftw-card p-5">
          <p class="text-sm opacity-60">{{ current.hint }}</p>

          <!-- Form (read-only audit uchun form yo'q) -->
          <form
            v-if="!current.readOnly && current.fields.length"
            class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            @submit.prevent="submit">
            <div
              v-for="field in current.fields"
              :key="field.key"
              :class="field.type === 'textarea' ? 'sm:col-span-2' : ''">
              <label class="label py-1">
                <span class="label-text text-xs font-bold uppercase tracking-wider opacity-55">
                  {{ field.label }}<span v-if="field.required" class="text-error"> *</span>
                </span>
              </label>

              <select
                v-if="field.type === 'select'"
                v-model="form[field.key]"
                class="select select-bordered w-full rounded-xl text-sm">
                <option
                  v-for="opt in field.options"
                  :key="opt.v"
                  :value="opt.v">
                  {{ opt.l }}
                </option>
              </select>

              <textarea
                v-else-if="field.type === 'textarea'"
                v-model="form[field.key]"
                rows="2"
                class="textarea textarea-bordered w-full rounded-xl text-sm"
                :placeholder="field.placeholder ?? ''" />

              <input
                v-else
                v-model="form[field.key]"
                :type="field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'"
                class="input input-bordered w-full rounded-xl text-sm"
                :placeholder="field.placeholder ?? ''"
                :min="field.type === 'number' ? 0 : undefined" />
            </div>

            <div class="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                class="btn btn-primary btn-sm rounded-xl"
                :disabled="ws.saving">
                <AppIcon name="plus" :size="14" />
                {{ ws.saving ? "Saqlanmoqda..." : "Qo'shish" }}
              </button>
            </div>
          </form>
        </div>

        <!-- Jadval -->
        <div class="ftw-card overflow-x-auto p-2">
          <table class="table table-sm">
            <thead>
              <tr>
                <th v-for="col in current.columns" :key="col.key">
                  {{ col.label }}
                </th>
                <th v-if="!current.readOnly" class="text-right">Amal</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!rows.length">
                <td
                  :colspan="current.columns.length + (current.readOnly ? 0 : 1)"
                  class="py-8 text-center text-sm opacity-50">
                  Hozircha ma'lumot yo'q — yuqoridan qo'shing.
                </td>
              </tr>
              <tr v-for="row in rows" :key="row.id">
                <td v-for="col in current.columns" :key="col.key">
                  <span
                    v-if="col.badge"
                    class="badge badge-sm"
                    :class="col.badge[row[col.key]] ?? 'badge-ghost'">
                    {{ col.badgeText?.[row[col.key]] ?? cellText(col, row) }}
                  </span>
                  <span v-else class="text-sm">{{ cellText(col, row) }}</span>
                </td>
                <td v-if="!current.readOnly" class="text-right">
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs text-error"
                    @click="onDelete(row)">
                    <AppIcon name="trash" :size="14" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ====== ANALITIKA ====== -->
      <template v-else-if="current?.kind === 'analytics'">
        <div class="ftw-card p-5">
          <p class="text-sm opacity-60">{{ current.hint }}</p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Jami tushum"
            :value="formatMoney(ws.analytics.total)"
            suffix="so'm"
            icon="wallet"
            tone="success" />
          <StatCard
            label="Shu oy tushumi"
            :value="formatMoney(ws.analytics.monthTotal)"
            suffix="so'm"
            icon="trending"
            tone="primary" />
          <StatCard
            label="Talabalar"
            :value="ws.analytics.students"
            icon="users"
            tone="info" />
          <StatCard
            label="Guruhlar"
            :value="ws.analytics.groups"
            icon="calendar"
            tone="secondary" />
          <StatCard
            label="O'rtacha ball"
            :value="ws.analytics.avgScore"
            icon="star"
            tone="accent" />
          <StatCard
            label="Davomat"
            :value="ws.analytics.attendanceRate"
            suffix="%"
            icon="checkCircle"
            tone="success" />
          <StatCard
            label="To'lovlar soni"
            :value="ws.analytics.payments"
            icon="ticket"
            tone="info" />
          <StatCard
            label="Kampaniyalar"
            :value="ws.analytics.campaigns"
            icon="send"
            tone="secondary" />
        </div>
      </template>

      <!-- ====== LINK (boshqa sahifa) ====== -->
      <template v-else-if="current?.kind === 'link'">
        <div class="ftw-card flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
          <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <AppIcon :name="current.icon" :size="22" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-base font-extrabold">{{ current.label }}</p>
            <p class="mt-0.5 text-sm opacity-60">{{ current.hint }}</p>
          </div>
          <RouterLink :to="current.to" class="btn btn-primary btn-sm rounded-xl shrink-0">
            Ochish
            <AppIcon name="arrowRight" :size="14" />
          </RouterLink>
        </div>
      </template>
    </template>
  </div>
</template>
