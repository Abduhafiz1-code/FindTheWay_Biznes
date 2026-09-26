import { ref, reactive, computed } from "vue";
import { defineStore } from "pinia";
import { supabase } from "../supabase";
import { useAuthStore } from "./auth";
import { useBizStore } from "./biz";
import { usePanelsStore } from "./panels";
import { useModulesStore } from "./modules";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Ish maydonlari konfiguratsiyasi.
 * kind: 'table' (CRUD jadval) | 'analytics' (hisobot) | 'link' (boshqa sahifa)
 * Panel sotib olsa yoki modul faol bo'lsa — shu maydon ochiladi.
 * Har bir jadval center_id bilan: markazlar ma'lumoti aralashmaydi.
 */
export const TOOLS = {
  crm: {
    label: "Talabalar bazasi",
    icon: "users",
    kind: "table",
    table: "panel_students",
    hint: "Ariza yuborgan va o'qiyotgan barcha talabalar bitta joyda.",
    fields: [
      { key: "full_name", label: "Ism familiya", required: true },
      { key: "phone", label: "Telefon", placeholder: "+998 90 123 45 67" },
      { key: "course", label: "Kurs" },
      {
        key: "status",
        label: "Holat",
        type: "select",
        default: "yangi",
        options: [
          { v: "yangi", l: "Yangi" },
          { v: "kontaktda", l: "Kontaktda" },
          { v: "qabul", l: "Qabul qilingan" },
        ],
      },
      { key: "note", label: "Izoh", type: "textarea" },
    ],
    columns: [
      { key: "full_name", label: "Ism" },
      { key: "phone", label: "Telefon" },
      { key: "course", label: "Kurs" },
      {
        key: "status",
        label: "Holat",
        badge: { yangi: "badge-ghost", kontaktda: "badge-info", qabul: "badge-success" },
        badgeText: { yangi: "Yangi", kontaktda: "Kontaktda", qabul: "Qabul qilingan" },
      },
      { key: "note", label: "Izoh" },
      { key: "created_at", label: "Sana", type: "date" },
    ],
  },

  schedule: {
    label: "Guruhlar va jadval",
    icon: "calendar",
    kind: "table",
    table: "panel_groups",
    hint: "Har bir kursni guruhlarga bo'ling: o'qituvchi, kun, vaqt va xona.",
    fields: [
      { key: "name", label: "Guruh nomi", required: true },
      { key: "course", label: "Kurs" },
      { key: "teacher", label: "O'qituvchi" },
      { key: "days", label: "Kunlar", placeholder: "Du, Chor, Ju" },
      { key: "time", label: "Vaqt", placeholder: "15:00–16:30" },
      { key: "room", label: "Xona" },
      { key: "capacity", label: "Sig'im", type: "number" },
    ],
    columns: [
      { key: "name", label: "Guruh" },
      { key: "course", label: "Kurs" },
      { key: "teacher", label: "O'qituvchi" },
      { key: "days", label: "Kunlar" },
      { key: "time", label: "Vaqt" },
      { key: "room", label: "Xona" },
      { key: "capacity", label: "Sig'im" },
    ],
  },

  finance: {
    label: "Kassa",
    icon: "wallet",
    kind: "table",
    table: "panel_payments",
    hint: "Har bir to'lov qabuli: kim, qancha, qachon va turi.",
    fields: [
      { key: "student", label: "O'quvchi", required: true },
      { key: "amount", label: "Summa (so'm)", type: "number", required: true },
      {
        key: "kind",
        label: "Turi",
        type: "select",
        default: "oylik",
        options: [
          { v: "oylik", l: "Oylik to'lov" },
          { v: "kurs", l: "Kurs to'lovi" },
          { v: "boshqa", l: "Boshqa" },
        ],
      },
      { key: "paid_on", label: "Sana", type: "date", default: today },
      { key: "note", label: "Izoh", type: "textarea" },
    ],
    columns: [
      { key: "student", label: "O'quvchi" },
      { key: "amount", label: "Summa", type: "money" },
      {
        key: "kind",
        label: "Turi",
        badge: { oylik: "badge-success", kurs: "badge-info", boshqa: "badge-ghost" },
        badgeText: { oylik: "Oylik", kurs: "Kurs", boshqa: "Boshqa" },
      },
      { key: "paid_on", label: "Sana", type: "date" },
      { key: "note", label: "Izoh" },
    ],
  },

  staff: {
    label: "Xodimlar va rollar",
    icon: "shield",
    kind: "table",
    table: "panel_staff",
    hint: "O'qituvchi, kassir, admin — lavozim, telefon va maosh.",
    fields: [
      { key: "name", label: "Ism familiya", required: true },
      {
        key: "role",
        label: "Rol",
        type: "select",
        default: "o'qituvchi",
        options: [
          { v: "o'qituvchi", l: "O'qituvchi" },
          { v: "kassir", l: "Kassir" },
          { v: "admin", l: "Admin" },
          { v: "marketing", l: "Marketing" },
          { v: "hr", l: "HR" },
          { v: "auditor", l: "Auditor" },
        ],
      },
      { key: "phone", label: "Telefon", placeholder: "+998 90 123 45 67" },
      { key: "salary", label: "Maosh (so'm)", type: "number" },
    ],
    columns: [
      { key: "name", label: "Ism" },
      {
        key: "role",
        label: "Rol",
        badge: {
          "o'qituvchi": "badge-info",
          kassir: "badge-success",
          admin: "badge-primary",
          marketing: "badge-secondary",
          hr: "badge-warning",
          auditor: "badge-ghost",
        },
      },
      { key: "phone", label: "Telefon" },
      { key: "salary", label: "Maosh", type: "money" },
    ],
  },

  attendance: {
    label: "Davomat",
    icon: "checkCircle",
    kind: "table",
    table: "panel_attendance",
    hint: "Kunlik davomat: kelganlar va kelmaslar soni.",
    fields: [
      { key: "group_name", label: "Guruh", required: true },
      { key: "day", label: "Kun", type: "date", default: today },
      { key: "present", label: "Kelgan", type: "number", default: 0 },
      { key: "absent", label: "Kelmagan", type: "number", default: 0 },
      { key: "note", label: "Izoh", type: "textarea" },
    ],
    columns: [
      { key: "group_name", label: "Guruh" },
      { key: "day", label: "Kun", type: "date" },
      { key: "present", label: "Kelgan" },
      { key: "absent", label: "Kelmagan" },
      { key: "note", label: "Izoh" },
    ],
  },

  tests: {
    label: "Test va natijalar",
    icon: "star",
    kind: "table",
    table: "panel_results",
    hint: "Imtihon natijalari: o'quvchi, test, ball va sana.",
    fields: [
      { key: "student", label: "O'quvchi", required: true },
      { key: "title", label: "Test nomi", required: true },
      { key: "score", label: "Ball", type: "number", required: true },
      { key: "max_score", label: "Maksimal ball", type: "number", default: 100 },
      { key: "day", label: "Sana", type: "date", default: today },
    ],
    columns: [
      { key: "student", label: "O'quvchi" },
      { key: "title", label: "Test" },
      { key: "score", label: "Ball" },
      { key: "max_score", label: "Max" },
      { key: "day", label: "Sana", type: "date" },
    ],
  },

  marketing: {
    label: "Marketing",
    icon: "trending",
    kind: "table",
    table: "panel_campaigns",
    hint: "SMS, Telegram va Instagram kampaniyalari hamda qamrovi.",
    fields: [
      { key: "name", label: "Kampaniya nomi", required: true },
      {
        key: "channel",
        label: "Kanal",
        type: "select",
        default: "sms",
        options: [
          { v: "sms", l: "SMS" },
          { v: "telegram", l: "Telegram" },
          { v: "instagram", l: "Instagram" },
          { v: "boshqa", l: "Boshqa" },
        ],
      },
      { key: "audience", label: "Qamrov (kishi)", type: "number" },
      {
        key: "status",
        label: "Holat",
        type: "select",
        default: "rejada",
        options: [
          { v: "rejada", l: "Rejada" },
          { v: "yuborildi", l: "Yuborildi" },
          { v: "tugadi", l: "Tugadi" },
        ],
      },
      { key: "day", label: "Sana", type: "date", default: today },
      { key: "note", label: "Izoh", type: "textarea" },
    ],
    columns: [
      { key: "name", label: "Kampaniya" },
      {
        key: "channel",
        label: "Kanal",
        badge: { sms: "badge-success", telegram: "badge-info", instagram: "badge-secondary", boshqa: "badge-ghost" },
      },
      { key: "audience", label: "Qamrov" },
      {
        key: "status",
        label: "Holat",
        badge: { rejada: "badge-ghost", yuborildi: "badge-info", tugadi: "badge-success" },
        badgeText: { rejada: "Rejada", yuborildi: "Yuborildi", tugadi: "Tugadi" },
      },
      { key: "day", label: "Sana", type: "date" },
    ],
  },

  materials: {
    label: "Materiallar",
    icon: "book",
    kind: "table",
    table: "panel_materials",
    hint: "Darsliklar, video va havolalar kutubxonasi.",
    fields: [
      { key: "title", label: "Sarlavha", required: true },
      {
        key: "kind",
        label: "Turi",
        type: "select",
        default: "darslik",
        options: [
          { v: "darslik", l: "Darslik" },
          { v: "video", l: "Video" },
          { v: "test", l: "Test" },
          { v: "boshqa", l: "Boshqa" },
        ],
      },
      { key: "url", label: "Havola", placeholder: "https://..." },
      { key: "group_name", label: "Guruh" },
      { key: "note", label: "Izoh", type: "textarea" },
    ],
    columns: [
      { key: "title", label: "Material" },
      {
        key: "kind",
        label: "Turi",
        badge: { darslik: "badge-info", video: "badge-secondary", test: "badge-warning", boshqa: "badge-ghost" },
      },
      { key: "group_name", label: "Guruh" },
      { key: "url", label: "Havola" },
      { key: "created_at", label: "Sana", type: "date" },
    ],
  },

  analytics: {
    label: "Analitika",
    icon: "chart",
    kind: "analytics",
    hint: "Tushum, o'quvchilar, davomat va test natijalari — bitta hisobot.",
  },

  audit: {
    label: "Audit jurnali",
    icon: "clock",
    kind: "table",
    table: "panel_audit",
    readOnly: true,
    hint: "Panel ichidagi barcha harakatlar: kim, nima, qachon.",
    fields: [],
    columns: [
      { key: "action", label: "Harakat" },
      { key: "detail", label: "Tafsilot" },
      { key: "created_at", label: "Sana", type: "date" },
    ],
  },

  "service-chat": {
    label: "Murojaatlar chati",
    icon: "mail",
    kind: "link",
    to: "/murojaatlar",
    hint: "O'quvchi savollari bitta joyda — javob shu panel orqali yoziladi.",
  },

  website: {
    label: "Markaz sahifasi",
    icon: "globe",
    kind: "link",
    to: "/markazim",
    hint: "Markazingizning ochiq sahifasi: kurslar, manzil va ariza.",
  },
};

