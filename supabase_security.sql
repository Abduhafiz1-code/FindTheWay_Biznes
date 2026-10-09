-- ============================================================
--  FindTheWay — XAVFSIZLIK MUSTAHKAMLASH (audit 1.1–1.6)
--  Supabase → SQL Editor → shu faylni to'liq nusxalab RUN bosing.
--
--  ⚠️ Avval oldingi SQL'lar ishga tushirilgan bo'lishi kerak:
--  setup → biznes → multicenter → ... → trust. Fayl xavfsiz:
--  qayta ishga tushirsangiz ham xato bermaydi.
--
--  Bu fayl nimani yopadi:
--   1.1 Egasi obuna ustunlarini (status, paid_until, plan) o'zi
--       o'zgartira olardi → endi chek faqat submit_receipt()
--       funksiyasi orqali yuboriladi. Admin uchun alohida policy.
--   1.2 subscriptions jadvali hamma uchun ochiq o'qilardi (chek
--       havolasi bilan) → endi faqat egasi va admin ko'radi;
--       o'quvchi ilovasi uchun active_center_ids view qoldi.
--   1.3 subscription_reminders RLS'siz edi → RLS yoqildi +
--       unikal indeks (bir eslatma ikki marta ketmaydi).
--   1.4 applications: egasiz/soxta ariza va spam → qat'iy insert
--       policy + kunlik limit triggeri. requests ham mustahkamlandi.
--   1.5 AI chat: begona markaz nomidan suhbat ochish va 'assistant'
--       rolini klient yozishi → policy'lar yopildi.
--   1.6 Chek bucketi: 5 MB va faqat rasm (bucket darajasida ham).
--   +  QALQON: hech kim (admin bo'lmasa) status='active' yoki
--      paid_until yozolmaydi — subscriptions, center_panels,
--      center_modules, student_plans jadvallarida bir xil teshik
--      edi, endi trigger bilan yopildi.
-- ============================================================


-- ------------------------------------------------------------
-- 0) is_admin() — bo'lmasa yaratamiz (mustaqil ishlash uchun)
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
-- 1.1) SUBSCRIPTIONS — egasining to'g'ridan-to'g'ri update'i YO'Q
-- ------------------------------------------------------------
-- Eski policy egasiga butun qatorni (paid_until, plan, billing_cycle)
-- o'zgartirish imkonini berardi. Olib tashlanadi — chek endi faqat
-- quyidagi submit_receipt() funksiyasi orqali yuboriladi.
drop policy if exists "subscriptions_owner_update" on public.subscriptions;

