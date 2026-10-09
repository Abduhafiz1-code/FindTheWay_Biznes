import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { supabase } from "../supabase";
import { useAuthStore } from "./auth";
import { useBizStore } from "./biz";

/**
 * Tayyor admin panellar do'koni (10 daraja).
 * Har bir panel center_id bilan xarid qilinadi — izolyatsiya shu yerda.
 */
export const usePanelsStore = defineStore("panels", () => {
  const catalog = ref([]);
  const mine = ref([]);
  const loading = ref(false);
  const lastError = ref("");

  // isActive(panel_id) qidiradi — shuning uchun p.panel_id beriladi
  const activeCount = computed(
    () => mine.value.filter((p) => isActive(p.panel_id)).length,
  );

  /** Faol (to'langan va muddati tugamagan) panel */
  const activePanel = computed(
    () => mine.value.find((p) => isActive(p.panel_id)) ?? null,
  );

  async function loadCatalog() {
    loading.value = true;
    const { data, error } = await supabase
      .from("panel_products")
      .select("*")
      .eq("is_active", true)
      .order("sort", { ascending: true });
    loading.value = false;
    if (error) {
      lastError.value = error.message;
      return [];
    }
    catalog.value = data ?? [];
    return catalog.value;
  }

  async function loadMine() {
    const biz = useBizStore();
    if (!biz.center?.id) {
      mine.value = [];
      return [];
    }
    const { data, error } = await supabase
      .from("center_panels")
      .select("*, panel_products ( *)")
      .eq("center_id", biz.center.id)
      .order("created_at", { ascending: false });
    if (error) {
      lastError.value = error.message;
      return [];
    }
    mine.value = data ?? [];
    return mine.value;
  }

  function getPanel(panelId) {
    return mine.value.find((p) => String(p.panel_id) === String(panelId)) ?? null;
  }

  function isActive(panelId) {
    const row = getPanel(panelId);
    return (
      row?.status === "active" &&
      (!row.paid_until || new Date(row.paid_until) > new Date())
    );
  }

  /** Sotib olish — pending holatda satr ochiladi, admin tasdiqlaydi */
  async function purchase(panelId) {
    const biz = useBizStore();
    if (!biz.center?.id) throw new Error("Avval markaz tanlang");

    const { data, error } = await supabase
      .from("center_panels")
      .upsert(
        { center_id: biz.center.id, panel_id: panelId, status: "pending" },
        { onConflict: "center_id,panel_id", ignoreDuplicates: true },
      )
      .select("*")
      .maybeSingle();
    if (error) {
      lastError.value = error.message;
      throw error;
    }
    await loadMine();
    return data;
  }

  /** Chek yuklash — admin tasdiqlaydi */
  async function uploadReceipt(file, panelId) {
    const auth = useAuthStore();
    const biz = useBizStore();
    if (!biz.center?.id || !panelId) throw new Error("Avval markaz tanlang");
    if (!file?.type?.startsWith("image/"))
      throw new Error("Faqat rasm faylini yuklang");
    if (file.size > 5 * 1024 * 1024)
      throw new Error("Rasm hajmi 5 MB dan oshmasin");

    const row = getPanel(panelId);
    if (!row) await purchase(panelId);

    const path = `${auth.user.id}/${biz.center.id}/panel-${panelId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error: uploadError } = await supabase.storage
      .from("subscription-receipts")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) throw uploadError;

    const active = isActive(panelId);
    const { data, error } = await supabase
      .from("center_panels")
      .update({ status: active ? "active" : "pending", receipt_url: path })
      .eq("center_id", biz.center.id)
      .eq("panel_id", panelId)
      .select("*")
      .single();
    if (error) {
      lastError.value = error.message;
      throw error;
    }
    await loadMine();
    return data;
  }

  function reset() {
    catalog.value = [];
    mine.value = [];
    lastError.value = "";
  }

  return {
    catalog,
    mine,
    loading,
    lastError,
    activeCount,
    activePanel,
    loadCatalog,
    loadMine,
    getPanel,
    isActive,
    purchase,
    uploadReceipt,
    reset,
  };
});
