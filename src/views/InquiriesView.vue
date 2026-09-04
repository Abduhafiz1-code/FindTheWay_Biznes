<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { RouterLink } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useBizStore } from "../stores/biz";
import { useInquiriesStore } from "../stores/inquiries";
import AppIcon from "../components/AppIcon.vue";
import EmptyState from "../components/ui/EmptyState.vue";

const auth = useAuthStore();
const biz = useBizStore();
const inquiries = useInquiriesStore();

const draft = ref("");
const chatBox = ref(null);

const STATUS_META = {
  open: { label: "Yangi", badge: "badge-primary" },
  in_progress: { label: "Jarayonda", badge: "badge-info" },
  resolved: { label: "Hal qilindi", badge: "badge-success" },
  closed: { label: "Yopilgan", badge: "badge-ghost" },
};

const openThreads = computed(
  () => inquiries.threads.filter((t) => t.status === "open" || t.status === "in_progress").length,
);
const active = computed(() => inquiries.activeThread);
const closedThread = computed(() => active.value?.status === "closed");

const isMine = (message) =>
  message.sender_name === biz.center?.name ||
  message.sender_id === auth.user?.id;

function shortDate(value) {
  if (!value) return "";
  const d = new Date(value);
  const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" });
}

async function refreshAll() {
  await inquiries.loadThreads();
  inquiries.subscribeNewThreads();
}

async function openThread(thread) {
  draft.value = "";
  await inquiries.openThread(thread);
  await scrollDown();
}

async function submit() {
  const text = draft.value.trim();
  if (!text || inquiries.sending || closedThread.value) return;
  try {
    await inquiries.sendMessage(text);
    draft.value = "";
    await scrollDown();
  } catch (error) {
    inquiries.lastError = error?.message || String(error);
  }
}

async function changeStatus(status) {
  if (!active.value) return;
  try {
    await inquiries.setStatus(active.value.id, status);
  } catch (error) {
    inquiries.lastError = error?.message || String(error);
  }
}

async function scrollDown() {
  await nextTick();
  if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
}

watch(
  () => [inquiries.messages.length, inquiries.activeThread?.id],
  async () => {
    await scrollDown();
  },
);

watch(
  () => biz.center?.id,
  async () => {
    inquiries.unsubscribeAll();
    inquiries.activeThread = null;
    await refreshAll();
  },
);

