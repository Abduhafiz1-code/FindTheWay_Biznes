-- ============================================================
--  FindTheWay — "SO'ROVLAR BOZORI" (marketplace) sxemasi
--  Supabase → SQL Editor → New query → shu faylni to'liq
--  nusxalab qo'ying va RUN bosing.
--
--  ⚠️ MUHIM: avval `supabase_setup.sql` + `supabase_biznes.sql`
--  ishga tushirilgan bo'lishi kerak.
--
--  Nima beradi?
--   • O'quvchi o'ziga kerakli kursni topa olmasa, bitta e'lon
--     (market_requests) yozadi — uni BARCHA markazlar ko'radi.
--   • Qiziqqan markaz e'longa yozadi; yozish bilan o'sha o'quvchi
--     bilan shaxsiy chat (market_conversations + market_messages)
--     ochiladi. Telefon ham ko'rsatiladi (agar o'quvchi qo'shgan
--     bo'lsa).
--   • Har bir markaz faqat O'Z chatlarini ko'radi — boshqa
--     markazning suhbatiga aralashib bo'lmaydi (RLS).
--
--  Fayl xavfsiz: qayta ishga tushirsangiz ham xato bermaydi.
-- ============================================================


-- ------------------------------------------------------------
-- 0) is_admin() funksiyasi bo'lmasa yaratamiz (Admin panel fayli
--    ham shuni yaratadi — bu yerda mustaqil ishlash uchun)
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
-- 1) market_requests — o'quvchining OMMAVIY e'loni
-- ------------------------------------------------------------
create table if not exists public.market_requests (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles (id) on delete cascade,
  student_name  text not null,
  student_phone text,
  title         text not null,
  description   text,
  category      text,
  district      text,
  status        text not null default 'open' check (status in ('open', 'closed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists market_requests_status_idx
  on public.market_requests (status, created_at desc);
create index if not exists market_requests_category_idx
  on public.market_requests (category);
create index if not exists market_requests_student_idx
  on public.market_requests (student_id);

alter table public.market_requests enable row level security;

-- Ko'rish: o'quvchi — o'z e'lonlarini; markaz egalari — ochiq e'lonlarni;
-- admin — hammasini
drop policy if exists "market_requests_select" on public.market_requests;
create policy "market_requests_select"
  on public.market_requests for select
  using (
    student_id = auth.uid()
    or (status = 'open' and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    ))
    or public.is_admin()
  );

-- Yozish: faqat student rolidagi o'quvchi o'z nomidan
drop policy if exists "market_requests_insert" on public.market_requests;
create policy "market_requests_insert"
  on public.market_requests for insert
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'student'
    )
  );

-- O'zgartirish: o'quvchi o'z e'lonini yopa oladi (status = closed), admin hamma narsani
drop policy if exists "market_requests_update" on public.market_requests;
create policy "market_requests_update"
  on public.market_requests for update
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

-- O'chirish: o'quvchi o'zini, admin hammasini
drop policy if exists "market_requests_delete" on public.market_requests;
create policy "market_requests_delete"
  on public.market_requests for delete
  using (student_id = auth.uid() or public.is_admin());


-- ------------------------------------------------------------
-- 2) market_conversations — bitta markaz ↔ bitta o'quvchi suhbati
--    (har bir (e'lon, markaz) juftligi uchun faqat bitta chat)
-- ------------------------------------------------------------
create table if not exists public.market_conversations (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.market_requests (id) on delete cascade,
  center_id       uuid not null references public.centers (id) on delete cascade,
  student_id      uuid not null references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (request_id, center_id)
);

create index if not exists market_conversations_center_idx
  on public.market_conversations (center_id, last_message_at desc);
create index if not exists market_conversations_student_idx
  on public.market_conversations (student_id, last_message_at desc);

alter table public.market_conversations enable row level security;

-- Ko'rish: o'quvchi (o'zi ishtirok etgan) yoki markaz egasi (o'z markazi)
drop policy if exists "market_conversations_select" on public.market_conversations;
create policy "market_conversations_select"
  on public.market_conversations for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.centers c
      where c.id = market_conversations.center_id and c.owner_id = auth.uid()
    )
    or public.is_admin()
  );

-- Yaratish: o'quvchi o'zi uchun yoki markaz egasi o'z markazi uchun
drop policy if exists "market_conversations_insert" on public.market_conversations;
create policy "market_conversations_insert"
  on public.market_conversations for insert
  with check (
    exists (
      select 1 from public.market_requests r
      where r.id = market_conversations.request_id
        and r.student_id = market_conversations.student_id
    )
    and (
      auth.uid() = student_id
      or exists (
        select 1 from public.centers c
        where c.id = market_conversations.center_id and c.owner_id = auth.uid()
      )
      or public.is_admin()
    )
  );

-- Yangilash (last_message_at trigger ishlatadi): ishtirokchilar
drop policy if exists "market_conversations_update" on public.market_conversations;
create policy "market_conversations_update"
  on public.market_conversations for update
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.centers c
      where c.id = market_conversations.center_id and c.owner_id = auth.uid()
    )
    or public.is_admin()
  )
  with check (
    student_id = auth.uid()
    or exists (
      select 1 from public.centers c
      where c.id = market_conversations.center_id and c.owner_id = auth.uid()
    )
    or public.is_admin()
  );


-- ------------------------------------------------------------
-- 3) market_messages — suhbat xabarlari
-- ------------------------------------------------------------
create table if not exists public.market_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.market_conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  sender_name     text not null,
  message         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists market_messages_conversation_idx
  on public.market_messages (conversation_id, created_at);

alter table public.market_messages enable row level security;

-- Ko'rish: suhbat ishtirokchilari
drop policy if exists "market_messages_select" on public.market_messages;
create policy "market_messages_select"
  on public.market_messages for select
  using (
    exists (
      select 1 from public.market_conversations cv
      where cv.id = market_messages.conversation_id
        and (
          cv.student_id = auth.uid()
          or exists (
            select 1 from public.centers c
            where c.id = cv.center_id and c.owner_id = auth.uid()
          )
          or public.is_admin()
        )
    )
  );

-- Yozish: faqat ishtirokchi o'z nomidan
drop policy if exists "market_messages_insert" on public.market_messages;
create policy "market_messages_insert"
  on public.market_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.market_conversations cv
      where cv.id = market_messages.conversation_id
        and (
          cv.student_id = auth.uid()
          or exists (
            select 1 from public.centers c
            where c.id = cv.center_id and c.owner_id = auth.uid()
          )
        )
    )
  );

-- Yangi xabar suhbatning last_message_at maydonini yangilaydi
create or replace function public.touch_market_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.market_conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists market_messages_touch_conversation on public.market_messages;
create trigger market_messages_touch_conversation
  after insert on public.market_messages
  for each row execute function public.touch_market_conversation();


-- ------------------------------------------------------------
-- 4) REALTIME — suhbat xabarlari jonli kelishi uchun
-- ------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.market_messages;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.market_conversations;
exception
  when duplicate_object then null;
end;
$$;

-- ============================================================
--  Tayyor. Frontend (App: /so-rovlar, Biznes: /so-rovlar) bu
--  jadvallar bilan ishlaydi.
-- ============================================================
