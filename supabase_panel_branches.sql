-- ============================================================
--  FindTheWay — FILIALLAR VA DARAJALAR FARQI (panel_branches)
--  Supabase → SQL Editor → shu faylni to'liq nusxalab RUN bosing.
--
--  ⚠️ Avval ishga tushirilgan bo'lishi kerak:
--     supabase_setup.sql + supabase_biznes.sql
--     supabase_modules.sql + supabase_panels.sql
--     supabase_panel_tools.sql
--
--  G'oya: katta panellar kichik panellardan ANIQ farq qilishi
--  uchun ish maydonlari soni ortadi:
--   1) panel_branches — filiallar boshqaruvi (faqat katta panellar)
--   2) talabalar va to'lovlarga branch_id — filialga bog'lash
--   3) xodimlarga shift (smena) — "HR va smenalar" va'dasi
--   4) flagship: 13 ta ish maydoni (HAMMASI, sayt va chat ham)
--   5) enterprise: 10 ta ish maydoni
--   6) filiallar moduli — kichik panellar alohida ham sotib oladi
--  Fayl xavfsiz: qayta RUN qilsak ham xato bermaydi.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Filiallar jadvali (har bir yozuv center_id bilan)
-- ------------------------------------------------------------
create table if not exists public.panel_branches (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers (id) on delete cascade,
  name        text not null,
  address     text,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists panel_branches_center_idx
  on public.panel_branches (center_id, created_at desc);

alter table public.panel_branches enable row level security;

drop policy if exists "panel_branches_owner" on public.panel_branches;
create policy "panel_branches_owner" on public.panel_branches for all
  using (
    exists (
      select 1 from public.centers c
      where c.id = panel_branches.center_id and c.owner_id = auth.uid()
    ) or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.centers c
      where c.id = panel_branches.center_id and c.owner_id = auth.uid()
    ) or public.is_admin()
  );


-- ------------------------------------------------------------
-- 2) Filialga bog'lash ustunlari + smena
--    (eski satrlar NULL qoladi — muammo emas)
-- ------------------------------------------------------------
alter table public.panel_students
  add column if not exists branch_id uuid references public.panel_branches (id) on delete set null;

alter table public.panel_payments
  add column if not exists branch_id uuid references public.panel_branches (id) on delete set null;

alter table public.panel_staff
  add column if not exists shift text;

create index if not exists panel_students_branch_idx
  on public.panel_students (branch_id);
create index if not exists panel_payments_branch_idx
  on public.panel_payments (branch_id);


-- ------------------------------------------------------------
-- 3) Modullar jadvalida tool ustuni bo'lishi shart
-- ------------------------------------------------------------
alter table public.modules
  add column if not exists tool text;

-- Filiallar moduli — kichik/o'rta panellar alohida sotib oladi
insert into public.modules (slug, name, short, description, features, price_monthly, sort, tool)
values
('branches', 'Filiallar', 'Bir necha filialni boshqarish',
 'Markazning filiallarini qo''shing: manzil, telefon va holati. Filialga bog''langan talabalar va to''lovlar bo''yicha alohida hisobot ochiladi.',
 '["Filial qo''shish (manzil, telefon)", "Filialga talaba biriktirish", "Filialga to''lov biriktirish", "Filiallar kesimida tushum hisoboti", "Faol/nofaol filial holati"]'::jsonb,
 70000, 11, 'branches')
on conflict (slug) do update
set name = excluded.name,
    short = excluded.short,
    description = excluded.description,
    features = excluded.features,
    price_monthly = excluded.price_monthly,
    tool = excluded.tool;


-- ------------------------------------------------------------
-- 4) Panellarga ish maydonlari — darajalar aniq farq qiladi
--    flagship: 13 ta (barcha maydonlar) — "to'liq butun panel"
--    enterprise: 10 ta
-- ------------------------------------------------------------
update public.panel_products set tools = '[
  "branches",
  "crm", "schedule", "finance", "staff", "attendance",
  "tests", "marketing", "materials", "analytics", "audit",
  "service-chat", "website"
]'::jsonb where slug = 'flagship-network';

update public.panel_products set tools = '[
  "branches",
  "crm", "schedule", "finance", "staff", "attendance",
  "tests", "marketing", "analytics", "audit"
]'::jsonb where slug = 'enterprise-suite';

-- Flagman va'dalarini ro'yxatga moslash (sayt ham ochiladi)
update public.panel_products set features = '[
  "Filiallar boshqaruvi",
  "Filiallar kesimida hisobot",
  "8 xil rol va huquqlar",
  "Markazlashgan kassa",
  "Marketing tarmog''i",
  "HR va smenalar",
  "Audit jurnali",
  "Konsolidatsiyalangan moliya",
  "Mijozlar chati va sayt to''liq kiritilgan"
]'::jsonb where slug = 'flagship-network';

update public.panel_products set features = '[
  "Direktor paneli",
  "Admin boshqaruv",
  "Filiallar boshqaruvi va hisoboti",
  "Kassa va moliya",
  "O''qituvchilar jadvali",
  "HR va maosh (smena bilan)",
  "Marketing kampaniyalari",
  "Kengaytirilgan hisobotlar",
  "Audit jurnali"
]'::jsonb where slug = 'enterprise-suite';

-- ============================================================
--  Tayyor. Keyingi qadam:
--  Biznes → /panellar (do'kon) va /panelim (ish maydoni).
--  Eski frontend ishlayveradi: filial maydonlari SQL'dan keyin
--  faqat katta panellarda ko'rinadi (requiresTool hisobida).
-- ============================================================
