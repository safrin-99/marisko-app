import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, UserPlus, KeyRound, Edit, Trash2, RefreshCw, AlertCircle, CheckCircle2, Eye, EyeOff, ChevronDown, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Nilai role di database tetap ADMIN / POS BUOL / KARYAWAN; role POS dipakai juga untuk cabang Lakea
const DAFTAR_PERAN = [
  { value: 'ADMIN', label: 'ADMIN (Induk)', ket: 'Semua menu, termasuk Pengaturan.' },
  { value: 'POS BUOL', label: 'POS (Buol / Lakea)', ket: 'Semua menu kecuali Pengaturan dan Cuti & Izin.' },
  { value: 'KARYAWAN', label: 'KARYAWAN', ket: 'Hanya Dashboard dan Cuti & Izin.' },
];
const labelPeran = (role) => DAFTAR_PERAN.find((p) => p.value === role)?.label || 'Belum ada role';

// Sama dengan batas di database (fungsi private.cek_password)
const SANDI_MIN = 8;

// Sama dengan durasi animasi .ui-modal-closing / .ui-overlay-closing
const DURASI_TUTUP_MS = 180;

const FORM_KOSONG = { id: null, email: '', nama: '', role: 'POS BUOL', sandi: '', ulangiSandi: '' };

const formatWaktu = (iso) => (iso
  ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : 'Belum pernah');

const pesanError = (error) => {
  if (error?.code === 'PGRST202') return 'Fitur Akun & Kata Sandi belum aktif di database. Jalankan file "05_pengaturan_akun.sql" sekali di Supabase SQL Editor.';
  if (!navigator.onLine) return 'Tidak ada koneksi internet. Periksa koneksi lalu coba lagi.';
  return error?.message || 'Terjadi kesalahan. Coba lagi.';
};

