import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, UploadCloud, Image as ImageIcon, CheckCircle2, AlertCircle, Trash2, RefreshCw, PenTool } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function SettingsPage() {
  const [logoUrl, setLogoUrl] = useState('');
  const [ttdUrl, setTtdUrl] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingTtd, setIsUploadingTtd] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, type: '', title: '', message: '' });

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
        if (data.logo_url) setLogoUrl(data.logo_url);
        if (data.ttd_kacab_url) setTtdUrl(data.ttd_kacab_url);
      }
    } catch (err) {
      console.error("Belum ada data pengaturan.");
    }
    setIsLoading(false);
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.includes('image')) {
      setModal({ isOpen: true, type: 'error', title: 'Format Salah', message: 'Mohon upload file gambar (JPG/PNG).' });
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

      if (type === 'logo') {
        setLogoUrl(publicUrl);
        setModal({ isOpen: true, type: 'success', title: 'Logo Tersimpan!', message: 'Logo Dealer berhasil diunggah.' });
      } else {
        setTtdUrl(publicUrl);
        setModal({ isOpen: true, type: 'success', title: 'TTD Tersimpan!', message: 'Tanda Tangan Kepala Cabang berhasil diunggah.' });
      }
    } catch (error) {
      setModal({ isOpen: true, type: 'error', title: 'Gagal Upload', message: 'Pastikan Bucket Storage "logos" sudah dibuat Public di Supabase.' });
    }

    if (type === 'logo') setIsUploadingLogo(false);
    else setIsUploadingTtd(false);
  };

  const handleDelete = async (type) => {
    if (type === 'logo') setIsUploadingLogo(true);
    else setIsUploadingTtd(true);

    try {
      const { data: existingData } = await supabase.from('dealer_settings').select('*').eq('id', 1).single();
      
      const updateData = type === 'logo' 
        ? { ...existingData, logo_url: '', updated_at: new Date() }
        : { ...existingData, ttd_kacab_url: '', updated_at: new Date() };

      await supabase.from('dealer_settings').upsert({ id: 1, ...updateData });
      
      if (type === 'logo') {
        setLogoUrl('');
        setModal({ isOpen: true, type: 'success', title: 'Logo Dihapus', message: 'Logo Dealer telah dihapus.' });
      } else {
        setTtdUrl('');
        setModal({ isOpen: true, type: 'success', title: 'TTD Dihapus', message: 'Tanda Tangan Kacab telah dihapus.' });
      }
    } catch (error) {
      setModal({ isOpen: true, type: 'error', title: 'Gagal', message: `Terjadi kesalahan saat menghapus ${type}.` });
    }

    if (type === 'logo') setIsUploadingLogo(false);
    else setIsUploadingTtd(false);
  };

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
              <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '' })} className="ui-btn-primary w-full">
                Mengerti
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      <div className="max-w-5xl mx-auto pb-12 space-y-6">
        <div>
          <h2 className="ui-page-title"><Settings className="w-6 h-6 text-stone-500" /> Pengaturan Sistem</h2>
          <p className="ui-page-subtitle max-w-lg">Kelola Logo Dealer dan Tanda Tangan Kepala Cabang untuk dokumen cetak PDF.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PANEL LOGO */}
            <div className="ui-card overflow-hidden">
              <div className="p-6">
                <div className="mb-5">
                  <h3 className="ui-card-title"><ImageIcon className="w-4 h-4 text-stone-500" /> Logo Perusahaan</h3>
                  <p className="text-sm text-stone-600 mt-1">Logo ini akan muncul di pojok kiri atas semua Kwitansi & BASTK.</p>
                </div>
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-full aspect-square max-h-[220px] bg-stone-50 border border-dashed border-stone-300 rounded-lg flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors hover:border-stone-500 group">
                    {isLoading ? <RefreshCw className="w-6 h-6 text-stone-400 animate-spin" /> : logoUrl ? <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" /> : <><ImageIcon className="w-10 h-10 text-stone-300 mb-3 group-hover:text-stone-500 transition-colors" /><span className="text-xs text-stone-500 text-center">Belum ada logo terpasang</span></>}
                  </div>
                  {logoUrl && <button onClick={() => handleDelete('logo')} disabled={isUploadingLogo} className="ui-action-danger"><Trash2 className="w-3.5 h-3.5" /> Hapus Logo</button>}
                  <div className="w-full relative group">
                    <input type="file" accept="image/png, image/jpeg" onChange={(e) => handleFileUpload(e, 'logo')} disabled={isUploadingLogo} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                    <div className={`w-full h-11 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${isUploadingLogo ? 'bg-stone-100 text-stone-500' : 'bg-brand text-brand-fg group-hover:bg-brand-hover'}`}>
                      {isUploadingLogo ? <><RefreshCw className="w-4 h-4 animate-spin" /> Mengunggah...</> : <><UploadCloud className="w-4 h-4" /> Upload Logo Baru</>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PANEL TTD KACAB */}
            <div className="ui-card overflow-hidden">
              <div className="p-6">
                <div className="mb-5">
                  <h3 className="ui-card-title"><PenTool className="w-4 h-4 text-stone-500" /> TTD Kepala Cabang</h3>
                  <p className="text-sm text-stone-600 mt-1">Gunakan format <b className="font-semibold text-stone-900">PNG (Transparan)</b> untuk tanda tangan di dokumen BASTK.</p>
                </div>
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-full aspect-square max-h-[220px] bg-stone-50 border border-dashed border-stone-300 rounded-lg flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors hover:border-stone-500 group">
                    {isLoading ? <RefreshCw className="w-6 h-6 text-stone-400 animate-spin" /> : ttdUrl ? <img src={ttdUrl} alt="TTD Kacab" className="max-w-full max-h-full object-contain" /> : <><PenTool className="w-10 h-10 text-stone-300 mb-3 group-hover:text-stone-500 transition-colors" /><span className="text-xs text-stone-500 text-center">Belum ada TTD terpasang</span></>}
                  </div>
                  {ttdUrl && <button onClick={() => handleDelete('ttd')} disabled={isUploadingTtd} className="ui-action-danger"><Trash2 className="w-3.5 h-3.5" /> Hapus TTD</button>}
                  <div className="w-full relative group">
                    <input type="file" accept="image/png, image/jpeg" onChange={(e) => handleFileUpload(e, 'ttd')} disabled={isUploadingTtd} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                    <div className={`w-full h-11 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${isUploadingTtd ? 'bg-stone-100 text-stone-500' : 'bg-brand text-brand-fg group-hover:bg-brand-hover'}`}>
                      {isUploadingTtd ? <><RefreshCw className="w-4 h-4 animate-spin" /> Mengunggah...</> : <><UploadCloud className="w-4 h-4" /> Upload TTD Baru</>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>
    </>
  );
}
