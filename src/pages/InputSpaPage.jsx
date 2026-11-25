import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SquarePen, Edit, RefreshCw, X, CheckCircle2, AlertCircle, FileSearch, Save, RotateCcw, FolderOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DAFTAR_KATEGORI, OPSI_PEMBIAYAAN } from '../lib/pilihanBastk';
import { formatRupiah, parseNumber } from '../lib/angka';
import PilihanDropdown from '../components/PilihanDropdown';

// SAKTI: Modul Penjualan — Input SPA. Berkas diisi dari BASTK yang sudah dicetak:
// pilih kategori + No BASTK, lalu data konsumen & motor terisi otomatis; sisanya diketik.
const OPSI_KATEGORI = DAFTAR_KATEGORI.map((k) => ({ value: k, label: k }));
const KETERANGAN = [
  { value: 'ADMINISTRASI LENGKAP', label: 'Administrasi Lengkap', penjelas: 'Tidak ada kendala administrasi saat keluaran.' },
  { value: 'MOTOROYAKU BELUM ADA', label: 'Motoroyaku Belum Ada', penjelas: 'Konsumen akan diberi tanda terima khusus.' },
];
const FORM_KOSONG = {
  bastkId: null, kategori: 'BASTK INDUK', noBastk: '', tanggalBastk: '', leasing: '',
  pemohon: '', namaStnk: '', noHp1: '', noHp2: '', pekerjaan: '',
  desa: '', kecamatan: '',
  jenisMotor: '', noRangka: '', noMesin: '', typeMotor: '', warna: '', unit: 1,
  otr: 0, dpStor: 0, dpGross: 0, tenor: 0, angsuran: 0, subsidi: 0,
  namaSales: '', keterangan: 'ADMINISTRASI LENGKAP',
};
const MODAL_TUTUP = { isOpen: false, type: '', title: '', message: '' };

// Alamat BASTK berbentuk "DESA TALUAN KEC. MOMUNU KAB. BUOL" (atau "KEL. ..."): ambil desa & kecamatannya
const pecahAlamat = (alamat) => {
  const cocok = /(?:DESA|KEL\.?)\s+(.+?)\s+KEC\.?\s+(.+?)(?:\s+KAB\.?\s|\s+KOTA\s|$)/i.exec(alamat || '');
  return cocok ? { desa: cocok[1].trim(), kecamatan: cocok[2].trim() } : { desa: '', kecamatan: '' };
};

const dariBaris = (r) => ({
  bastkId: r.bastk_id, kategori: r.kategori || 'BASTK INDUK', noBastk: r.no_bastk || '', tanggalBastk: r.tanggal_bastk || '', leasing: r.leasing || '',
  pemohon: r.pemohon || '', namaStnk: r.nama_stnk || '', noHp1: r.no_hp1 || '', noHp2: r.no_hp2 || '', pekerjaan: r.pekerjaan || '',
  desa: r.desa || '', kecamatan: r.kecamatan || '',
  jenisMotor: r.jenis_motor || '', noRangka: r.no_rangka || '', noMesin: r.no_mesin || '', typeMotor: r.type_motor || '', warna: r.warna || '', unit: r.unit || 1,
  otr: r.otr || 0, dpStor: r.dp_stor || 0, dpGross: r.dp_gross || 0, tenor: r.tenor || 0, angsuran: r.angsuran || 0, subsidi: r.subsidi || 0,
  namaSales: r.nama_sales || '', keterangan: r.keterangan || 'ADMINISTRASI LENGKAP',
});

