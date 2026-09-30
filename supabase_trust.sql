-- ============================================================
--  FindTheWay — TO'LOV ISONCHI VA CHEK TA'MIRLASH
--  Supabase → SQL Editor → shu faylni to'liq nusxalab RUN bosing.
--
--  Bu fayl nimani hal qiladi:
--   1. Admin panelda "Chek topilmadi" bugi: chek fayllari
--      `subscription-receipts` PRIVATE bucketida yotadi, lekin
--      storage RLS faqat egasiga o'qish ruxsat bergan — admin
--      signed URL ololmasdi. Endi admin barcha cheklarni ko radi.
--   2. Egasi chekni QAYTA yuklay olmasdi: `upsert: true` mavjud
--      faylni yangilashga urinadi, lekin UPDATE policy yo'q edi
--      — shuning uchun ikkinchi marta yuklash jim rad etilardi.
--   3. Xavfsizlik: bucketga faqat rasm (jpeg/png/webp), max 5 MB
--      yuklanadi — trigger bilan tekshiriladi.
--   4. Yopishtirilgan (lekin cheki yo'q) so'rovlar tozalanadi:
--      pending + receipt_url yo'q qatorlar trial/expired ga
--      qaytariladi — egasi yangi chek yuborishi mumkin.
--   5. ISHONCH: `platform_accounts` jadvali — rasmiy to'lov
--      kartalari/endiliklari. Ularni FAQAT siz (admin) to'ldirasiz;
--      hamma o'qiy oladi. Panel aynan shu jadvaldan ko'rsatadi —
--      kartani kodga yozib qo'yilmaydi, adashtirib bo'lmaydi.
--
--  Fayl xavfsiz: qayta ishga tushirsangiz ham xato bermaydi.
-- ============================================================


-- ------------------------------------------------------------
-- 1) STORAGE RLS — cheklarni o'qish va yangilash huquqlari
-- ------------------------------------------------------------
-- a) ADMIN barcha cheklarni ko'radi (signed URL uchun kerak)
drop policy if exists "subscription_receipts_admin_read" on storage.objects;
create policy "subscription_receipts_admin_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'subscription-receipts'
    and public.is_admin()
  );

-- b) Egasi O'Z faylini qayta yuklay oladi (upsert = update)
drop policy if exists "subscription_receipts_owner_update" on storage.objects;
create policy "subscription_receipts_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'subscription-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'subscription-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- c) Bucket bar ekanligini yana bir bor kafolatlaymiz
insert into storage.buckets (id, name, public)
values ('subscription-receipts', 'subscription-receipts', false)
on conflict (id) do nothing;


-- ------------------------------------------------------------
-- 2) YUKLAM XAVFSIZLIGI — faqat rasm, max 5 MB
-- ------------------------------------------------------------
create or replace function public.check_receipt_file()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.bucket_id <> 'subscription-receipts' then
    return new;
  end if;

  if new.metadata->>'size' is not null
     and (new.metadata->>'size')::bigint > 5 * 1024 * 1024 then
    raise exception 'Chek hajmi 5 MB dan oshmasin';
  end if;

  if coalesce(new.metadata->>'mimetype', '') not in
     ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Faqat JPG, PNG yoki WebP rasm yuklang';
  end if;

  return new;
end;
$$;

drop trigger if exists receipt_file_guard on storage.objects;
create trigger receipt_file_guard
  before insert or update on storage.objects
  for each row execute function public.check_receipt_file();


-- ------------------------------------------------------------
-- 3) YOPISHTIRILGAN SO'ROVLARNI TOZALASH
--    (chek fayli yo'q "pending" qatorlar — egasi qayta yuborsin)
-- ------------------------------------------------------------
-- a) Markaz obunalari: cheki yo'q pending → trial hali tirik bo'lsa
--    trial, aks holda expired
update public.subscriptions s
   set status = case
          when s.trial_ends_at > now() then 'trial'
          else 'expired'
        end,
        receipt_url = null
 where s.status = 'pending'
   and (s.receipt_url is null or s.receipt_url = '');

