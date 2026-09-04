<script setup>
import { ref, computed, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useUiStore } from "../stores/ui";
import { useAuthStore } from "../stores/auth";
import { useBizStore } from "../stores/biz";
import { useMarketStore } from "../stores/market";
import { useInquiriesStore } from "../stores/inquiries";
import { useSupportStore } from "../stores/support";
import { useModulesStore } from "../stores/modules";
import AppIcon from "../components/AppIcon.vue";
import BaseDropdown from "../components/BaseDropdown.vue";
import LocaleSwitcher from "../components/LocaleSwitcher.vue";
import ThemeSwitcher from "../components/ThemeSwitcher.vue";

const ui = useUiStore();
const auth = useAuthStore();
const biz = useBizStore();
const market = useMarketStore();
const inquiries = useInquiriesStore();
const supportStore = useSupportStore();
const moduleStore = useModulesStore();
const route = useRoute();
const router = useRouter();

const mobileOpen = ref(false);

const links = [
  { to: "/", icon: "dashboard", key: "nav.dashboard" },
  { to: "/arizalar", icon: "inbox", key: "nav.applications", badge: true },
  { to: "/murojaatlar", icon: "mail", key: "nav.inquiries" },
  { to: "/so-rovlar", icon: "message", key: "nav.market" },
  { to: "/markazim", icon: "building", key: "nav.center" },
  { to: "/kurslar", icon: "book", key: "nav.courses" },
  { to: "/ai-yordamchi", icon: "sparkles", key: "nav.aiAssistant" },
  { to: "/modullar", icon: "ticket", key: "nav.modules" },
  { to: "/sozlamalar", icon: "settings", key: "nav.settings" },
  { to: "/to-lov", icon: "wallet", key: "nav.payment" },
];

const pageTitle = computed(() => ui.t(route.meta?.titleKey ?? "nav.dashboard"));

const initials = computed(() => {
  const name = auth.displayName || "F";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
});

// -------------------------------------------------------------
// Markazlar ro'yxati (switcher) uchun yordamchilar
// -------------------------------------------------------------
function daysLeft(dateValue) {
  if (!dateValue) return null;
  return Math.ceil((new Date(dateValue) - new Date()) / 86400000);
}

function statusInfo(center) {
  if (!center) return { text: "", dot: "bg-base-content/25" };
  const s = center.subscription_status;
  const end = s === "active" ? center.paid_until : center.trial_ends_at;
  const days = daysLeft(end);

  if (s === "active") {
    if (days === null) return { text: "Faol", dot: "bg-success" };
    if (days <= 0)
      return { text: "Obuna tugagan — to'lov qiling", dot: "bg-error" };
    return {
      text: days <= 5 ? `Faol · ${days} kun qoldi` : "Faol",
      dot: days <= 5 ? "bg-warning" : "bg-success",
    };
  }
  if (s === "trial") {
    if (days <= 0)
      return { text: "Sinov tugadi — to'lov qiling", dot: "bg-error" };
    return {
      text: `Sinov · ${days} kun qoldi`,
      dot: days <= 5 ? "bg-warning" : "bg-info",
    };
  }
  if (s === "pending")
    return { text: "Chek tekshirilmoqda", dot: "bg-info" };
  if (s === "expired")
    return { text: "To'lov qiling", dot: "bg-error" };
  return { text: "Holat aniqlanmoqda", dot: "bg-base-content/25" };
}

async function handleSwitchCenter(centerId) {
  await biz.selectCenter(centerId);
  mobileOpen.value = false;
}

function handleAddCenter() {
  biz.beginCreateCenter();
  mobileOpen.value = false;
  router.push("/markazim");
}

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false;
  },
);

async function handleLogout() {
  try {
    await auth.signOut();
  } finally {
    biz.reset();
    market.reset();
    inquiries.reset();
    supportStore.reset();
    moduleStore.reset();
    router.push("/login");
  }
}
</script>

