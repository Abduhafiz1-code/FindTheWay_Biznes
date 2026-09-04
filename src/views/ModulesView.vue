<script setup>
import { reactive, watch, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { useBizStore } from "../stores/biz";
import { useModulesStore } from "../stores/modules";
import AppIcon from "../components/AppIcon.vue";
import EmptyState from "../components/ui/EmptyState.vue";

const biz = useBizStore();
const modules = useModulesStore();

const files = reactive({});
const buying = reactive({});
const messages = reactive({});

function chooseFile(event, module) {
  files[module.id] = event.target.files?.[0] || null;
  messages[module.id] = "";
}

function statusOf(module) {
  if (modules.isActive(module.id)) return "active";
  const row = modules.getModule(module.id);
  if (row?.status === "pending") return "pending";
  if (row?.status === "expired") return "expired";
  return "none";
}

async function startBuy(module) {
  buying[module.id] = true;
  messages[module.id] = "";
}

async function sendReceipt(module) {
  const file = files[module.id];
  if (!file) {
    messages[module.id] = "Chek rasmini tanlang.";
    return;
  }
  messages[module.id] = "";
  try {
    await modules.uploadReceipt(file, module.id);
    messages[module.id] = "Chek yuborildi. Admin tasdiqlashini kuting.";
    buying[module.id] = false;
    files[module.id] = null;
  } catch (error) {
    messages[module.id] = error?.message || String(error);
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
    await modules.loadMine();
    await modules.loadCatalog();
  },
);

onMounted(async () => {
  await Promise.all([modules.loadCatalog(), modules.loadMine()]);
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-black tracking-tight">Modullar do'koni</h2>
      <p class="mt-1 text-sm opacity-60">
        Tayyor panel-imkoniyatlar — har biri alohida sotib olinadi va faqat
        sizning markazingizga tegishli (ma'lumotlar boshqa markazga
        aralashmaydi).
      </p>
    </div>

    <div
      v-if="!biz.hasCenter"
      class="ftw-card p-5">
      <EmptyState
        icon="building"
        title="Avval markazingizni yarating"
        text="Modul sotib olish uchun markaz profili kerak.">
        <RouterLink to="/markazim" class="btn btn-primary btn-sm rounded-xl">
          Markaz yaratish
        </RouterLink>
      </EmptyState>
    </div>

    <template v-else>
      <div
        v-if="modules.activeCount"
        class="flex items-center gap-2 rounded-2xl border border-success/25 bg-success/8 px-4 py-3 text-sm">
        <AppIcon name="checkCircle" :size="17" class="text-success" />
        <span class="font-bold">Faol modullar: {{ modules.activeCount }} ta</span>
      </div>

      <p v-if="modules.lastError" class="text-sm text-error">
        {{ modules.lastError }}
      </p>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="module in modules.catalog"
          :key="module.id"
          class="ftw-card flex flex-col rounded-2xl p-5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="text-base font-extrabold tracking-tight">{{ module.name }}</h3>
              <p class="mt-0.5 text-xs font-semibold opacity-60">{{ module.short }}</p>
            </div>
            <span
              v-if="statusOf(module) === 'active'"
              class="badge badge-success shrink-0">Faol</span>
            <span
              v-else-if="statusOf(module) === 'pending'"
              class="badge badge-info shrink-0">Tekshirilmoqda</span>
            <span
              v-else-if="statusOf(module) === 'expired'"
              class="badge badge-warning shrink-0">Muddati tugagan</span>
          </div>

          <p class="mt-3 text-sm leading-relaxed opacity-70">
            {{ module.description }}
          </p>

          <ul class="mt-3 space-y-1.5">
            <li
              v-for="feature in module.features"
              :key="feature"
              class="flex items-start gap-2 text-xs opacity-75">
              <AppIcon name="check" :size="13" class="mt-0.5 shrink-0 text-success" />
              {{ feature }}
            </li>
          </ul>

          <div class="mt-auto pt-4">
            <p class="text-lg font-black">
              {{ formatPrice(module.price_monthly) }}
              <span class="text-[11px] font-semibold opacity-50">so'm / oy</span>
            </p>

            <!-- Faol: davr oxiri -->
            <p
              v-if="statusOf(module) === 'active'"
              class="mt-1 text-[11px] opacity-50">
              {{
                modules.getModule(module.id)?.paid_until
                  ? 'Amal qilish muddati: ' +
                    formatUntil(modules.getModule(module.id).paid_until)
                  : 'Faol'
              }}
            </p>

            <!-- Sotib olish -->
            <div v-else-if="!buying[module.id]" class="mt-3">
              <button
                type="button"
                class="btn btn-primary btn-sm w-full rounded-xl"
                @click="startBuy(module)">
                <AppIcon name="ticket" :size="14" />
                {{
                  statusOf(module) === 'pending'
                    ? 'Chek yuklash'
                    : statusOf(module) === 'expired'
                      ? 'Qayta faollashtirish'
                      : 'Sotib olish'
                }}
              </button>
            </div>

            <!-- Chek yuklash formasi -->
            <div v-else class="mt-3 space-y-2">
              <label
                class="btn btn-outline btn-sm w-full rounded-xl"
                :class="files[module.id] ? 'btn-primary' : ''">
                {{ files[module.id] ? 'Fayl tanlandi ✓' : 'Chek rasmini tanlang' }}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  class="hidden"
                  @change="chooseFile($event, module)" />
              </label>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="btn btn-primary btn-sm flex-1 rounded-xl"
                  :disabled="!files[module.id]"
                  @click="sendReceipt(module)">
                  Yuborish
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm rounded-xl"
                  @click="buying[module.id] = false">
                  Bekor qilish
                </button>
              </div>
              <p class="text-[11px] opacity-55">
                {{
                  formatPrice(module.price_monthly)
                }} so'm to'lab, chek rasmini yuboring — admin tasdiqlaydi.
              </p>
            </div>

            <p
              v-if="messages[module.id]"
              class="mt-2 text-xs"
              :class="
                String(messages[module.id]).includes('Xatolik') ||
                String(messages[module.id]).includes('xatolik')
                  ? 'text-error'
                  : 'text-success'
              ">
              {{ messages[module.id] }}
            </p>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>
