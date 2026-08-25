<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useBizStore } from '../stores/biz'
import { useAiStore } from '../stores/ai'
import AppIcon from '../components/AppIcon.vue'
import EmptyState from '../components/ui/EmptyState.vue'

const biz = useBizStore()
const ai = useAiStore()
const draft = ref('')
const errorText = ref('')

const hasCenter = computed(() => Boolean(biz.center?.id))

async function loadConversations() {
  if (!biz.center?.id) return
  await ai.loadConversations(biz.center.id)
  if (ai.conversations[0]) await ai.selectConversation(ai.conversations[0].id)
}

async function send() {
  const text = draft.value.trim()
  if (!text || ai.responding || !biz.center?.id) return
  errorText.value = ''
  try {
    if (!ai.currentConversation) await ai.startConversation(biz.center.id, text.slice(0, 48))
    draft.value = ''
    await ai.sendMessage(text)
  } catch (error) {
    errorText.value = error?.message || 'AI javobini olishda xatolik yuz berdi.'
  }
}

watch(() => biz.center?.id, loadConversations)
onMounted(loadConversations)
</script>

<template>
  <div class="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-4xl flex-col gap-5">
    <div>
      <h2 class="flex items-center gap-2 text-2xl font-black tracking-tight">
        <AppIcon name="sparkles" :size="23" class="text-primary" />
        AI yordamchi
      </h2>
      <p class="mt-1 text-sm opacity-60">Kurslar, o‘quvchilar va markazingiz rivoji bo‘yicha tezkor maslahat oling.</p>
    </div>

    <section v-if="!hasCenter" class="ftw-card">
      <EmptyState icon="building" title="Avval markaz yarating" text="AI yordamchi markazingiz ma’lumotlari asosida javob beradi." />
    </section>

    <section v-else class="ftw-card flex min-h-0 flex-1 flex-col overflow-hidden">
      <div class="border-b border-base-content/10 px-5 py-4 text-sm font-bold">Suhbat</div>
      <div class="flex-1 space-y-4 overflow-y-auto p-5">
        <div v-if="!ai.messages.length" class="py-10 text-center text-sm opacity-60">
          Savolingizni yozing — masalan, yangi kurs uchun reklama rejasini so‘rang.
        </div>
        <div v-for="item in ai.messages" :key="item.id" class="flex" :class="item.role === 'user' ? 'justify-end' : 'justify-start'">
          <p class="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed" :class="item.role === 'user' ? 'bg-primary text-primary-content' : 'bg-base-200'">{{ item.content }}</p>
        </div>
        <div v-if="ai.responding" class="flex justify-start"><span class="loading loading-dots loading-sm text-primary" /></div>
      </div>
      <div class="border-t border-base-content/10 p-3">
        <p v-if="errorText" class="mb-2 text-sm text-error">{{ errorText }}</p>
        <form class="flex gap-2" @submit.prevent="send">
          <input v-model="draft" class="input input-bordered min-w-0 flex-1 rounded-xl" maxlength="4000" placeholder="Savolingizni yozing..." :disabled="ai.responding" />
          <button class="btn btn-primary rounded-xl" :disabled="!draft.trim() || ai.responding"><AppIcon name="send" :size="17" /><span class="hidden sm:inline">Yuborish</span></button>
        </form>
      </div>
    </section>
  </div>
</template>
