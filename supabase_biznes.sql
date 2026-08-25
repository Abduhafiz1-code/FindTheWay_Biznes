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

alter table public.profiles add column if not exists telegram_chat_id text;

drop trigger if exists centers_touch_updated_at on public.centers;
create trigger centers_touch_updated_at
  before update on public.centers
  for each row
  execute function public.touch_updated_at();

-- 0.1) OBUNALAR — har bir markazga 30 kunlik trial avtomatik beriladi.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null unique references public.centers(id) on delete cascade,
  status text not null default 'trial' check (status in ('trial', 'pending', 'active', 'expired')),
  plan text not null default 'pro' check (plan in ('pro','max')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly','yearly')),
  is_extra_center boolean not null default false,
  trial_ends_at timestamptz not null default (now() + interval '30 days'),
  paid_until timestamptz,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions
  add column if not exists plan text default 'pro';

alter table public.subscriptions
  add column if not exists billing_cycle text default 'monthly';

alter table public.subscriptions
  add column if not exists is_extra_center boolean default false;

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('pro','max'));

alter table public.subscriptions
  drop constraint if exists subscriptions_billing_cycle_check;

alter table public.subscriptions
  add constraint subscriptions_billing_cycle_check
  check (billing_cycle in ('monthly','yearly'));

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_owner_read" on public.subscriptions;
create policy "subscriptions_owner_read" on public.subscriptions
  for select using (
    exists (select 1 from public.centers c where c.id = subscriptions.center_id and c.owner_id = auth.uid())
  );

-- O'quvchi ilovasi faqat muddati o'tmagan trial yoki to'langan markazni ko'radi.
drop policy if exists "subscriptions_public_read_active" on public.subscriptions;
create policy "subscriptions_public_read_active" on public.subscriptions
  for select using (
    (status = 'trial' and trial_ends_at > now())
    or (status = 'active' and paid_until > now())
  );

drop policy if exists "subscriptions_owner_update" on public.subscriptions;
create policy "subscriptions_owner_update" on public.subscriptions
  for update using (
    exists (select 1 from public.centers c where c.id = subscriptions.center_id and c.owner_id = auth.uid())
  ) with check (
    status = 'pending'
    and exists (select 1 from public.centers c where c.id = subscriptions.center_id and c.owner_id = auth.uid())
  );

create or replace function public.create_center_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (center_id)
  values (new.id)
  on conflict (center_id) do nothing;
  return new;
end;
$$;

drop trigger if exists center_subscription_created on public.centers;
create trigger center_subscription_created
  after insert on public.centers
  for each row execute function public.create_center_subscription();

insert into public.subscriptions (center_id)
select c.id from public.centers c
where not exists (select 1 from public.subscriptions s where s.center_id = c.id);

create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists subscriptions_trial_ends_idx on public.subscriptions (trial_ends_at);

-- Cheklar uchun private storage bucket va owner upload/update huquqi.
insert into storage.buckets (id, name, public)
values ('subscription-receipts', 'subscription-receipts', false)
on conflict (id) do nothing;

drop policy if exists "subscription_receipts_owner_insert" on storage.objects;
create policy "subscription_receipts_owner_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'subscription-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "subscription_receipts_owner_read" on storage.objects;
create policy "subscription_receipts_owner_read" on storage.objects
  for select to authenticated using (
    bucket_id = 'subscription-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


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


-- ============================================================
-- 5) TALABALAR UCHUN REQUEST SISTEMA — CENTER GA MU'ROJAT
-- ============================================================
-- O'quvchi markaz haqida savol yoki taklif qo'yadi.

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.requests enable row level security;

drop policy if exists "requests_student_read" on public.requests;
create policy "requests_student_read" on public.requests
  for select using (student_id = auth.uid());

drop policy if exists "requests_owner_read" on public.requests;
create policy "requests_owner_read" on public.requests
  for select using (
    exists (select 1 from public.centers c where c.id = requests.center_id and c.owner_id = auth.uid())
  );

drop policy if exists "requests_student_create" on public.requests;
create policy "requests_student_create" on public.requests
  for insert with check (student_id = auth.uid());

drop policy if exists "requests_owner_update" on public.requests;
create policy "requests_owner_update" on public.requests
  for update using (
    exists (select 1 from public.centers c where c.id = requests.center_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.centers c where c.id = requests.center_id and c.owner_id = auth.uid())
  );

create index if not exists idx_requests_center_id on public.requests(center_id);
create index if not exists idx_requests_student_id on public.requests(student_id);
create index if not exists idx_requests_status on public.requests(status);

-- Request messages — engaging conversation
create table if not exists public.request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.request_messages enable row level security;

