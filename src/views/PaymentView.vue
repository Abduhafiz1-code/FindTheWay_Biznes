<script setup>
import { ref, computed, onMounted } from "vue";
import { useBizStore, calculatePrice } from "../stores/biz";
import { usePanelsStore } from "../stores/panels";
import { supabase } from "../supabase";
import AppIcon from "../components/AppIcon.vue";

const biz = useBizStore();
const panels = usePanelsStore();
const file = ref(null);
const uploading = ref(false);
const message = ref("");
const errorMessage = ref("");
const copied = ref("");

// To'lov rekvizitlari — bazadan (platform_accounts), ishonch uchun
const accounts = ref([]);
async function loadAccounts() {
  const { data } = await supabase
    .from("platform_accounts")
    .select("*")
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("sort", { ascending: true });
  accounts.value = data ?? [];
}

const planLabel = computed(() =>
  (biz.subscription?.plan || "pro").toUpperCase(),
);
const cycleLabel = computed(() =>
  biz.subscription?.billing_cycle === "yearly" ? "yillik" : "oylik",
);
const currentPrice = computed(() =>
  calculatePrice({
    plan: biz.subscription?.plan || "pro",
    cycle: biz.subscription?.billing_cycle || "monthly",
    isExtraCenter: !!biz.subscription?.is_extra_center,
  }),
);

// Panel/modul to'lovi — qaysi mahsulot kutayotganini ko'rsatamiz
const pendingPanel = computed(
  () =>
    panels.mine.find(
      (p) => p.status === "pending" && !p.paid_until && p.receipt_url,
    ) ?? null,
);

const statusLabel = computed(
  () =>
    ({
      trial: "Sinov muddati",
      pending: "Tekshirilmoqda",
      active: "Faol",
      expired: "Tugagan",
    })[biz.subscription?.status] || "Noma’lum",
);

function chooseFile(event) {
  const chosen = event.target.files?.[0] || null;
  message.value = "";
  errorMessage.value = "";
  if (chosen && !chosen.type.startsWith("image/")) {
    errorMessage.value = "Faqat rasm faylini yuklang (JPG, PNG, WebP).";
    file.value = null;
    return;
  }
  if (chosen && chosen.size > 5 * 1024 * 1024) {
    errorMessage.value = "Rasm hajmi 5 MB dan oshmasin.";
    file.value = null;
    return;
  }
  file.value = chosen;
}

async function submitReceipt() {
  if (!file.value) {
    errorMessage.value = "Chek rasmini tanlang.";
    return;
  }
  uploading.value = true;
  message.value = "";
  errorMessage.value = "";
  try {
    await biz.uploadReceipt(file.value);
    message.value =
      "Chek yuborildi va xavfsiz saqlandi. Admin 24 soat ichida tekshiradi — javob shu sahifada ko‘rinadi.";
    file.value = null;
  } catch (error) {
    errorMessage.value = error?.message || String(error);
  } finally {
    uploading.value = false;
  }
}

async function copy(value, key) {
  try {
    await navigator.clipboard.writeText(value);
    copied.value = key;
    setTimeout(() => (copied.value = ""), 1800);
  } catch {
    /* clipboard bloklangan bo'lsa jim o'tamiz */
  }
}

onMounted(() => {
  biz.loadSubscription();
  loadAccounts();
});
</script>

