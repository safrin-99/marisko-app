-- =====================================================================
-- TAHAP 06 — Cuti & Izin hanya untuk ADMIN dan KARYAWAN
-- Akun POS (Buol / Lakea) tidak bisa membaca maupun menulis data cuti,
-- termasuk di "Aktivitas Terbaru" Dashboard. Aturan ADMIN & KARYAWAN tetap:
--   ADMIN    : lihat, ajukan, edit, setujui/tolak, hapus
--   KARYAWAN : lihat & ajukan; edit hanya yang DIPROSES; tidak bisa setujui/hapus
-- Cara pakai: Supabase → SQL Editor → New query → tempel SEMUA isi file
-- ini → Run. Aman dijalankan ulang. Tidak mengubah data cuti yang ada.
-- =====================================================================

drop policy if exists "cuti: baca" on public.cuti_history;
create policy "cuti: baca" on public.cuti_history for select to authenticated
  using ((select private.app_role()) in ('ADMIN', 'KARYAWAN'));

drop policy if exists "cuti: tambah" on public.cuti_history;
create policy "cuti: tambah" on public.cuti_history for insert to authenticated
  with check (
    (select private.app_role()) = 'ADMIN'
    or ((select private.app_role()) = 'KARYAWAN' and coalesce(status, 'DIPROSES') = 'DIPROSES')
  );

drop policy if exists "cuti: ubah" on public.cuti_history;
create policy "cuti: ubah" on public.cuti_history for update to authenticated
  using (
    (select private.app_role()) = 'ADMIN'
    or ((select private.app_role()) = 'KARYAWAN' and coalesce(status, 'DIPROSES') = 'DIPROSES')
  )
  with check (
    (select private.app_role()) = 'ADMIN'
    or ((select private.app_role()) = 'KARYAWAN' and coalesce(status, 'DIPROSES') = 'DIPROSES')
  );

-- "cuti: hapus ADMIN" tidak berubah (sudah hanya ADMIN).
