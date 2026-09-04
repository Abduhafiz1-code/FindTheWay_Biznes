-- ============================================================
--  FindTheWay — MARKAZ BILAN SAVOL-JAVOB CHATI (qo'shimcha)
--  Supabase → SQL Editor → New query → shu faylni to'liq
--  nusxalab qo'ying va RUN bosing.
--
--  ⚠️ MUHIM: avval `supabase_biznes.sql` ishga tushirilgan bo'lishi
--  kerak — u `requests` va `request_messages` jadvallarini yaratadi.
--
--  Bu fayl:
--   1. requests / request_messages ga ism "snapshot" ustunlarini
--      qo'shadi (xabar yozilgan paytdagi ism — profillar RLS bilan
--      yopiq bo'lgani uchun to'g'ridan-to'g'ri join ishlamaydi).
--   2. Ikkala jadvalni realtime'ga qo'shadi — suhbat jonli keladi.
--
--  Fayl xavfsiz: qayta ishga tushirsangiz ham xato bermaydi.
-- ============================================================

alter table public.requests add column if not exists student_name text;
alter table public.request_messages add column if not exists sender_name text;

create index if not exists idx_requests_center_status
  on public.requests (center_id, status, updated_at desc);

do $$
begin
  alter publication supabase_realtime add table public.requests;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.request_messages;
exception
  when duplicate_object then null;
end;
$$;

-- ============================================================
--  Tayyor. Frontend (Biznes: /murojaatlar, App: markaz sahifasi)
--  bu jadvallar bilan ishlaydi.
-- ============================================================