drop policy if exists "request_messages_read" on public.request_messages;
create policy "request_messages_read" on public.request_messages
  for select using (
    exists (
      select 1 from public.requests r
      where r.id = request_messages.request_id
      and (r.student_id = auth.uid() or exists (
        select 1 from public.centers c where c.id = r.center_id and c.owner_id = auth.uid()
      ))
    )
  );

drop policy if exists "request_messages_create" on public.request_messages;
create policy "request_messages_create" on public.request_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.requests r
      where r.id = request_messages.request_id
      and (r.student_id = auth.uid() or exists (
        select 1 from public.centers c where c.id = r.center_id and c.owner_id = auth.uid()
      ))
    )
  );

create index if not exists idx_request_messages_request_id on public.request_messages(request_id);
create index if not exists idx_request_messages_sender_id on public.request_messages(sender_id);


-- ============================================================
-- 6) AI SUPPORT CHAT — REAL-TIME ASSISTANT
-- ============================================================
-- Markaz egasiga AI assistant chatni ishlatish imkoniyati.

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New Conversation',
  context text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_conversations enable row level security;

drop policy if exists "ai_conversations_owner_read" on public.ai_conversations;
create policy "ai_conversations_owner_read" on public.ai_conversations
  for select using (owner_id = auth.uid());

drop policy if exists "ai_conversations_owner_write" on public.ai_conversations;
create policy "ai_conversations_owner_write" on public.ai_conversations
  for insert with check (owner_id = auth.uid());

drop policy if exists "ai_conversations_owner_update" on public.ai_conversations;
create policy "ai_conversations_owner_update" on public.ai_conversations
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- AI chat messages
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tokens_used integer default 0,
  created_at timestamptz not null default now()
);

alter table public.ai_messages enable row level security;

drop policy if exists "ai_messages_read" on public.ai_messages;
create policy "ai_messages_read" on public.ai_messages
  for select using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "ai_messages_create" on public.ai_messages;
create policy "ai_messages_create" on public.ai_messages
  for insert with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.owner_id = auth.uid()
    )
  );

create index if not exists idx_ai_messages_conversation_id on public.ai_messages(conversation_id);
create index if not exists idx_ai_messages_created_at on public.ai_messages(created_at);


-- ============================================================
-- 7) PAYMENT INTEGRATION — SUBSCRIPTION PAYMENT RECORDS
-- ============================================================
-- Stripe/Click integration uchun payment logs.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'click', 'payme', 'manual')),
  provider_payment_id text unique,
  amount integer not null,
  currency text not null default 'UZS',
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.payments enable row level security;

drop policy if exists "payments_owner_read" on public.payments;
create policy "payments_owner_read" on public.payments
  for select using (
    exists (
      select 1 from public.subscriptions s
      inner join public.centers c on c.id = s.center_id
      where s.id = payments.subscription_id and c.owner_id = auth.uid()
    )
  );

create index if not exists idx_payments_subscription_id on public.payments(subscription_id);
create index if not exists idx_payments_provider_payment_id on public.payments(provider_payment_id);
create index if not exists idx_payments_status on public.payments(status);


-- ============================================================
-- 5) TELEGRAM OBUNA ESLATMALARI — SCHEDULED REMINDERS
-- ============================================================
-- Bu SQL obunaning tugash vaqtini tekshirib, Telegram orqali
-- eslatma yuborish uchun database-side qismidir.
--
-- Frontend: SettingsView.vue da chat_id saqlanadi.
-- Edge Function: supabase/functions/send-reminder/index.ts
-- Scheduler: Supabase → Cron Jobs (pg_cron extension) yoki 
--           HTTP trigger orqali har soat chaqiriladi.

-- Agar pg_cron o'rnatilgan bo'lsa (uni admin panel orqali yoqish mumkin):
-- select cron.schedule(
--   'send-subscription-reminders',
--   '0 * * * *',  -- har soat ishga tushadi
--   'select net.http_post(
--     url := current_setting(''app.supabase_url'') || ''/functions/v1/send-reminder'',
--     headers := jsonb_build_object(
--       ''Authorization'', ''Bearer '' || current_setting(''app.service_role_key''),
--       ''Content-Type'', ''application/json''
--     ),
--     body := jsonb_build_object(''action'', ''check_subscriptions'')
--   ) as req
--   );'
-- );

-- Yoki Vercel cron orqali (FindTheWay_Biznes/vercel.json da):
-- {
--   "crons": [{
--     "path": "/api/cron/subscriptions",
--     "schedule": "0 * * * *"
--   }]
-- }

-- Subscription jadvalini kuzatish uchun
-- Reminder yuborilganligini cayd qilish
create table if not exists public.subscription_reminders (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('5_days_left', 'expired')),
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Index uchun search tezligi
create index if not exists idx_subscription_reminders_sub_id 
  on public.subscription_reminders(subscription_id);
create index if not exists idx_subscription_reminders_sent 
  on public.subscription_reminders(sent_at);
