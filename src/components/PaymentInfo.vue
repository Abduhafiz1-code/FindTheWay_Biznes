<script setup>
import { ref, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { supabase } from "../supabase";
import AppIcon from "./AppIcon.vue";

// Rasmiy to'lov rekvizitlari — bazadan (platform_accounts).
// Do'kon sahifalari (Modullar, Panellar) xarid paytida shu
// komponent orqali karta raqamini ko'rsatadi.
const props = defineProps({
  amount: { type: Number, default: 0 },
  compact: { type: Boolean, default: true },
});

const accounts = ref([]);
const copied = ref("");
const loading = ref(true);

async function loadAccounts() {
  const { data } = await supabase
    .from("platform_accounts")
    .select("*")
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("sort", { ascending: true });
  accounts.value = data ?? [];
  loading.value = false;
}

async function copy(value, key) {
  try {
    await navigator.clipboard.writeText(value);
    copied.value = key;
    setTimeout(() => (copied.value = ""), 1800);
  } catch {
    /* clipboard mavjud bo'lmasa jim o'tamiz */
  }
}

onMounted(loadAccounts);
</script>

<template>
  <div
    class="rounded-xl border border-success/30 bg-success/8 p-3.5 text-left">
    <p
      class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-success">
      <AppIcon name="shield" :size="13" />
      Rasmiy to'lov kartasi
    </p>

    <p v-if="loading" class="mt-1.5 text-xs opacity-50">
      Kartalar yuklanmoqda...
    </p>

    <template v-else>
      <div
        v-for="account in accounts"
        :key="account.id"
        class="mt-2 flex items-center gap-2">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-black tracking-wider">
            {{ account.number }}
          </p>
          <p class="truncate text-[11px] opacity-60">
            {{ account.holder }}<template v-if="account.bank"> · {{ account.bank }}</template>
          </p>
        </div>
        <button
          type="button"
          class="btn btn-xs"
          :class="copied === account.id ? 'btn-success' : 'btn-outline'"
          @click="copy(account.number, account.id)">
          <AppIcon :name="copied === account.id ? 'check' : 'copy'" :size="12" />
          {{ copied === account.id ? "Nusxa" : "Nusxalash" }}
        </button>
      </div>

      <p v-if="!accounts.length" class="mt-2 text-xs text-warning">
        To'lov kartalari hozircha kiritilmagan — admin paneldan qo'shing
        yoki <RouterLink to="/to-lov" class="font-bold">To'lov</RouterLink>
        sahifasini kuzatib turing.
      </p>

      <div v-if="amount" class="mt-2.5 border-t border-success/20 pt-2">
        <p class="text-[11px] leading-relaxed opacity-70">
          Aynan <span class="font-black text-base-content">{{ Number(amount).toLocaleString("uz-UZ") }} so'm</span>
          ko'rinishida o'tkazing va chek rasmini yuklang. Summa farq qilsa
          admin rad etishi mumkin.
        </p>
      </div>

      <p class="mt-1.5 text-[11px] leading-relaxed opacity-60">
        Hech kim sizdan SMS kod yoki parol so'ramaydi. To'lov faqat shu
        sahifadagi raqamga bo'ladi.
      </p>

      <RouterLink
        v-if="compact"
        to="/to-lov"
        class="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-success hover:underline">
        Xavfsizlik va batafsil ma'lumot
        <AppIcon name="arrowRight" :size="11" />
      </RouterLink>
    </template>
  </div>
</template>