<template>
  <div class="min-h-dvh bg-base-200/40">
    <!-- Mobil uchun qorong'i fon -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0">
      <div
        v-if="mobileOpen"
        class="fixed inset-0 z-40 bg-black/50 lg:hidden"
        @click="mobileOpen = false" />
    </Transition>

    <!-- Yon panel -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-base-content/10 bg-base-100 transition-transform duration-300 lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      ]">
      <div class="flex items-center justify-between px-5 py-5">
        <RouterLink to="/" class="flex items-center gap-2.5">
          <span
            class="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-content">
            <AppIcon name="compass" :size="19" />
          </span>
          <span class="text-[15px] font-extrabold leading-tight tracking-tight">
            {{ ui.t("brand.name") }}
            <span
              class="block text-[11px] font-bold uppercase tracking-widest text-primary">
              {{ ui.t("brand.suffix") }}
            </span>
          </span>
        </RouterLink>
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-circle lg:hidden"
          @click="mobileOpen = false">
          <AppIcon name="close" :size="18" />
        </button>
      </div>

      <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          :class="
            route.path === link.to
              ? 'bg-primary/12 text-primary'
              : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
          ">
          <AppIcon :name="link.icon" :size="18" />
          <span class="flex-1">{{ ui.t(link.key) }}</span>
          <span
            v-if="link.badge && biz.newCount"
            class="badge badge-primary badge-sm font-bold">
            {{ biz.newCount }}
          </span>
        </RouterLink>
      </nav>

      <!-- Markazlar (switcher) -->
      <div class="space-y-2 px-3 pb-3">
        <template v-if="biz.centers.length">
          <p
            class="px-1 text-[10px] font-bold uppercase tracking-widest opacity-40">
            Markazlarim
          </p>
          <ul class="space-y-1.5">
            <li v-for="centerItem in biz.centers" :key="centerItem.id">
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors"
                :class="
                  centerItem.id === biz.center?.id
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-transparent hover:bg-base-200/80'
                "
                @click="handleSwitchCenter(centerItem.id)">
                <span
                  class="size-2 shrink-0 rounded-full"
                  :class="statusInfo(centerItem).dot" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[13px] font-bold">{{
                    centerItem.name
                  }}</span>
                  <span
                    class="block truncate text-[11px] leading-tight opacity-60">
                    {{ statusInfo(centerItem).text }}
                  </span>
                </span>
                <span
                  v-if="centerItem.is_extra_center"
                  class="badge badge-ghost badge-xs shrink-0 opacity-70">
                  qo'shimcha
                </span>
                <AppIcon
                  v-if="centerItem.id === biz.center?.id"
                  name="check"
                  :size="14"
                  class="shrink-0 text-primary" />
              </button>
            </li>
          </ul>
          <button
            type="button"
            class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
            @click="handleAddCenter">
            <AppIcon name="plus" :size="14" />
            Yangi markaz qo'shish
          </button>
        </template>

        <RouterLink
          v-else
          to="/markazim"
          class="block rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-3.5 text-xs leading-relaxed transition-colors hover:bg-primary/10">
          <span class="font-bold text-primary">{{
            ui.t("center.createCenter")
          }}</span>
          <span class="mt-1 block opacity-65">{{
            ui.t("center.noCenterHint")
          }}</span>
        </RouterLink>
      </div>

      <div class="border-t border-base-content/10 p-3">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-base-content/70 transition-colors hover:bg-error/10 hover:text-error"
          @click="handleLogout">
          <AppIcon name="logout" :size="18" />
          {{ ui.t("nav.logout") }}
        </button>
      </div>
    </aside>

    <!-- Asosiy qism -->
    <div class="lg:pl-[264px]">
      <header
        class="sticky top-0 z-30 flex items-center gap-3 border-b border-base-content/10 bg-base-100/85 px-4 py-3 backdrop-blur sm:px-6">
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-circle lg:hidden"
          :aria-label="ui.t('nav.menu')"
          @click.stop="mobileOpen = true">
          <AppIcon name="menu" :size="20" />
        </button>

        <h1
          class="flex-1 truncate text-base font-bold tracking-tight sm:text-lg">
          {{ pageTitle }}
        </h1>

        <RouterLink
          to="/arizalar"
          class="btn btn-ghost btn-sm btn-circle relative"
          :aria-label="ui.t('nav.applications')">
          <AppIcon name="bell" :size="18" />
          <span
            v-if="biz.newCount"
            class="absolute right-1 top-1 size-2 rounded-full bg-primary ring-2 ring-base-100" />
        </RouterLink>

        <LocaleSwitcher />
        <ThemeSwitcher />

        <BaseDropdown width="w-64">
          <template #trigger>
            <span
              class="flex size-7 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
              {{ initials }}
            </span>
            <AppIcon name="chevronDown" :size="14" class="opacity-60" />
          </template>

          <div class="border-b border-base-content/10 px-3 pb-2.5 pt-2">
            <p class="truncate text-sm font-bold">{{ auth.displayName }}</p>
            <p class="truncate text-xs opacity-60">{{ auth.user?.email }}</p>
          </div>
          <RouterLink
            to="/sozlamalar"
            class="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-base-200">
            <AppIcon name="settings" :size="16" />
            {{ ui.t("nav.settings") }}
          </RouterLink>
          <RouterLink
            to="/yordam"
            class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-base-200">
            <AppIcon name="mail" :size="16" />
            Yordam
          </RouterLink>
          <button
            type="button"
            class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-error transition-colors hover:bg-error/10"
            @click="handleLogout">
            <AppIcon name="logout" :size="16" />
            {{ ui.t("nav.logout") }}
          </button>
        </BaseDropdown>
      </header>

      <main class="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
        <slot />
      </main>
    </div>
  </div>
</template>
