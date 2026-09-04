import { ref } from "vue";
import { defineStore } from "pinia";
import { supabase } from "../supabase";
import { useAuthStore } from "./auth";
import { useBizStore } from "./biz";

/**
 * "So'rovlar bozori" — o'quvchilar e'lon qilgan ochiq ehtiyojlar.
 * Markaz ularni ko'radi va javob yozsa, shaxsiy chat ochiladi.
 * Chatlar markazga bog'liq (faqat o'z markazining suhbatlari).
 */
export const useMarketStore = defineStore("market", () => {
  const requests = ref([]); // ochiq e'lonlar (bozor)
  const conversations = ref([]); // faol markazning suhbatlari
  const activeConversation = ref(null);
  const messages = ref([]);

  const loadingBoard = ref(false);
  const loadingConversations = ref(false);
  const loadingMessages = ref(false);
  const sending = ref(false);
  const lastError = ref("");

  let channel = null;

  function note(error, context) {
    if (!error) return;
    lastError.value = error.message || String(error);
    console.warn(`[FindTheWay Biznes] ${context}:`, lastError.value);
  }

  /** Ochiq e'lonlar — barcha markazlar ko'radi */
  async function loadBoard() {
    loadingBoard.value = true;
    lastError.value = "";
    const { data, error } = await supabase
      .from("market_requests")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(100);
    loadingBoard.value = false;
    if (error) {
      note(error, "E'lonlarni yuklash");
      return [];
    }
    requests.value = data ?? [];
    return requests.value;
  }

  /** Faol markazning barcha suhbatlari */
  async function loadConversations() {
    const biz = useBizStore();
    if (!biz.center?.id) {
      conversations.value = [];
      return [];
    }
    loadingConversations.value = true;
    const { data, error } = await supabase
      .from("market_conversations")
      .select(
        "id, request_id, center_id, student_id, created_at, last_message_at, market_requests ( id, title, description, category, district, status, student_name, student_phone )",
      )
      .eq("center_id", biz.center.id)
      .order("last_message_at", { ascending: false });
    loadingConversations.value = false;
    if (error) {
      note(error, "Suhbatlarni yuklash");
      return [];
    }
    conversations.value = data ?? [];
    return conversations.value;
  }

  function conversationForRequest(requestId) {
    return (
      conversations.value.find((c) => String(c.request_id) === String(requestId)) ??
      null
    );
  }

  /** E'longa javob berish — suhbat ochiladi (allaqachon bo'lsa qaytadi) */
  async function ensureConversation(request) {
    const biz = useBizStore();
    const auth = useAuthStore();
    if (!biz.center?.id) throw new Error("Avval markaz tanlang");
    if (!request?.id) return null;

    const existing = conversationForRequest(request.id);
    if (existing) {
      await openConversation(existing);
      return existing;
    }

    // Ikkita markaz bir vaqtda yozsa ham bitta chat qoladi
    const { data, error } = await supabase
      .from("market_conversations")
      .upsert(
        {
          request_id: request.id,
          center_id: biz.center.id,
          student_id: request.student_id,
        },
        { onConflict: "request_id,center_id", ignoreDuplicates: true },
      )
      .select(
        "id, request_id, center_id, student_id, created_at, last_message_at, market_requests ( id, title, description, category, district, status, student_name, student_phone )",
      )
      .maybeSingle();
    if (error) {
      note(error, "Suhbat ochish");
      throw error;
    }
    const conv = data ?? existing;
    if (conv && !conversationForRequest(conv.id))
      conversations.value = [conv, ...conversations.value];
    if (conv) await openConversation(conv);
    return conv;
  }

  async function openConversation(conversation) {
    unsubscribeMessages();
    activeConversation.value = conversation;
    messages.value = [];
    loadingMessages.value = true;
    const { data, error } = await supabase
      .from("market_messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });
    loadingMessages.value = false;
    if (error) {
      note(error, "Xabarlarni yuklash");
      return [];
    }
    messages.value = data ?? [];
    subscribeMessages(conversation.id);
    return messages.value;
  }

  async function sendMessage(text) {
    const auth = useAuthStore();
    const biz = useBizStore();
    const conv = activeConversation.value;
    const trimmed = String(text ?? "").trim();
    if (!conv || !trimmed) return null;

    sending.value = true;
    try {
      const { data, error } = await supabase
        .from("market_messages")
        .insert({
          conversation_id: conv.id,
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
      if (conv.last_message_at) conv.last_message_at = data?.created_at;
      return data;
    } catch (error) {
      note(error, "Xabar yuborish");
      throw error;
    } finally {
      sending.value = false;
    }
  }

  function subscribeMessages(conversationId) {
    if (!conversationId || channel) return;
    channel = supabase
      .channel(`market-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "market_messages",
          filter: `conversation_id=eq.${conversationId}`,
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
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  }

  function reset() {
    unsubscribeMessages();
    requests.value = [];
    conversations.value = [];
    activeConversation.value = null;
    messages.value = [];
    lastError.value = "";
  }

  return {
    requests,
    conversations,
    activeConversation,
    messages,
    loadingBoard,
    loadingConversations,
    loadingMessages,
    sending,
    lastError,
    loadBoard,
    loadConversations,
    conversationForRequest,
    ensureConversation,
    openConversation,
    sendMessage,
    reset,
  };
});
