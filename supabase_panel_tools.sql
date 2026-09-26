-- ============================================================
--  FindTheWay — PANEL ISH MAYDONLARI (real funksiyalar, rasmlar emas)
--  Supabase → SQL Editor → shu faylni to'liq nusxalab RUN bosing.
--
--  ⚠️ Avval ishga tushirilgan bo'lishi kerak:
--     supabase_setup.sql + supabase_biznes.sql
--     supabase_modules.sql + supabase_panels.sql
--
--  G'oya: sotib olingan PANEL yoki MODUL — markazga real
--  ish maydonini ochadi (CRM, kassa, jadval, davomat, test,
--  marketing, materiallar, analitika, audit). Har bir yozuv
--  center_id bilan — markazlar ma'lumoti aralashmaydi.
--  Fayl xavfsiz: qayta RUN qilsak ham xato bermaydi.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Modullarga — qaysi ish maydonini ochadi (tool)
-- ------------------------------------------------------------
alter table public.modules
  add column if not exists tool text;

update public.modules set tool = 'crm'         where slug = 'students-crm';
update public.modules set tool = 'schedule'    where slug = 'schedule';
update public.modules set tool = 'finance'     where slug = 'finance';
update public.modules set tool = 'staff'       where slug = 'staff';
update public.modules set tool = 'marketing'   where slug = 'marketing';
update public.modules set tool = 'attendance'  where slug = 'attendance';
update public.modules set tool = 'tests'       where slug = 'tests';
update public.modules set tool = 'service-chat' where slug = 'service-chat';
update public.modules set tool = 'website'     where slug = 'website';
update public.modules set tool = 'analytics'   where slug = 'analytics';

-- Modullarga ko'proq vazifalar (zamonaviy ro'yxat)
update public.modules set features = '[
  "Ariza yuborgan talabalar ro''yxati",
  "Holatlar: yangi, kontaktda, qabul qilindi",
  "Izoh va eslatmalar",
  "Qo''ng''iroq tugmasi",
  "Kurs bo''yicha saralash",
  "O''quvchi qo''shish / tahrirlash"
]'::jsonb where slug = 'students-crm';

update public.modules set features = '[
  "Guruh yaratish",
  "O''qituvchi va vaqt belgilash",
  "Haftalik jadval ko''rinishi",
  "To''qnashuvlarni tekshirish",
  "Xona va sig''im boshqaruvi",
  "Guruhlar kesimida o''quvchilar"
]'::jsonb where slug = 'schedule';

update public.modules set features = '[
  "Daromad hisoboti",
  "To''lovlar tarixi",
  "Qarzdorlar ro''yxati",
  "Excel eksport",
  "Kunlik / oylik kassa",
  "To''lov turini ajratish"
]'::jsonb where slug = 'finance';

update public.modules set features = '[
  "Xodimlar ro''yxati",
  "Oylik maosh hisobi",
  "Ish yuklamasi",
  "Shartnoma muddatlari",
  "Rol belgilash: kassir, o''qituvchi, admin",
  "Telefon va lavozim kartasi"
]'::jsonb where slug = 'staff';

update public.modules set features = '[
  "SMS/Telegram yuborish",
  "Kampaniya shablonlari",
  "Yuborilganlar tarixi",
  "Konversiya hisoboti",
  "Kanal bo''yicha natija (sms, telegram, instagram)",
  "Qamrov sonini kuzatish"
]'::jsonb where slug = 'marketing';

update public.modules set features = '[
  "Davomat qayd etish",
  "Kelmaganlar ro''yxati",
  "Oylik statistika",
  "Eslatma yuborish",
  "Kunlik kelgan / kelmagan hisobi",
  "Davomat foizi (analitikada)"
]'::jsonb where slug = 'attendance';

update public.modules set features = '[
  "Test yaratish",
  "Natijalarni kiritish",
  "Reyting jadvali",
  "Rivojlanish grafigi",
  "O''rtacha ball hisobi",
  "Maksimal ballni belgilash"
]'::jsonb where slug = 'tests';

update public.modules set features = '[
  "Yagona qabul qutisi",
  "Tez javob shablonlari",
  "O''quvchi kartasi",
  "Holat belgilari",
  "Murojaatlar tarixi",
  "Telefon raqamga ulash"
]'::jsonb where slug = 'service-chat';

update public.modules set features = '[
  "Fotogalereya",
  "O''qituvchilar bloki",
  "Sharhlar",
  "Onlayn qabul tugmasi",
  "Xarita va mo''ljal",
  "Onlayn ariza qabul qilish"
]'::jsonb where slug = 'website';

update public.modules set features = '[
  "Konversiya hisoboti",
  "Yo''nalishlar bo''yicha tahlil",
  "Trend grafiklari",
  "PDF hisobot",
  "Kunlik kassa va o''rtacha ball",
  "Davomat foizi"
]'::jsonb where slug = 'analytics';


-- ------------------------------------------------------------
-- 2) Panellarga — qaysi ish maydonlari tegishli (tools)
--    Har bir panel funksiya jihatidan bir-biridan farq qiladi.
-- ------------------------------------------------------------
alter table public.panel_products
  add column if not exists tools jsonb not null default '[]'::jsonb;

