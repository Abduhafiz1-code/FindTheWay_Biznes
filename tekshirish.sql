-- ============================================================
--  FindTheWay — hisobni tekshirish va tuzatish
--  Supabase panel → SQL Editor → New query → shuni ishlating.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Hisobingiz qanday holatda? (avval shuni ishga tushiring)
-- ------------------------------------------------------------
-- "role" ustuni 'owner' bo'lishi kerak.
-- "email_confirmed_at" bo'sh bo'lsa — email hali tasdiqlanmagan,
-- shuning uchun tizimga kira olmaysiz.
-- "profil_yoq" = true bo'lsa — profiles qatori umuman yaratilmagan.

select
  u.email,
  u.email_confirmed_at,
  u.raw_user_meta_data ->> 'role' as metadata_role,
  p.role                          as profil_role,
  p.center_name,
  (p.id is null)                  as profil_yoq,
  u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;


-- ------------------------------------------------------------
-- 2) Emailni qo'lda tasdiqlash (agar email_confirmed_at bo'sh bo'lsa)
-- ------------------------------------------------------------
-- Emailingizni yozing va izohni oching:
--
-- update auth.users
--    set email_confirmed_at = now()
--  where email = 'sizning@email.com'
--    and email_confirmed_at is null;


-- ------------------------------------------------------------
-- 3) Hisobni markaz egasiga aylantirish
-- ------------------------------------------------------------
-- Profil yo'q bo'lsa yaratadi, bor bo'lsa rolini 'owner' qiladi.
-- Emailingizni yozing va izohni oching:
--
-- insert into public.profiles (id, role, full_name, center_name, phone)
-- select
--   u.id,
--   'owner',
--   coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
--   u.raw_user_meta_data ->> 'center_name',
--   u.raw_user_meta_data ->> 'phone'
-- from auth.users u
-- where u.email = 'sizning@email.com'
-- on conflict (id) do update set role = 'owner';
--
-- update auth.users
--    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"role":"owner"}'::jsonb
--  where email = 'sizning@email.com';


-- ------------------------------------------------------------
-- 4) Hisobni butunlay o'chirib, noldan boshlash
-- ------------------------------------------------------------
-- Test hisoblarini tozalash uchun. Ehtiyot bo'ling — qaytarib bo'lmaydi.
--
-- delete from auth.users where email = 'sizning@email.com';
