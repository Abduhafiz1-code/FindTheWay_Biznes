import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { supabase } from "../supabase";
import { useAuthStore } from "./auth";
import { useBizStore } from "./biz";

/**
 * Modullar do'koni — markaz tayyor qo'shimcha imkoniyatlarni
 * sotib oladi. Har bir modul center_id bilan bog'lanadi (izolyatsiya).
 */
export const useModulesStore = defineStore("modules", () => {
  const catalog = ref([]);
  const mine = ref([]);
  const loading = ref(false);
  const lastError = ref("");

  const activeCount = computed(
    () => mine.value.filter((m) => m.status === "active").length,
  );

  async function loadCatalog() {
    loading.value = true;
    const { data, error } = await supabase
      .from("modules")
      .select("*")
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
      .from("center_modules")
      .select("*, modules ( *)")
      .eq("center_id", biz.center.id)
      .order("created_at", { ascending: false });
    if (error) {
      lastError.value = error.message;
      return [];
    }
    mine.value = data ?? [];
    return mine.value;
  }

  function getModule(moduleId) {
    return mine.value.find((m) => String(m.module_id) === String(moduleId)) ?? null;
  }

  function isActive(moduleId) {
    const row = getModule(moduleId);
    return (
      row?.status === "active" &&
      (!row.paid_until || new Date(row.paid_until) > new Date())
    );
  }

  /** Sotib olish — pending holatda satr ochiladi */
  async function purchase(moduleId) {
    const biz = useBizStore();
    if (!biz.center?.id) throw new Error("Avval markaz tanlang");

    const { data, error } = await supabase
      .from("center_modules")
      .upsert(
        { center_id: biz.center.id, module_id: moduleId, status: "pending" },
        { onConflict: "center_id,module_id", ignoreDuplicates: true },
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
  async function uploadReceipt(file, moduleId) {
    const auth = useAuthStore();
    const biz = useBizStore();
    if (!biz.center?.id || !moduleId) throw new Error("Avval markaz tanlang");
    if (!file?.type?.startsWith("image/"))
      throw new Error("Faqat rasm faylini yuklang");
    if (file.size > 5 * 1024 * 1024)
      throw new Error("Rasm hajmi 5 MB dan oshmasin");

    const row = getModule(moduleId);
    if (!row) await purchase(moduleId);

    const path = `${auth.user.id}/${biz.center.id}/module-${moduleId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error: uploadError } = await supabase.storage
      .from("subscription-receipts")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) throw uploadError;

    // Faol modulni uzaytirishda (muddat hali tugamagan) statusni o'zgartirmaymiz
    const active = isActive(moduleId);
    const { data, error } = await supabase
      .from("center_modules")
      .update({
        status: active ? "active" : "pending",
        receipt_url: path,
      })
      .eq("center_id", biz.center.id)
      .eq("module_id", moduleId)
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
    loadCatalog,
    loadMine,
    getModule,
    isActive,
    purchase,
    uploadReceipt,
    reset,
  };
});