onMounted(refreshAll);
onUnmounted(() => inquiries.unsubscribeAll());
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-2xl font-black tracking-tight">Murojaatlar</h2>
        <p class="mt-1 text-sm opacity-60">
          O'quvchilar markaz sahifasida shu yerda savol beradi — chat orqali
          javob bering.
        </p>
      </div>
      <span
        v-if="openThreads"
        class="badge badge-primary">
        {{ openThreads }} ta ochiq
      </span>
    </div>

    <p
      v-if="inquiries.lastError"
      class="rounded-xl border border-error/30 bg-error/10 px-3.5 py-2.5 text-sm text-error">
      {{ inquiries.lastError }}
    </p>

    <div
      v-if="!biz.hasCenter"
      class="ftw-card p-5">
      <EmptyState
        icon="building"
        title="Avval markazingizni yarating"
        text="O'quvchilar savollari markaz profili bilan birga keladi.">
        <RouterLink to="/markazim" class="btn btn-primary btn-sm rounded-xl">
          Markaz yaratish
        </RouterLink>
      </EmptyState>
    </div>

    <div
      v-else
      class="grid gap-5 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      <!-- Ro'yxat -->
      <div class="space-y-3" :class="active ? 'hidden xl:block' : ''">
        <p
          v-if="!inquiries.threads.length"
          class="rounded-xl bg-base-200/50 px-4 py-6 text-center text-sm opacity-60">
          Hozircha murojaatlar yo'q.
        </p>
        <button
          v-for="thread in inquiries.threads"
          :key="thread.id"
          type="button"
          class="ftw-card w-full p-4 text-left transition-colors hover:bg-base-100"
          :class="thread.id === active?.id ? 'ring-2 ring-primary/40' : ''"
          @click="openThread(thread)">
          <div class="flex items-start gap-3">
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-black text-primary">
              {{ (thread.student_name || '?').charAt(0).toUpperCase() }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-bold">{{
                thread.title
              }}</span>
              <span class="mt-0.5 block truncate text-xs opacity-55">
                {{ thread.student_name || "O'quvchi" }}
              </span>
              <span class="mt-1.5 flex items-center gap-2">
                <span
                  class="badge badge-sm font-semibold"
                  :class="(STATUS_META[thread.status] ?? STATUS_META.open).badge">
                  {{ (STATUS_META[thread.status] ?? STATUS_META.open).label }}
                </span>
                <span class="text-[11px] opacity-45">{{
                  shortDate(thread.updated_at)
                }}</span>
              </span>
            </span>
          </div>
        </button>
      </div>

      <!-- Chat -->
      <div
        v-if="active"
        class="ftw-card flex h-[72vh] flex-col overflow-hidden xl:sticky xl:top-20">
        <div class="flex items-center gap-3 border-b border-base-content/10 p-4">
          <button
            type="button"
            class="btn btn-ghost btn-sm btn-circle xl:hidden"
            @click="inquiries.activeThread = null">
            <AppIcon name="arrowLeft" :size="17" />
          </button>
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-black text-primary">
            {{ (active.student_name || '?').charAt(0).toUpperCase() }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-bold">{{ active.title }}</p>
            <p class="truncate text-xs opacity-55">
              {{ active.student_name || "O'quvchi" }} · {{
                shortDate(active.created_at)
              }}
            </p>
          </div>
        </div>

        <!-- Xabarlar -->
        <div
          ref="chatBox"
          class="flex-1 space-y-3 overflow-y-auto bg-base-200/30 p-4">
          <div class="flex justify-start">
            <div
              class="max-w-[80%] rounded-2xl rounded-bl-md bg-base-100 px-3.5 py-2.5 text-sm leading-relaxed">
              <p class="text-[10px] font-bold opacity-60">{{
                active.student_name || "O'quvchi"
              }}</p>
              <p class="mt-0.5 whitespace-pre-wrap">{{ active.message }}</p>
              <p class="mt-1 text-[10px] opacity-40">{{
                shortDate(active.created_at)
              }}</p>
            </div>
          </div>
          <div
            v-for="message in inquiries.messages"
            :key="message.id"
            class="flex"
            :class="isMine(message) ? 'justify-end' : 'justify-start'">
            <div
              class="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
              :class="
                isMine(message)
                  ? 'rounded-br-md bg-primary text-primary-content'
                  : 'rounded-bl-md bg-base-100'
              ">
              <p class="whitespace-pre-wrap">{{ message.message }}</p>
              <p
                class="mt-1 text-[10px]"
                :class="isMine(message) ? 'opacity-60' : 'opacity-40'">
                {{ shortDate(message.created_at) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Holat va yozish -->
        <div class="border-t border-base-content/10 p-3">
          <div class="mb-3 flex flex-wrap items-center gap-1.5">
            <span class="mr-1 text-[11px] font-bold uppercase tracking-wide opacity-45">
              Holat:
            </span>
            <button
              v-for="(meta, key) in STATUS_META"
              :key="key"
              type="button"
              class="btn btn-xs rounded-lg"
              :class="
                active.status === key ? 'btn-primary' : 'btn-ghost'
              "
              @click="changeStatus(key)">
              {{ meta.label }}
            </button>
          </div>
          <form
            class="flex items-end gap-2"
            @submit.prevent="submit">
            <textarea
              v-model="draft"
              rows="1"
              class="textarea textarea-bordered max-h-28 flex-1 resize-none rounded-xl text-sm"
              :disabled="closedThread"
              :placeholder="
                closedThread ? 'Suhbat yopilgan' : 'Xabar yozing…'
              "
              @keydown.enter.exact.prevent="submit" />
            <button
              type="submit"
              class="btn btn-primary btn-circle shrink-0"
              :disabled="!draft.trim() || inquiries.sending || closedThread">
              <span v-if="inquiries.sending" class="loading loading-spinner loading-sm" />
              <AppIcon v-else name="send" :size="16" />
            </button>
          </form>
        </div>
      </div>

      <!-- Bo'sh chat -->
      <div
        v-else
        class="ftw-card hidden items-center justify-center xl:flex">
        <EmptyState
          icon="message"
          title="Murojaatni tanlang"
          text="Chapdagi ro'yxatdan savolni oching va javob yozing." />
      </div>
    </div>
  </div>
</template>
