import { ref } from "vue";
import { defineStore } from "pinia";
import { supabase } from "../supabase";
import { useAuthStore } from "./auth";
import { useBizStore } from "./biz";

/**
 * "Murojaatlar" — o'quvchilar markaz sahifasida savol beradi,
 * egasi shu yerda javob yozadi (chat, realtime).
 */
export const useInquiriesStore = defineStore("inquiries", () => {
  const threads = ref([]);
  const activeThread = ref(null);
  const messages = ref([]);
  const loading = ref(false);
  const loadingMessages = ref(false);
  const sending = ref(false);
  const lastError = ref("");

  let listChannel = null;
  let msgChannel = null;

  function note(error, context) {
    if (!error) return;
    lastError.value = error.message || String(error);
    console.warn(`[FindTheWay Biznes] ${context}:`, lastError.value);
  }

  async function loadThreads() {
    const biz = useBizStore();
    if (!biz.center?.id) {
      threads.value = [];
      return [];
    }
    loading.value = true;
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .eq("center_id", biz.center.id)
      .order("updated_at", { ascending: false })
      .limit(100);
    loading.value = false;
    if (error) {
      note(error, "Murojaatlarni yuklash");
      return [];
    }
    threads.value = data ?? [];
    return threads.value;
  }

  function subscribeNewThreads() {
    const biz = useBizStore();
    if (!biz.center?.id || listChannel) return;
    listChannel = supabase
      .channel(`inq-${biz.center.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "requests",
          filter: `center_id=eq.${biz.center.id}`,
        },
        (payload) => {
          if (payload.new && !threads.value.some((t) => t.id === payload.new.id)) {
            threads.value = [payload.new, ...threads.value];
          }
        },
      )
      .subscribe();
  }

  async function openThread(thread) {
    unsubscribeMessages();
    activeThread.value = thread;
    messages.value = [];
    loadingMessages.value = true;
    const { data, error } = await supabase
      .from("request_messages")
      .select("*")
      .eq("request_id", thread.id)
      .order("created_at", { ascending: true });
    loadingMessages.value = false;
    if (error) {
      note(error, "Xabarlarni yuklash");
      return [];
    }
    messages.value = data ?? [];
    subscribeMessages(thread.id);
    return messages.value;
  }

  async function sendMessage(text) {
    const auth = useAuthStore();
    const biz = useBizStore();
    const thread = activeThread.value;
    const trimmed = String(text ?? "").trim();
    if (!thread || !trimmed) return null;

    sending.value = true;
    try {
      const { data, error } = await supabase
        .from("request_messages")
        .insert({
          request_id: thread.id,
          sender_id: auth.user.id,
          sender_name: biz.center?.name || auth.displayName || "Markaz",
          message: trimmed,
        })
        .select("*")
        .single();
      if (error) throw error;
      if (data && !messages.value.some((m) => m.id === data.id)) {
        messages.value = [...messages.value, data];
      }
      return data;
    } catch (error) {
      note(error, "Xabar yuborish");
      throw error;
    } finally {
      sending.value = false;
    }
  }

  async function setStatus(threadId, status) {
    const { data, error } = await supabase
      .from("requests")
      .update({
        status,
        resolved_at: ["resolved", "closed"].includes(status)
          ? new Date().toISOString()
          : null,
      })
      .eq("id", threadId)
      .select("*")
      .single();
    if (error) {
      note(error, "Holatni yangilash");
      throw error;
    }
    const index = threads.value.findIndex((t) => t.id === threadId);
    if (index !== -1) threads.value[index] = data;
    if (activeThread.value?.id === threadId) activeThread.value = data;
    return data;
  }

  function subscribeMessages(threadId) {
    if (!threadId || msgChannel) return;
    msgChannel = supabase
      .channel(`inq-msg-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "request_messages",
          filter: `request_id=eq.${threadId}`,
        },
        (payload) => {
          if (
            payload.new &&
            !messages.value.some((m) => m.id === payload.new.id)
          ) {
            messages.value = [...messages.value, payload.new];
          }
        },
      )
      .subscribe();
  }

  function unsubscribeMessages() {
    if (msgChannel) {
      supabase.removeChannel(msgChannel);
      msgChannel = null;
    }
  }

  function unsubscribeAll() {
    unsubscribeMessages();
    if (listChannel) {
      supabase.removeChannel(listChannel);
      listChannel = null;
    }
  }

  function reset() {
    unsubscribeAll();
    threads.value = [];
    activeThread.value = null;
    messages.value = [];
    lastError.value = "";
  }

  return {
    threads,
    activeThread,
    messages,
    loading,
    loadingMessages,
    sending,
    lastError,
    loadThreads,
    subscribeNewThreads,
    openThread,
    sendMessage,
    setStatus,
    unsubscribeAll,
    reset,
  };
});
