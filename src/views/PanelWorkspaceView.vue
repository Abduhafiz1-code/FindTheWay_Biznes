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
const query = ref("");
const editingId = ref(null);
const editingPatch = reactive({});

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

// Bu panelda yopiq qolgan maydonlar — nima uchun katta panel qimmatroq
const lockedTools = computed(() =>
  Object.entries(TOOLS)
    .filter(([key, cfg]) => !ws.tools.includes(key) && cfg.label)
    .map(([key, cfg]) => ({ key, label: cfg.label, hint: cfg.hint })),
);

const current = computed(() => TOOLS[active.value] ?? null);
const rows = computed(() =>
  current.value?.table ? ws.rowsOf(active.value) : [],
);

// Faqat ochiq maydonlar (requiresTool hisobga olinadi)
const formFields = computed(() => ws.fieldsOf(active.value));
const tableColumns = computed(() => ws.columnsOf(active.value));

/** select maydon uchun variantlar (filiallar jadvaldan keladi) */
function fieldOptions(field) {
  return ws.optionsOf(field);
}

/** ref ustun qiymati (branch_id -> filial nomi) */
function colValue(col, row) {
  if (col.ref) {
    const label = ws.refLabel(col, row[col.key]);
    if (label !== null) return label;
  }
  return row[col.key];
}

// Qidiruv — ko'rinadigan ustunlar bo'yicha (filial nomi bilan ham)
const filteredRows = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter((row) => {
    const values = tableColumns.value.map((c) => colValue(c, row));
    return [...values, ...Object.values(row)].some(
      (v) =>
        v !== null &&
        v !== undefined &&
        String(v).toLowerCase().includes(q),
    );
  });
});

function startEdit(row) {
  editingId.value = row.id;
  Object.keys(editingPatch).forEach((k) => delete editingPatch[k]);
  tableColumns.value
    .filter((c) => c.editable)
    .forEach((c) => {
      editingPatch[c.key] = row[c.key];
    });
}

async function saveEdit(row) {
  try {
    await ws.update(active.value, row.id, { ...editingPatch });
    message.value = "Yangilandi.";
    messageType.value = "success";
    editingId.value = null;
  } catch (error) {
    message.value = error?.message || "Xatolik yuz berdi.";
    messageType.value = "error";
  }
}

function telHref(value) {
  const digits = String(value ?? "").replace(/[^0-9+]/g, "");
  return digits ? `tel:${digits}` : "";
}

