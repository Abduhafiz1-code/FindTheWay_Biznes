-- ============================================================
--  FindTheWay Biznes — arizalar va kurslar sxemasi
--  Supabase panel → SQL Editor → New query → shu faylni to'liq
--  nusxalab qo'ying va RUN bosing.
--
--  ⚠️ MUHIM: avval `supabase_setup.sql` (profiles + centers) ni
--  ishga tushiring. Bu fayl o'sha jadvallar ustiga quriladi.
-- ============================================================


-- ------------------------------------------------------------
-- 0) centers jadvaliga qo'shimcha ustunlar (agar yo'q bo'lsa)
-- ------------------------------------------------------------
alter table public.centers add column if not exists website text;
alter table public.centers add column if not exists updated_at timestamptz not null default now();

drop trigger if exists centers_touch_updated_at on public.centers;
create trigger centers_touch_updated_at
  before update on public.centers
  for each row
  execute function public.touch_updated_at();


-- ------------------------------------------------------------
-- 1) COURSES — markazning kurslari
-- ------------------------------------------------------------
create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers (id) on delete cascade,
  name        text not null,
  level       text,
  price       integer,
  duration    text,
  group_size  integer,
  schedule    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists courses_center_id_idx on public.courses (center_id);

drop trigger if exists courses_touch_updated_at on public.courses;
create trigger courses_touch_updated_at
  before update on public.courses
  for each row
  execute function public.touch_updated_at();

alter table public.courses enable row level security;

-- Faol kurslarni hamma ko'radi, markaz egasi esa barchasini ko'radi.
drop policy if exists "courses_select_public" on public.courses;
create policy "courses_select_public"
  on public.courses for select
  using (
    is_active = true
    or exists (
      select 1 from public.centers c
      where c.id = courses.center_id and c.owner_id = auth.uid()
    )
  );

-- Kurs qo'shish / tahrirlash / o'chirish — faqat markaz egasi.
drop policy if exists "courses_write_owner" on public.courses;
create policy "courses_write_owner"
  on public.courses for all
  using (
    exists (
      select 1 from public.centers c
      where c.id = courses.center_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.centers c
      where c.id = courses.center_id and c.owner_id = auth.uid()
    )
  );


-- ------------------------------------------------------------
-- 2) APPLICATIONS — o'quvchi tanlagan markazga yuborgan so'rovi
-- ------------------------------------------------------------
-- Bu asosiy jadval: FindTheWay ilovasida o'quvchi markazni tanlab
-- ariza yuborsa, u shu yerga tushadi va markaz panelida ko'rinadi.

create table if not exists public.applications (
  id             uuid primary key default gen_random_uuid(),
  center_id      uuid not null references public.centers (id) on delete cascade,
  course_id      uuid references public.courses (id) on delete set null,
  student_id     uuid references public.profiles (id) on delete set null,

  -- Ariza yuborilgan paytdagi nusxa (keyin profil o'zgarsa ham saqlanib qoladi)
  student_name   text not null,
  student_phone  text,
  student_email  text,
  course_name    text,
  message        text,

  status         text not null default 'new'
                 check (status in ('new', 'seen', 'contacted', 'accepted', 'rejected')),
  internal_note  text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists applications_center_id_idx on public.applications (center_id);
create index if not exists applications_status_idx    on public.applications (center_id, status);
create index if not exists applications_created_idx   on public.applications (center_id, created_at desc);

drop trigger if exists applications_touch_updated_at on public.applications;
create trigger applications_touch_updated_at
  before update on public.applications
  for each row
  execute function public.touch_updated_at();

alter table public.applications enable row level security;

-- Arizani markaz egasi va arizani yuborgan o'quvchi ko'ra oladi.
drop policy if exists "applications_select_owner_or_student" on public.applications;
create policy "applications_select_owner_or_student"
  on public.applications for select
  using (
    auth.uid() = student_id
    or exists (
      select 1 from public.centers c
      where c.id = applications.center_id and c.owner_id = auth.uid()
    )
  );

-- Har qanday tizimga kirgan foydalanuvchi ariza yubora oladi.
drop policy if exists "applications_insert_authenticated" on public.applications;
create policy "applications_insert_authenticated"
  on public.applications for insert
  to authenticated
  with check (student_id is null or auth.uid() = student_id);

-- Holat va ichki eslatmani faqat markaz egasi o'zgartira oladi.
drop policy if exists "applications_update_owner" on public.applications;
create policy "applications_update_owner"
  on public.applications for update
  using (
    exists (
      select 1 from public.centers c
      where c.id = applications.center_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.centers c
      where c.id = applications.center_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "applications_delete_owner" on public.applications;
create policy "applications_delete_owner"
  on public.applications for delete
  using (
    exists (
      select 1 from public.centers c
      where c.id = applications.center_id and c.owner_id = auth.uid()
    )
  );


-- ------------------------------------------------------------
-- 3) REALTIME — yangi ariza kelganda panel o'zi yangilanadi
-- ------------------------------------------------------------
-- Supabase panelda ham qilish mumkin: Database → Replication →
-- supabase_realtime → applications jadvalini yoqing.

do $$
begin
  alter publication supabase_realtime add table public.applications;
exception
  when duplicate_object then null;
end;
$$;


-- ------------------------------------------------------------
-- 4) TEST MA'LUMOT (ixtiyoriy)
-- ------------------------------------------------------------
-- Panelni bo'sh emas holatda ko'rish uchun. O'z markazingiz ID sini
-- qo'ying va izohni oching:
--
-- insert into public.applications
--   (center_id, student_name, student_phone, student_email, course_name, message)
-- values
--   ('BU_YERGA_CENTER_ID', 'Aziz Karimov', '+998 90 123 45 67',
--    'aziz@example.com', 'Ingliz tili — Umumiy kurs',
--    'Assalomu alaykum, kechki guruhlar bormi?');