-- b) O'quvchi Pro so'rovlari
update public.student_plans
   set status = case when tier = 'pro' then 'free' else tier end,
        receipt_url = null
 where status = 'pending'
   and (receipt_url is null or receipt_url = '');

-- c) Modul xaridlari
update public.center_modules
   set status = 'expired', receipt_url = null
 where status = 'pending'
   and (receipt_url is null or receipt_url = '');

-- d) Panel xaridlari
update public.center_panels
   set status = 'expired', receipt_url = null
 where status = 'pending'
   and (receipt_url is null or receipt_url = '');


-- ------------------------------------------------------------
-- 4) PLATFORM_ACCOUNTS — rasmiy to'lov rekvizitlari (ISHONCH)
-- ------------------------------------------------------------
-- Panel aynan shu jadvaldan ko'rsatadi. Admin boshqaruv
-- sahifasidan tahrirlanadi; hamma (hatto kirmagan) o'qiy oladi.
-- Bu shuni anglatadi: kartani hujjatlashtirilgan, bitta rasmiy
-- manbadan ko'rsatasiz — foydalanuvchi "boshqa qanday karta
-- bor?" deb shubhalanmaydi.
create table if not exists public.platform_accounts (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,               -- "Asosiy karta (UzCard)"
  holder     text not null,               -- karta egasi F.I.Sh.
  number     text not null,               -- to'liq karta raqami
  bank       text,                        -- bank nomi
  kind       text not null default 'card' check (kind in ('card', 'wallet', 'bank')),
  is_primary boolean not null default false,
  is_active  boolean not null default true,
  sort       integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.platform_accounts enable row level security;

-- Hamma o'qiy oladi — ishonch uchun faqat faol qatorlar
drop policy if exists "platform_accounts_public_read" on public.platform_accounts;
create policy "platform_accounts_public_read"
  on public.platform_accounts for select
  using (is_active = true or public.is_admin());

-- Faqat admin boshqaradi
drop policy if exists "platform_accounts_admin_all" on public.platform_accounts;
create policy "platform_accounts_admin_all"
  on public.platform_accounts for all
  using (public.is_admin())
  with check (public.is_admin());

-- Bitta "asosiy" karta kafolati: boshqasi avtomatik false
create or replace function public.enforce_single_primary_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_primary then
    update public.platform_accounts
       set is_primary = false
     where id <> new.id and is_primary;
  end if;
  return new;
end;
$$;

drop trigger if exists platform_accounts_primary on public.platform_accounts;
create trigger platform_accounts_primary
  after insert or update of is_primary on public.platform_accounts
  for each row execute function public.enforce_single_primary_account();

drop trigger if exists platform_accounts_touch on public.platform_accounts;
create trigger platform_accounts_touch
  before update on public.platform_accounts
  for each row execute function public.touch_updated_at();

-- Boshlang'ich qatorlarni O'ZINGIZGA moslab to'ldiring:
-- (Bu faqat birinchi ishga tushirishda qo'shiladi, keyin admin
--  paneldan o'zgartirasiz. NUMBERLARNI ALMASHTIRING!)
insert into public.platform_accounts (label, holder, number, bank, kind, is_primary, sort)
select 'Asosiy karta', 'FINDTHEWAY MCHJ', '8600 0000 0000 0000', 'X Bank', 'card', true, 0
where not exists (select 1 from public.platform_accounts);


-- ------------------------------------------------------------
-- 5) REALTIME — yangi chek kelsa admin paneli o'zi yangilanadi
-- ------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.subscriptions;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.center_panels;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.center_modules;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.student_plans;
exception
  when duplicate_object then null;
end;
$$;


-- ============================================================
--  TAYYOR. Endi:
--   • Admin cheklarni ko'radi ("Chek topilmadi" hal bo'ldi)
--   • Egasi chekni qayta yuklay oladi
--   • To'lov kartasi admin paneldan boshqariladi
--  Keyingi qadam: Supabase → Table Editor → platform_accounts →
--  karta raqam va egasini O'Z ma'lumotlaringiz bilan almashtiring.
-- ============================================================
