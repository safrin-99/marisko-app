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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white rounded-4xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="flex flex-col items-center text-center mt-2">
              {modal.type === 'success' ? (
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 text-emerald-600 shadow-inner"><CheckCircle2 className="w-10 h-10" /></div>
              ) : (
                <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 text-rose-600 shadow-inner"><AlertCircle className="w-10 h-10" /></div>
              )}
              <h3 className="text-2xl font-extrabold text-slate-900 mb-2">{modal.title}</h3>
              <p className="text-slate-500 font-medium mb-8">{modal.message}</p>
              <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '' })} className="w-full py-3.5 bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all">
                Mengerti
              </button>
            </div>
          </div>
        </div>, document.body
      )}
      
      <div className="max-w-5xl mx-auto pb-12 space-y-8 animate-in fade-in duration-300">
        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 rounded-3xl p-8 text-white shadow-xl flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-black mb-2 flex items-center"><Settings className="w-8 h-8 mr-3 opacity-80" /> Pengaturan Sistem</h2>
            <p className="text-indigo-200 font-medium max-w-lg">Kelola Logo Dealer dan Tanda Tangan Kepala Cabang untuk dokumen cetak PDF.</p>
          </div>
          <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4"><Settings className="w-64 h-64" /></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* PANEL LOGO */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-8">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center"><ImageIcon className="w-5 h-5 mr-2 text-indigo-600" /> Logo Perusahaan</h3>
                  <p className="text-sm text-slate-500 mt-1">Logo ini akan muncul di pojok kiri atas semua Kwitansi & BASTK.</p>
                </div>
                <div className="flex flex-col items-center space-y-6">
                  <div className="w-full aspect-square max-h-[220px] bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center p-4 relative overflow-hidden transition-all hover:border-indigo-400 group">
                    {isLoading ? <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" /> : logoUrl ? <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" /> : <><ImageIcon className="w-12 h-12 text-slate-300 mb-3 group-hover:text-indigo-400 transition-colors" /><span className="text-xs font-bold text-slate-400 text-center">Belum ada logo terpasang</span></>}
                  </div>
                  {logoUrl && <button onClick={() => handleDelete('logo')} disabled={isUploadingLogo} className="flex items-center text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors px-4 py-2 rounded-lg hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5 mr-1.5" /> Hapus Logo</button>}
                  <div className="w-full relative group">
                    <input type="file" accept="image/png, image/jpeg" onChange={(e) => handleFileUpload(e, 'logo')} disabled={isUploadingLogo} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                    <div className={`w-full py-3.5 px-4 rounded-xl border-2 flex items-center justify-center font-bold text-sm transition-all ${isUploadingLogo ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-white border-indigo-600 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white shadow-sm'}`}>
                      {isUploadingLogo ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Mengunggah...</> : <><UploadCloud className="w-4 h-4 mr-2" /> Upload Logo Baru</>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PANEL TTD KACAB */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-8">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center"><PenTool className="w-5 h-5 mr-2 text-emerald-600" /> TTD Kepala Cabang</h3>
                  <p className="text-sm text-slate-500 mt-1">Gunakan format <b>PNG (Transparan)</b> untuk tanda tangan di dokumen BASTK.</p>
                </div>
                <div className="flex flex-col items-center space-y-6">
                  <div className="w-full aspect-square max-h-[220px] bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center p-4 relative overflow-hidden transition-all hover:border-emerald-400 group">
                    {isLoading ? <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" /> : ttdUrl ? <img src={ttdUrl} alt="TTD Kacab" className="max-w-full max-h-full object-contain" /> : <><PenTool className="w-12 h-12 text-slate-300 mb-3 group-hover:text-emerald-400 transition-colors" /><span className="text-xs font-bold text-slate-400 text-center">Belum ada TTD terpasang</span></>}
                  </div>
                  {ttdUrl && <button onClick={() => handleDelete('ttd')} disabled={isUploadingTtd} className="flex items-center text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors px-4 py-2 rounded-lg hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5 mr-1.5" /> Hapus TTD</button>}
                  <div className="w-full relative group">
                    <input type="file" accept="image/png, image/jpeg" onChange={(e) => handleFileUpload(e, 'ttd')} disabled={isUploadingTtd} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                    <div className={`w-full py-3.5 px-4 rounded-xl border-2 flex items-center justify-center font-bold text-sm transition-all ${isUploadingTtd ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-white border-emerald-600 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white shadow-sm'}`}>
                      {isUploadingTtd ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Mengunggah...</> : <><UploadCloud className="w-4 h-4 mr-2" /> Upload TTD Baru</>}
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