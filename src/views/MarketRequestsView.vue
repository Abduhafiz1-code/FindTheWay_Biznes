<script setup>
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { RouterLink } from "vue-router";
import { useUiStore } from "../stores/ui";
import { useBizStore } from "../stores/biz";
import { useMarketStore } from "../stores/market";
import AppIcon from "../components/AppIcon.vue";
import EmptyState from "../components/ui/EmptyState.vue";

const ui = useUiStore();
const biz = useBizStore();
const market = useMarketStore();

const tab = ref("board"); // 'board' | 'mine'
const category = ref("all");
const draft = ref("");
const chatBox = ref(null);
const listBox = ref(null);

const CATEGORY_OPTIONS = [
  { key: "language", label: "Til" },
  { key: "it", label: "IT" },
  { key: "math", label: "Matematika" },
  { key: "exam", label: "Imtihon" },
  { key: "design", label: "Dizayn" },
  { key: "business", label: "Biznes" },
  { key: "music", label: "Musiqa" },
  { key: "sport", label: "Sport" },
];

function categoryLabel(key) {
  return CATEGORY_OPTIONS.find((c) => c.key === key)?.label ?? null;
}

const visibleRequests = computed(() => {
  if (category.value === "all") return market.requests;
  return market.requests.filter((r) => r.category === category.value);
});

const active = computed(() => market.activeConversation);

const chatTitle = computed(
  () => active.value?.market_requests?.title ?? "",
);

function shortDate(value) {
  if (!value) return "";
  const d = new Date(value);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" });
}

async function refreshAll() {
  await Promise.all([market.loadBoard(), market.loadConversations()]);
}

async function openRequest(request) {
  draft.value = "";
  try {
    await market.ensureConversation(request);
  } catch (error) {
    market.lastError = error?.message || String(error);
  }
}

async function openConversation(conversation) {
  draft.value = "";
  try {
    await market.openConversation(conversation);
  } catch (error) {
    market.lastError = error?.message || String(error);
  }
}

async function submit() {
  const text = draft.value.trim();
  if (!text || market.sending) return;
  try {
    await market.sendMessage(text);
    draft.value = "";
    await scrollChatDown();
  } catch (error) {
    market.lastError = error?.message || String(error);
  }
}

async function scrollChatDown() {
  await nextTick();
  if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
}

watch(
  () => [market.messages.length, market.activeConversation?.id],
  async () => {
    await scrollChatDown();
  },
);

watch(
  () => biz.center?.id,
  async () => {
    await market.loadConversations();
    if (market.activeConversation) market.activeConversation = null;
    await market.loadBoard();
  },
);

