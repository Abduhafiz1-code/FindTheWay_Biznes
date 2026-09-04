-- ============================================================
--  FindTheWay — KO'P MARKAZLI REJIM (multi-center) migratsiyasi
--  Supabase → SQL Editor → New query → shu faylni to'liq
--  nusxalab qo'ying va RUN bosing.
--
--  ⚠️ MUHIM: avval `supabase_biznes.sql` ishga tushirilgan
--  bo'lishi kerak (subscriptions jadvali uchun).
--
--  Bu fayl nimani hal qiladi:
--   1. O'quvchi ilovasidagi "markazlar ko'rinmayapti" muammosi:
--      ilova centers jadvalidan subscription_status, trial_ends_at,
--      paid_until ustunlarini o'qiydi, lekin bu ustunlar bazada
--      yo'q edi — so'rov xato berib, hech qanday markaz
--      chiqmasdi. Endi ustunlar qo'shiladi va subscriptions
--      jadvalidagi har bir o'zgarish markazga avtomatik
--      ko'chiriladi (trigger orqali).
--   2. Egasining birinchi markazi "asosiy", qolganlari
--      "qo'shimcha markaz" (is_extra_center = true) bo'ladi —
--      qo'shimcha markazga Pro tarifda −20% chegirma qo'llanadi.
--   3. Obuna egasi chek yuborganda trial hali tugamagan bo'lsa,
--      markaz "pending" holatiga tushib o'quvchilardan
--      yashirinib qolmasligi uchun RLS qoidasi yumshaydi.
--
--  Fayl xavfsiz: qayta ishga tushirsangiz ham xato bermaydi.
-- ============================================================


-- ------------------------------------------------------------
-- 1) centers ga obuna holati ustunlari (o'quvchi ilovasi o'qiydi)
-- ------------------------------------------------------------
alter table public.centers add column if not exists subscription_status text;
alter table public.centers add column if not exists plan             text;
alter table public.centers add column if not exists billing_cycle    text;
alter table public.centers add column if not exists is_extra_center  boolean not null default false;
alter table public.centers add column if not exists trial_ends_at    timestamptz;
alter table public.centers add column if not exists paid_until       timestamptz;

create index if not exists centers_subscription_status_idx
  on public.centers (subscription_status);


-- ------------------------------------------------------------
-- 2) Trigger — subscriptions o'zgarsa, markaz holati yangilanadi
-- ------------------------------------------------------------
create or replace function public.sync_center_subscription_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.centers
       set subscription_status = null,
           plan = null,
           billing_cycle = null,
           trial_ends_at = null,
           paid_until = null
     where id = old.center_id;
    return old;
  end if;

  update public.centers
     set subscription_status = new.status,
         plan = new.plan,
         billing_cycle = new.billing_cycle,
         is_extra_center  = coalesce(new.is_extra_center, false),
         trial_ends_at = new.trial_ends_at,
         paid_until    = new.paid_until
   where id = new.center_id;

  return new;
end;
$$;

drop trigger if exists subscriptions_sync_center_status on public.subscriptions;
create trigger subscriptions_sync_center_status
  after insert or update or delete on public.subscriptions
  for each row execute function public.sync_center_subscription_status();


-- ------------------------------------------------------------
-- 3) YANGI markaz yaratilganda: egasining birinchi markazi
--    "asosiy", keyingilari avtomatik "qo'shimcha" (chegirmali)
-- ------------------------------------------------------------
create or replace function public.create_center_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  already_has boolean;
begin
  select exists (
    select 1 from public.centers c
    where c.owner_id = new.owner_id and c.id <> new.id
  ) into already_has;

  insert into public.subscriptions (center_id, is_extra_center)
  values (new.id, coalesce(already_has, false))
  on conflict (center_id) do nothing;

  return new;
end;
$$;

drop trigger if exists center_subscription_created on public.centers;
create trigger center_subscription_created
  after insert on public.centers
  for each row execute function public.create_center_subscription();


-- ------------------------------------------------------------
-- 4) MAVJUD MA'LUMOTLARNI TO'LDIRISH (backfill)
-- ------------------------------------------------------------

-- a) Egasining birinchi markazidan keyingilari — qo'shimcha markaz
update public.subscriptions s
   set is_extra_center = true
  from public.centers c
 where c.id = s.center_id
   and exists (
     select 1 from public.centers older
     where older.owner_id = c.owner_id
       and older.id <> c.id
       and older.created_at < c.created_at
   );

-- b) Obuna holatini markazga ko'chirish (yangi trigger ishga tushishi
--    uchun subscriptions dagi har bir qatorni bir marta "tegizamiz")
update public.subscriptions
   set updated_at = updated_at
 where true;

-- Eski markazlar uchun ham status biriktirish (qator "tegilmagan" bo'lsa)
update public.centers c
   set subscription_status = s.status,
       plan = s.plan,
       billing_cycle = s.billing_cycle,
       is_extra_center = s.is_extra_center,
       trial_ends_at = s.trial_ends_at,
       paid_until = s.paid_until
  from public.subscriptions s
 where s.center_id = c.id
   and c.subscription_status is null;


-- ------------------------------------------------------------
-- 5) RLS — egasi trial davomida ham chek yuklay olsin
--    (obuna "pending" bo'lib markaz o'quvchilardan yashirinib
--    qolmasligi uchun; statusni egasi faqat trial/pending ga
--    o'zgartira oladi — "active" ni faqat admin qo'yadi)
-- ------------------------------------------------------------
drop policy if exists "subscriptions_owner_update" on public.subscriptions;
create policy "subscriptions_owner_update" on public.subscriptions
  for update using (
    exists (select 1 from public.centers c
            where c.id = subscriptions.center_id and c.owner_id = auth.uid())
  ) with check (
    status in ('trial', 'pending')
    and exists (select 1 from public.centers c
                where c.id = subscriptions.center_id and c.owner_id = auth.uid())
  );

-- ============================================================
--  Tayyor. Keyingi qadam: loyiha (frontend) ham shu qoidalar
--  bilan ishlaydi — markazlar qo'shish/alo'stirish panel orqali.
-- ============================================================
