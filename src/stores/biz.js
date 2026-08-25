import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { supabase } from "../supabase";
import { useAuthStore } from "./auth";

export function calculatePrice({
  plan = "pro",
  cycle = "monthly",
  isExtraCenter = false,
} = {}) {
  const base = { pro: 200000, max: 350000 }[plan] ?? 200000;
  const yearlyMonthly = base * 0.7;
  let price = cycle === "yearly" ? yearlyMonthly : base;

  if (isExtraCenter && plan === "pro") {
    price = price * 0.8;
  }

  if (isExtraCenter && plan === "max") {
    price = 0;
  }

  return cycle === "yearly" ? Math.round(price * 12) : Math.round(price);
}

export const APPLICATION_STATUSES = [
  "new",
  "seen",
  "contacted",
  "accepted",
  "rejected",
];

export const STATUS_META = {
  new: {
    labelKey: "applications.statusNew",
    badge: "badge-primary",
    dot: "bg-primary",
  },
  seen: {
    labelKey: "applications.statusSeen",
    badge: "badge-ghost",
    dot: "bg-base-content/40",
  },
  contacted: {
    labelKey: "applications.statusContacted",
    badge: "badge-info",
    dot: "bg-info",
  },
  accepted: {
    labelKey: "applications.statusAccepted",
    badge: "badge-success",
    dot: "bg-success",
  },
  rejected: {
    labelKey: "applications.statusRejected",
    badge: "badge-error",
    dot: "bg-error",
  },
};

const SUBSCRIPTION_FIELDS =
  "id, center_id, status, plan, billing_cycle, is_extra_center, trial_ends_at, paid_until, receipt_url";

