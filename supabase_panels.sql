-- ============================================================
--  FindTheWay — TAYYOR ADMIN PANELLAR DO'KONI (10 daraja)
--  Supabase → SQL Editor → shu faylni to'liq nusxalab RUN bosing.
--
--  ⚠️ Avval supabase_setup.sql + supabase_biznes.sql ishga
--  tushirilgan bo'lishi kerak (profiles, centers, receipts bucket).
--
--  G'oya: modullardan tashqari markazlar TO'LIQ tayyor admin
--  panellarni sotib oladi. Har bir panel o'z funksiyalari va
--  ROLLARI bilan farq qiladi; kattadan kichikgacha 10 daraja.
--  Bir xil panelni ko'p markaz sotib olsa ham, har bir yozuv
--  center_id bilan bog'lanadi — ma'lumotlar aralashmaydi.
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
-- 2) panel_products — tayyor panellar katalogi
--    tier: mini | small | medium | large | flagship
-- ------------------------------------------------------------
create table if not exists public.panel_products (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  short         text,
  description   text,
  tier          text not null default 'medium'
                check (tier in ('mini', 'small', 'medium', 'large', 'flagship')),
  roles         jsonb not null default '[]'::jsonb,
  features      jsonb not null default '[]'::jsonb,
  price_monthly integer not null default 50000,
  is_active     boolean not null default true,
  sort          integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.panel_products enable row level security;

drop policy if exists "panel_products_select" on public.panel_products;
create policy "panel_products_select"
  on public.panel_products for select
  using (is_active = true or public.is_admin());

drop policy if exists "panel_products_admin_all" on public.panel_products;
create policy "panel_products_admin_all"
  on public.panel_products for all
  using (public.is_admin())
  with check (public.is_admin());


-- ------------------------------------------------------------
-- 3) 10 ta tayyor panel — kichikdan ENG KATTAGACHA
-- ------------------------------------------------------------
insert into public.panel_products (slug, name, short, description, tier, roles, features, price_monthly, sort) values
('mini-kassir', 'Mini Kassir', 'Kichik markaz uchun oddiy kassa',
 'Faqat kassir uchun: kundalik to''lovlar, kvitantsiya va oddiy hisob. Kichik o''quv markazni bir qo''l bilan boshqarish.',
 'mini', '["kassir"]'::jsonb,
 '["Kundalik to''lov qabul qilish","Kvitantsiya chiqarish","Kunlik yig''indi","O''quvchi tezkor qidiruv"]'::jsonb,
 30000, 1),
('starter-base', 'Starter Baza', 'O''quvchilar bazasi + to''lovlar',
 'Kichik markaz uchun: o''quvchilar ro''yxati, telefonlar, to''lov tarixi va eslatmalar.',
 'small', '["ega","kassir"]'::jsonb,
 '["O''quvchilar bazasi","To''lovlar jurnali","Qarzdorlar ro''yxati","Izoh va eslatmalar","Qo''ng''iroq tugmasi"]'::jsonb,
 50000, 2),
('group-lite', 'Guruh Jadvali', 'Guruhlar, xonalar va dars jadvali',
 'Guruhlarga bo''ling, o''qituvchi va vaqtni belgilang — haftalik jadval va davomat bilan.',
 'small', '["ega","o''qituvchi"]'::jsonb,
 '["Guruh yaratish","Haftalik jadval","Davomat belgilash","Xona va vaqt boshqaruvi","To''qnashuv tekshiruvi"]'::jsonb,
 60000, 3),
('tutor-pro', 'Repetitor Pro', 'Individual o''qituvchi uchun shaxsiy panel',
 'Repetitor va kichik studiya uchun: shaxsiy o''quvchilar, darslar jadvali va to''lovlar.',
 'medium', '["o''qituvchi","assistent"]'::jsonb,
 '["Shaxsiy o''quvchilar","Darslar jadvali","Dars narxlari","To''lovlar kuzatuvi","Oylik daromad"]'::jsonb,
 55000, 4),
('exam-center', 'Test Markazi', 'Imtihonlar, ballar va sertifikatlar',
 'Imtihon o''tkazadigan markazlar uchun: testlar, nazoratchi rollari, ballar va sertifikatlar.',
 'medium', '["ega","nazoratchi"]'::jsonb,
 '["Imtihon yaratish","Ballarni kiritish","Nazoratchi roli","Reyting jadvali","Sertifikat chiqarish"]'::jsonb,
 70000, 5),