-- Admin paneli to'lovni tasdiqlash/rad etish uchun to'liq huquq.
-- (Bu policy'siz adminning approve so'rovi jim 0 qatorni yangilardi!)
drop policy if exists "subscriptions_admin_all" on public.subscriptions;
create policy "subscriptions_admin_all" on public.subscriptions
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Ega o'z obunasini o'qiy oladi (panel ko'rsatuvi uchun)
drop policy if exists "subscriptions_owner_read" on public.subscriptions;
create policy "subscriptions_owner_read" on public.subscriptions
  for select using (
    exists (
      select 1 from public.centers c
      where c.id = subscriptions.center_id and c.owner_id = auth.uid()
    )
  );

-- CHEK YUBORISH — yagona rasmiy yo'l (security definer):
--   • faqat markaz egasi
--   • faqat receipt_url/plan/billing_cycle o'zgaradi
--   • status: trial davom etyapsa 'trial' qoladi (markaz
--     o'quvchilardan yashirinmaydi), 'active' buzilmaydi
--     (uzaytirish admin ko'rinadigan oqimda), qolgani 'pending'
create or replace function public.submit_receipt(
  p_center_id  uuid,
  p_receipt_url text,
  p_plan       text default null,
  p_cycle      text default null
)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.subscriptions;
begin
  if p_receipt_url is null or p_receipt_url = '' then
    raise exception 'Chek fayli yuklanmadi';
  end if;

  update public.subscriptions s
     set receipt_url   = p_receipt_url,
         plan          = coalesce(p_plan, s.plan),
         billing_cycle = coalesce(p_cycle, s.billing_cycle),
         status = case
           when s.status = 'trial'  and s.trial_ends_at > now() then 'trial'
           when s.status = 'active' then 'active'
           else 'pending'
         end
   where s.center_id = p_center_id
     and exists (
       select 1 from public.centers c
       where c.id = p_center_id and c.owner_id = auth.uid()
     )
  returning * into updated;

  if not found then
    raise exception 'Ruxsat yo''q yoki obuna topilmadi';
  end if;

  return updated;
end;
$$;

revoke all on function public.submit_receipt(uuid, text, text, text) from public;
grant execute on function public.submit_receipt(uuid, text, text, text) to authenticated;


-- ------------------------------------------------------------
-- 1.2) SUBSCRIPTIONS ommaviy o'qish YO'Q — faqat view orqali
-- ------------------------------------------------------------
-- Eski policy anon kalitga chek havolasi (receipt_url) bilan birga
-- butun qatorni ko'rsatardi. O'quvchi ilovasi subscriptions'ni
-- to'g'ridan-to'g'ri o'qimaydi (centers'dagi sinxron ustunlarni
-- o'qiydi), shuning uchun bu policy xavfsiz o'chiriladi.
drop policy if exists "subscriptions_public_read_active" on public.subscriptions;

-- Faqat "qaysi markazlar hozir ko'rinadi" ro'yxati (boshqa ma'lumot yo'q).
-- View obunalar jadvaliga egasi sifatida bog'lanadi (security_invoker
-- YO'Q — aks holda RLS bilan aylanma bog'lanib qoladi).
create or replace view public.active_center_ids as
select center_id
from public.subscriptions
where (status = 'trial'  and trial_ends_at > now())
   or (status = 'active' and paid_until > now());

grant select on public.active_center_ids to anon, authenticated;

-- Markazlar ro'yxati: faqat tasdiqlangan VA obunasi tirik markazlar
-- ommaga ko'rinadi. Egasi o'z markazini doim ko'radi, admin hammasini.
drop policy if exists "centers_select_public" on public.centers;
create policy "centers_select_public"
  on public.centers for select
  using (
    auth.uid() = owner_id
    or public.is_admin()
    or (
      is_verified = true
      and exists (
        select 1 from public.active_center_ids a
        where a.center_id = centers.id
      )
    )
  );


-- ------------------------------------------------------------
-- 1.3) SUBSCRIPTION_REMINDERS — RLS + bir eslatma bir marta
-- ------------------------------------------------------------
alter table public.subscription_reminders enable row level security;

-- Policy YO'Q = klient (anon/authenticated) umuman kira olmaydi.
-- Edge Function service_role kalit bilan yozadi — RLS unga ta'sir qilmaydi.

alter table public.subscription_reminders
  add column if not exists period_end timestamptz;

update public.subscription_reminders
   set period_end = coalesce(period_end, created_at)
 where period_end is null;

alter table public.subscription_reminders
  alter column period_end set default now();
alter table public.subscription_reminders
  alter column period_end set not null;

-- (obuna, eslatma turi, davr) uchligiga unikal indeks — ikkinchi
-- marta yuborish urinishi bazada rad etiladi
create unique index if not exists uq_reminder_once
  on public.subscription_reminders (subscription_id, reminder_type, period_end);


-- ------------------------------------------------------------
-- 1.4) APPLICATIONS — soxta status va spam yo'q
-- ------------------------------------------------------------
drop policy if exists "applications_insert_authenticated" on public.applications;
drop policy if exists "applications_insert_student" on public.applications;
create policy "applications_insert_student"
  on public.applications for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and status = 'new'
    and internal_note is null
  );

-- Oddiy rate-limit: bir o'quvchi bir markazga kuniga 3 tadan
-- ko'p ariza yubormasin
create or replace function public.limit_applications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.applications
      where student_id = new.student_id
        and center_id = new.center_id
        and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Bir markazga kuniga 3 tadan ko''p ariza yuborib bo''lmaydi. Ertaga qayta urinib ko''ring.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limit_applications on public.applications;
create trigger trg_limit_applications
  before insert on public.applications
  for each row execute function public.limit_applications();

create index if not exists applications_student_center_created_idx
  on public.applications (student_id, center_id, created_at desc);

