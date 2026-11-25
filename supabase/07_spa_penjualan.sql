-- =====================================================================
-- TAHAP 07 — Modul Penjualan: tabel data SPA (penjualan dealer)
-- Satu baris = satu penjualan. Isinya disimpan lengkap di tabel ini (tidak
-- bergantung pada BASTK), agar data Excel tahun-tahun sebelumnya bisa diimpor.
-- SPA yang dibuat dari BASTK di aplikasi menyimpan bastk_id: satu BASTK
-- hanya boleh punya satu SPA.
-- Akses sama dengan BASTK: ADMIN & POS BUOL (KARYAWAN tidak).
-- Cara pakai: Supabase → SQL Editor → New query → tempel SEMUA isi file
-- ini → Run. Aman dijalankan ulang. Tidak mengubah tabel lain.
-- =====================================================================

create table if not exists public.spa_penjualan (
  id uuid primary key default gen_random_uuid(),
  bastk_id uuid references public.bastk_history (id) on delete set null,
  kategori text,
  no_bastk text not null,
  tanggal_bastk date not null,
  leasing text not null,
  pemohon text not null,
  nama_stnk text,
  no_hp1 text,
  no_hp2 text,
  pekerjaan text,
  desa text,
  kecamatan text,
  unit integer not null default 1,
  jenis_motor text,
  no_rangka text,
  no_mesin text,
  type_motor text,
  warna text,
  otr bigint not null default 0,
  dp_stor bigint not null default 0,
  dp_gross bigint not null default 0,
  tenor integer,
  angsuran bigint not null default 0,
  subsidi bigint not null default 0,
  nama_sales text,
  keterangan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Satu BASTK di aplikasi = paling banyak satu SPA (data impor tanpa bastk_id tidak dibatasi)
create unique index if not exists spa_penjualan_bastk_unik on public.spa_penjualan (bastk_id) where bastk_id is not null;
create index if not exists spa_penjualan_tanggal on public.spa_penjualan (tanggal_bastk desc);
create index if not exists spa_penjualan_leasing on public.spa_penjualan (leasing);
create index if not exists spa_penjualan_sales on public.spa_penjualan (nama_sales);

alter table public.spa_penjualan enable row level security;

drop policy if exists "staf: akses penuh" on public.spa_penjualan;
create policy "staf: akses penuh" on public.spa_penjualan for all to authenticated
  using ((select private.app_role()) in ('ADMIN', 'POS BUOL'))
  with check ((select private.app_role()) in ('ADMIN', 'POS BUOL'));

-- Pilihan filter di halaman Data SPA: daftar leasing & sales yang pernah dipakai.
-- security invoker: tunduk pada aturan akses tabel di atas.
create or replace function public.spa_pilihan_filter()
returns table (jenis text, nilai text)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct 'leasing'::text, s.leasing from public.spa_penjualan s where coalesce(s.leasing, '') <> ''
  union
  select distinct 'sales'::text, s.nama_sales from public.spa_penjualan s where coalesce(s.nama_sales, '') <> ''
  order by 1, 2;
$$;

revoke all on function public.spa_pilihan_filter() from public, anon;
grant execute on function public.spa_pilihan_filter() to authenticated;
