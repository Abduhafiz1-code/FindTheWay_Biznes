<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { useSupportStore } from "../stores/support";
import AppIcon from "../components/AppIcon.vue";

const support = useSupportStore();

const showForm = ref(false);
const creating = ref(false);
const subject = ref("");
const body = ref("");
const draft = ref("");
const chatBox = ref(null);

const STATUS_META = {
  open: { label: "Ochiq", badge: "badge-primary" },
  answered: { label: "Javob berildi", badge: "badge-info" },
  closed: { label: "Yopilgan", badge: "badge-ghost" },
};

const openCount = computed(
  () => support.tickets.filter((t) => t.status === "open").length,
);
const active = computed(() => support.activeTicket);
const isMine = (message) => message.sender_role === "user";
const closedTicket = computed(() => active.value?.status === "closed");

function shortDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleString("uz-UZ", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function scrollDown() {
  await nextTick();
  if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
}

async function submitTicket() {
  creating.value = true;
  support.lastError = "";
  try {
    await support.createTicket({ subject: subject.value, body: body.value });
    subject.value = "";
    body.value = "";
    showForm.value = false;
  } catch (error) {
    support.lastError = error?.message || String(error);
  } finally {
    creating.value = false;
  }
}

async function toggleTicket(ticket) {
  if (active.value?.id === ticket.id) {
    support.activeTicket = null;
    support.messages = [];
    return;
  }
  await support.openTicket(ticket);
  await scrollDown();
}

async function send() {
  const text = draft.value.trim();
  if (!text || support.sending || closedTicket.value) return;
  try {
    await support.sendMessage(text);
    draft.value = "";
    await scrollDown();
  } catch (error) {
    support.lastError = error?.message || String(error);
  }
}

async function closeTicket(ticket) {
  if (!window.confirm("Bu murojaatni yopasizmi?")) return;
  try {
    await support.closeTicket(ticket.id);
  } catch (error) {
    support.lastError = error?.message || String(error);
  }
}

onMounted(async () => {
  await support.init();
  await scrollDown();
});

onUnmounted(() => support.dispose());
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-2xl font-black tracking-tight">Yordam</h2>
        <p class="mt-1 text-sm opacity-60">
          Savolingiz bo'lsa yozing — platforma jamoasi javob beradi.
        </p>
      </div>
      <button
        type="button"
        class="btn btn-primary rounded-xl"
        @click="showForm = !showForm">
        <AppIcon :name="showForm ? 'close' : 'plus'" :size="16" />
        {{ showForm ? "Yopish" : "Yangi murojaat" }}
      </button>
    </div>

    <p
      v-if="support.lastError"
      class="rounded-xl border border-error/30 bg-error/10 px-3.5 py-2.5 text-sm text-error">
      {{ support.lastError }}
    </p>

    <!-- Yangi ticket -->
    <form
      v-if="showForm"
      class="ftw-card space-y-4 rounded-2xl p-5"
      @submit.prevent="submitTicket">
      <div>
        <label class="mb-1.5 block text-sm font-semibold">
          Mavzu <span class="text-error">*</span>
        </label>
        <input
          v-model="subject"
          type="text"
          class="input input-bordered h-12 w-full rounded-xl"
          placeholder="Masalan: Qo'shimcha markaz qo'sha olmayapman"
          required />
      </div>
      <div>
        <label class="mb-1.5 block text-sm font-semibold">
          Xabar <span class="text-error">*</span>
        </label>
        <textarea
          v-model="body"
          rows="4"
          class="textarea textarea-bordered w-full rounded-xl"
          placeholder="Muammongizni batafsil yozing…"
          required />
      </div>
      <button type="submit" class="btn btn-primary rounded-xl" :disabled="creating">
        <span v-if="creating" class="loading loading-spinner loading-sm" />
        {{ creating ? "Yuborilmoqda…" : "Yuborish" }}
      </button>
    </form>

    <div v-if="support.loading && !support.tickets.length" class="space-y-3">
      <div v-for="i in 2" :key="i" class="ftw-skeleton h-24 rounded-2xl" />
    </div>

    <template v-else>
      <p
        v-if="!support.tickets.length && !showForm"
        class="ftw-card rounded-2xl p-10 text-center">
        <AppIcon name="mail" :size="34" class="mx-auto opacity-30" />
        <span class="mt-3 block font-bold">Murojaatlar yo'q</span>
        <span class="mt-1 block text-sm opacity-60">
          Muammo yoki savol bo'lsa, yangi murojaat oching.
        </span>
      </p>

      <div v-else class="space-y-3">
        <article
          v-for="ticket in support.tickets"
          :key="ticket.id"
          class="ftw-card overflow-hidden rounded-2xl">
          <button
            type="button"
            class="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-base-200/50"
            @click="toggleTicket(ticket)">
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-extrabold">{{ ticket.subject }}</span>
              <span class="mt-0.5 block text-[11px] opacity-50">{{
                shortDate(ticket.updated_at)
              }}</span>
            </span>
            <span
              class="badge shrink-0"
              :class="(STATUS_META[ticket.status] ?? STATUS_META.open).badge">
              {{ (STATUS_META[ticket.status] ?? STATUS_META.open).label }}
            </span>
            <AppIcon
              :name="active?.id === ticket.id ? 'chevronDown' : 'chevronRight'"
              :size="16"
              class="shrink-0 opacity-40" />
          </button>

          <!-- Chat -->
          <div
            v-if="active?.id === ticket.id"
            class="border-t border-base-content/10 bg-base-200/25">
            <div ref="chatBox" class="h-80 space-y-3 overflow-y-auto p-4">
              <p
                v-if="!support.messages.length"
                class="py-8 text-center text-xs opacity-50">
                Xabarlar yo'q.
              </p>
              <div
                v-for="message in support.messages"
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
                  <p class="text-[10px] font-bold opacity-60">{{
                    message.sender_name
                  }}</p>
                  <p class="mt-0.5 whitespace-pre-wrap">{{ message.body }}</p>
                  <p
                    class="mt-1 text-[10px]"
                    :class="isMine(message) ? 'opacity-60' : 'opacity-40'">
                    {{ shortDate(message.created_at) }}
                  </p>
                </div>
              </div>
            </div>
            <form
              v-if="ticket.status !== 'closed'"
              class="flex items-end gap-2 border-t border-base-content/10 bg-base-100 p-3"
              @submit.prevent="send">
              <textarea
                v-model="draft"
                rows="1"
                class="textarea textarea-bordered max-h-28 flex-1 resize-none rounded-xl text-sm"
                placeholder="Xabar yozing…"
                @keydown.enter.exact.prevent="send" />
              <button
                type="submit"
                class="btn btn-primary btn-circle shrink-0"
                :disabled="!draft.trim() || support.sending">
                <span v-if="support.sending" class="loading loading-spinner loading-sm" />
                <AppIcon v-else name="send" :size="16" />
              </button>
            </form>
            <div
              v-if="ticket.status !== 'closed'"
              class="flex justify-end border-t border-base-content/10 px-3 pb-3 pt-2">
              <button
                type="button"
                class="text-xs font-bold text-error hover:underline"
                @click="closeTicket(ticket)">
                Murojaatni yopish
              </button>
            </div>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>