// Markaz, kurslar va arizalar bilan ishlaydigan asosiy store
export const useBizStore = defineStore("biz", () => {
  const center = ref(null);
  const centers = ref([]);
  const courses = ref([]);
  const applications = ref([]);
  const subscription = ref(null);

  const loadingCenter = ref(false);
  const loadingCourses = ref(false);
  const loadingApplications = ref(false);
  const lastError = ref("");

  let channel = null;

  const hasCenter = computed(() => !!center.value);
  const centerCount = computed(() => centers.value.length);
  const isExtraCenter = computed(() => centerCount.value > 1);
  const maxCentersForPlan = computed(() => {
    const plan = subscription.value?.plan || "pro";
    return plan === "pro" ? 1 : plan === "max" ? 5 : 1;
  });
  const canAddCenter = computed(
    () => centerCount.value < maxCentersForPlan.value,
  );

  const newCount = computed(
    () => applications.value.filter((a) => a.status === "new").length,
  );
  const acceptedCount = computed(
    () => applications.value.filter((a) => a.status === "accepted").length,
  );
  const totalCount = computed(() => applications.value.length);
  const activeCourses = computed(
    () => courses.value.filter((c) => c.is_active !== false).length,
  );
  const conversion = computed(() =>
    totalCount.value
      ? Math.round((acceptedCount.value / totalCount.value) * 100)
      : 0,
  );
  const subscriptionUntil = computed(
    () =>
      subscription.value?.paid_until ||
      subscription.value?.trial_ends_at ||
      null,
  );
  const subscriptionDaysLeft = computed(() => {
    if (!subscriptionUntil.value) return null;
    return Math.ceil(
      (new Date(subscriptionUntil.value) - new Date()) / 86400000,
    );
  });
  const subscriptionExpired = computed(
    () => (subscriptionDaysLeft.value ?? 0) < 0,
  );
  const subscriptionWarning = computed(
    () =>
      subscriptionExpired.value ||
      (subscriptionDaysLeft.value !== null && subscriptionDaysLeft.value <= 5),
  );

  // Oxirgi 14 kunlik arizalar — dashboard grafigi uchun
  const chartData = computed(() => {
    const days = [];
    const now = new Date();
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const count = applications.value.filter(
        (a) => String(a.created_at ?? "").slice(0, 10) === key,
      ).length;
      days.push({ key, label: `${d.getDate()}`, count });
    }
    return days;
  });

  function note(error, context) {
    if (!error) return;
    lastError.value = error.message || String(error);
    console.warn(`[FindTheWay Biznes] ${context}:`, lastError.value);
  }

  async function loadCenters() {
    const auth = useAuthStore();
    if (!auth.user) {
      centers.value = [];
      center.value = null;
      return [];
    }

    loadingCenter.value = true;
    const { data, error } = await supabase
      .from("centers")
      .select("*")
      .eq("owner_id", auth.user.id)
      .order("created_at", { ascending: false });
    loadingCenter.value = false;

    if (error) {
      note(error, "Markazlarni yuklash");
      centers.value = [];
      center.value = null;
      return [];
    }

    centers.value = data ?? [];
    center.value = centers.value[0] ?? null;
    return centers.value;
  }

  async function loadCenter() {
    return loadCenters();
  }

  function selectCenter(centerId) {
    const next = centers.value.find((item) => item.id === centerId) ?? null;
    if (next?.id !== center.value?.id) unsubscribe();
    center.value = next;
    return next;
  }

  async function loadSubscription() {
    if (!center.value?.id) {
      subscription.value = null;
      return null;
    }
    const { data, error } = await supabase
      .from("subscriptions")
      .select(SUBSCRIPTION_FIELDS)
      .eq("center_id", center.value.id)
      .maybeSingle();
    if (error) {
      note(error, "Obunani yuklash");
      return null;
    }
    subscription.value = data;
    return data;
  }

  async function uploadReceipt(file) {
    if (!center.value?.id) throw new Error("Avval markaz profilini yarating");
    if (!file?.type?.startsWith("image/"))
      throw new Error("Faqat rasm faylini yuklang");
    if (file.size > 5 * 1024 * 1024)
      throw new Error("Rasm hajmi 5 MB dan oshmasin");
    const auth = useAuthStore();
    const path = `${auth.user.id}/${center.value.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error: uploadError } = await supabase.storage
      .from("subscription-receipts")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) throw uploadError;
    const { data, error } = await supabase
      .from("subscriptions")
      .update({ status: "pending", receipt_url: path })
      .eq("center_id", center.value.id)
      .select(SUBSCRIPTION_FIELDS)
      .single();
    if (error) throw error;
    subscription.value = data;
    return data;
  }

  async function saveCenter(payload) {
    const auth = useAuthStore();
    if (!auth.user) throw new Error("Avval tizimga kiring");

    if (center.value?.id) {
      const { data, error } = await supabase
        .from("centers")
        .update(payload)
        .eq("id", center.value.id)
        .select()
        .single();
      if (error) throw error;
      center.value = data;
      const index = centers.value.findIndex((item) => item.id === data.id);
      if (index !== -1) centers.value[index] = data;
      return data;
    }

    const { data, error } = await supabase
      .from("centers")
      .insert({ ...payload, owner_id: auth.user.id })
      .select()
      .single();
    if (error) throw error;
    center.value = data;
    centers.value = [data, ...centers.value];
    return data;
  }

  async function loadCourses() {
    if (!center.value?.id) {
      courses.value = [];
      return [];
    }
    loadingCourses.value = true;
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("center_id", center.value.id)
      .order("created_at", { ascending: false });
    loadingCourses.value = false;
    if (error) {
      note(error, "Kurslarni yuklash");
      return [];
    }
    courses.value = data ?? [];
    return courses.value;
  }

  async function saveCourse(payload) {
    if (!center.value?.id) throw new Error("Avval markaz profilini yarating");
    if (payload.id) {
      const { id, ...rest } = payload;
      const { data, error } = await supabase
        .from("courses")
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const index = courses.value.findIndex((c) => c.id === id);
      if (index !== -1) courses.value[index] = data;
      return data;
    }
    const { data, error } = await supabase
      .from("courses")
      .insert({ ...payload, center_id: center.value.id })
      .select()
      .single();
    if (error) throw error;
    courses.value = [data, ...courses.value];
    return data;
  }

  async function deleteCourse(id) {
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) throw error;
    courses.value = courses.value.filter((c) => c.id !== id);
  }

  async function loadApplications() {
    if (!center.value?.id) {
      applications.value = [];
      return [];
    }
    loadingApplications.value = true;
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("center_id", center.value.id)
      .order("created_at", { ascending: false });
    loadingApplications.value = false;
    if (error) {
      note(error, "Arizalarni yuklash");
      return [];
    }
    applications.value = data ?? [];
    return applications.value;
  }

  async function updateApplication(id, patch) {
    const { data, error } = await supabase
      .from("applications")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    const index = applications.value.findIndex((a) => a.id === id);
    if (index !== -1) applications.value[index] = data;
    return data;
  }

  function setStatus(id, status) {
    return updateApplication(id, { status });
  }

  // Realtime — yangi ariza kelganda ro'yxat o'zi yangilanadi
  function subscribe() {
    if (!center.value?.id || channel) return;
    channel = supabase
      .channel(`applications-${center.value.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "applications",
          filter: `center_id=eq.${center.value.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            if (!applications.value.some((a) => a.id === payload.new.id)) {
              applications.value = [payload.new, ...applications.value];
            }
          } else if (payload.eventType === "UPDATE") {
            const index = applications.value.findIndex(
              (a) => a.id === payload.new.id,
            );
            if (index !== -1) applications.value[index] = payload.new;
          } else if (payload.eventType === "DELETE") {
            applications.value = applications.value.filter(
              (a) => a.id !== payload.old.id,
            );
          }
        },
      )
      .subscribe();
  }

  function unsubscribe() {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  }

  // Panelga kirganda hammasini bir marta yuklaymiz
  async function bootstrap() {
    const list = await loadCenters();
    if (center.value?.id) {
      await Promise.all([
        loadCourses(),
        loadApplications(),
        loadSubscription(),
      ]);
      subscribe();
    }
    return list;
  }

  function reset() {
    unsubscribe();
    center.value = null;
    centers.value = [];
    courses.value = [];
    applications.value = [];
    subscription.value = null;
    lastError.value = "";
  }

  return {
    center,
    centers,
    courses,
    applications,
    subscription,
    loadingCenter,
    loadingCourses,
    loadingApplications,
    lastError,
    hasCenter,
    centerCount,
    isExtraCenter,
    maxCentersForPlan,
    canAddCenter,
    newCount,
    acceptedCount,
    totalCount,
    activeCourses,
    conversion,
    subscriptionUntil,
    subscriptionDaysLeft,
    subscriptionExpired,
    subscriptionWarning,
    chartData,
    loadCenter,
    loadCenters,
    selectCenter,
    loadSubscription,
    uploadReceipt,
    saveCenter,
    loadCourses,
    saveCourse,
    deleteCourse,
    loadApplications,
    updateApplication,
    setStatus,
    subscribe,
    unsubscribe,
    bootstrap,
    reset,
  };
});