export default function InputSpaPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idEdit = searchParams.get('id');

  const [form, setForm] = useState(FORM_KOSONG);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mencariBastk, setMencariBastk] = useState(false);
  const [infoBastk, setInfoBastk] = useState(null); // { jenis: 'sukses' | 'gagal', pesan }
  const [modal, setModal] = useState(MODAL_TUTUP);

  const isEditing = Boolean(idEdit);
  const ubah = (kolom) => (e) => setForm((f) => ({ ...f, [kolom]: e.target.value }));
  const ubahAngka = (kolom) => (e) => setForm((f) => ({ ...f, [kolom]: parseNumber(e.target.value) }));
  const tutupModal = () => setModal(MODAL_TUTUP);

  // Mode edit: buka data SPA yang dipilih di halaman Data SPA
  useEffect(() => {
    if (!idEdit) return;
    let batal = false;
    (async () => {
      const { data, error } = await supabase.from('spa_penjualan').select('*').eq('id', idEdit).maybeSingle();
      if (batal) return;
      if (error || !data) {
        setModal({ isOpen: true, type: 'error', title: 'Data Tidak Ditemukan', message: 'Data SPA yang ingin diedit tidak ditemukan. Muat ulang halaman Data SPA lalu coba lagi.' });
        return;
      }
      setForm(dariBaris(data));
    })();
    return () => { batal = true; };
  }, [idEdit]);

  const ambilDariBastk = async () => {
    const nomor = form.noBastk.trim();
    if (!nomor) {
      setInfoBastk({ jenis: 'gagal', pesan: 'Isi No BASTK dulu, lalu tekan "Ambil dari BASTK".' });
      return;
    }
    setMencariBastk(true);
    setInfoBastk(null);
    try {
      // Cukup nomor depannya (mis. 7678), atau nomor lengkap 7678/MP/BL/XI/2026
      let query = supabase
        .from('bastk_history')
        .select('id, noSurat, tglSerah, jenisPembiayaan, namaKonsumen, alamat, tipeKendaraan, noRangka, noMesin, warna')
        .eq('kategori', form.kategori)
        .order('created_at', { ascending: false })
        .limit(1);
      query = nomor.includes('/') ? query.eq('noSurat', nomor) : query.like('noSurat', `${nomor}/%`);
      const { data, error } = await query;
      if (error) throw error;
      const bastk = data?.[0];
      if (!bastk) {
        setInfoBastk({ jenis: 'gagal', pesan: `BASTK ${nomor} tidak ditemukan di ${form.kategori}. Periksa nomor & kategori, atau isi data secara manual.` });
        return;
      }
      const { data: sudahAda, error: errCek } = await supabase.from('spa_penjualan').select('id').eq('bastk_id', bastk.id).limit(1);
      if (errCek) throw errCek;
      if (sudahAda?.length && sudahAda[0].id !== idEdit) {
        setInfoBastk({ jenis: 'gagal', pesan: `BASTK ${bastk.noSurat} sudah punya data SPA. Ubah datanya lewat menu Data SPA.` });
        return;
      }
      const alamat = pecahAlamat(bastk.alamat);
      setForm((f) => ({
        ...f,
        bastkId: bastk.id, noBastk: bastk.noSurat, tanggalBastk: bastk.tglSerah || f.tanggalBastk, leasing: bastk.jenisPembiayaan || f.leasing,
        pemohon: bastk.namaKonsumen || f.pemohon, typeMotor: bastk.tipeKendaraan || f.typeMotor,
        noRangka: bastk.noRangka || f.noRangka, noMesin: bastk.noMesin || f.noMesin, warna: bastk.warna || f.warna,
        desa: f.desa || alamat.desa, kecamatan: f.kecamatan || alamat.kecamatan,
      }));
      setInfoBastk({ jenis: 'sukses', pesan: `Data konsumen & motor terisi dari BASTK ${bastk.noSurat}. Periksa kembali sebelum menyimpan.` });
    } catch {
      setInfoBastk({ jenis: 'gagal', pesan: navigator.onLine ? 'Gagal terhubung ke server database.' : 'Tidak ada koneksi internet. Periksa koneksi lalu coba lagi.' });
    } finally {
      setMencariBastk(false);
    }
  };

  const resetForm = () => {
    setForm(FORM_KOSONG);
    setInfoBastk(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.kategori || !form.noBastk.trim() || !form.tanggalBastk || !form.leasing || !form.pemohon.trim()) {
      setModal({ isOpen: true, type: 'error', title: 'Data Belum Lengkap!', message: 'Mohon isi Kategori, No BASTK, Tanggal BASTK, Leasing, dan Pemohon sebelum menyimpan.' });
      return;
    }

    const besar = (teks) => (teks || '').trim().toUpperCase();
    const data = {
      bastk_id: form.bastkId, kategori: form.kategori, no_bastk: form.noBastk.trim(), tanggal_bastk: form.tanggalBastk, leasing: form.leasing,
      pemohon: besar(form.pemohon), nama_stnk: besar(form.namaStnk) || besar(form.pemohon),
      no_hp1: form.noHp1.trim(), no_hp2: form.noHp2.trim(), pekerjaan: besar(form.pekerjaan),
      desa: besar(form.desa), kecamatan: besar(form.kecamatan),
      jenis_motor: besar(form.jenisMotor), no_rangka: besar(form.noRangka), no_mesin: besar(form.noMesin),
      type_motor: besar(form.typeMotor), warna: besar(form.warna), unit: parseNumber(form.unit) || 1,
      otr: form.otr, dp_stor: form.dpStor, dp_gross: form.dpGross, tenor: form.tenor || null, angsuran: form.angsuran, subsidi: form.subsidi,
      nama_sales: besar(form.namaSales), keterangan: form.keterangan, updated_at: new Date().toISOString(),
    };

    setIsSubmitting(true);
    try {
      if (isEditing) {
        const { data: updated, error } = await supabase.from('spa_penjualan').update(data).eq('id', idEdit).select();
        if (error) throw error;
        if (!updated || updated.length === 0) throw new Error('Data tidak ditemukan di database. Muat ulang halaman lalu coba lagi.');
        setModal({ isOpen: true, type: 'success', title: 'Data Diperbarui!', message: `Data SPA BASTK ${data.no_bastk} berhasil diperbarui.` });
      } else {
        const { error } = await supabase.from('spa_penjualan').insert([data]);
        if (error) throw error;
        setModal({ isOpen: true, type: 'success', title: 'Berhasil Disimpan!', message: `Data SPA BASTK ${data.no_bastk} berhasil disimpan.` });
        resetForm();
      }
    } catch (err) {
      // Indeks unik di database: satu BASTK hanya boleh punya satu SPA
      if (err?.code === '23505') setModal({ isOpen: true, type: 'error', title: 'Peringatan Duplikasi!', message: `BASTK ${data.no_bastk} sudah punya data SPA. Tidak boleh ada data ganda!` });
      else setModal({ isOpen: true, type: 'error', title: 'Kesalahan Sistem', message: 'Terjadi kegagalan saat menghubungi server database.' });
    }
    setIsSubmitting(false);
  };

  const renderModal = () => {
    if (!modal.isOpen) return null;
    return createPortal(
      <div className="ui-overlay">
        <div className="absolute inset-0" onClick={tutupModal}></div>
        <div className="ui-modal">
          <div className="flex flex-col items-center text-center">
            {modal.type === 'success' ? (
              <div className="ui-modal-icon-success"><CheckCircle2 className="w-6 h-6" /></div>
            ) : (
              <div className="ui-modal-icon-danger"><AlertCircle className="w-6 h-6" /></div>
            )}
            <h3 className="ui-modal-title">{modal.title}</h3>
            <p className="ui-modal-text">{modal.message}</p>
            <div className="flex w-full gap-3 justify-center">
              {modal.type === 'success' ? (
                <><button onClick={tutupModal} className="ui-btn-secondary flex-1">Tutup</button><button onClick={() => { tutupModal(); navigate('/penjualan/data-spa'); }} className="ui-btn-primary flex-1"><FolderOpen className="w-4 h-4" /> Lihat Data SPA</button></>
              ) : (
                <button onClick={tutupModal} className="ui-btn-primary w-full">Mengerti</button>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const keteranganTerpilih = KETERANGAN.find((k) => k.value === form.keterangan);

  return (
    <>
      {renderModal()}
      {isSubmitting && createPortal(
        <div className="ui-overlay z-[99998]">
          <div className="ui-modal max-w-sm flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center mb-4">
              <SquarePen className="w-6 h-6 text-brand-fg animate-pulse" />
            </div>
            <h3 className="ui-modal-title">Memproses SPA...</h3>
            <p className="text-sm text-stone-600 text-center">Menyimpan data penjualan ke database.</p>
          </div>
        </div>, document.body
      )}

      <div className="max-w-5xl mx-auto pb-12 space-y-6 relative">
        <div className="ui-card overflow-hidden">
          <div className="p-5 md:p-7">
            <div className="mb-7 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div>
                <h2 className="ui-page-title"><SquarePen className="w-6 h-6 text-stone-500" /> {isEditing ? 'Mode Edit Data SPA' : 'Form Data Penjualan Dealer'}</h2>
                <p className="ui-page-subtitle">Input data secara lengkap dan akurat sesuai SOP.</p>
              </div>
              {isEditing && (
                <span className="ui-badge-warning w-fit px-2 py-1">
                  <Edit className="w-3.5 h-3.5" /> Sedang Mengedit
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <section>
                <h3 className="ui-section-title"><span className="ui-step">1</span>Informasi BASTK</h3>
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <button type="button" onClick={ambilDariBastk} disabled={mencariBastk} className={`ui-btn-sm ${mencariBastk ? 'opacity-60 pointer-events-none' : ''}`}>
                    {mencariBastk ? <><RefreshCw className="w-4 h-4 animate-spin" /> Mencari BASTK...</> : <><FileSearch className="w-4 h-4" /> Ambil dari BASTK</>}
                  </button>
                  <p className="text-xs text-stone-500">Pilih kategori dan isi No BASTK, lalu tekan <b>Ambil dari BASTK</b> (atau Enter). Pemohon, leasing, tanggal &amp; data motor terisi otomatis.</p>
                </div>
                {infoBastk && (
                  <div className="mb-4">
                    {infoBastk.jenis === 'sukses'
                      ? <div className="ui-alert-neutral"><CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-700" /> {infoBastk.pesan}</div>
                      : <div className="ui-alert-danger"><AlertCircle className="w-4 h-4 flex-shrink-0" /> {infoBastk.pesan}</div>}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-4">
                  <div><label className="ui-label">Kategori</label><PilihanDropdown value={form.kategori} onChange={(v) => setForm((f) => ({ ...f, kategori: v, bastkId: null }))} options={OPSI_KATEGORI} placeholder="Pilih Kategori..." /></div>
                  <div>
                    <label className="ui-label">No BASTK</label>
                    <input type="text" value={form.noBastk} onChange={(e) => setForm((f) => ({ ...f, noBastk: e.target.value, bastkId: null }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ambilDariBastk(); } }} required placeholder="Contoh: 6975" className="ui-input" />
                  </div>
                  <div><label className="ui-label">Tanggal BASTK</label><input type="date" value={form.tanggalBastk} onChange={ubah('tanggalBastk')} required className="ui-input" /></div>
                  <div><label className="ui-label">Leasing</label><PilihanDropdown value={form.leasing} onChange={(v) => setForm((f) => ({ ...f, leasing: v }))} options={OPSI_PEMBIAYAAN} placeholder="Pilih Leasing..." /></div>
                </div>
              </section>

              <section>
                <h3 className="ui-section-title"><span className="ui-step">2</span>Data Pemohon dan STNK</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
                  <div><label className="ui-label">Pemohon *</label><input type="text" value={form.pemohon} onChange={ubah('pemohon')} required placeholder="Nama pemohon" className="ui-input" /></div>
                  <div><label className="ui-label">Nama STNK</label><input type="text" value={form.namaStnk} onChange={ubah('namaStnk')} placeholder="Otomatis dari pemohon" className="ui-input" /></div>
                  <div><label className="ui-label">No HP 1</label><input type="tel" value={form.noHp1} onChange={ubah('noHp1')} placeholder="08xxxxxxxxxx" className="ui-input" /></div>
                  <div><label className="ui-label">No HP 2 (Opsional)</label><input type="tel" value={form.noHp2} onChange={ubah('noHp2')} placeholder="Opsional" className="ui-input" /></div>
                  <div className="md:col-span-2"><label className="ui-label">Pekerjaan Nama STNK</label><input type="text" value={form.pekerjaan} onChange={ubah('pekerjaan')} placeholder="Ketik manual pekerjaan..." className="ui-input" /></div>
                </div>
              </section>

              <section>
                <h3 className="ui-section-title"><span className="ui-step">3</span>Alamat Sesuai Excel</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  <div><label className="ui-label">Desa / Kelurahan</label><input type="text" value={form.desa} onChange={ubah('desa')} placeholder="Nama desa atau kelurahan" className="ui-input" /></div>
                  <div><label className="ui-label">Kecamatan</label><input type="text" value={form.kecamatan} onChange={ubah('kecamatan')} placeholder="Nama kecamatan" className="ui-input" /></div>
                </div>
              </section>

              <section>
                <h3 className="ui-section-title"><span className="ui-step">4</span>Data Unit Motor</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
                  <div><label className="ui-label">Jenis Motor</label><input type="text" value={form.jenisMotor} onChange={ubah('jenisMotor')} placeholder="Contoh: Scoopy" className="ui-input" /></div>
                  <div><label className="ui-label">No Rangka</label><input type="text" value={form.noRangka} onChange={ubah('noRangka')} placeholder="Nomor rangka" className="ui-input" /></div>
                  <div><label className="ui-label">No Mesin</label><input type="text" value={form.noMesin} onChange={ubah('noMesin')} placeholder="Nomor mesin" className="ui-input" /></div>
                  <div><label className="ui-label">Type</label><input type="text" value={form.typeMotor} onChange={ubah('typeMotor')} placeholder="Type motor" className="ui-input" /></div>
                  <div><label className="ui-label">Warna</label><input type="text" value={form.warna} onChange={ubah('warna')} placeholder="Warna motor" className="ui-input" /></div>
                  <div><label className="ui-label">Unit</label><input type="text" inputMode="numeric" value={form.unit} onChange={ubahAngka('unit')} placeholder="1" className="ui-input-number" /></div>
                </div>
              </section>

              <section>
                <h3 className="ui-section-title"><span className="ui-step">5</span>Pembayaran</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
                  <div><label className="ui-label">OTR (Rp)</label><input type="text" inputMode="numeric" value={form.otr === 0 ? '' : formatRupiah(form.otr)} onChange={ubahAngka('otr')} placeholder="0" className="ui-input-number" /></div>
                  <div><label className="ui-label">DP Stor (Rp)</label><input type="text" inputMode="numeric" value={form.dpStor === 0 ? '' : formatRupiah(form.dpStor)} onChange={ubahAngka('dpStor')} placeholder="0" className="ui-input-emphasis" /></div>
                  <div><label className="ui-label">DP Gross (Rp)</label><input type="text" inputMode="numeric" value={form.dpGross === 0 ? '' : formatRupiah(form.dpGross)} onChange={ubahAngka('dpGross')} placeholder="0" className="ui-input-number" /></div>
                  <div><label className="ui-label">Jangka Waktu (Bulan)</label><input type="text" inputMode="numeric" value={form.tenor === 0 ? '' : form.tenor} onChange={ubahAngka('tenor')} placeholder="Contoh: 35" className="ui-input-number" /></div>
                  <div><label className="ui-label">Angsuran (Rp)</label><input type="text" inputMode="numeric" value={form.angsuran === 0 ? '' : formatRupiah(form.angsuran)} onChange={ubahAngka('angsuran')} placeholder="0" className="ui-input-number" /></div>
                  <div><label className="ui-label">Subsidi (Rp)</label><input type="text" inputMode="numeric" value={form.subsidi === 0 ? '' : formatRupiah(form.subsidi)} onChange={ubahAngka('subsidi')} placeholder="0" className="ui-input-number" /></div>
                </div>
              </section>

              <section>
                <h3 className="ui-section-title"><span className="ui-step">6</span>Sales dan Keterangan</h3>
                <div className="space-y-4">
                  <div><label className="ui-label">Nama Sales</label><input type="text" value={form.namaSales} onChange={ubah('namaSales')} placeholder="Ketik nama sales..." className="ui-input" /></div>
                  <div>
                    <label className="ui-label">Keterangan Administrasi</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                      {KETERANGAN.map((k) => (
                        <button key={k.value} type="button" onClick={() => setForm((f) => ({ ...f, keterangan: k.value }))} className={form.keterangan === k.value ? 'ui-choice-active' : 'ui-choice'}>{k.label}</button>
                      ))}
                    </div>
                    {keteranganTerpilih && <p className="mt-2 text-xs text-stone-500">{keteranganTerpilih.penjelas}</p>}
                  </div>
                </div>
              </section>

              <div className="pt-6 border-t border-stone-200 flex flex-col sm:flex-row justify-end items-center gap-3">
                {isEditing ? (
                  <button type="button" disabled={isSubmitting} onClick={() => navigate('/penjualan/data-spa')} className="ui-btn-secondary w-full sm:w-auto">
                    <X className="w-4 h-4" /> Batal Edit
                  </button>
                ) : (
                  <button type="button" disabled={isSubmitting} onClick={resetForm} className="ui-btn-secondary w-full sm:w-auto">
                    <RotateCcw className="w-4 h-4" /> Reset Form
                  </button>
                )}
                <button type="submit" disabled={isSubmitting} className="ui-btn-primary w-full sm:w-auto px-8">
                  {isSubmitting ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Memproses...</>
                  ) : isEditing ? (
                    <><Edit className="w-4 h-4" /> Update Data SPA</>
                  ) : (
                    <><Save className="w-4 h-4" /> Simpan Data Baru</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
