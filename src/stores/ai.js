import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { supabase } from "../supabase";
import { useAuthStore } from "./auth";

export const useAiStore = defineStore("ai", () => {
  const conversations = ref([]);
  const currentConversation = ref(null);
  const messages = ref([]);
  const loading = ref(false);
  const responding = ref(false);

  const recentConversations = computed(() =>
    conversations.value
      .filter((c) => c.is_active)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)),
  );

  async function loadConversations(centerId) {
    loading.value = true;
    const auth = useAuthStore();
    if (!auth.user) {
      conversations.value = [];
      loading.value = false;
      return [];
    }

    const { data, error } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("center_id", centerId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error loading conversations:", error.message);
      conversations.value = [];
    } else {
      conversations.value = data ?? [];
    }

    loading.value = false;
    return conversations.value;
  }

  async function startConversation(
    centerId,
    initialTitle = "New Conversation",
  ) {
    const auth = useAuthStore();
    if (!auth.user) throw new Error("Avval tizimga kiring.");

    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({
        center_id: centerId,
        owner_id: auth.user.id,
        title: initialTitle,
      })
      .select()
      .single();

    if (error) throw error;
    conversations.value.push(data);
    currentConversation.value = data;
    messages.value = [];
    return data;
  }

  async function selectConversation(conversationId) {
    currentConversation.value =
      conversations.value.find((c) => c.id === conversationId) || null;
    if (currentConversation.value) {
      await loadMessages(conversationId);
    }
  }

  async function loadMessages(conversationId) {
    const { data, error } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading messages:", error.message);
      messages.value = [];
    } else {
      messages.value = data ?? [];
    }
    return messages.value;
  }

  async function sendMessage(content) {
    if (!currentConversation.value) throw new Error("Avval suhbat tanlang.");

    responding.value = true;
    try {
      // 1) Save user message
      const { data: userMsg, error: userError } = await supabase
        .from("ai_messages")
        .insert({
          conversation_id: currentConversation.value.id,
          role: "user",
          content,
        })
        .select()
        .single();

      if (userError) throw userError;
      messages.value.push(userMsg);

      // 2) Edge Function current session tokenini avtomatik yuboradi.
      const { data: result, error: functionError } =
        await supabase.functions.invoke("ai-chat", {
          body: {
            conversation_id: currentConversation.value.id,
            message: content,
            context: currentConversation.value.context,
          },
        });
      if (functionError) throw functionError;
      if (!result?.message) {
        throw new Error(result?.error || "AI javob qaytarmadi.");
      }

      // 3) Save assistant response
      const { data: assistantMsg, error: assistantError } = await supabase
        .from("ai_messages")
        .insert({
          conversation_id: currentConversation.value.id,
          role: "assistant",
          content: result.message,
          tokens_used: result.tokens_used || 0,
        })
        .select()
        .single();

      if (assistantError) throw assistantError;
      messages.value.push(assistantMsg);

      // Update conversation
      const { error: updateError } = await supabase
        .from("ai_conversations")
        .update({
          updated_at: new Date().toISOString(),
          context: result.context || currentConversation.value.context,
        })
        .eq("id", currentConversation.value.id);

      if (updateError)
        console.error("Error updating conversation:", updateError.message);

      return assistantMsg;
    } finally {
      responding.value = false;
    }
  }

  async function updateConversationTitle(conversationId, title) {
    const { data, error } = await supabase
      .from("ai_conversations")
      .update({ title })
      .eq("id", conversationId)
      .select()
      .single();

    if (error) throw error;
    const idx = conversations.value.findIndex((c) => c.id === conversationId);
    if (idx >= 0) conversations.value[idx] = data;
    if (currentConversation.value?.id === conversationId) {
      currentConversation.value = data;
    }
    return data;
  }

  function reset() {
    conversations.value = [];
    currentConversation.value = null;
    messages.value = [];
  }

  return {
    conversations,
    currentConversation,
    messages,
    loading,
    responding,
    recentConversations,
    loadConversations,
    startConversation,
    selectConversation,
    loadMessages,
    sendMessage,
    updateConversationTitle,
    reset,
  };
});
