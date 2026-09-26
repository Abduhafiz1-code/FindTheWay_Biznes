<script setup>
import { reactive, watch, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { useBizStore } from "../stores/biz";
import { usePanelsStore } from "../stores/panels";
import { TOOLS, TOOL_ORDER } from "../stores/panelTools";
import AppIcon from "../components/AppIcon.vue";
import EmptyState from "../components/ui/EmptyState.vue";

const biz = useBizStore();
const panels = usePanelsStore();

const files = reactive({});
const buying = reactive({});
const messages = reactive({});

const TIERS = [
  { key: "mini", label: "Mini", cls: "badge-ghost" },
  { key: "small", label: "Kichik", cls: "badge-info" },
  { key: "medium", label: "O'rta", cls: "badge-primary" },
  { key: "large", label: "Katta", cls: "badge-secondary" },
  { key: "flagship", label: "Flagman", cls: "badge-warning" },
];

function tierOf(panel) {
  return TIERS.find((t) => t.key === panel.tier) ?? TIERS[2];
}

function toolNames(panel) {
  return (panel.tools ?? [])
    .map((key) => TOOLS[key]?.label)
    .filter(Boolean);
}

function chooseFile(event, panel) {
  files[panel.id] = event.target.files?.[0] || null;
  messages[panel.id] = "";
}

function statusOf(panel) {
  if (panels.isActive(panel.id)) return "active";
  const row = panels.getPanel(panel.id);
  if (row?.status === "pending") return "pending";
  if (row?.status === "expired") return "expired";
  return "none";
}

function startBuy(panel) {
  buying[panel.id] = true;
  messages[panel.id] = "";
}

async function sendReceipt(panel) {
  const file = files[panel.id];
  if (!file) {
    messages[panel.id] = "Chek rasmini tanlang.";
    return;
  }
  messages[panel.id] = "";
  try {
    await panels.uploadReceipt(file, panel.id);
    messages[panel.id] = "Chek yuborildi. Admin tasdiqlashini kuting.";
    buying[panel.id] = false;
    files[panel.id] = null;
  } catch (error) {
    messages[panel.id] = error?.message || String(error);
  }
}

function formatPrice(value) {
  return Number(value ?? 0).toLocaleString("uz-UZ");
}

function formatUntil(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("uz-UZ");
}

watch(
  () => biz.center?.id,
  async () => {
    await panels.loadMine();
    await panels.loadCatalog();
  },
);

onMounted(async () => {
  await Promise.all([panels.loadCatalog(), panels.loadMine()]);
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-black tracking-tight">Tayyor admin panellar</h2>
      <p class="mt-1 text-sm opacity-60">
        To'liq tayyor panellar — kattadan kichikgacha 10 daraja. Har bir panel
        o'z funksiyalari va rollari bilan farq qiladi; sotib olingach ish
        maydonlari ochiladi. Bir xil panelni ko'p markaz sotib olsa ham
        ma'lumotlar aralashmaydi.
      </p>
    </div>

    <div v-if="!biz.hasCenter" class="ftw-card p-5">
      <EmptyState
        icon="building"
        title="Avval markazingizni yarating"
        text="Panel sotib olish uchun markaz profili kerak.">
        <RouterLink to="/markazim" class="btn btn-primary btn-sm rounded-xl">
          Markaz yaratish
        </RouterLink>
      </EmptyState>
    </div>

    <template v-else>
      <div
        v-if="panels.activeCount"
        class="flex items-center gap-2 rounded-2xl border border-success/25 bg-success/8 px-4 py-3 text-sm">
        <AppIcon name="checkCircle" :size="17" class="text-success" />
        <span class="font-bold">Faol panellar: {{ panels.activeCount }} ta</span>
        <RouterLink to="/panelim" class="btn btn-primary btn-xs ml-auto rounded-xl">
          Panelimga o'tish
        </RouterLink>
      </div>

      <p v-if="panels.lastError" class="text-sm text-error">
        {{ panels.lastError }}
      </p>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="panel in panels.catalog"
          :key="panel.id"
          class="ftw-card flex flex-col rounded-2xl p-5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-1.5">
                <h3 class="text-base font-extrabold tracking-tight">
                  {{ panel.name }}
                </h3>
                <span class="badge badge-sm shrink-0" :class="tierOf(panel).cls">
                  {{ tierOf(panel).label }}
                </span>
              </div>
              <p class="mt-0.5 text-xs font-semibold opacity-60">
                {{ panel.short }}
              </p>
            </div>
            <span v-if="statusOf(panel) === 'active'" class="badge badge-success shrink-0">Faol</span>
            <span v-else-if="statusOf(panel) === 'pending'" class="badge badge-info shrink-0">Tekshirilmoqda</span>
            <span v-else-if="statusOf(panel) === 'expired'" class="badge badge-warning shrink-0">Muddati tugagan</span>
          </div>

          <p class="mt-3 text-sm leading-relaxed opacity-70">
            {{ panel.description }}
          </p>

          <!-- Rollar -->
          <div v-if="panel.roles?.length" class="mt-3 flex flex-wrap gap-1.5">
            <span
              v-for="role in panel.roles"
              :key="role"
              class="badge badge-outline badge-xs">
              {{ role }}
            </span>
          </div>

          <!-- Ish maydonlari -->
          <div v-if="toolNames(panel).length" class="mt-3">
            <p class="text-[10px] font-bold uppercase tracking-widest opacity-45">
              Ish maydonlari
            </p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <span
                v-for="name in toolNames(panel)"
                :key="name"
                class="badge badge-ghost badge-sm">
                {{ name }}
              </span>
            </div>
          </div>

          <ul class="mt-3 space-y-1.5">
            <li
              v-for="feature in panel.features"
              :key="feature"
              class="flex items-start gap-2 text-xs opacity-75">
              <AppIcon name="check" :size="13" class="mt-0.5 shrink-0 text-success" />
              {{ feature }}
            </li>
          </ul>

          <div class="mt-auto pt-4">
            <p class="text-lg font-black">
              {{ formatPrice(panel.price_monthly) }}
              <span class="text-[11px] font-semibold opacity-50">so'm / oy</span>
            </p>

            <p
              v-if="statusOf(panel) === 'active'"
              class="mt-1 text-[11px] opacity-50">
              {{
                panels.getPanel(panel.id)?.paid_until
                  ? "Amal qilish muddati: " + formatUntil(panels.getPanel(panel.id).paid_until)
                  : "Faol"
              }}
            </p>

            <div v-else-if="!buying[panel.id]" class="mt-3">
              <button
                type="button"
                class="btn btn-primary btn-sm w-full rounded-xl"
                @click="startBuy(panel)">
                <AppIcon name="briefcase" :size="14" />
                {{
                  statusOf(panel) === "pending"
                    ? "Chek yuklash"
                    : statusOf(panel) === "expired"
                      ? "Qayta faollashtirish"
                      : "Sotib olish"
                }}
              </button>
            </div>

            <div v-else class="mt-3 space-y-2">
              <label
                class="btn btn-outline btn-sm w-full rounded-xl"
                :class="files[panel.id] ? 'btn-primary' : ''">
                {{ files[panel.id] ? "Fayl tanlandi ✓" : "Chek rasmini tanlang" }}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  class="hidden"
                  @change="chooseFile($event, panel)" />
              </label>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="btn btn-primary btn-sm flex-1 rounded-xl"
                  :disabled="!files[panel.id]"
                  @click="sendReceipt(panel)">
                  Yuborish
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm rounded-xl"
                  @click="buying[panel.id] = false">
                  Bekor qilish
                </button>
              </div>
              <p class="text-[11px] opacity-55">
                {{ formatPrice(panel.price_monthly) }} so'm to'lab, chek rasmini
                yuboring — admin tasdiqlaydi.
              </p>
            </div>

            <p
              v-if="messages[panel.id]"
              class="mt-2 text-xs"
              :class="
                String(messages[panel.id]).includes('xatolik') ||
                String(messages[panel.id]).includes('Xatolik')
                  ? 'text-error'
                  : 'text-success'
              ">
              {{ messages[panel.id] }}
            </p>
          </div>
        </article>
      </div>

      <div class="ftw-card p-5 text-sm leading-relaxed opacity-70">
        <p class="font-bold text-base-content">Qanday ishlaydi?</p>
        <ol class="mt-2 list-decimal space-y-1 pl-5">
          <li>Markazga mos panelni tanlang va «Sotib olish»ni bosing.</li>
          <li>To'lov chekining rasmini yuboring — admin tasdiqlaydi.</li>
          <li>
            Tasdiqlangach panel faollashadi va
            <RouterLink to="/panelim" class="font-bold text-primary">Panelim</RouterLink>
            sahifasida ish maydonlari ochiladi (CRM, kassa, jadval, davomat,
            test, marketing, materiallar, analitika, audit).
          </li>
          <li>
            Bir xil panelni boshqa markaz ham sotib olsa — ma'lumotlar
            center_id bo'yicha ajratiladi, aralashmaydi.
          </li>
        </ol>
      </div>
    </template>
  </div>
</template>
