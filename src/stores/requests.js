import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { supabase } from "../supabase";
import { useAuthStore } from "./auth";

export const useRequestsStore = defineStore("requests", () => {
  const requests = ref([]);
  const selectedRequest = ref(null);
  const messages = ref([]);
  const loading = ref(false);
  const sending = ref(false);

  const studentRequests = computed(() =>
    requests.value.filter((r) => r.status !== "closed"),
  );
  const openCount = computed(
    () => requests.value.filter((r) => r.status === "open").length,
  );

  async function loadRequests() {
    loading.value = true;
    const auth = useAuthStore();
    if (!auth.user) {
      requests.value = [];
      loading.value = false;
      return [];
    }

    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .eq("student_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading requests:", error.message);
      requests.value = [];
    } else {
      requests.value = data ?? [];
    }

    loading.value = false;
    return requests.value;
  }

  async function selectRequest(requestId) {
    selectedRequest.value =
      requests.value.find((r) => r.id === requestId) || null;
    if (selectedRequest.value) {
      await loadMessages(requestId);
    }
  }

  async function createRequest(centerId, { title, message, priority }) {
    const auth = useAuthStore();
    if (!auth.user) throw new Error("Avval tizimga kiring.");

    const { data, error } = await supabase
      .from("requests")
      .insert({
        center_id: centerId,
        student_id: auth.user.id,
        title,
        message,
        priority: priority || "normal",
      })
      .select()
      .single();

    if (error) throw error;
    requests.value.push(data);
    return data;
  }

  async function loadMessages(requestId) {
    const { data, error } = await supabase
      .from("request_messages")
      .select("*, profiles(full_name)")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading messages:", error.message);
      messages.value = [];
    } else {
      messages.value = data ?? [];
    }
    return messages.value;
  }

  async function sendMessage(requestId, content) {
    const auth = useAuthStore();
    if (!auth.user) throw new Error("Avval tizimga kiring.");

    sending.value = true;
    try {
      const { data, error } = await supabase
        .from("request_messages")
        .insert({
          request_id: requestId,
          sender_id: auth.user.id,
          message: content,
        })
        .select()
        .single();

      if (error) throw error;
      messages.value.push(data);
      return data;
    } finally {
      sending.value = false;
    }
  }

  async function updateRequestStatus(requestId, status) {
    const { data, error } = await supabase
      .from("requests")
      .update({
        status,
        resolved_at: status === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", requestId)
      .select()
      .single();

    if (error) throw error;
    const idx = requests.value.findIndex((r) => r.id === requestId);
    if (idx >= 0) {
      requests.value[idx] = data;
      if (selectedRequest.value?.id === requestId) {
        selectedRequest.value = data;
      }
    }
    return data;
  }

  function reset() {
    requests.value = [];
    selectedRequest.value = null;
    messages.value = [];
  }

  return {
    requests,
    selectedRequest,
    messages,
    loading,
    sending,
    studentRequests,
    openCount,
    loadRequests,
    selectRequest,
    createRequest,
    loadMessages,
    sendMessage,
    updateRequestStatus,
    reset,
  };
});