onMounted(async () => {
  await refreshAll();
});
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-2xl font-black tracking-tight">So'rovlar bozori</h2>
        <p class="mt-1 text-sm opacity-60">
          O'quvchilar qidirayotgan kursni topolmasa, shu yerda e'lon qiladi —
          siz javob yozsangiz, u bilan shaxsiy chat ochiladi.
        </p>
      </div>
    </div>

    <p
      v-if="market.lastError"
      class="rounded-xl border border-error/30 bg-error/10 px-3.5 py-2.5 text-sm text-error">
      {{ market.lastError }}
    </p>

    <div
      v-if="!biz.hasCenter"
      class="ftw-card flex flex-wrap items-center gap-4 p-5">
      <EmptyState
        icon="building"
        title="Avval markazingizni yarating"
        text="So'rovlarga javob yozish uchun markaz profili kerak.">
        <RouterLink to="/markazim" class="btn btn-primary btn-sm rounded-xl">
          Markaz yaratish
        </RouterLink>
      </EmptyState>
    </div>

    <template v-else>
      <!-- Yorliqlar -->
      <div class="flex gap-2">
        <button
          type="button"
          class="btn btn-sm rounded-xl"
          :class="tab === 'board' ? 'btn-primary' : 'btn-ghost'"
          @click="tab = 'board'">
          <AppIcon name="search" :size="15" />
          Bozor ({{ market.requests.length }})
        </button>
        <button
          type="button"
          class="btn btn-sm rounded-xl"
          :class="tab === 'mine' ? 'btn-primary' : 'btn-ghost'"
          @click="tab = 'mine'">
          <AppIcon name="message" :size="15" />
          Suhbatlarim ({{ market.conversations.length }})
        </button>
      </div>

      <div class="grid gap-5 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <!-- ============ Chap: ro'yxat ============ -->
        <div
          ref="listBox"
          class="space-y-3"
          :class="active ? 'hidden xl:block' : ''">
          <!-- Yo'nalish filtri (bozor) -->
          <div
            v-if="tab === 'board'"
            class="flex flex-wrap gap-1.5">
            <button
              v-for="cat in [{ key: 'all', label: 'Hammasi' }, ...CATEGORY_OPTIONS]"
              :key="cat.key"
              type="button"
              class="rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors"
              :class="
                category === cat.key
                  ? 'bg-primary text-primary-content'
                  : 'bg-base-content/6 hover:bg-base-content/12'
              "
              @click="category = cat.key">
              {{ cat.label }}
            </button>
          </div>

          <template v-if="tab === 'board'">
            <p
              v-if="!visibleRequests.length"
              class="rounded-xl bg-base-200/50 px-4 py-6 text-center text-sm opacity-60">
              Hozircha ochiq so'rovlar yo'q.
            </p>
            <button
              v-for="request in visibleRequests"
              :key="request.id"
              type="button"
              class="ftw-card w-full p-4 text-left transition-colors hover:bg-base-100"
              :class="
                market.conversationForRequest(request.id) &&
                market.conversationForRequest(request.id).id === active?.id
                  ? 'ring-2 ring-primary/40'
                  : ''
              "
              @click="openRequest(request)">
              <div class="flex items-start gap-3">
                <span
                  class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-black text-primary">
                  {{ (request.student_name || '?').charAt(0).toUpperCase() }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block font-bold leading-snug">{{
                    request.title
                  }}</span>
                  <span
                    v-if="request.description"
                    class="mt-0.5 block line-clamp-2 text-xs leading-relaxed opacity-60">
                    {{ request.description }}
                  </span>
                  <span class="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      v-if="categoryLabel(request.category)"
                      class="badge badge-ghost badge-sm">
                      {{ categoryLabel(request.category) }}
                    </span>
                    <span
                      v-if="request.district"
                      class="badge badge-ghost badge-sm">
                      {{ request.district }}
                    </span>
                    <span class="text-[11px] opacity-45">{{
                      shortDate(request.created_at)
                    }}</span>
                  </span>
                </span>
                <AppIcon
                  v-if="market.conversationForRequest(request.id)"
                  name="message"
                  :size="15"
                  class="mt-1 shrink-0 text-success" />
              </div>
            </button>
          </template>

          <template v-else>
            <p
              v-if="!market.conversations.length"
              class="rounded-xl bg-base-200/50 px-4 py-6 text-center text-sm opacity-60">
              Hozircha suhbatlar yo'q. Bozor yorlig'idan so'rovlarga javob
              yozing.
            </p>
            <button
              v-for="conversation in market.conversations"
              :key="conversation.id"
              type="button"
              class="ftw-card w-full p-4 text-left transition-colors hover:bg-base-100"
              :class="
                conversation.id === active?.id ? 'ring-2 ring-primary/40' : ''
              "
              @click="openConversation(conversation)">
              <div class="flex items-center gap-3">
                <span
                  class="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/12 text-xs font-black text-success">
                  {{
                    (conversation.market_requests?.student_name || '?')
                      .charAt(0)
                      .toUpperCase()
                  }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-bold">{{
                    conversation.market_requests?.title
                  }}</span>
                  <span class="block text-xs opacity-55">
                    {{
                      conversation.market_requests?.student_name ||
                      "O'quvchi"
                    }}
                    · {{ shortDate(conversation.last_message_at) }}
                  </span>
                </span>
              </div>
            </button>
          </template>
        </div>

        <!-- ============ O'ng: chat ============ -->
        <div
          v-if="active"
          class="ftw-card flex h-[72vh] flex-col overflow-hidden xl:sticky xl:top-20">
          <!-- Chat sarlavhasi -->
          <div class="flex items-center gap-3 border-b border-base-content/10 p-4">
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-circle xl:hidden"
              @click="market.activeConversation = null">
              <AppIcon name="arrowLeft" :size="17" />
            </button>
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-black text-primary">
              {{
                (active.market_requests?.student_name || '?').charAt(0).toUpperCase()
              }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold">{{ chatTitle }}</p>
              <p class="truncate text-xs opacity-55">
                {{ active.market_requests?.student_name }}
                <a
                  v-if="active.market_requests?.student_phone"
                  :href="`tel:${active.market_requests.student_phone}`"
                  class="font-bold text-primary">
                  · {{ active.market_requests.student_phone }}
                </a>
              </p>
            </div>
          </div>

          <!-- Xabarlar -->
          <div
            ref="chatBox"
            class="flex-1 space-y-3 overflow-y-auto bg-base-200/30 p-4">
            <p
              v-if="!market.messages.length"
              class="py-10 text-center text-sm opacity-50">
              Suhbat boshlandi. O'quvchiga savolingiz yoki taklifingizni
              yozing.
            </p>
            <div
              v-for="message in market.messages"
              :key="message.id"
              class="flex"
              :class="message.sender_name === biz.center?.name ? 'justify-end' : 'justify-start'">
              <div
                class="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                :class="
                  message.sender_name === biz.center?.name
                    ? 'rounded-br-md bg-primary text-primary-content'
                    : 'rounded-bl-md bg-base-100'
                ">
                <p class="whitespace-pre-wrap">{{ message.message }}</p>
                <p
                  class="mt-1 text-[10px]"
                  :class="
                    message.sender_name === biz.center?.name
                      ? 'opacity-60'
                      : 'opacity-40'
                  ">
                  {{ shortDate(message.created_at) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Yozish -->
          <form
            class="flex items-end gap-2 border-t border-base-content/10 p-3"
            @submit.prevent="submit">
            <textarea
              v-model="draft"
              rows="1"
              class="textarea textarea-bordered max-h-28 flex-1 resize-none rounded-xl text-sm"
              placeholder="Xabar yozing… (Enter — yuborish, Shift+Enter — qator)"
              @keydown.enter.exact.prevent="submit" />
            <button
              type="submit"
              class="btn btn-primary btn-circle shrink-0"
              :disabled="!draft.trim() || market.sending">
              <span v-if="market.sending" class="loading loading-spinner loading-sm" />
              <AppIcon v-else name="send" :size="16" />
            </button>
          </form>
        </div>

        <!-- O'ng: bo'sh holat -->
        <div
          v-else
          class="ftw-card hidden items-center justify-center xl:flex">
          <EmptyState
            icon="message"
            title="Suhbatni tanlang"
            text="Chapdagi ro'yxatdan so'rovni oching yoki suhbatlaringizni ko'ring." />
        </div>
      </div>
    </template>
  </div>
</template>
