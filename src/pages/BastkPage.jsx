import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Edit, Trash2, RefreshCw, Clock, ChevronDown, X, CheckCircle2, AlertCircle, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { jsPDF } from "jspdf";

export default function BastkPage() {
  const [kategori, setKategori] = useState('BASTK INDUK');
  const [historyData, setHistoryData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [ttdBase64, setTtdBase64] = useState('');

  const [modal, setModal] = useState({ isOpen: false, type: '', title: '', message: '', actionData: null });
  const [isEditing, setIsEditing] = useState(false);
  const [originalNoSurat, setOriginalNoSurat] = useState('');
  
  const [noSurat, setNoSurat] = useState('');
  const [tglSerah, setTglSerah] = useState('');
  const [jenisPembiayaan, setJenisPembiayaan] = useState('');
  const [namaKonsumen, setNamaKonsumen] = useState('');
  const [noKtp, setNoKtp] = useState('');
  const [alamat, setAlamat] = useState('');
  const [tipeKendaraan, setTipeKendaraan] = useState('');
  const [tahunCc, setTahunCc] = useState('');
  const [noRangka, setNoRangka] = useState('');
  const [noMesin, setNoMesin] = useState('');
  const [warna, setWarna] = useState('');
  const [hadiah, setHadiah] = useState('');

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const opsiPembiayaan = [
    { value: 'CASH', label: 'CASH (MARISKO PERKASA)' },
    { value: 'ADIRA', label: 'PT. ADIRA MULTI FINANCE' },
    { value: 'FIF', label: 'PT. FEDERAL INTERNATIONAL FINANCE' },
    { value: 'MANDALA', label: 'PT. ADIRA DAHULU MANDALA' }
  ];

  useEffect(() => {
    fetchSettingsImages();
    fetchHistory();
  }, [kategori]);

  const fetchSettingsImages = async () => {
    try {
      const { data } = await supabase.from('dealer_settings').select('*').eq('id', 1).single();
      if (data?.ttd_kacab_url) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          setTtdBase64(canvas.toDataURL('image/png')); 
        };
        img.src = `${data.ttd_kacab_url}?t=${new Date().getTime()}`;
      }
    } catch (err) { console.error("Gagal menarik TTD:", err); }
  };

  const fetchHistory = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('bastk_history')
      .select('*')
      .eq('kategori', kategori)
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data) setHistoryData(data);
    setIsLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!noSurat || !tglSerah || !namaKonsumen || !jenisPembiayaan) {
      setModal({ isOpen: true, type: 'error', title: 'Data Belum Lengkap!', message: 'Mohon isi semua kolom yang diwajibkan sebelum menyimpan.' });
      return;
    }

    setIsSubmitting(true);
    const cleanNoSurat = noSurat.trim();

    const formData = {
      kategori, noSurat: cleanNoSurat, tglSerah, jenisPembiayaan,
      namaKonsumen: namaKonsumen.toUpperCase(), noKtp,
      alamat: alamat.toUpperCase(), tipeKendaraan, tahunCc,
      noRangka: noRangka.toUpperCase(), noMesin: noMesin.toUpperCase(),
      warna: warna.toUpperCase(), hadiah: hadiah || '-'
    };

    try {
      if (isEditing) {
        await supabase.from('bastk_history').update(formData).eq('noSurat', originalNoSurat);
        setModal({ isOpen: true, type: 'success', title: 'Berhasil Diupdate!', message: 'Data BASTK telah berhasil diperbarui.', actionData: formData });
        setIsEditing(false);
      } else {
        const { data: existing } = await supabase.from('bastk_history').select('noSurat').ilike('noSurat', cleanNoSurat);
        if (existing && existing.length > 0) {
          setIsSubmitting(false);
          setModal({ isOpen: true, type: 'error', title: 'Peringatan Duplikasi!', message: `Dokumen dengan Nomor BASTK "${cleanNoSurat}" sudah ada di database. Tidak boleh ada data ganda!` });
          return;
        }
        
        await supabase.from('bastk_history').insert([formData]);
        setModal({ isOpen: true, type: 'success', title: 'Berhasil Disimpan!', message: 'Dokumen BASTK berhasil dibuat dan siap untuk dicetak.', actionData: formData });
      }
      resetForm();
      fetchHistory();
    } catch (err) {
      setModal({ isOpen: true, type: 'error', title: 'Kesalahan Sistem', message: 'Terjadi kegagalan saat menghubungi server database.' });
    }
    setIsSubmitting(false);
  };

  const handleEdit = (data) => {
    setIsEditing(true);
    setOriginalNoSurat(data.noSurat);
    setNoSurat(data.noSurat); setTglSerah(data.tglSerah); setJenisPembiayaan(data.jenisPembiayaan);
    setNamaKonsumen(data.namaKonsumen); setNoKtp(data.noKtp); setAlamat(data.alamat);
    setTipeKendaraan(data.tipeKendaraan); setTahunCc(data.tahunCc); setNoRangka(data.noRangka);
    setNoMesin(data.noMesin); setWarna(data.warna); setHadiah(data.hadiah);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRequest = (noSuratId) => {
    setModal({ isOpen: true, type: 'confirm_delete', title: 'Yakin Ingin Menghapus?', message: `Dokumen BASTK No: ${noSuratId} akan dihapus secara permanen dari sistem.`, actionData: noSuratId });
  };

  const executeDelete = async (noSuratId) => {
    setModal({ isOpen: false, type: '', title: '', message: '', actionData: null });
    await supabase.from('bastk_history').delete().eq('noSurat', noSuratId);
    fetchHistory();
    setModal({ isOpen: true, type: 'success_delete', title: 'Terhapus!', message: 'Data BASTK telah berhasil dihapus.', actionData: null });
  };

  const resetForm = () => {
    setNoSurat(''); setTglSerah(''); setJenisPembiayaan(''); setNamaKonsumen('');
    setNoKtp(''); setAlamat(''); setTipeKendaraan(''); setTahunCc('');
    setNoRangka(''); setNoMesin(''); setWarna(''); setHadiah('');
    setIsEditing(false); setOriginalNoSurat('');
  };

  const generateBastkPDF = (data) => {
    const doc = new jsPDF({ format: [215, 330], unit: 'mm' }); 
    let currentY = 20; 
    const dateParts = data.tglSerah.split('-');
    const tglFormatPDF = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    
    // JUDUL
    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    const title = "BERITA ACARA SERAH TERIMA KENDARAAN";
    doc.text(title, 107.5, currentY, { align: "center" });
    const titleWidth = doc.getTextWidth(title);
    doc.setLineWidth(0.4);
    doc.line(107.5 - (titleWidth / 2), currentY + 1, 107.5 + (titleWidth / 2), currentY + 1); 
    
    currentY += 10; 
    doc.setFontSize(11); 
    doc.setFont("helvetica", "bold"); 
    doc.setTextColor(0, 0, 0);
    
    const labelX = 76; 
    const colonX = 94;
    
    doc.text("Nomor", labelX, currentY); doc.text(`: ${data.noSurat}`, colonX, currentY);
    currentY += 6;
    doc.text("Tanggal", labelX, currentY); doc.text(`: ${tglFormatPDF}`, colonX, currentY);
    
    // ISI DOKUMEN
    currentY += 12; 
    doc.setFont("helvetica", "normal");
    doc.text("Yang bertanda tangan dibawah ini :", 20, currentY); currentY += 8;
    doc.text("Nama", 30, currentY); doc.text(": BACHTIAR LATIEF", 75, currentY); currentY += 6;
    doc.text("Jabatan", 30, currentY); doc.text(": KACAB", 75, currentY); currentY += 12; 
    
    doc.text("Menyatakan dengan ini :", 20, currentY); currentY += 8;
    doc.text("1.", 20, currentY); doc.text("Kendaraan bermotor dengan spesifikasi seperti tersebut dibawah ini :", 26, currentY); currentY += 8;
    doc.text("Jenis / Type", 30, currentY); doc.text(`: ${data.tipeKendaraan}`, 75, currentY); currentY += 6;
    doc.text("Tahun / CC", 30, currentY); doc.text(`: ${data.tahunCc}`, 75, currentY); currentY += 6;
    doc.text("Warna", 30, currentY); doc.text(`: ${data.warna}`, 75, currentY); currentY += 6;
    doc.text("No. Rangka", 30, currentY); doc.text(`: ${data.noRangka}`, 75, currentY); currentY += 6;
    doc.text("No. Mesin", 30, currentY); doc.text(`: ${data.noMesin}`, 75, currentY); currentY += 10; 
    
    doc.text("2.", 20, currentY); doc.text("Hadiah sebagai berikut:", 26, currentY); currentY += 7;
    doc.text("Jenis Hadiah", 30, currentY); doc.text(`: ${data.hadiah}`, 75, currentY); currentY += 10; 
    
    doc.text("3.", 20, currentY); doc.text("Telah kami serahkan dan telah diterima dengan baik oleh :", 26, currentY); currentY += 8;
    doc.text("Nama", 30, currentY); doc.text(`: ${data.namaKonsumen}`, 75, currentY); currentY += 6;
    doc.text("NO. KTP", 30, currentY); doc.text(`: ${data.noKtp}`, 75, currentY); currentY += 6;
    
    const splitAlamat = doc.splitTextToSize(`: ${data.alamat}`, 115);
    doc.text("Alamat Rumah", 30, currentY); doc.text(splitAlamat, 75, currentY);
    currentY += (splitAlamat.length * 5) + 3; 
    
    let tksP1 = ""; let tksP2 = "";
    if (data.jenisPembiayaan === "CASH") {
      tksP1 = "Penerima kendaraan adalah debitur CV. MARISKO PERKASA BUOL";
      tksP2 = "BPKB dari kendaraan bermotor tersebut pada butir 1 di atas, sedang dalam pengurusan kami, dan apabila telah selesai akan kami serahkan kepada CV. MARISKO PERKASA BUOL sesuai dengan surat pernyataan serah terima kendaraan.";
    } else {
      const namaFinance = opsiPembiayaan.find(o => o.value === data.jenisPembiayaan)?.label || data.jenisPembiayaan;
      tksP1 = `Penerima kendaraan adalah debitur / penerima kredit dari ${namaFinance} CAB. BUOL`;
      tksP2 = `BPKB dari kendaraan bermotor tersebut pada butir 1 di atas, sedang dalam pengurusan kami, dan apabila telah selesai akan kami serahkan kepada ${namaFinance} CAB. BUOL sesuai dengan surat pernyataan serah terima kendaraan.`;
    }

    doc.text("1.", 20, currentY); doc.text(tksP1, 28, currentY, { maxWidth: 165, align: "justify", lineHeightFactor: 1.5 });
    currentY += (doc.splitTextToSize(tksP1, 165).length * 6) + 3; 
    doc.text("2.", 20, currentY); doc.text(tksP2, 28, currentY, { maxWidth: 165, align: "justify", lineHeightFactor: 1.5 });
    currentY += (doc.splitTextToSize(tksP2, 165).length * 6) + 4; 

    const tksP3 = "Demikian surat ini dibuat dengan sebenar-benarnya dan segala akibat hukum yang timbul dari surat ini menjadi tanggung jawab kami.";
    doc.text(tksP3, 20, currentY, { maxWidth: 170, align: "justify", lineHeightFactor: 1.5 });
    currentY += (doc.splitTextToSize(tksP3, 170).length * 6) + 5; 
    
    // AREA TANDA TANGAN
    doc.text("Yang menerima kendaraan", 55, currentY, { align: "center" });
    doc.text("Yang menyerahkan kendaraan", 160, currentY, { align: "center" });
    
    currentY += 28; 
    
    if (ttdBase64) {
      try { 
        let imgFormat = 'PNG'; 
        if (ttdBase64.toLowerCase().includes('jpeg') || ttdBase64.toLowerCase().includes('jpg')) imgFormat = 'JPEG';
        doc.addImage(ttdBase64, imgFormat, 140, currentY - 26, 40, 20); 
      } catch (e) { console.error("Gagal Render TTD", e); }
    }
    
    doc.setFont("helvetica", "bold");
    doc.text(data.namaKonsumen, 55, currentY, { align: "center" }); doc.line(55 - (doc.getTextWidth(data.namaKonsumen)/2), currentY + 1, 55 + (doc.getTextWidth(data.namaKonsumen)/2), currentY + 1); 
    doc.text("BACHTIAR LATIEF", 160, currentY, { align: "center" }); doc.line(160 - (doc.getTextWidth("BACHTIAR LATIEF")/2), currentY + 1, 160 + (doc.getTextWidth("BACHTIAR LATIEF")/2), currentY + 1); 
    currentY += 5;
    doc.setFont("helvetica", "normal"); doc.text("KONSUMEN", 55, currentY, { align: "center" }); doc.text("KEPALA CABANG", 160, currentY, { align: "center" });

    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
  };

  const formatDateTime = (isoString, tglSerah) => {
    if (!isoString) return { date: tglSerah, time: '-' };
    const date = new Date(isoString);
    const time = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const tglSplit = tglSerah.split('-');
    return { date: `${tglSplit[2]}/${tglSplit[1]}/${tglSplit[0]}`, time };
  };

  const inputClass = "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400";
  const labelClass = "block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider";

  const renderModal = () => {
    if (!modal.isOpen) return null;
    return createPortal(
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })}></div>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[calc(100%-2rem)] sm:max-w-md p-5 sm:p-8 relative z-10 animate-in zoom-in-95 fade-in duration-300 border border-slate-100">
          <div className="flex flex-col items-center text-center mt-2">
            {modal.type === 'success' || modal.type === 'success_delete' ? (
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4 sm:mb-6 text-indigo-600 shadow-inner"><CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" /></div>
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-50 rounded-full flex items-center justify-center mb-4 sm:mb-6 text-rose-600 shadow-inner"><AlertCircle className="w-8 h-8 sm:w-10 sm:h-10" /></div>
            )}
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-2 tracking-tight">{modal.title}</h3>
            <p className="text-slate-500 font-medium text-sm sm:text-[15px] leading-relaxed mb-6 sm:mb-8 px-1 sm:px-2">{modal.message}</p>
            <div className="flex w-full gap-3 justify-center flex-col sm:flex-row">
              {modal.type === 'confirm_delete' ? (
                <>
                  <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="flex-1 py-3 sm:py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all duration-200 active:scale-95">Batal</button>
                  <button onClick={() => executeDelete(modal.actionData)} className="flex-1 py-3 sm:py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg transition-all duration-200 active:scale-95">Ya, Hapus!</button>
                </>
              ) : modal.type === 'success' ? (
                <>
                  <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="flex-1 py-3 sm:py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all duration-200 active:scale-95">Tutup</button>
                  <button onClick={() => { generateBastkPDF(modal.actionData); setModal({ isOpen: false, type: '', title: '', message: '', actionData: null }); }} className="flex-1 py-3 sm:py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-all"><Printer className="w-4 h-4 mr-2" /> Cetak PDF</button>
                </>
              ) : (
                <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="w-full py-3 sm:py-3.5 bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-all duration-200 active:scale-95">Mengerti</button>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      {renderModal()}
      <div className="max-w-5xl mx-auto pb-12 px-3 sm:px-4 space-y-6 sm:space-y-8 relative">
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300">
          <div className="p-4 sm:p-6 md:p-8">
            <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">{isEditing ? 'Mode Edit Dokumen BASTK' : 'Form Serah Terima Kendaraan'}</h2>
                <p className="text-slate-500 text-xs sm:text-sm">Lengkapi formulir di bawah ini untuk menghasilkan dokumen BASTK yang sah.</p>
              </div>
              {isEditing && (
                <span className="w-fit px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-bold flex items-center shadow-sm">
                  <Edit className="w-3.5 h-3.5 mr-1.5" /> Sedang Mengedit
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
              <div className="bg-slate-50 p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200">
                <label className="block text-[10px] sm:text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider text-center md:text-left">Pilih Kategori BASTK</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button type="button" onClick={() => setKategori('BASTK INDUK')} className={`w-full h-10 sm:h-12 rounded-xl font-bold text-[10px] sm:text-sm transition-all duration-200 active:scale-95 border ${kategori === 'BASTK INDUK' ? 'bg-slate-950 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>1. BASTK INDUK</button>
                  <button type="button" onClick={() => setKategori('BASTK POS BUOL')} className={`w-full h-10 sm:h-12 rounded-xl font-bold text-[10px] sm:text-sm transition-all duration-200 active:scale-95 border ${kategori === 'BASTK POS BUOL' ? 'bg-slate-950 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>2. BASTK POS BUOL</button>
                </div>
              </div>

              <section>
                <h3 className="flex items-center text-sm sm:text-base font-bold text-slate-800 mb-4 sm:mb-5"><span className="bg-indigo-100 text-indigo-700 w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center mr-2 sm:mr-3 text-xs shadow-sm">1</span>Informasi Surat & Konsumen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div><label className={labelClass}>Nomor Surat (BASTK)</label><input type="text" value={noSurat} onChange={(e)=>setNoSurat(e.target.value)} required placeholder="Contoh: 6526/MP/BL/III/2026" className={inputClass} /></div>
                  <div><label className={labelClass}>Tanggal Serah Terima</label><input type="date" value={tglSerah} onChange={(e)=>setTglSerah(e.target.value)} required className={inputClass} /></div>
                  
                  <div className="relative">
                    <label className={labelClass}>Jenis Pembiayaan</label>
                    <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} className={`${inputClass} flex items-center justify-between cursor-pointer select-none transition-all duration-200 ${isDropdownOpen ? 'bg-white border-blue-500 ring-4 ring-blue-500/10' : ''}`}>
                      <span className={jenisPembiayaan ? 'text-slate-900 font-bold truncate' : 'text-slate-400 font-normal truncate pr-2'}>{jenisPembiayaan ? opsiPembiayaan.find(o => o.value === jenisPembiayaan)?.label : '-- Pilih Pembiayaan --'}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 flex-shrink-0 ${isDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
                    </div>
                    {isDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                        <div className="absolute z-20 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                          {opsiPembiayaan.map((opt) => (
                            <div key={opt.value} onClick={() => { setJenisPembiayaan(opt.value); setIsDropdownOpen(false); }} className={`px-4 sm:px-6 py-3 sm:py-3.5 text-xs sm:text-sm font-bold cursor-pointer transition-colors ${jenisPembiayaan === opt.value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>{opt.label}</div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div><label className={labelClass}>Nama Lengkap Konsumen</label><input type="text" value={namaKonsumen} onChange={(e)=>setNamaKonsumen(e.target.value)} required placeholder="Sesuai KTP" className={inputClass} /></div>
                  <div><label className={labelClass}>Nomor NIK / KTP</label><input type="text" value={noKtp} onChange={(e)=>setNoKtp(e.target.value)} required placeholder="16 digit NIK" className={inputClass} /></div>
                  <div><label className={labelClass}>Alamat Lengkap</label><input type="text" value={alamat} onChange={(e)=>setAlamat(e.target.value)} required placeholder="DESA TALUAN KEC. MOMUNU KAB. BUOL" className={inputClass} /></div>
                </div>
              </section>

              <section>
                <h3 className="flex items-center text-sm sm:text-base font-bold text-slate-800 mb-4 sm:mb-5"><span className="bg-indigo-100 text-indigo-700 w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center mr-2 sm:mr-3 text-xs shadow-sm">2</span>Spesifikasi Kendaraan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div><label className={labelClass}>Jenis / Type Kendaraan</label><input type="text" value={tipeKendaraan} onChange={(e)=>setTipeKendaraan(e.target.value)} required placeholder="Beat Sporty CBS / H1B02N41S3 A/T" className={inputClass} /></div>
                  <div><label className={labelClass}>Tahun Pembuatan / CC</label><input type="text" value={tahunCc} onChange={(e)=>setTahunCc(e.target.value)} required placeholder="2026 / 110" className={inputClass} /></div>
                  <div><label className={labelClass}>Nomor Rangka</label><input type="text" value={noRangka} onChange={(e)=>setNoRangka(e.target.value)} required placeholder="MH1..." className={inputClass} /></div>
                  <div><label className={labelClass}>Nomor Mesin</label><input type="text" value={noMesin} onChange={(e)=>setNoMesin(e.target.value)} required placeholder="JM..." className={inputClass} /></div>
                  <div><label className={labelClass}>Warna Kendaraan</label><input type="text" value={warna} onChange={(e)=>setWarna(e.target.value)} required placeholder="Black Red" className={inputClass} /></div>
                  <div><label className={labelClass}>Hadiah (Opsional)</label><input type="text" value={hadiah} onChange={(e)=>setHadiah(e.target.value)} placeholder="Helm / Jaket / -" className={inputClass} /></div>
                </div>
              </section>

              <div className="pt-6 sm:pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4">
                {isEditing && (
                  <button type="button" disabled={isSubmitting} onClick={resetForm} className="px-6 sm:px-8 py-3 sm:py-3.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-50 transition-all duration-200 active:scale-95 shadow-sm flex items-center justify-center w-full sm:w-auto">
                    <X className="w-4 h-4 mr-2" /> Batal Edit
                  </button>
                )}
                <button type="submit" disabled={isSubmitting} className={`px-8 sm:px-12 py-3 sm:py-3.5 text-white rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 active:scale-95 shadow-lg tracking-wide flex items-center justify-center w-full sm:w-auto ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-950 hover:bg-slate-800'}`}>
                  {isSubmitting ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Memproses...</>
                  ) : isEditing ? (
                    <><Edit className="w-4 h-4 mr-2" /> Update Data BASTK</>
                  ) : (
                    <><FileText className="w-4 h-4 mr-2" /> Simpan & Cetak BASTK</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50/80 border-b border-slate-200 p-4 sm:p-5 px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
            <h3 className="text-base sm:text-lg font-bold text-slate-800">Riwayat {kategori}</h3>
            <button onClick={fetchHistory} className="flex items-center text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 sm:px-4 py-2 rounded-xl hover:bg-slate-100 transition-all duration-200 active:scale-95 shadow-sm w-full sm:w-auto justify-center">
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Segarkan Data
            </button>
          </div>
          
          {/* PERBAIKAN UTAMA: Tabel Responsif dengan overflow-x-auto */}
          <div className="max-h-[420px] overflow-y-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse min-w-[600px] sm:min-w-full">
                <thead className="text-[10px] sm:text-[11px] text-slate-500 uppercase sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200 shadow-sm">
                    <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold tracking-wider">No. BASTK</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold tracking-wider">Tanggal</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold tracking-wider">Nama Konsumen</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyData.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-10 sm:py-12 text-slate-400 font-medium text-sm">Belum ada data BASTK di kategori ini.</td></tr>
                  ) : (
                    historyData.map((row, index) => {
                      const { date, time } = formatDateTime(row.created_at, row.tglSerah);
                      return (
                        <tr key={index} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="px-4 sm:px-6 py-4 sm:py-5 font-bold text-slate-950 whitespace-nowrap text-xs sm:text-sm">{row.noSurat}</td>
                          <td className="px-4 sm:px-6 py-4 sm:py-5 whitespace-nowrap">
                            <div className="font-bold text-slate-700 text-xs sm:text-sm">{date}</div>
                            <div className="flex items-center text-[10px] sm:text-[11px] font-medium text-slate-400 mt-1">
                              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1" /> Jam: {time}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 sm:py-5 font-bold text-slate-950 uppercase whitespace-nowrap text-xs sm:text-sm truncate max-w-[150px] sm:max-w-none">{row.namaKonsumen}</td>
                          <td className="px-4 sm:px-6 py-4 sm:py-5">
                            <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 flex-wrap">
                              <button onClick={() => generateBastkPDF(row)} className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all duration-200 active:scale-95 font-bold text-[10px] sm:text-xs border border-emerald-200 shadow-sm">
                                <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> PDF
                              </button>
                              <button onClick={() => handleEdit(row)} className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all duration-200 active:scale-95 font-bold text-[10px] sm:text-xs border border-indigo-200 shadow-sm">
                                <Edit className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Edit
                              </button>
                              <button onClick={() => handleDeleteRequest(row.noSurat)} className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-all duration-200 active:scale-95 font-bold text-[10px] sm:text-xs border border-rose-200 shadow-sm">
                                <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Del
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
               </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}