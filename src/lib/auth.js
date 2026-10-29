import { supabase } from './supabase';

// Nama & role diambil dari tabel profiles (bukan dari input pengguna), lalu disalin ke localStorage
// agar halaman lama (Layout, Dashboard, Cuti) tetap bisa membacanya. Hak akses sebenarnya dijaga RLS di database.
export async function loadProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('nama, role').eq('id', userId).single();
  if (error || !data) return null;

  localStorage.setItem('adminName', data.nama);
  localStorage.setItem('adminRole', data.role);
  return data;
}

export function clearLocalLogin() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('adminName');
  localStorage.removeItem('adminRole');
}

// SAKTI: scope 'local' agar perangkat lain yang memakai akun yang sama tidak ikut ter-logout
export async function signOutLocal() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  // Bila server tidak terjangkau, Supabase tidak menghapus sesi lokal; hapus manual agar tetap keluar
  if (error) {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
      .forEach((key) => localStorage.removeItem(key));
  }
  clearLocalLogin();
}
