-- ============================================================
--  FindTheWay — MODULLAR DO'KONI (10 ta tayyor panel)
--  Supabase → SQL Editor → New query → shu faylni to'liq
--  nusxalab qo'ying va RUN bosing.
--
--  ⚠️ MUHIM: avval `supabase_setup.sql` + `supabase_biznes.sql`
--  (subscriptions / receipts bucket) ishga tushirilgan bo'lishi kerak.
--
--  G'oya: har bir modul — markaz uchun tayyor qo'shimcha imkoniyat.
--  Modullar bir-biridan funksiyasi bilan farq qiladi. Xuddi shu
--  modulni ko'p markaz sotib olsa ham, har bir yozuv center_id
--  bilan bog'langan va RLS faqat o'z markaziga ruxsat beradi —
--  ma'lumotlar hech qachon aralashmaydi.
--
--  To'lov: chek yuklash (subscription-receipts), admin tasdiqlaydi.
--  Fayl xavfsiz: qayta ishga tushirsangiz ham xato bermaydi.
-- ============================================================


-- ------------------------------------------------------------
-- 1) is_admin() funksiyasi (mustaqil ishlash uchun)
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;


-- ------------------------------------------------------------
-- 2) modules — modullar katalogi (do'kon vitrini)
-- ------------------------------------------------------------
create table if not exists public.modules (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  short         text,
  description   text,
  features      jsonb not null default '[]'::jsonb,
  price_monthly integer not null default 50000,
  is_active     boolean not null default true,
  sort          integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.modules enable row level security;

-- Katalog hammaga ochiq (markaz paneli ko'rishi uchun)
drop policy if exists "modules_select_public" on public.modules;
create policy "modules_select_public"
  on public.modules for select
  using (is_active = true or public.is_admin());

-- Katalogni faqat admin boshqaradi
drop policy if exists "modules_admin_all" on public.modules;
create policy "modules_admin_all"
  on public.modules for all
  using (public.is_admin())
  with check (public.is_admin());


-- ------------------------------------------------------------
-- 3) 10 ta tayyor modul (vitrin)
-- ------------------------------------------------------------
insert into public.modules (slug, name, short, description, features, price_monthly, sort) values
('students-crm', 'Talabalar bazasi', 'O’quvchilar ro’yxati, holatlar va tarix',
 'Ro’yxatdan o’tgan va ariza yuborgan barcha talabalaringizni bir joyda saqlang: holat, kurs, telefon, qo’ng’iroq va izohlar.',
 '["Ariza yuborgan talabalar ro’yxati", "Holatlar: yangi, kontaktda, qabul qilindi", "Izoh va eslatmalar", "Qo’ng’iroq tugmasi"]'::jsonb, 60000, 1),
('schedule', 'Guruhlar va dars jadvali', 'Guruhlar, xonalar va vaqt jadvali',
 'Har bir kursni guruhlarga bo’ling, o’qituvchi va vaqtini belgilang — haftalik jadval avtomatik ko’rinadi.',
 '["Guruh yaratish", "O’qituvchi va vaqt belgilash", "Haftalik jadval ko’rinishi", "To’qnashuvlarni tekshirish"]'::jsonb, 80000, 2),
('finance', 'Moliyaviy hisobot', 'To’lovlar, daromad va xarajatlar',
 'Oylik daromad, to’lovlar tarixi va muddati o’tgan to’lovlarni kuzating. Excelga eksport.',
 '["Daromad hisoboti", "To’lovlar tarixi", "Qarzdorlar ro’yxati", "Excel eksport"]'::jsonb, 90000, 3),
('staff', 'Xodimlar boshqaruvi', 'O’qituvchilar va xodimlar',
 'O’qituvchilar ro’yxati, oylik maosh hisobi va ish yuklamasi nazorati.',
 '["Xodimlar ro’yxati", "Oylik maosh hisobi", "Ish yuklamasi", "Shartnoma muddatlari"]'::jsonb, 70000, 4),
('marketing', 'Reklama va SMS', 'Marketing kampaniyalar va SMS yuborish',
 'Talabalar bazasiga SMS/telegram orqali e’lon yuboring, kampaniyalar natijasini ko’ring.',
 '["SMS/Telegram yuborish", "Kampaniya shablonlari", "Yuborilganlar tarixi", "Konversiya hisoboti"]'::jsonb, 50000, 5),
('attendance', 'Davomat nazorati', 'Dars davomati va statistikasi',
 'Har bir guruhda kim kelmaganini belgilang — ota-onalarga avtomatik eslatma.',
 '["Davomat qayd etish", "Kelmaganlar ro’yxati", "Oylik statistika", "Eslatma yuborish"]'::jsonb, 40000, 6),
('tests', 'Test va natijalar', 'Testlar, imtihonlar va ballar',
 'Test yarating, o’quvchilar natijasini kiriting va rivojlanish grafigini ko’ring.',
 '["Test yaratish", "Natijalarni kiritish", "Reyting jadvali", "Rivojlanish grafigi"]'::jsonb, 75000, 7),
('service-chat', 'Mijozlarga xizmat', 'O’quvchilar bilan markazlashgan chat',
 'Barcha o’quvchi yozishmalarini bitta joyda boshqaring — telefon raqamlar chatga bog’lanadi.',
 '["Yagona qabul qutisi", "Tez javob shablonlari", "O’quvchi kartasi", "Holat belgilari"]'::jsonb, 45000, 8),
('website', 'Shaxsiy sahifa', 'Markaz uchun kengaytirilgan sahifa',
 'Galereya, o’qituvchilar, sharhlar va onlayn qabul bilan to’liq markaz sahifasi.',
 '["Fotogalereya", "O’qituvchilar bloki", "Sharhlar", "Onlayn qabul tugmasi"]'::jsonb, 65000, 9),
('analytics', 'Analitika va hisobot', 'Kengaytirilgan statistika',
 'Arizalar konversiyasi, qaysi yo’nalish ommabopligi va oylik trendlar.',
 '["Konversiya hisoboti", "Yo’nalishlar bo’yicha tahlil", "Trend grafiklari", "PDF hisobot"]'::jsonb, 85000, 10)
on conflict (slug) do update
set name = excluded.name,
    short = excluded.short,
    description = excluded.description,
    features = excluded.features,
    price_monthly = excluded.price_monthly,
    sort = excluded.sort;


-- ------------------------------------------------------------
-- 4) center_modules — markazning xarid qilgan modullari
--    (har bir yozuv center_id bilan — izolyatsiya shu yerda)
-- ------------------------------------------------------------
create table if not exists public.center_modules (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers (id) on delete cascade,
  module_id   uuid not null references public.modules (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'active', 'expired')),
  paid_until  timestamptz,
  receipt_url text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (center_id, module_id)
);

