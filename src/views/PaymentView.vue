<script setup>
import { ref, computed, onMounted } from "vue";
import { useBizStore } from "../stores/biz";
import AppIcon from "../components/AppIcon.vue";

const biz = useBizStore();
const file = ref(null);
const uploading = ref(false);
const message = ref("");
const errorMessage = ref("");

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
  file.value = event.target.files?.[0] || null;
  message.value = "";
  errorMessage.value = "";
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
    message.value = "Chek yuborildi. Admin tasdiqlashini kuting.";
    file.value = null;
  } catch (error) {
    errorMessage.value = error?.message || String(error);
  } finally {
    uploading.value = false;
  }
}

onMounted(() => biz.loadSubscription());
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
          <p class="mt-1 text-lg font-black">150 000 so‘m / oy</p>
        </div>
        <div class="rounded-xl bg-base-200/70 p-4">
          <p class="text-xs opacity-55">Karta raqami</p>
          <p class="mt-1 text-lg font-black tracking-wide">
            8600 **** **** 0000
          </p>
        </div>
      </div>
      <div
        v-if="biz.subscription?.status === 'pending'"
        class="alert alert-info text-sm">
        <AppIcon name="hourglass" :size="18" />
        Chekingiz admin tomonidan tekshirilmoqda.
      </div>
    </section>

    <section class="ftw-card space-y-4 p-5 sm:p-6">
      <div>
        <h3 class="font-bold">To‘lov chekini yuborish</h3>
        <p class="mt-1 text-sm opacity-60">JPG yoki PNG, maksimal 5 MB.</p>
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