update public.panel_products set tools = '[
  "finance"
]'::jsonb where slug = 'mini-kassir';

update public.panel_products set tools = '[
  "crm", "finance"
]'::jsonb where slug = 'starter-base';

update public.panel_products set tools = '[
  "schedule", "attendance"
]'::jsonb where slug = 'group-lite';

update public.panel_products set tools = '[
  "crm", "schedule", "finance"
]'::jsonb where slug = 'tutor-pro';

update public.panel_products set tools = '[
  "crm", "tests", "analytics"
]'::jsonb where slug = 'exam-center';

update public.panel_products set tools = '[
  "crm", "schedule", "materials", "analytics"
]'::jsonb where slug = 'online-studio';

update public.panel_products set tools = '[
  "crm", "schedule", "finance", "staff"
]'::jsonb where slug = 'standard-office';

update public.panel_products set tools = '[
  "crm", "finance", "staff", "marketing", "analytics"
]'::jsonb where slug = 'growth-office';

update public.panel_products set tools = '[
  "crm", "schedule", "finance", "staff", "attendance",
  "tests", "analytics", "audit"
]'::jsonb where slug = 'enterprise-suite';

update public.panel_products set tools = '[
  "crm", "schedule", "finance", "staff", "attendance",
  "tests", "marketing", "materials", "analytics", "audit"
]'::jsonb where slug = 'flagship-network';


-- ------------------------------------------------------------
-- 3) Ish maydonlari jadvallari (har biri center_id bilan)
-- ------------------------------------------------------------

-- CRM: talabalar bazasi
create table if not exists public.panel_students (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers (id) on delete cascade,
  full_name   text not null,
  phone       text,
  course      text,
  status      text not null default 'yangi',
  note        text,
  created_at  timestamptz not null default now()
);

-- Jadval: guruhlar
create table if not exists public.panel_groups (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers (id) on delete cascade,
  name        text not null,
  course      text,
  teacher     text,
  room        text,
  days        text,
  time        text,
  capacity    integer,
  created_at  timestamptz not null default now()
);

-- Kassa: to'lovlar
create table if not exists public.panel_payments (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers (id) on delete cascade,
  student     text not null,
  amount      integer not null default 0,
  kind        text not null default 'oylik',
  note        text,
  paid_on     date not null default current_date,
  created_at  timestamptz not null default now()
);

-- Xodimlar va rollar
create table if not exists public.panel_staff (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers (id) on delete cascade,
  name        text not null,
  role        text not null default 'o''qituvchi',
  phone       text,
  salary      integer,
  created_at  timestamptz not null default now()
);

-- Davomat
create table if not exists public.panel_attendance (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers (id) on delete cascade,
  group_name  text not null,
  day         date not null default current_date,
  present     integer not null default 0,
  absent      integer not null default 0,
  note        text,
  created_at  timestamptz not null default now()
);

-- Test va natijalar
create table if not exists public.panel_results (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers (id) on delete cascade,
  student     text not null,
  title       text not null,
  score       integer not null default 0,
  max_score   integer not null default 100,
  day         date not null default current_date,
  created_at  timestamptz not null default now()
);

-- Marketing kampaniyalari
create table if not exists public.panel_campaigns (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers (id) on delete cascade,
  name        text not null,
  channel     text not null default 'sms',
  audience    integer,
  status      text not null default 'rejada',
  note        text,
  day         date not null default current_date,
  created_at  timestamptz not null default now()
);

-- Materiallar kutubxonasi
create table if not exists public.panel_materials (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers (id) on delete cascade,
  title       text not null,
  kind        text not null default 'darslik',
  url         text,
  group_name  text,
  note        text,
  created_at  timestamptz not null default now()
);

-- Audit jurnali (panel ichidagi harakatlar)
create table if not exists public.panel_audit (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers (id) on delete cascade,
  action      text not null,
  detail      text,
  created_at  timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 4) Indekslar + RLS (faqat markaz egasi yoki admin)
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'panel_students', 'panel_groups', 'panel_payments', 'panel_staff',
    'panel_attendance', 'panel_results', 'panel_campaigns',
    'panel_materials', 'panel_audit'
  ]
  loop
    execute format(
      'create index if not exists %I on public.%I (center_id, created_at desc)',
      t || '_center_idx', t
    );
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s_owner" on public.%I', t, t);
    execute format(
      'create policy "%s_owner" on public.%I for all
       using (
         exists (
           select 1 from public.centers c
           where c.id = %I.center_id and c.owner_id = auth.uid()
         ) or public.is_admin()
       )
       with check (
         exists (
           select 1 from public.centers c
           where c.id = %I.center_id and c.owner_id = auth.uid()
         ) or public.is_admin()
       )',
      t, t, t, t
    );
  end loop;
end $$;

-- ============================================================
--  Tayyor. Keyingi qadam:
--  Biznes → /panellar (do'kon) va /panelim (ish maydoni).
-- ============================================================
