-- =====================================================================
-- TAHAP 05 — Pengaturan Akun dari aplikasi (menu Pengaturan, khusus ADMIN)
-- Cara pakai: Supabase → SQL Editor → New query → tempel SEMUA isi file
-- ini → Run. Aman dijalankan ulang. Tidak mengubah data yang sudah ada.
--
-- Semua fungsi memeriksa peran pemanggil di awal: selain ADMIN langsung
-- ditolak. Kata sandi disimpan ter-hash bcrypt, sama seperti Supabase Auth.
-- =====================================================================

-- Pemeriksa: hanya ADMIN yang boleh lanjut
create or replace function private.wajib_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(private.app_role(), '') <> 'ADMIN' then
    raise exception 'Hanya ADMIN yang boleh mengatur akun' using errcode = '42501';
  end if;
end $$;
revoke all on function private.wajib_admin() from public;

-- Pemeriksa kata sandi: 8–72 karakter (batas bcrypt 72 byte)
create or replace function private.cek_password(p_password text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_password is null or length(p_password) < 8 then
    raise exception 'Kata sandi minimal 8 karakter' using errcode = '22023';
  end if;
  if octet_length(p_password) > 72 then
    raise exception 'Kata sandi maksimal 72 karakter' using errcode = '22023';
  end if;
end $$;
revoke all on function private.cek_password(text) from public;

-- 1) Daftar semua akun (termasuk akun Auth yang belum punya profil/role)
create or replace function public.admin_daftar_akun()
returns table (id uuid, email text, nama text, role text, login_terakhir timestamptz, dibuat timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.wajib_admin();
  return query
    select u.id, u.email::text, coalesce(p.nama, '')::text, p.role, u.last_sign_in_at, u.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by case p.role when 'ADMIN' then 1 when 'POS BUOL' then 2 when 'KARYAWAN' then 3 else 4 end, u.email;
end $$;

-- 2) Atur nama & role (sekaligus membuat profil bila belum ada)
create or replace function public.admin_atur_akun(p_user uuid, p_nama text, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  perform private.wajib_admin();
  if p_role is null or p_role not in ('ADMIN', 'POS BUOL', 'KARYAWAN') then
    raise exception 'Role tidak dikenal' using errcode = '22023';
  end if;
  if coalesce(btrim(p_nama), '') = '' then
    raise exception 'Nama wajib diisi' using errcode = '22023';
  end if;
  if p_user = auth.uid() and p_role <> 'ADMIN' then
    raise exception 'Role akun sendiri tidak bisa diturunkan (agar selalu ada ADMIN)' using errcode = '22023';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = p_user;
  if v_email is null then
    raise exception 'Akun tidak ditemukan' using errcode = 'P0002';
  end if;

  insert into public.profiles (id, email, nama, role)
  values (p_user, v_email, btrim(p_nama), p_role)
  on conflict (id) do update set nama = excluded.nama, role = excluded.role;
end $$;

-- 3) Ganti kata sandi akun mana pun (termasuk akun sendiri)
create or replace function public.admin_ganti_password(p_user uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.wajib_admin();
  perform private.cek_password(p_password);

  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where id = p_user;
  if not found then
    raise exception 'Akun tidak ditemukan' using errcode = 'P0002';
  end if;

  -- Perangkat lain yang masih login dengan akun itu ikut dikeluarkan (kecuali akun sendiri)
  if p_user <> auth.uid() then
    delete from auth.sessions where user_id = p_user;
  end if;
end $$;

-- 4) Buat akun baru lengkap dengan profil (langsung bisa login)
create or replace function public.admin_buat_akun(p_email text, p_password text, p_nama text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  perform private.wajib_admin();
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Format email tidak valid' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'Email sudah terdaftar' using errcode = '23505';
  end if;
  perform private.cek_password(p_password);
  if p_role is null or p_role not in ('ADMIN', 'POS BUOL', 'KARYAWAN') then
    raise exception 'Role tidak dikenal' using errcode = '22023';
  end if;
  if coalesce(btrim(p_nama), '') = '' then
    raise exception 'Nama wajib diisi' using errcode = '22023';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token,
    is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('nama', btrim(p_nama)),
    now(), now(),
    '', '', '', '', '', '', '', '',
    false, false
  );

  insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (v_id::text, v_id,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
          'email', now(), now());

  insert into public.profiles (id, email, nama, role)
  values (v_id, v_email, btrim(p_nama), p_role);

  return v_id;
end $$;

-- 5) Hapus akun (profil, identitas & sesi ikut terhapus)
create or replace function public.admin_hapus_akun(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.wajib_admin();
  if p_user = auth.uid() then
    raise exception 'Akun sendiri tidak bisa dihapus' using errcode = '22023';
  end if;
  delete from auth.users where id = p_user;
  if not found then
    raise exception 'Akun tidak ditemukan' using errcode = 'P0002';
  end if;
end $$;

-- Hanya pengguna login yang boleh memanggil (pemeriksaan ADMIN ada di dalam fungsi)
revoke all on function public.admin_daftar_akun() from public, anon;
revoke all on function public.admin_atur_akun(uuid, text, text) from public, anon;
revoke all on function public.admin_ganti_password(uuid, text) from public, anon;
revoke all on function public.admin_buat_akun(text, text, text, text) from public, anon;
revoke all on function public.admin_hapus_akun(uuid) from public, anon;
grant execute on function public.admin_daftar_akun() to authenticated;
grant execute on function public.admin_atur_akun(uuid, text, text) to authenticated;
grant execute on function public.admin_ganti_password(uuid, text) to authenticated;
grant execute on function public.admin_buat_akun(text, text, text, text) to authenticated;
grant execute on function public.admin_hapus_akun(uuid) to authenticated;

-- Beri tahu API agar fungsi baru langsung bisa dipanggil aplikasi
notify pgrst, 'reload schema';
