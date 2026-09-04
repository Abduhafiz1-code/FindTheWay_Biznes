import { ref } from "vue";
import { defineStore } from "pinia";
import { supabase } from "../supabase";
import { useAuthStore } from "./auth";

/**
 * "Yordam" — markaz egasi platforma adminiga savol yozadi.
 * Admin javob beradi (AI bilan silliqlash mumkin), suhbat realtime.
 */
export const useSupportStore = defineStore("support", () => {
  const ROLE = "owner";
  const tickets = ref([]);
  const activeTicket = ref(null);
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

  async function loadTickets() {
    const auth = useAuthStore();
    if (!auth.user) {
      tickets.value = [];
      return [];
    }
    loading.value = true;
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("updated_at", { ascending: false })
      .limit(50);
    loading.value = false;
    if (error) {
      note(error, "Ticketlarni yuklash");
      return [];
    }
    tickets.value = data ?? [];
    return tickets.value;
  }

  async function createTicket({ subject, body }) {
    const auth = useAuthStore();
    const subjectText = String(subject ?? "").trim();
    const bodyText = String(body ?? "").trim();
    if (!auth.user) throw new Error("Avval tizimga kiring.");
    if (!subjectText || !bodyText) throw new Error("Maydonlarni to'ldiring.");

    const { data, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: auth.user.id,
        user_name: auth.displayName || "Foydalanuvchi",
        user_role: ROLE,
        subject: subjectText,
      })
      .select("*")
      .single();
    if (error) throw error;

    const { error: msgError } = await supabase.from("support_messages").insert({
      ticket_id: data.id,
      sender_id: auth.user.id,
      sender_role: "user",
      sender_name: auth.displayName || "Foydalanuvchi",
      body: bodyText,
    });
    if (msgError) throw msgError;

    tickets.value = [data, ...tickets.value];
    return data;
  }

  async function openTicket(ticket) {
    unsubscribeMessages();
    activeTicket.value = ticket;
    messages.value = [];
    loadingMessages.value = true;
    const { data, error } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    loadingMessages.value = false;
    if (error) {
      note(error, "Xabarlarni yuklash");
      return [];
    }
    messages.value = data ?? [];
    subscribeMessages(ticket.id);
    return messages.value;
  }

  async function sendMessage(body) {
    const auth = useAuthStore();
    const ticket = activeTicket.value;
    const text = String(body ?? "").trim();
    if (!ticket || !text) return null;

    sending.value = true;
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: ticket.id,
          sender_id: auth.user.id,
          sender_role: "user",
          sender_name: auth.displayName || "Foydalanuvchi",
          body: text,
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

  async function closeTicket(ticketId) {
    const { data, error } = await supabase
      .from("support_tickets")
      .update({ status: "closed" })
      .eq("id", ticketId)
      .select("*")
      .single();
    if (error) {
      note(error, "Ticketni yopish");
      throw error;
    }
    const index = tickets.value.findIndex((t) => t.id === ticketId);
    if (index !== -1) tickets.value[index] = data;
    if (activeTicket.value?.id === ticketId) activeTicket.value = data;
    return data;
  }

  function subscribeList() {
    const auth = useAuthStore();
    if (!auth.user || listChannel) return;
    listChannel = supabase
      .channel(`support-list-${auth.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_tickets",
          filter: `user_id=eq.${auth.user.id}`,
        },
        (payload) => {
          if (!payload.new) return;
          const index = tickets.value.findIndex((t) => t.id === payload.new.id);
          if (payload.eventType === "INSERT" && index === -1) {
            tickets.value = [payload.new, ...tickets.value];
          } else if (index !== -1) {
            if (payload.eventType === "DELETE") tickets.value.splice(index, 1);
            else tickets.value[index] = payload.new;
          }
          if (activeTicket.value?.id === payload.new.id) {
            activeTicket.value = payload.new;
          }
        },
      )
      .subscribe();
  }

  function subscribeMessages(ticketId) {
    if (!ticketId || msgChannel) return;
    msgChannel = supabase
      .channel(`support-msg-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${ticketId}`,
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

  function unsubscribeAll() {
    if (listChannel) {
      supabase.removeChannel(listChannel);
      listChannel = null;
    }
    if (msgChannel) {
      supabase.removeChannel(msgChannel);
      msgChannel = null;
    }
  }

  async function init() {
    unsubscribeAll();
    await loadTickets();
    subscribeList();
  }

  function dispose() {
    unsubscribeAll();
  }

  return {
    tickets,
    activeTicket,
    messages,
    loading,
    loadingMessages,
    sending,
    lastError,
    loadTickets,
    createTicket,
    openTicket,
    sendMessage,
    closeTicket,
    init,
    dispose,
  };
});
