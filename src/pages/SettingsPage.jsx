import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, UploadCloud, Image as ImageIcon, CheckCircle2, AlertCircle, Trash2, RefreshCw, PenTool } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getLogosSignedUrl } from '../lib/storage';
import AkunPanel from '../components/AkunPanel';

// Gambar ditanam utuh ke setiap PDF, jadi file besar membuat PDF berat & lambat dibuat
const MAX_FILE_SIZE_MB = 2;

export default function SettingsPage() {
  const [logoUrl, setLogoUrl] = useState('');
  const [ttdUrl, setTtdUrl] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingTtd, setIsUploadingTtd] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, type: '', title: '', message: '', actionData: null });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('dealer_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (data) {
        // Bucket privat: pratinjau memakai URL bertanda tangan, data di database tetap URL aslinya
        if (data.logo_url) setLogoUrl((await getLogosSignedUrl(data.logo_url)) || data.logo_url);
        if (data.ttd_kacab_url) setTtdUrl((await getLogosSignedUrl(data.ttd_kacab_url)) || data.ttd_kacab_url);
      }
    } catch (err) {
      console.error("Belum ada data pengaturan.");
    }
    setIsLoading(false);
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    // SAKTI: Kosongkan input agar file yang sama bisa dipilih ulang
    e.target.value = '';
    if (!file) return;

    if (!file.type.includes('image')) {
      setModal({ isOpen: true, type: 'error', title: 'Format Salah', message: 'Mohon upload file gambar (JPG/PNG).' });
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setModal({ isOpen: true, type: 'error', title: 'File Terlalu Besar', message: `Ukuran gambar maksimal ${MAX_FILE_SIZE_MB} MB. Perkecil gambar lalu coba lagi.` });
      return;
    }

    if (type === 'logo') setIsUploadingLogo(true);
    else setIsUploadingTtd(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}_dealer_${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(filePath);
      const publicUrl = publicUrlData.publicUrl;

      // SAKTI: Ambil data lama dulu agar tidak saling timpa!
      const { data: existingData } = await supabase.from('dealer_settings').select('*').eq('id', 1).single();

      const updateData = type === 'logo'
        ? { ...existingData, logo_url: publicUrl, updated_at: new Date() }
        : { ...existingData, ttd_kacab_url: publicUrl, updated_at: new Date() };

      const { error: updateError } = await supabase.from('dealer_settings').upsert({ id: 1, ...updateData });
      if (updateError) throw updateError;

      const previewUrl = (await getLogosSignedUrl(publicUrl)) || publicUrl;
      if (type === 'logo') {
        setLogoUrl(previewUrl);
        setModal({ isOpen: true, type: 'success', title: 'Logo Tersimpan!', message: 'Logo Dealer berhasil diunggah.' });
      } else {
        setTtdUrl(previewUrl);
        setModal({ isOpen: true, type: 'success', title: 'TTD Tersimpan!', message: 'Tanda Tangan Kepala Cabang berhasil diunggah.' });
      }
    } catch (error) {
      const message = navigator.onLine
        ? 'Pastikan Bucket Storage "logos" sudah dibuat Public di Supabase.'
        : 'Tidak ada koneksi internet. Periksa koneksi lalu coba lagi.';
      setModal({ isOpen: true, type: 'error', title: 'Gagal Upload', message });
    }

    if (type === 'logo') setIsUploadingLogo(false);
    else setIsUploadingTtd(false);
  };

  // SAKTI: Minta konfirmasi dulu, karena logo & TTD langsung dipakai di dokumen cetak
  const handleDeleteRequest = (type) => {
    setModal({
      isOpen: true,
      type: 'confirm_delete',
      title: type === 'logo' ? 'Hapus Logo?' : 'Hapus TTD Kepala Cabang?',
      message: type === 'logo'
        ? 'Logo tidak akan tampil lagi di Kwitansi dan Nota yang dicetak setelah ini.'
        : 'Tanda tangan tidak akan tampil lagi di BASTK dan Cuti & Izin yang dicetak setelah ini.',
      actionData: type
    });
  };

  const handleDelete = async (type) => {
    setModal({ isOpen: false, type: '', title: '', message: '', actionData: null });
    if (type === 'logo') setIsUploadingLogo(true);
    else setIsUploadingTtd(true);

    try {
      const { data: existingData } = await supabase.from('dealer_settings').select('*').eq('id', 1).single();

      const updateData = type === 'logo'
        ? { ...existingData, logo_url: '', updated_at: new Date() }
        : { ...existingData, ttd_kacab_url: '', updated_at: new Date() };

      const { error: updateError } = await supabase.from('dealer_settings').upsert({ id: 1, ...updateData });
      if (updateError) throw updateError;

      if (type === 'logo') {
        setLogoUrl('');
        setModal({ isOpen: true, type: 'success', title: 'Logo Dihapus', message: 'Logo Dealer telah dihapus.' });
      } else {
        setTtdUrl('');
        setModal({ isOpen: true, type: 'success', title: 'TTD Dihapus', message: 'Tanda Tangan Kacab telah dihapus.' });
      }
    } catch (error) {
      setModal({ isOpen: true, type: 'error', title: 'Gagal', message: `Terjadi kesalahan saat menghapus ${type === 'logo' ? 'logo' : 'TTD'}. Coba lagi atau periksa koneksi internet.` });
    }

    if (type === 'logo') setIsUploadingLogo(false);
    else setIsUploadingTtd(false);
  };

  const closeModal = () => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null });

  return (
    <>
      {modal.isOpen && createPortal(
        <div className="ui-overlay">
          <div className="ui-modal">
            <div className="flex flex-col items-center text-center">
              {modal.type === 'success' ? (
                <div className="ui-modal-icon-success"><CheckCircle2 className="w-6 h-6" /></div>
              ) : (
                <div className="ui-modal-icon-danger"><AlertCircle className="w-6 h-6" /></div>
              )}
              <h3 className="ui-modal-title">{modal.title}</h3>
              <p className="ui-modal-text">{modal.message}</p>
              {modal.type === 'confirm_delete' ? (
                <div className="flex w-full gap-3">
                  <button onClick={closeModal} className="ui-btn-secondary flex-1">Batal</button>
                  <button onClick={() => handleDelete(modal.actionData)} className="ui-btn-danger flex-1">Ya, Hapus!</button>
                </div>
              ) : (
                <button onClick={closeModal} className="ui-btn-primary w-full">
                  Mengerti
                </button>
              )}
            </div>
          </div>
        </div>, document.body
      )}

      <div className="max-w-5xl mx-auto pb-12 space-y-6">
        <div>
          <h2 className="ui-page-title"><Settings className="w-6 h-6 text-stone-500" /> Pengaturan Sistem</h2>
          <p className="ui-page-subtitle max-w-2xl">Kelola Logo Dealer dan Tanda Tangan Kepala Cabang untuk dokumen cetak PDF.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PANEL LOGO */}
            <div className="ui-card overflow-hidden p-6 grid grid-rows-subgrid row-span-4 gap-y-0">
              <div className="mb-5">
                <h3 className="ui-card-title"><ImageIcon className="w-4 h-4 text-stone-500" /> Logo Perusahaan</h3>
                <p className="text-sm text-stone-600 mt-1">Logo ini muncul di pojok kiri atas Kwitansi Kredit, Kwitansi Cash, Kwitansi Indent, dan Nota.</p>
              </div>
              <div className={`w-full h-56 border rounded-lg flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors group ${logoUrl && !isLoading ? 'ui-checker border-stone-200' : 'bg-stone-50 border-dashed border-stone-300 hover:border-stone-500'}`}>
                {isLoading ? <RefreshCw className="w-6 h-6 text-stone-400 animate-spin" /> : logoUrl ? <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" /> : <><ImageIcon className="w-10 h-10 text-stone-300 mb-3 group-hover:text-stone-500 transition-colors" /><span className="text-xs text-stone-500 text-center">Belum ada logo terpasang</span></>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <div className="flex-[3_1_12rem] relative group">
                  <input type="file" accept="image/png, image/jpeg" onChange={(e) => handleFileUpload(e, 'logo')} disabled={isUploadingLogo} aria-label="Upload Logo Baru" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                  <div className={`w-full h-11 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold whitespace-nowrap transition-colors group-focus-within:ring-3 group-focus-within:ring-brand/20 ${isUploadingLogo ? 'bg-stone-100 text-stone-500' : 'bg-brand text-brand-fg group-hover:bg-brand-hover'}`}>
                    {isUploadingLogo ? <><RefreshCw className="w-4 h-4 animate-spin" /> Mengunggah...</> : <><UploadCloud className="w-4 h-4" /> Upload Logo Baru</>}
                  </div>
                </div>
                {logoUrl && <button onClick={() => handleDeleteRequest('logo')} disabled={isUploadingLogo} className="ui-btn-secondary flex-[1_0_auto] px-4 text-red-700 hover:text-red-800 hover:bg-red-50 hover:border-red-200"><Trash2 className="w-4 h-4" /> Hapus Logo</button>}
              </div>
              <p className="mt-2 text-xs text-stone-500">PNG atau JPG, maks. {MAX_FILE_SIZE_MB} MB. Sebaiknya persegi (1:1) karena dicetak 17 × 17 mm.</p>
            </div>

            {/* PANEL TTD KACAB */}
            <div className="ui-card overflow-hidden p-6 grid grid-rows-subgrid row-span-4 gap-y-0">
              <div className="mb-5">
                <h3 className="ui-card-title"><PenTool className="w-4 h-4 text-stone-500" /> TTD Kepala Cabang</h3>
                <p className="text-sm text-stone-600 mt-1">Tanda tangan ini otomatis dicetak di dokumen BASTK dan Cuti & Izin. Gunakan format <b className="font-semibold text-stone-900">PNG (Transparan)</b>.</p>
              </div>
              <div className={`w-full h-56 border rounded-lg flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors group ${ttdUrl && !isLoading ? 'ui-checker border-stone-200' : 'bg-stone-50 border-dashed border-stone-300 hover:border-stone-500'}`}>
                {isLoading ? <RefreshCw className="w-6 h-6 text-stone-400 animate-spin" /> : ttdUrl ? <img src={ttdUrl} alt="TTD Kacab" className="max-w-full max-h-full object-contain" /> : <><PenTool className="w-10 h-10 text-stone-300 mb-3 group-hover:text-stone-500 transition-colors" /><span className="text-xs text-stone-500 text-center">Belum ada TTD terpasang</span></>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <div className="flex-[3_1_12rem] relative group">
                  <input type="file" accept="image/png, image/jpeg" onChange={(e) => handleFileUpload(e, 'ttd')} disabled={isUploadingTtd} aria-label="Upload TTD Baru" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                  <div className={`w-full h-11 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold whitespace-nowrap transition-colors group-focus-within:ring-3 group-focus-within:ring-brand/20 ${isUploadingTtd ? 'bg-stone-100 text-stone-500' : 'bg-brand text-brand-fg group-hover:bg-brand-hover'}`}>
                    {isUploadingTtd ? <><RefreshCw className="w-4 h-4 animate-spin" /> Mengunggah...</> : <><UploadCloud className="w-4 h-4" /> Upload TTD Baru</>}
                  </div>
                </div>
                {ttdUrl && <button onClick={() => handleDeleteRequest('ttd')} disabled={isUploadingTtd} className="ui-btn-secondary flex-[1_0_auto] px-4 text-red-700 hover:text-red-800 hover:bg-red-50 hover:border-red-200"><Trash2 className="w-4 h-4" /> Hapus TTD</button>}
              </div>
              <p className="mt-2 text-xs text-stone-500">PNG transparan, maks. {MAX_FILE_SIZE_MB} MB. Sebaiknya melebar (± 2:1) agar tidak gepeng di dokumen.</p>
            </div>
        </div>

        {/* SAKTI: Pengaturan akun (role & kata sandi) — halaman ini hanya bisa dibuka ADMIN */}
        <AkunPanel />
      </div>
    </>
  );
}