/** Do'mondagi ish maydonlari tartibi (tabs shu tartibda chiqadi) */
export const TOOL_ORDER = [
  "crm",
  "schedule",
  "finance",
  "staff",
  "attendance",
  "tests",
  "marketing",
  "materials",
  "analytics",
  "audit",
  "service-chat",
  "website",
];

const TABLES = Object.fromEntries(
  Object.entries(TOOLS)
    .filter(([, cfg]) => cfg.table)
    .map(([key, cfg]) => [key, cfg.table]),
);

export const usePanelToolsStore = defineStore("panelTools", () => {
  const tools = ref([]);
  const roles = ref([]);
  const activePanel = ref(null);
  const data = reactive({});
  const loading = ref(false);
  const saving = ref(false);
  const lastError = ref("");

  const hasAnything = computed(
    () => !!activePanel.value || tools.value.length > 0,
  );

  /** Panel + faol modullardan qaysi ish maydonlari ochiq? */
  async function load() {
    const biz = useBizStore();
    const panels = usePanelsStore();
    const mods = useModulesStore();

    tools.value = [];
    roles.value = [];
    activePanel.value = null;
    if (!biz.center?.id) return;

    await Promise.all([panels.loadMine(), mods.loadMine()]);

    const set = new Set();
    const panel = panels.activePanel;
    if (panel) {
      activePanel.value = panel;
      (panel.panel_products?.tools ?? []).forEach((t) => set.add(t));
      roles.value = panel.panel_products?.roles ?? [];
    }
    mods.mine
      .filter((m) => mods.isActive(m.module_id))
      .forEach((m) => {
        if (m.modules?.tool) set.add(m.modules.tool);
      });

    tools.value = TOOL_ORDER.filter((t) => set.has(t));
    await loadData();
  }

  /** Ochiq maydonlarning jadvallarini yuklash */
  async function loadData() {
    const biz = useBizStore();
    if (!biz.center?.id) return;

    const tables = new Set();
    tools.value.forEach((t) => {
      const cfg = TOOLS[t];
      if (cfg?.table) tables.add(cfg.table);
      if (t === "analytics") {
        [
          "panel_students",
          "panel_payments",
          "panel_groups",
          "panel_campaigns",
          "panel_results",
          "panel_attendance",
        ].forEach((x) => tables.add(x));
      }
    });

    loading.value = true;
    await Promise.all(
      [...tables].map(async (table) => {
        const { data: rows, error } = await supabase
          .from(table)
          .select("*")
          .eq("center_id", biz.center.id)
          .order("created_at", { ascending: false })
          .limit(300);
        if (!error) data[table] = rows ?? [];
      }),
    );
    loading.value = false;
  }

  function rowsOf(toolKey) {
    const table = TABLES[toolKey];
    return table ? (data[table] ?? []) : [];
  }

  async function logAudit(action, detail) {
    const biz = useBizStore();
    if (!biz.center?.id) return;
    try {
      await supabase
        .from("panel_audit")
        .insert({ center_id: biz.center.id, action, detail });
    } catch {
      /* audit ixtiyoriy */
    }
  }

  function rowTitle(cfg, row) {
    return (
      row.full_name ||
      row.name ||
      row.title ||
      row.student ||
      row.group_name ||
      row.action ||
      ""
    );
  }

  async function add(toolKey, payload) {
    const cfg = TOOLS[toolKey];
    if (!cfg?.table) throw new Error("Bu bo'lim uchun jadval yo'q");
    const biz = useBizStore();
    if (!biz.center?.id) throw new Error("Avval markaz tanlang");

    saving.value = true;
    lastError.value = "";
    try {
      const { data: row, error } = await supabase
        .from(cfg.table)
        .insert({ ...payload, center_id: biz.center.id })
        .select("*")
        .single();
      if (error) {
        lastError.value = error.message;
        throw error;
      }
      data[cfg.table] = [row, ...(data[cfg.table] ?? [])];
      await logAudit("Qo'shildi", `${cfg.label}: ${rowTitle(cfg, row)}`);
      return row;
    } finally {
      saving.value = false;
    }
  }

  async function remove(toolKey, id) {
    const cfg = TOOLS[toolKey];
    if (!cfg?.table) throw new Error("Bu bo'lim uchun jadval yo'q");

    const row = (data[cfg.table] ?? []).find((r) => r.id === id);
    saving.value = true;
    lastError.value = "";
    try {
      const { error } = await supabase
        .from(cfg.table)
        .delete()
        .eq("id", id);
      if (error) {
        lastError.value = error.message;
        throw error;
      }
      data[cfg.table] = (data[cfg.table] ?? []).filter((r) => r.id !== id);
      await logAudit("O'chirildi", `${cfg.label}: ${row ? rowTitle(cfg, row) : id}`);
    } finally {
      saving.value = false;
    }
  }

  /** Analitika: ochiq maydonlardan hisoblanadi */
  const analytics = computed(() => {
    const students = data["panel_students"] ?? [];
    const payments = data["panel_payments"] ?? [];
    const groups = data["panel_groups"] ?? [];
    const campaigns = data["panel_campaigns"] ?? [];
    const results = data["panel_results"] ?? [];
    const attendance = data["panel_attendance"] ?? [];

    const now = new Date();
    const monthPayments = payments.filter((p) => {
      const d = new Date(p.paid_on || p.created_at);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    });
    const sum = (list) =>
      list.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const present = attendance.reduce((s, a) => s + (Number(a.present) || 0), 0);
    const absent = attendance.reduce((s, a) => s + (Number(a.absent) || 0), 0);
    const totalDays = present + absent;

    return {
      students: students.length,
      groups: groups.length,
      payments: payments.length,
      total: sum(payments),
      monthTotal: sum(monthPayments),
      campaigns: campaigns.length,
      avgScore: results.length
        ? Math.round(
            results.reduce((s, r) => s + (Number(r.score) || 0), 0) /
              results.length,
          )
        : 0,
      attendanceRate: totalDays ? Math.round((present / totalDays) * 100) : 0,
    };
  });

  function reset() {
    tools.value = [];
    roles.value = [];
    activePanel.value = null;
    Object.keys(data).forEach((k) => delete data[k]);
    lastError.value = "";
  }

  return {
    tools,
    roles,
    activePanel,
    data,
    loading,
    saving,
    lastError,
    hasAnything,
    analytics,
    load,
    loadData,
    rowsOf,
    add,
    remove,
    reset,
  };
});