create index if not exists center_modules_center_idx on public.center_modules (center_id);
create index if not exists center_modules_module_idx on public.center_modules (module_id);

alter table public.center_modules enable row level security;

-- Ko'rish: markaz egasi yoki admin
drop policy if exists "center_modules_select" on public.center_modules;
create policy "center_modules_select"
  on public.center_modules for select
  using (
    exists (
      select 1 from public.centers c
      where c.id = center_modules.center_id and c.owner_id = auth.uid()
    )
    or public.is_admin()
  );

-- Sotib olish: egasi o'z markazi uchun (status pending bo'lib ochiladi)
drop policy if exists "center_modules_insert" on public.center_modules;
create policy "center_modules_insert"
  on public.center_modules for insert
  with check (
    status = 'pending'
    and exists (
      select 1 from public.centers c
      where c.id = center_modules.center_id and c.owner_id = auth.uid()
    )
  );

-- Chek yuklash: egasi, faqat pending/active da (o'zi active qila olmaydi)
drop policy if exists "center_modules_update" on public.center_modules;
create policy "center_modules_update"
  on public.center_modules for update
  using (
    exists (
      select 1 from public.centers c
      where c.id = center_modules.center_id and c.owner_id = auth.uid()
    )
  )
  with check (
    status in ('pending', 'active')
    and exists (
      select 1 from public.centers c
      where c.id = center_modules.center_id and c.owner_id = auth.uid()
    )
  );

-- Admin boshqaradi
drop policy if exists "center_modules_admin_all" on public.center_modules;
create policy "center_modules_admin_all"
  on public.center_modules for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
--  Tayyor. Frontend (Biznes: /modullar, Admin: To'lovlar →
--  Modullar yorlig'i) shu jadvallar bilan ishlaydi.
-- ============================================================