export default function AkunPanel() {
  const [akun, setAkun] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [belumAktif, setBelumAktif] = useState(false);
  const [idSaya, setIdSaya] = useState(null);
  const [dialog, setDialog] = useState(null); // tambah | ubah | sandi | hapus
  const [form, setForm] = useState(FORM_KOSONG);
  const [lihatSandi, setLihatSandi] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notif, setNotif] = useState('');
  const [sedangMenutup, setSedangMenutup] = useState(false);
  const [menuPeranTerbuka, setMenuPeranTerbuka] = useState(false);

  const terapkanDaftarAkun = ({ data, error }) => {
    if (error) {
      setBelumAktif(error.code === 'PGRST202');
      setLoadError(pesanError(error));
    } else {
      setBelumAktif(false);
      setLoadError('');
      setAkun(data || []);
    }
    setIsLoading(false);
  };

  const muatAkun = () => {
    setIsLoading(true);
    supabase.rpc('admin_daftar_akun').then(terapkanDaftarAkun);
  };

  useEffect(() => {
    supabase.rpc('admin_daftar_akun').then(terapkanDaftarAkun);
    supabase.auth.getSession().then(({ data }) => setIdSaya(data.session?.user?.id || null));
  }, []);

  const bukaDialog = (jenis, data = null) => {
    setForm(data ? { ...FORM_KOSONG, id: data.id, email: data.email, nama: data.nama || '', role: data.role || 'POS BUOL' } : FORM_KOSONG);
    setFormError('');
    setNotif('');
    setLihatSandi(false);
    setMenuPeranTerbuka(false);
    setDialog(jenis);
  };

  // Popup ditutup dengan animasi dulu (sama seperti popup Keluar Aplikasi), baru dilepas
  const lepasDialog = (setelahTutup) => {
    setMenuPeranTerbuka(false);
    setSedangMenutup(true);
    setTimeout(() => {
      setDialog(null);
      setSedangMenutup(false);
      if (setelahTutup) setelahTutup();
    }, DURASI_TUTUP_MS);
  };

  const tutupDialog = () => {
    if (!isSaving && !sedangMenutup) lepasDialog();
  };

  const ubahForm = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const simpan = async (e) => {
    e.preventDefault();
    let galat = '';
    if ((dialog === 'tambah' || dialog === 'ubah') && !form.nama.trim()) galat = 'Nama wajib diisi.';
    if (!galat && dialog === 'tambah' && !form.email.trim()) galat = 'Email wajib diisi.';
    if (!galat && (dialog === 'tambah' || dialog === 'sandi')) {
      if (form.sandi.length < SANDI_MIN) galat = `Kata sandi minimal ${SANDI_MIN} karakter.`;
      else if (form.sandi !== form.ulangiSandi) galat = 'Ulangi kata sandi tidak sama.';
    }
    if (galat) {
      setFormError(galat);
      return;
    }

    setIsSaving(true);
    setFormError('');
    let hasil;
    try {
      if (dialog === 'tambah') hasil = await supabase.rpc('admin_buat_akun', { p_email: form.email.trim(), p_password: form.sandi, p_nama: form.nama.trim(), p_role: form.role });
      else if (dialog === 'ubah') hasil = await supabase.rpc('admin_atur_akun', { p_user: form.id, p_nama: form.nama.trim(), p_role: form.role });
      else if (dialog === 'sandi') hasil = await supabase.rpc('admin_ganti_password', { p_user: form.id, p_password: form.sandi });
      else hasil = await supabase.rpc('admin_hapus_akun', { p_user: form.id });
    } catch (err) {
      hasil = { error: err };
    }
    setIsSaving(false);

    if (hasil.error) {
      setFormError(pesanError(hasil.error));
      return;
    }

    if (dialog === 'ubah' && form.id === idSaya) localStorage.setItem('adminName', form.nama.trim());
    const pesan = {
      tambah: `Akun ${form.email.trim().toLowerCase()} berhasil dibuat dan bisa langsung login.`,
      ubah: `Nama & role ${form.email} berhasil disimpan. Perubahan menu terlihat setelah akun itu memuat ulang aplikasi.`,
      sandi: form.id === idSaya
        ? 'Kata sandi Anda berhasil diganti. Gunakan sandi baru saat login berikutnya.'
        : `Kata sandi ${form.email} berhasil diganti. Perangkat yang masih login dengan akun itu otomatis keluar.`,
      hapus: `Akun ${form.email} berhasil dihapus.`,
    }[dialog];
    lepasDialog(() => setNotif(pesan));
    muatAkun();
  };

  const judulDialog = {
    tambah: 'Tambah Akun Baru',
    ubah: form.id === idSaya ? 'Ubah Nama Akun Anda' : 'Ubah Nama & Role',
    sandi: form.id === idSaya ? 'Ganti Kata Sandi Anda' : 'Ganti Kata Sandi',
    hapus: 'Hapus Akun?',
  }[dialog];

  const ketDialog = {
    tambah: 'Akun langsung aktif dan bisa login dengan email & kata sandi ini.',
    ubah: form.email,
    sandi: `Untuk akun ${form.email}. Minimal ${SANDI_MIN} karakter; sebaiknya 12 karakter atau lebih.`,
    hapus: `Akun ${form.email} akan dihapus permanen dan tidak bisa login lagi. Data BASTK, kwitansi, dan cuti tidak ikut terhapus.`,
  }[dialog];

  const renderDialog = () => createPortal(
    <div className={`ui-overlay ${sedangMenutup ? 'ui-overlay-closing' : ''}`}>
      <div className="absolute inset-0" onClick={tutupDialog}></div>
      <form onSubmit={simpan} className={`ui-modal ${sedangMenutup ? 'ui-modal-closing' : ''}`}>
        <h3 className="ui-modal-title">{judulDialog}</h3>
        <p className="ui-modal-text">{ketDialog}</p>

        {formError && (
          <div className="ui-alert-danger mb-4"><AlertCircle className="w-4 h-4 flex-shrink-0" /> {formError}</div>
        )}

        <div className="space-y-4">
          {dialog === 'tambah' && (
            <div><label className="ui-label">Email</label><input type="email" value={form.email} onChange={ubahForm('email')} required placeholder="nama@marisko.com" className="ui-input" /></div>
          )}

          {(dialog === 'tambah' || dialog === 'ubah') && (
            <>
              <div><label className="ui-label">Nama Tampil</label><input type="text" value={form.nama} onChange={ubahForm('nama')} required placeholder="Mis. STAF POS LAKEA" className="ui-input" /></div>
              <div className="relative">
                <label className="ui-label">Role</label>
                {form.id !== null && form.id === idSaya ? (
                  <div className="ui-input flex items-center bg-stone-100 text-stone-600 cursor-not-allowed select-none">{labelPeran(form.role)}</div>
                ) : (
                  <>
                    {/* SAKTI: Dropdown sama dengan Jenis Pembiayaan di halaman BASTK */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-haspopup="listbox"
                      aria-expanded={menuPeranTerbuka}
                      onClick={() => setMenuPeranTerbuka(!menuPeranTerbuka)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMenuPeranTerbuka(!menuPeranTerbuka); } }}
                      className={`ui-input flex items-center justify-between cursor-pointer select-none ${menuPeranTerbuka ? 'border-brand ring-3 ring-brand/10' : ''}`}
                    >
                      <span className="text-stone-900 font-medium">{labelPeran(form.role)}</span>
                      <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform duration-200 flex-shrink-0 ${menuPeranTerbuka ? 'rotate-180' : ''}`} />
                    </div>
                    {menuPeranTerbuka && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuPeranTerbuka(false)}></div>
                        <div className="ui-menu" role="listbox">
                          {DAFTAR_PERAN.map((p) => (
                            // Pilihan saat ini cukup ditandai tebal + centang (tanpa latar), agar hanya baris yang disorot yang abu-abu
                            <div key={p.value} role="option" aria-selected={form.role === p.value} onClick={() => { setForm((f) => ({ ...f, role: p.value })); setMenuPeranTerbuka(false); }} className={`ui-menu-item flex items-center justify-between ${form.role === p.value ? 'font-semibold text-stone-900' : ''}`}>
                              {p.label}
                              {form.role === p.value && <Check className="w-4 h-4 text-stone-900 flex-shrink-0" />}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
                {/* Kotak keterangan setinggi tetap: memberi ruang agar daftar Role yang melayang tetap muat di dalam popup (popup tidak berubah ukuran / melompat) */}
                <p className="mt-2 min-h-[3.5rem] px-3 py-2.5 rounded-lg border border-stone-200 bg-stone-50 text-xs leading-relaxed text-stone-600">
                  {form.id !== null && form.id === idSaya
                    ? 'Role akun sendiri tidak bisa diubah, agar selalu ada ADMIN.'
                    : DAFTAR_PERAN.find((p) => p.value === form.role)?.ket}
                </p>
              </div>
            </>
          )}

          {(dialog === 'tambah' || dialog === 'sandi') && (
            <>
              <div>
                <label className="ui-label">{dialog === 'tambah' ? 'Kata Sandi' : 'Kata Sandi Baru'}</label>
                <div className="relative">
                  <input type={lihatSandi ? 'text' : 'password'} value={form.sandi} onChange={ubahForm('sandi')} required autoComplete="new-password" className="ui-input pr-11" />
                  <button type="button" onClick={() => setLihatSandi(!lihatSandi)} aria-label={lihatSandi ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} className="absolute inset-y-0 right-0 px-3 text-stone-500 hover:text-stone-900">
                    {lihatSandi ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div><label className="ui-label">Ulangi Kata Sandi</label><input type={lihatSandi ? 'text' : 'password'} value={form.ulangiSandi} onChange={ubahForm('ulangiSandi')} required autoComplete="new-password" className="ui-input" /></div>
            </>
          )}
        </div>

        <div className="flex w-full gap-3 mt-6">
          <button type="button" onClick={tutupDialog} disabled={isSaving} className="ui-btn-secondary flex-1">Batal</button>
          <button type="submit" disabled={isSaving} className={`${dialog === 'hapus' ? 'ui-btn-danger' : 'ui-btn-primary'} flex-1`}>
            {isSaving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Memproses...</> : { tambah: 'Buat Akun', ubah: 'Simpan', sandi: 'Ganti Sandi', hapus: 'Ya, Hapus!' }[dialog]}
          </button>
        </div>
      </form>
    </div>, document.body
  );

  return (
    <div className="ui-card overflow-hidden">
      {dialog && renderDialog()}

      <div className="ui-card-header">
        <div>
          <h3 className="ui-card-title"><Users className="w-4 h-4 text-stone-500" /> Akun & Kata Sandi</h3>
          <p className="text-sm text-stone-600 mt-1">Atur role dan kata sandi setiap akun tanpa membuka database.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={muatAkun} disabled={isLoading} className="ui-btn-sm"><RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</button>
          <button onClick={() => bukaDialog('tambah')} disabled={belumAktif} className="ui-btn-sm"><UserPlus className="w-4 h-4" /> Tambah Akun</button>
        </div>
      </div>

      {notif && (
        <div className="px-5 pt-4"><div className="ui-alert-neutral"><CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-700" /> {notif}</div></div>
      )}

      {loadError ? (
        <div className="p-5"><div className={belumAktif ? 'ui-alert-neutral' : 'ui-alert-danger'}><AlertCircle className="w-4 h-4 flex-shrink-0" /> {loadError}</div></div>
      ) : (
        <div className="ui-table-wrap ui-scroll-thin">
          <table className="ui-table whitespace-nowrap">
            <thead className="ui-thead"><tr><th className="ui-th">Nama & Email</th><th className="ui-th">Role</th><th className="ui-th">Login Terakhir</th><th className="ui-th text-right">Aksi</th></tr></thead>
            <tbody>
              {isLoading && akun.length === 0 ? (
                <tr><td colSpan={4} className="ui-empty">Memuat daftar akun...</td></tr>
              ) : akun.length === 0 ? (
                <tr><td colSpan={4} className="ui-empty">Belum ada akun.</td></tr>
              ) : akun.map((a) => (
                <tr key={a.id} className="ui-tr">
                  <td className="ui-td">
                    <div className="font-semibold text-stone-900">{a.nama || '—'} {a.id === idSaya && <span className="ui-badge-neutral ml-1">Anda</span>}</div>
                    <div className="text-xs text-stone-500 mt-0.5">{a.email}</div>
                  </td>
                  <td className="ui-td">
                    {a.role
                      ? <span className={a.role === 'ADMIN' ? 'ui-badge-success' : 'ui-badge-neutral'}>{labelPeran(a.role)}</span>
                      : <span className="ui-badge-warning">Belum ada role</span>}
                  </td>
                  <td className="ui-td text-stone-700">{formatWaktu(a.login_terakhir)}</td>
                  <td className="ui-td">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => bukaDialog('ubah', a)} className="ui-action"><Edit className="w-3.5 h-3.5" /> {a.role ? 'Ubah' : 'Beri Role'}</button>
                      <button onClick={() => bukaDialog('sandi', a)} className="ui-action"><KeyRound className="w-3.5 h-3.5" /> Ganti Sandi</button>
                      {a.id !== idSaya && <button onClick={() => bukaDialog('hapus', a)} className="ui-action-danger"><Trash2 className="w-3.5 h-3.5" /> Hapus</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-5 py-4 border-t border-stone-200 space-y-1">
        {DAFTAR_PERAN.map((p) => (
          <p key={p.value} className="text-xs text-stone-500"><b className="font-semibold text-stone-700">{p.label}:</b> {p.ket}</p>
        ))}
      </div>
    </div>
  );
}