// Marketing: SMS/Telegram tez xabar
const blastText = ref("");
const crmPhones = computed(() =>
  ws.rowsOf("crm").filter((s) => s.phone),
);
function smsHref(phone, text) {
  const digits = String(phone ?? "").replace(/[^0-9+]/g, "");
  return `sms:${digits}?body=${encodeURIComponent(text || "")}`;
}
function tgHref(phone, text) {
  let digits = String(phone ?? "").replace(/[^0-9]/g, "");
  if (digits.startsWith("998") && digits.length > 9)
    digits = digits.slice(-9);
  return `https://t.me/+998${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

function initForm() {
  Object.keys(form).forEach((k) => delete form[k]);
  message.value = "";
  const fields = formFields.value;
  fields.forEach((f) => {
    if (f.default !== undefined) {
      form[f.key] =
        typeof f.default === "function" ? f.default() : f.default;
    } else if (f.optionsFrom) {
      form[f.key] = "";
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
  query.value = "";
  editingId.value = null;
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
  const fields = formFields.value;
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
    const payload = { ...form };
    // Tanlanmagan filial -> NULL (faqat filial maydoni uchun)
    formFields.value.forEach((f) => {
      if (f.optionsFrom && payload[f.key] === "") payload[f.key] = null;
    });
    await ws.add(active.value, payload);
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
  const value = colValue(col, row);
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
              <span class="badge badge-outline badge-sm">
                {{ ws.tools.length }} ta ish maydoni
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

      <!-- Nima yopiq? (darajalar farqini ko'rsatadi) -->
      <div v-if="lockedTools.length" class="ftw-card p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-bold uppercase tracking-widest opacity-45">
            Bu panel {{ ws.tools.length }} ta maydon ochadi
          </span>
          <span class="text-xs opacity-45">·</span>          <span class="text-xs opacity-60">
            Kattaroq panelda yana {{ lockedTools.length }} ta maydon ochiladi:
          </span>
        </div>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <span
            v-for="t in lockedTools"
            :key="t.key"
            class="badge badge-ghost badge-sm opacity-70">
            <AppIcon name="lock" :size="11" class="mr-1" />
            {{ t.label }}
          </span>
        </div>
        <RouterLink to="/panellar" class="btn btn-outline btn-xs mt-3 rounded-xl">
          Panellar bilan tanishing
          <AppIcon name="chevronRight" :size="13" />
        </RouterLink>
      </div>

      <!-- ====== TABLE (CRUD) ====== -->
      <template v-if="current?.kind === 'table'">
        <!-- Kassa jamlamasi -->
        <div v-if="current.summary === 'finance'" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Bugungi tushum"
            :value="formatMoney(ws.financeSummary.today)"
            suffix="so'm"
            icon="wallet"
            tone="success" />
          <StatCard
            label="Shu oy"
            :value="formatMoney(ws.financeSummary.month)"
            suffix="so'm"
            icon="trending"
            tone="primary" />
          <StatCard
            label="Jami"
            :value="formatMoney(ws.financeSummary.total)"
            suffix="so'm"
            icon="chart"
            tone="info" />
          <StatCard
            label="Qabul qilinganlar"
            :value="ws.financeSummary.debtors"
            icon="users"
            tone="secondary" />
        </div>

        <div class="ftw-card p-5">
          <p class="text-sm opacity-60">{{ current.hint }}</p>

          <!-- Qidiruv + eksport -->
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <div class="relative min-w-56 flex-1">
              <AppIcon
                name="search"
                :size="15"
                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
              <input
                v-model="query"
                type="search"
                placeholder="Qidirish..."
                class="input input-bordered input-sm w-full rounded-xl pl-9 text-sm" />
            </div>
            <button
              type="button"
              class="btn btn-outline btn-sm rounded-xl"
              :disabled="!rows.length"
              @click="ws.exportCsv(active.value ?? active)">
              <AppIcon name="download" :size="14" />
              Excel (CSV)
            </button>
          </div>

          <!-- Form (read-only audit uchun form yo'q) -->
          <form
            v-if="!current.readOnly && formFields.length"
            class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            @submit.prevent="submit">
            <div
              v-for="field in formFields"
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
                <option v-if="field.optionsFrom && !field.required" value="">— Tanlanmagan —</option>
                <option
                  v-for="opt in fieldOptions(field)"
                  :key="String(opt.v)"
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
                <th v-for="col in tableColumns" :key="col.key">
                  {{ col.label }}
                </th>
                <th v-if="!current.readOnly" class="text-right">Amal</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filteredRows.length">
                <td
                  :colspan="tableColumns.length + (current.readOnly ? 0 : 1)"
                  class="py-8 text-center text-sm opacity-50">
                  {{
                    rows.length
                      ? "Qidiruv natijasi yo'q."
                      : "Hozircha ma'lumot yo'q — yuqoridan qo'shing."
                  }}
                </td>
              </tr>
              <tr v-for="row in filteredRows" :key="row.id">
                <td v-for="col in tableColumns" :key="col.key">
                  <!-- Tahrirlanadigan holat (select) -->
                  <select
                    v-if="editingId === row.id && col.editable"
                    v-model="editingPatch[col.key]"
                    class="select select-bordered select-xs w-full rounded-lg text-xs">
                    <option
                      v-for="opt in col.editOptions"
                      :key="opt.v"
                      :value="opt.v">
                      {{ opt.l }}
                    </option>
                  </select>

                  <!-- Telefon: qo'ng'iroq tugmasi -->
                  <a
                    v-else-if="col.phone && row[col.key]"
                    :href="telHref(row[col.key])"
                    class="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-sm font-semibold text-primary hover:bg-primary/10">
                    {{ row[col.key] }}
                    <AppIcon name="phone" :size="12" />
                  </a>

                  <span
                    v-else-if="col.badge"
                    class="badge badge-sm"
                    :class="col.badge[row[col.key]] ?? 'badge-ghost'">
                    {{ col.badgeText?.[row[col.key]] ?? cellText(col, row) }}
                  </span>
                  <span v-else class="text-sm">{{ cellText(col, row) }}</span>
                </td>
                <td v-if="!current.readOnly" class="text-right">
                  <template v-if="editingId === row.id">
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs text-success"
                      title="Saqlash"
                      @click="saveEdit(row)">
                      <AppIcon name="check" :size="14" />
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      title="Bekor"
                      @click="editingId = null">
                      <AppIcon name="close" :size="14" />
                    </button>
                  </template>
                  <template v-else>
                    <button
                      v-if="tableColumns.some((c) => c.editable)"
                      type="button"
                      class="btn btn-ghost btn-xs"
                      title="Tahrirlash"
                      @click="startEdit(row)">
                      <AppIcon name="pencil" :size="14" />
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs text-error"
                      @click="onDelete(row)">
                      <AppIcon name="trash" :size="14" />
                    </button>
                  </template>
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

        <!-- Filiallar kesimida hisobot (faqat katta panellar) -->
        <div v-if="ws.byBranch.length" class="ftw-card p-5">
          <p class="text-xs font-bold uppercase tracking-widest opacity-45">
            Filiallar kesimida hisobot
          </p>
          <div class="mt-3 overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Filial</th>
                  <th class="text-right">Talabalar</th>
                  <th class="text-right">To'lovlar</th>
                  <th class="text-right">Tushum</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="b in ws.byBranch" :key="b.id || 'none'">
                  <td class="font-bold">
                    {{ b.name }}
                    <span v-if="!b.active" class="badge badge-ghost badge-xs ml-1">nofaol</span>
                  </td>
                  <td class="text-right">{{ b.students }}</td>
                  <td class="text-right">{{ b.payments }}</td>
                  <td class="text-right">{{ formatMoney(b.total) }} so'm</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <!-- ====== MARKETING YUBORISH (SMS/Telegram tez xabar) ====== -->
      <template v-else-if="active === 'marketing'">
        <div class="ftw-card space-y-4 p-5">
          <div>
            <h3 class="font-bold">Tez xabar yuborish</h3>
            <p class="mt-0.5 text-sm opacity-60">
              O'quvchilaringizga SMS yoki Telegram orqali xabar tayyorlang —
              har bir o'quvchi uchun yuborish tugmasi shakllanadi.
            </p>
          </div>
          <textarea
            v-model="blastText"
            rows="3"
            class="textarea textarea-bordered w-full rounded-xl text-sm"
            placeholder="Masalan: Assalomu alaykum! Ertaga 15:00 da dars bo'ladi." />
          <p class="text-xs opacity-55">
            {{ blastText.length }} belgi. Kampaniya jadvalda «Rejada» holatida
            saqlanadi.
          </p>

          <div v-if="crmPhones.length" class="space-y-2">
            <p class="text-xs font-bold uppercase tracking-wider opacity-50">
              O'quvchilar ({{ crmPhones.length }})
            </p>
            <div class="max-h-64 space-y-1.5 overflow-y-auto pr-1">
              <div
                v-for="student in crmPhones"
                :key="student.id"
                class="flex items-center gap-3 rounded-xl border border-base-content/10 px-3 py-2">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-bold">{{ student.full_name }}</p>
                  <p class="truncate text-xs opacity-55">{{ student.phone }}</p>
                </div>
                <a
                  :href="smsHref(student.phone, blastText)"
                  class="btn btn-outline btn-xs rounded-lg"
                  title="SMS yuborish">
                  SMS
                </a>
                <a
                  :href="tgHref(student.phone, blastText)"
                  target="_blank"
                  rel="noopener"
                  class="btn btn-primary btn-xs rounded-lg"
                  title="Telegram yuborish">
                  Telegram
                </a>
              </div>
            </div>
            <p class="text-xs leading-relaxed opacity-55">
              Tugma bosilganda telefon ilovasi ochiladi va matn tayyor
              bo'ladi — yuborishni tasdiqlaysiz. Xarajat va qamrov
              kampaniya jadvalida kuzatiladi.
            </p>
          </div>
          <p v-else class="text-sm opacity-55">
            Avval Talabalar bazasiga o'quvchilarni qo'shing — telefonlari
            shu yerda paydo bo'ladi.
          </p>
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