-- requests: o'quvchi status/priority ni o'zi belgilay olmasin
drop policy if exists "requests_student_create" on public.requests;
create policy "requests_student_create" on public.requests
  for insert with check (
    student_id = auth.uid()
    and status = 'open'
  );


-- ------------------------------------------------------------
-- 1.5) AI CHAT — begona markaz va 'assistant' soxta roli yo'q
-- ------------------------------------------------------------
drop policy if exists "ai_conversations_owner_write" on public.ai_conversations;
create policy "ai_conversations_owner_write" on public.ai_conversations
  for insert with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.centers c
      where c.id = ai_conversations.center_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "ai_conversations_owner_delete" on public.ai_conversations;
create policy "ai_conversations_owner_delete" on public.ai_conversations
  for delete using (owner_id = auth.uid());

-- Klient faqat 'user' xabarini, tokens_used=0 bilan yozadi;
-- 'assistant' javobini ai-chat Edge Function (service_role) yozadi
drop policy if exists "ai_messages_create" on public.ai_messages;
create policy "ai_messages_create" on public.ai_messages
  for insert with check (
    role = 'user'
    and coalesce(tokens_used, 0) = 0
    and exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "ai_messages_owner_delete" on public.ai_messages;
create policy "ai_messages_owner_delete" on public.ai_messages
  for delete using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.owner_id = auth.uid()
    )
  );


-- ------------------------------------------------------------
-- 1.6) CHEK BUCKETI — hajm va tur bucket darajasida ham
-- ------------------------------------------------------------
update storage.buckets
   set file_size_limit = 5242880,   -- 5 MB
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'subscription-receipts';

-- Eslatma: admin o'qish + egasi qayta yuklash policy'lari
-- supabase_trust.sql da allaqachon bor.


-- ------------------------------------------------------------
-- +) QALQON TRIGGER — pul ustunlarini faqat admin yozadi
-- ------------------------------------------------------------
-- Bir xil teshik 4 jadvalda edi (center_panels/center_modules/
-- student_plans'da egasi o'zi 'active' qila olardi). Bu trigger
-- har qanday policy xatosidan qat'i nazar himoya qiladi:
--   • status → 'active' o'zgarishi: faqat admin
--   • paid_until o'zgarishi: faqat admin
-- service_role (Edge Function) va SQL Editor (auth.uid() null)
-- o'tadi; admin o'tadi; egalar rad etiladi.
create or replace function public.guard_paid_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_table_name in ('subscriptions', 'center_panels', 'center_modules', 'student_plans') then
    if new.status = 'active' and old.status is distinct from 'active' then
      raise exception 'Faqat admin to''lovni tasdiqlaydi';
    end if;
    if new.paid_until is distinct from old.paid_until then
      raise exception 'To''lov muddatini faqat admin o''zgartiradi';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_paid_rows on public.subscriptions;
create trigger trg_guard_paid_rows
  before update on public.subscriptions
  for each row execute function public.guard_paid_rows();

drop trigger if exists trg_guard_paid_rows on public.center_panels;
create trigger trg_guard_paid_rows
  before update on public.center_panels
  for each row execute function public.guard_paid_rows();

drop trigger if exists trg_guard_paid_rows on public.center_modules;
create trigger trg_guard_paid_rows
  before update on public.center_modules
  for each row execute function public.guard_paid_rows();

drop trigger if exists trg_guard_paid_rows on public.student_plans;
create trigger trg_guard_paid_rows
  before update on public.student_plans
  for each row execute function public.guard_paid_rows();


-- ============================================================
--  TAYYOR. Frontend o'zgarishlari (bu SQL'dan KEYIN deploy
--  qilinishi kerak):
--   • Biznes: chek yuborish endi submit_receipt() RPC chaqiradi
--     (biz.js yangilandi) — to'g'ridan-to'g'ri update ishlamaydi.
--   • Biznes: AI javobini klient emas, ai-chat funksiyasi yozadi
--     (ai.js + ai-chat yangilandi).
--   • Vercel: CRON_SECRET muhit o'zgaruvchisini qo'shing
--     (/api/cron/subscriptions endi shuni talab qiladi).
-- ============================================================