<template>
  <div class="max-w-2xl space-y-6">
    <div>
      <h2 class="text-2xl font-black tracking-tight">Obuna va to‘lov</h2>
      <p class="mt-1 text-sm opacity-60">
        Markazingiz xizmatini uzluksiz davom ettiring.
      </p>
    </div>

    <section class="ftw-card space-y-5 p-5 sm:p-6">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-xs font-bold uppercase tracking-wider opacity-50">
            Joriy holat
          </p>
          <p class="mt-1 text-xl font-black">{{ statusLabel }}</p>
        </div>
        <span class="badge badge-primary"
          >{{ biz.subscriptionDaysLeft ?? "—" }} kun</span
        >
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-xl bg-base-200/70 p-4">
          <p class="text-xs opacity-55">To‘lov uchun</p>
          <p class="mt-1 text-lg font-black">
            {{ currentPrice.toLocaleString("uz-UZ") }} so‘m / {{ cycleLabel }}
          </p>
          <p class="mt-1 text-xs opacity-55">
            {{ planLabel }} ·
            {{
              biz.subscription?.is_extra_center
                ? "Qo‘shimcha markaz"
                : "Birinchi markaz"
            }}
          </p>
        </div>
        <div
          v-if="biz.subscription?.status === 'pending'"
          class="flex flex-col justify-center rounded-xl border border-info/30 bg-info/10 p-4">
          <p class="flex items-center gap-2 text-sm font-bold text-info">
            <AppIcon name="hourglass" :size="16" />
            Chekingiz tekshirilmoqda
          </p>
          <p class="mt-1 text-xs leading-relaxed opacity-70">
            Odatda 24 soat ichida tasdiqlanadi. Tasdiqlanganda obunangiz
            avtomatik uzayadi.
          </p>
        </div>
        <div
          v-else
          class="flex flex-col justify-center rounded-xl border border-base-content/15 bg-base-200/70 p-4">
          <p class="flex items-center gap-2 text-xs font-bold opacity-60">
            <AppIcon name="clock" :size="14" />
            To‘lov muddati
          </p>
          <p class="mt-1 text-sm font-bold">
            {{
              biz.subscription?.paid_until
                ? new Date(biz.subscription.paid_until).toLocaleDateString(
                    "uz-UZ",
                  )
                : "To‘lovdan keyin"
            }}
          </p>
        </div>
      </div>
    </section>

    <!-- ============ RASMIY TO'LOV REKVIZITLARI (bazadan) ============ -->
    <section class="ftw-card space-y-4 p-5 sm:p-6">
      <div class="flex items-start gap-3">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
          <AppIcon name="shield" :size="20" />
        </span>
        <div>
          <h3 class="font-bold">Rasmiy to‘lov rekvizitlari</h3>
          <p class="mt-0.5 text-sm leading-relaxed opacity-60">
            FindTheWay faqat quyidagi hisob raqamlariga to‘lov qabul qiladi.
            Bu ro‘yxat platforma ma’lumotlar bazasida saqlanadi va admin
            tomonidan boshqariladi — boshqa hech qanday karta allaqachon
            yo‘q.
          </p>
        </div>
      </div>

      <div class="space-y-2.5">
        <div
          v-for="account in accounts"
          :key="account.id"
          class="flex items-center gap-3 rounded-xl border bg-base-200/60 p-4"
          :class="
            account.is_primary ? 'border-success/40' : 'border-base-content/12'
          ">
          <div class="min-w-0 flex-1">
            <p class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-55">
              {{ account.label }}
              <span
                v-if="account.is_primary"
                class="badge badge-success badge-xs">asosiy</span>
            </p>
            <p class="mt-1 text-lg font-black tracking-wider">
              {{ account.number }}
            </p>
            <p class="mt-0.5 text-xs opacity-60">
              {{ account.holder }}
              <template v-if="account.bank"> · {{ account.bank }}</template>
            </p>
          </div>
          <button
            type="button"
            class="btn btn-sm"
            :class="copied === account.id ? 'btn-success' : 'btn-outline'"
            @click="copy(account.number, account.id)">
            <AppIcon
              :name="copied === account.id ? 'check' : 'copy'"
              :size="14" />
            {{ copied === account.id ? "Nusxalandi" : "Nusxalash" }}
          </button>
        </div>
      </div>

      <div
        class="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs leading-relaxed">
        <p class="font-bold">To‘lovni faqat shu raqamlarga qiling:</p>
        <ul class="mt-1.5 list-inside list-disc space-y-0.5 opacity-75">
          <li>Kartadan karta raqamini hech kim so‘ramaydi — SMS kodni hech kimga bermang.</li>
          <li>Chekdagi summa panel ko‘rsatgan summa bilan bir xil bo‘lsin.</li>
          <li>Chek yuklangach admin tasdiqlaydi — bu odatda 24 soat ichida.</li>
        </ul>
      </div>
    </section>

    <!-- ============ CHEK YUKLASH ============ -->
    <section class="ftw-card space-y-4 p-5 sm:p-6">
      <div>
        <h3 class="font-bold">To‘lov chekini yuborish</h3>
        <p class="mt-1 text-sm opacity-60">
          JPG yoki PNG, maksimal 5 MB. Chek shaxsiy sahifangizda (private
          storage) saqlanadi — faqat siz va admin ko‘radi.
        </p>
      </div>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        class="file-input file-input-bordered w-full"
        @change="chooseFile" />
      <p v-if="file" class="text-sm opacity-65">
        Tanlangan fayl: {{ file.name }}
      </p>
      <p v-if="message" class="text-sm text-success">{{ message }}</p>
      <p v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</p>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="uploading"
        @click="submitReceipt">
        {{ uploading ? "Yuklanmoqda..." : "Chekni yuborish" }}
      </button>
    </section>
  </div>
</template>