('online-studio', 'Onlayn Studio', 'Onlayn darslar va materiallar',
 'Onlayn o''qitadigan markazlar uchun: dars havolalari, materiallar va o''quvchi kirishlari.',
 'medium', '["ega","moderator","o''qituvchi"]'::jsonb,
 '["Onlayn dars havolalari","Materiallar kutubxonasi","O''quvchi kirish nazorati","Dars qaydlari","Yuklamalar statistikasi"]'::jsonb,
 85000, 6),
('standard-office', 'Standart Ofis', 'Kassir + admin + CRM',
 'O''rta markaz uchun to''liq ofis: CRM, jadval, moliya va xodimlar bitta joyda.',
 'medium', '["ega","admin","kassir"]'::jsonb,
 '["Talabalar CRM","Guruh va jadval","Moliyaviy hisobot","Xodimlar ro''yxati","Kassa smenasi","Arizalar konversiyasi"]'::jsonb,
 90000, 7),
('growth-office', 'Growth Ofis', 'Marketing va konversiya bilan',
 'O''sishga yo''naltirilgan panel: marketing kampaniyalari, konversiya voronkasi va hisobotlar.',
 'large', '["ega","admin","kassir","marketing"]'::jsonb,
 '["Marketing kampaniyalari","SMS/Telegram yuborish","Konversiya voronkasi","Manba tahlili","Moliya + CRM","Xodimlar samaradorligi"]'::jsonb,
 140000, 8),
('enterprise-suite', 'Korporat Suite', 'To''liq boshqaruv: 6 rol',
 'Katta markaz uchun to''liq tizim: direktor, admin, kassir, o''qituvchi, HR va hisobotlar.',
 'large', '["ega","direktor","admin","kassir","o''qituvchi","hr"]'::jsonb,
 '["Direktor paneli","Admin boshqaruv","Kassa va moliya","O''qituvchilar jadvali","HR va maosh","Kengaytirilgan hisobotlar","Audit jurnali"]'::jsonb,
 190000, 9),
('flagship-network', 'Tarmoq Boshqaruvi', 'ENG KATTA: filiallar, 8 rol, audit',
 'Eng katta o''quv tarmoqlari uchun: filiallar boshqaruvi, 8 xil rol, konsolidatsiyalangan hisobotlar va audit.',
 'flagship', '["ega","direktor","filial-admin","kassir","o''qituvchi","marketing","hr","auditor"]'::jsonb,
 '["Filiallar boshqaruvi","Filiallar kesimida hisobot","8 xil rol va huquqlar","Markazlashgan kassa","Marketing tarmog''i","HR va smenalar","Audit jurnali","Konsolidatsiyalangan moliya"]'::jsonb,
 290000, 10)
on conflict (slug) do update
set name = excluded.name,
    short = excluded.short,
    description = excluded.description,
    tier = excluded.tier,
    roles = excluded.roles,
    features = excluded.features,
    price_monthly = excluded.price_monthly,
    sort = excluded.sort;


-- ------------------------------------------------------------
-- 4) center_panels — markazning xarid qilgan panellari
--    (har bir yozuv center_id bilan — izolyatsiya shu yerda)
--    data ustuni: shu markazning panel ichidagi ma'lumotlari
-- ------------------------------------------------------------
create table if not exists public.center_panels (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers (id) on delete cascade,
  panel_id    uuid not null references public.panel_products (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'active', 'expired')),
  paid_until  timestamptz,
  receipt_url text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (center_id, panel_id)
);

create index if not exists center_panels_center_idx on public.center_panels (center_id);
create index if not exists center_panels_panel_idx on public.center_panels (panel_id);

alter table public.center_panels enable row level security;

drop policy if exists "center_panels_select" on public.center_panels;
create policy "center_panels_select"
  on public.center_panels for select
  using (
    exists (
      select 1 from public.centers c
      where c.id = center_panels.center_id and c.owner_id = auth.uid()
    )
    or public.is_admin()
  );

drop policy if exists "center_panels_insert" on public.center_panels;
create policy "center_panels_insert"
  on public.center_panels for insert
  with check (
    status = 'pending'
    and exists (
      select 1 from public.centers c
      where c.id = center_panels.center_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "center_panels_update" on public.center_panels;
create policy "center_panels_update"
  on public.center_panels for update
  using (
    exists (
      select 1 from public.centers c
      where c.id = center_panels.center_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.centers c
      where c.id = center_panels.center_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "center_panels_admin_all" on public.center_panels;
create policy "center_panels_admin_all"
  on public.center_panels for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
--  Tayyor. Biznes: /panellar (do'kon + "Panelim" ish maydoni),
--  Admin: To'lovlar → Panellar yorlig'i.
-- ============================================================
