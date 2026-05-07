import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileSignature, Edit, Trash2, RefreshCw, Clock, ChevronDown, X, CheckCircle2, AlertCircle, Printer, CalendarDays, Search, MessageCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { jsPDF } from "jspdf";

export default function CutiPage() {
  const [historyData, setHistoryData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [modal, setModal] = useState({ isOpen: false, type: '', title: '', message: '', actionData: null });

  const [isEditing, setIsEditing] = useState(false);
  const [originalNoCuti, setOriginalNoCuti] = useState('');
  
  const [noCuti, setNoCuti] = useState('');
  const [namaPegawai, setNamaPegawai] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [jenisCuti, setJenisCuti] = useState('');
  const [tglMulai, setTglMulai] = useState('');
  const [tglSelesai, setTglSelesai] = useState('');
  const [alasan, setAlasan] = useState('');

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const opsiCuti = [
    { value: 'TAHUNAN', label: 'Cuti Tahunan' },
    { value: 'SAKIT', label: 'Izin Sakit (Dengan Surat Dokter)' },
    { value: 'MENIKAH', label: 'Cuti Menikah' },
    { value: 'MELAHIRKAN', label: 'Cuti Melahirkan' },
    { value: 'DUKA', label: 'Izin Kedukaan' },
    { value: 'LAINNYA', label: 'Keperluan Lainnya' }
  ];

  // =========================================================================
  // SAKTI: MESIN PENDETEKSI MAGIC LINK APPROVAL (DARI WA KACAB)
  // =========================================================================
  useEffect(() => {
    const checkMagicLink = async () => {
      // Mendeteksi apakah ada kata "?approve=..." di alamat URL (Browser)
      const params = new URLSearchParams(window.location.search);
      const approveId = params.get('approve');
      
      if (approveId) {
        setIsLoading(true);
        try {
          // Sistem menembak database untuk mengubah status jadi DISETUJUI
          const { error } = await supabase
            .from('cuti_history')
            .update({ status: 'DISETUJUI' })
            .eq('noCuti', approveId);

          if (!error) {
            setModal({ isOpen: true, type: 'success', title: 'Cuti Disetujui!', message: `Surat izin/cuti dengan No. Registrasi ${approveId} telah berhasil DISETUJUI.`, actionData: 'MAGIC_LINK' });
            // Membersihkan link agar tidak terus-terusan dieksekusi saat direfresh
            window.history.replaceState({}, document.title, window.location.pathname);
            fetchHistory();
          } else {
            throw error;
          }
        } catch (err) {
          setModal({ isOpen: true, type: 'error', title: 'Gagal Menyetujui', message: 'Terjadi kesalahan sistem atau kolom "status" belum ditambahkan di Supabase.' });
        }
        setIsLoading(false);
      }
    };
    
    checkMagicLink();
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('cuti_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (!error && data) setHistoryData(data);
    setIsLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!noCuti || !namaPegawai || !jabatan || !jenisCuti || !tglMulai || !tglSelesai) {
      setModal({ isOpen: true, type: 'error', title: 'Data Belum Lengkap!', message: 'Mohon isi semua kolom yang diwajibkan.' });
      return;
    }

    setIsSubmitting(true);
    const cleanNoCuti = noCuti.trim();

    const formData = {
      noCuti: cleanNoCuti, 
      namaPegawai: namaPegawai.toUpperCase(), 
      jabatan: jabatan.toUpperCase(), 
      jenisCuti, 
      tglMulai, 
      tglSelesai, 
      alasan
    };

    try {
      if (isEditing) {
        await supabase.from('cuti_history').update(formData).eq('noCuti', originalNoCuti);
        setModal({ isOpen: true, type: 'success', title: 'Berhasil Diupdate!', message: 'Data Permohonan Cuti telah diperbarui.', actionData: formData });
        setIsEditing(false);
      } else {
        const { data: existing } = await supabase.from('cuti_history').select('noCuti').ilike('noCuti', cleanNoCuti);
        if (existing && existing.length > 0) {
          setIsSubmitting(false);
          setModal({ isOpen: true, type: 'error', title: 'Peringatan Duplikasi!', message: `Nomor Registrasi "${cleanNoCuti}" sudah digunakan. Data tidak boleh kembar!` });
          return;
        }
        
        // SAKTI: Tambahkan status default saat insert
        await supabase.from('cuti_history').insert([{ ...formData, status: 'DIPROSES' }]);
        setModal({ isOpen: true, type: 'success', title: 'Berhasil Disimpan!', message: 'Surat Permohonan Cuti berhasil dibuat dan siap dicetak.', actionData: formData });
      }
      resetForm();
      fetchHistory();
    } catch (err) {
      setModal({ isOpen: true, type: 'error', title: 'Kesalahan Sistem', message: 'Gagal menghubungi database. Pastikan kolom "status" sudah dibuat di Supabase.' });
    }
    setIsSubmitting(false);
  };

  const handleEdit = (data) => {
    setIsEditing(true);
    setOriginalNoCuti(data.noCuti);
    setNoCuti(data.noCuti); setNamaPegawai(data.namaPegawai); setJabatan(data.jabatan);
    setJenisCuti(data.jenisCuti); setTglMulai(data.tglMulai); setTglSelesai(data.tglSelesai);
    setAlasan(data.alasan);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRequest = (id) => {
    setModal({ isOpen: true, type: 'confirm_delete', title: 'Yakin Ingin Menghapus?', message: `Permohonan Cuti dengan No: ${id} akan dihapus permanen.`, actionData: id });
  };

  const executeDelete = async (id) => {
    setModal({ isOpen: false, type: '', title: '', message: '', actionData: null });
    await supabase.from('cuti_history').delete().eq('noCuti', id);
    fetchHistory();
    setModal({ isOpen: true, type: 'success_delete', title: 'Terhapus!', message: 'Data Cuti telah berhasil dihapus.', actionData: null });
  };

  const resetForm = () => {
    setNoCuti(''); setNamaPegawai(''); setJabatan(''); setJenisCuti(''); setTglMulai(''); setTglSelesai(''); setAlasan('');
    setIsEditing(false); setOriginalNoCuti('');
  };

  const handleSendWA = (data) => {
    // GANTI DENGAN NOMOR WA KACAB (AWALAN 62)
    const nomorWAKacab = "6281234567890"; 
    
    const formatTgl = (tgl) => tgl.split('-').reverse().join('/');
    const jenis = opsiCuti.find(o => o.value === data.jenisCuti)?.label || data.jenisCuti;
    
    // SAKTI: Merakit Magic Link (otomatis mendeteksi alamat website Vercel Anda saat ini)
    const magicLink = `${window.location.origin}/cuti?approve=${encodeURIComponent(data.noCuti)}`;

    const teksWA = `Halo Bapak/Ibu Kepala Cabang,\n\nSaya mengajukan permohonan persetujuan:\n\n*No. Registrasi:* ${data.noCuti}\n*Nama Pegawai:* ${data.namaPegawai}\n*Jabatan:* ${data.jabatan}\n*Jenis Cuti:* ${jenis}\n*Tanggal:* ${formatTgl(data.tglMulai)} s/d ${formatTgl(data.tglSelesai)}\n*Alasan:* ${data.alasan || '-'}\n\n✅ *KLIK LINK DI BAWAH INI UNTUK MENYETUJUI OTOMATIS:*\n${magicLink}\n\nTerima kasih. 🙏`;

    const waUrl = `https://wa.me/${nomorWAKacab}?text=${encodeURIComponent(teksWA)}`;
    window.open(waUrl, '_blank');
  };

  // =========================================================================
  // MESIN CETAK PDF 
  // =========================================================================
  const generateCutiPDF = (data) => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    const leftMargin = 25; const rightMargin = 25; 
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - leftMargin - rightMargin; 
    let currentY = 30; 

    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const createdDate = data.created_at ? new Date(data.created_at) : new Date();
    const todayStr = `Buol, ${createdDate.getDate()} ${months[createdDate.getMonth()]} ${createdDate.getFullYear()}`;

    let perihalStr = ""; let jenisKata = "";
    if (data.jenisCuti === 'TAHUNAN') { perihalStr = "cuti tahunan"; jenisKata = "CUTI"; }
    else if (data.jenisCuti === 'MENIKAH') { perihalStr = "cuti menikah"; jenisKata = "CUTI"; }
    else if (data.jenisCuti === 'MELAHIRKAN') { perihalStr = "cuti melahirkan"; jenisKata = "CUTI"; }
    else if (data.jenisCuti === 'SAKIT') { perihalStr = "izin sakit"; jenisKata = "IZIN"; }
    else if (data.jenisCuti === 'DUKA') { perihalStr = "izin kedukaan"; jenisKata = "IZIN"; }
    else { perihalStr = "izin keperluan lainnya"; jenisKata = "IZIN"; }

    doc.text(todayStr, leftMargin, currentY); currentY += 6;
    doc.text("Perihal", leftMargin, currentY); doc.text(`: Permohonan ${perihalStr}`, leftMargin + 20, currentY); currentY += 12;
    doc.text("Kepada Yth", leftMargin, currentY); currentY += 6;
    doc.text("Kacab/Owner", leftMargin, currentY); currentY += 12;
    doc.text("Dengan Hormat,", leftMargin, currentY); currentY += 8;
    doc.text("Saya yang bertanda tangan dibawah ini :", leftMargin, currentY); currentY += 12;

    doc.text("No Regis", leftMargin, currentY); doc.text(`: ${data.noCuti}`, leftMargin + 25, currentY); currentY += 7;
    doc.text("Nama", leftMargin, currentY); doc.text(`: ${data.namaPegawai}`, leftMargin + 25, currentY); currentY += 7;
    doc.text("Jabatan", leftMargin, currentY); doc.text(`: ${data.jabatan}`, leftMargin + 25, currentY); currentY += 7;
    doc.text("Pekerjaan", leftMargin, currentY); doc.text(`: Karyawan Dealer Honda Marisko Perkasa`, leftMargin + 25, currentY); currentY += 15;

    const d1 = new Date(data.tglMulai);
    const d2 = new Date(data.tglSelesai);
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 

    const dKembali = new Date(d2);
    dKembali.setDate(dKembali.getDate() + 1);

    const daysLower = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
    const monthsLower = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];

    const startNum = d1.getDate();
    const endNum = d2.getDate();
    const endMonthYear = `${monthsLower[d2.getMonth()]} ${d2.getFullYear()}`;
    
    let tglRangeStr = "";
    if(d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()) { tglRangeStr = `${startNum} s/d ${endNum} ${endMonthYear}`; } 
    else { tglRangeStr = `${startNum} ${monthsLower[d1.getMonth()]} s/d ${endNum} ${endMonthYear}`; }
    
    const hariKembaliStr = daysLower[dKembali.getDay()];
    const tglKembaliFullStr = `${hariKembaliStr} ${dKembali.getDate()} ${monthsLower[dKembali.getMonth()]} ${dKembali.getFullYear()}`;

    const textParagraf1 = `Melalui surat ini saya mengajukan permohonan ${jenisKata} untuk tidak masuk kerja selama ${diffDays} hari pada tanggal ${tglRangeStr}, saya akan memulai bekerja kembali pada hari ${tglKembaliFullStr}.`;
    doc.text(textParagraf1, leftMargin, currentY, { maxWidth: contentWidth, align: "justify", lineHeightFactor: 1.5 });
    currentY += (doc.splitTextToSize(textParagraf1, contentWidth).length * 6.5) + 4;

    const textParagraf2 = `Demikian permohonan ${jenisKata} ini saya ajukan, dan atas ${jenisKata} yang diberikan saya ucapkan terima kasih.`;
    doc.text(textParagraf2, leftMargin, currentY, { maxWidth: contentWidth, align: "justify", lineHeightFactor: 1.5 });
    currentY += 25;

    const centerKiri = leftMargin + 25;
    const centerKanan = pageWidth - rightMargin - 25;

    doc.text("Mengetahui,", centerKiri, currentY, { align: "center" });
    doc.text("Hormat saya,", centerKanan, currentY, { align: "center" }); currentY += 6;
    doc.text("Kepala Cabang", centerKiri, currentY, { align: "center" });

    currentY += 35; 
    doc.setFont("helvetica", "bold"); 
    
    doc.text("BACHTIAR LATIEF", centerKiri, currentY, { align: "center" });
    const wKacab = doc.getTextWidth("BACHTIAR LATIEF");
    doc.setLineWidth(0.4);
    doc.line(centerKiri - (wKacab/2), currentY + 1, centerKiri + (wKacab/2), currentY + 1);

    doc.text(data.namaPegawai, centerKanan, currentY, { align: "center" });
    const wKaryawan = doc.getTextWidth(data.namaPegawai);
    doc.line(centerKanan - (wKaryawan/2), currentY + 1, centerKanan + (wKaryawan/2), currentY + 1);

    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
  };

  const formatDateTime = (isoString, tgl) => {
    if (!isoString) return { date: tgl, time: '-' };
    return { date: tgl.split('-').reverse().join('/'), time: '-' };
  };

  const inputClass = "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-400";
  const labelClass = "block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider";

  const renderModal = () => {
    if (!modal.isOpen) return null;
    return createPortal(
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })}></div>
        <div className="bg-white rounded-4xl shadow-2xl w-full max-w-md p-8 relative z-10 animate-in zoom-in-95 fade-in duration-300 border border-slate-100">
          <div className="flex flex-col items-center text-center mt-2">
            {modal.type === 'success' || modal.type === 'success_delete' ? (
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 text-indigo-600 shadow-inner"><CheckCircle2 className="w-10 h-10" /></div>
            ) : (
              <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 text-rose-600 shadow-inner"><AlertCircle className="w-10 h-10" /></div>
            )}
            <h3 className="text-2xl font-extrabold text-slate-900 mb-2 tracking-tight">{modal.title}</h3>
            <p className="text-slate-500 font-medium text-[15px] leading-relaxed mb-8 px-2">{modal.message}</p>
            <div className="flex w-full gap-3 justify-center">
              {modal.type === 'confirm_delete' ? (
                <><button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all duration-200 active:scale-95">Batal</button><button onClick={() => executeDelete(modal.actionData)} className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg shadow-rose-600/20 transition-all duration-200 active:scale-95">Ya, Hapus!</button></>
              ) : modal.actionData === 'MAGIC_LINK' ? (
                <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all duration-200 active:scale-95">Tutup & Lanjutkan</button>
              ) : modal.type === 'success' ? (
                <><button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all duration-200 active:scale-95">Tutup</button><button onClick={() => { generateCutiPDF(modal.actionData); setModal({ isOpen: false, type: '', title: '', message: '', actionData: null }); }} className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-200 active:scale-95 flex items-center justify-center"><Printer className="w-4 h-4 mr-2" /> Buka PDF</button></>
              ) : (
                <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="w-full py-3.5 bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-all duration-200 active:scale-95">Mengerti</button>
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
      <div className="max-w-5xl mx-auto pb-12 space-y-8 relative">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300">
          <div className="p-6 md:p-8">
            <div className="mb-8 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{isEditing ? 'Edit Permohonan Cuti' : 'Form Pengajuan Cuti & Izin'}</h2>
                <p className="text-slate-500 text-sm">Ajukan permohonan cuti atau izin absen kerja melalui formulir di bawah ini.</p>
              </div>
              {isEditing && (
                <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-bold flex items-center shadow-sm"><Edit className="w-3.5 h-3.5 mr-1.5" /> Mengedit Data</span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <section>
                <h3 className="flex items-center text-base font-bold text-slate-800 mb-5"><span className="bg-indigo-100 text-indigo-700 w-7 h-7 rounded-lg flex items-center justify-center mr-3 text-xs shadow-sm">1</span>Data Pegawai & Cuti</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>No. Registrasi / Cuti</label>
                    <input type="text" value={noCuti} onChange={(e)=>setNoCuti(e.target.value)} required placeholder="Contoh: CT/101/2026" className={inputClass} />
                  </div>
                  <div className="relative">
                    <label className={labelClass}>Jenis Cuti / Izin</label>
                    <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} className={`${inputClass} flex items-center justify-between cursor-pointer select-none transition-all duration-200 active:scale-95 ${isDropdownOpen ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/10' : ''}`}>
                      <span className={jenisCuti ? 'text-slate-900 font-bold' : 'text-slate-400 font-normal'}>{jenisCuti ? opsiCuti.find(o => o.value === jenisCuti)?.label : '-- Pilih Kategori Cuti --'}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                    </div>
                    {isDropdownOpen && (
                      <><div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                      <div className="absolute z-20 w-full mt-2.5 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-950/10 overflow-hidden py-2.5 animate-in fade-in slide-in-from-top-3 duration-300">
                        {opsiCuti.map((opt) => (
                          <div key={opt.value} onClick={() => { setJenisCuti(opt.value); setIsDropdownOpen(false); }} className={`px-6 py-3.5 text-sm font-bold cursor-pointer transition-colors ${jenisCuti === opt.value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-indigo-50/50 hover:text-indigo-600'}`}>{opt.label}</div>
                        ))}
                      </div></>
                    )}
                  </div>
                  <div><label className={labelClass}>Nama Pegawai</label><input type="text" value={namaPegawai} onChange={(e)=>setNamaPegawai(e.target.value)} required placeholder="Contoh: AUFAR" className={inputClass} /></div>
                  <div><label className={labelClass}>Posisi / Jabatan</label><input type="text" value={jabatan} onChange={(e)=>setJabatan(e.target.value)} required placeholder="Contoh: STAFF ADMIN" className={inputClass} /></div>
                </div>
              </section>

              <section>
                <h3 className="flex items-center text-base font-bold text-slate-800 mb-5"><span className="bg-indigo-100 text-indigo-700 w-7 h-7 rounded-lg flex items-center justify-center mr-3 text-xs shadow-sm">2</span>Waktu & Keterangan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label className={labelClass}>Tanggal Mulai Cuti</label><input type="date" value={tglMulai} onChange={(e)=>setTglMulai(e.target.value)} required className={inputClass} /></div>
                  <div><label className={labelClass}>Tanggal Selesai Cuti</label><input type="date" value={tglSelesai} onChange={(e)=>setTglSelesai(e.target.value)} required className={inputClass} /></div>
                  <div className="md:col-span-2"><label className={labelClass}>Alasan / Keperluan Tambahan</label><textarea value={alasan} onChange={(e)=>setAlasan(e.target.value)} placeholder="Tuliskan keterangan detail jika diperlukan..." rows="3" className={`${inputClass} h-auto py-3 resize-none`} /></div>
                </div>
              </section>

              <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-center items-center gap-4 transition-all duration-300">
                {isEditing && (
                  <button type="button" disabled={isSubmitting} onClick={resetForm} className="px-8 py-3.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all duration-200 active:scale-95 shadow-sm flex items-center justify-center w-full sm:w-auto"><X className="w-4 h-4 mr-2" /> Batal Edit</button>
                )}
                <button type="submit" disabled={isSubmitting} className={`px-12 py-3.5 text-white rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 shadow-lg shadow-slate-900/30 tracking-wide flex items-center justify-center w-full sm:w-auto ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-950 hover:bg-slate-800'}`}>
                  {isSubmitting ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Memproses...</> : isEditing ? <><Edit className="w-4 h-4 mr-2" /> Update Permohonan</> : <><FileSignature className="w-4 h-4 mr-2" /> Ajukan Cuti & Cetak</>}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300">
          <div className="bg-slate-50/80 border-b border-slate-200 p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5">
            <h3 className="text-lg font-bold text-slate-800 flex items-center"><CalendarDays className="w-5 h-5 mr-2 text-indigo-600" /> Riwayat Permohonan</h3>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari Nama / No. Registrasi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                />
              </div>
              <button onClick={fetchHistory} className="w-full sm:w-auto flex items-center justify-center text-xs font-bold text-slate-700 bg-white border border-slate-300 px-4 py-2.5 rounded-xl active:scale-95 shadow-sm hover:bg-slate-100 transition-all duration-200">
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Segarkan Data
              </button>
            </div>
          </div>
          
          <div className="overflow-y-auto overflow-x-auto max-h-[420px] scrollbar-thin">
            <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
              <thead className="text-[11px] text-slate-500 uppercase sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200 shadow-sm">
                  <th className="px-6 py-4 font-bold tracking-wider">No. Registrasi</th>
                  <th className="px-6 py-4 font-bold tracking-wider">Nama & Jabatan</th>
                  <th className="px-6 py-4 font-bold tracking-wider">Jenis & Status</th>
                  <th className="px-6 py-4 font-bold tracking-wider">Tanggal Pelaksanaan</th>
                  <th className="px-6 py-4 font-bold tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyData.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-12 text-slate-400 font-medium">Belum ada data pengajuan cuti/izin.</td></tr>
                ) : (
                  historyData
                    .filter((row) => {
                      if (!searchTerm) return true;
                      const keyword = searchTerm.toLowerCase();
                      const searchString = `${row?.noCuti || ''} ${row?.namaPegawai || ''} ${row?.jabatan || ''}`.toLowerCase();
                      return searchString.includes(keyword);
                    })
                    .map((row, index) => {
                      const mulai = formatDateTime(null, row.tglMulai).date;
                      const selesai = formatDateTime(null, row.tglSelesai).date;
                      const jenis = opsiCuti.find(o => o.value === row.jenisCuti)?.label || row.jenisCuti;
                      
                      // SAKTI: Menampilkan badge status warna kuning (DIPROSES) atau hijau (DISETUJUI)
                      const statusCuti = row.status || 'DIPROSES';
                      const statusColor = statusCuti === 'DISETUJUI' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200';

                      return (
                        <tr key={index} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="px-6 py-5 font-bold text-slate-950 whitespace-nowrap">{row.noCuti}</td>
                          <td className="px-6 py-5 whitespace-nowrap">
                              <div className="font-bold text-slate-950 uppercase">{row.namaPegawai}</div>
                              <div className="text-[11px] text-slate-500 font-bold mt-0.5">{row.jabatan}</div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                              <div className="font-bold text-indigo-700">{jenis}</div>
                              <div className={`mt-1.5 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded flex items-center w-fit shadow-sm ${statusColor}`}>
                                 {statusCuti === 'DISETUJUI' ? <CheckCircle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                                 {statusCuti}
                              </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="font-bold text-slate-700">{mulai} - {selesai}</div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2.5">
                              {/* SAKTI: Tombol Kirim WA diletakkan tepat di sebelah kiri tombol Cetak PDF */}
                              <button onClick={() => handleSendWA(row)} className="flex items-center gap-1.5 px-3 py-2 bg-[#25D366]/10 text-[#075E54] hover:bg-[#25D366]/20 rounded-lg transition-all duration-200 active:scale-95 font-bold text-xs border border-[#25D366]/30 shadow-sm"><MessageCircle className="w-3.5 h-3.5" /> Kirim WA</button>

                              <button onClick={() => generateCutiPDF(row)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all duration-200 active:scale-95 font-bold text-xs border border-emerald-200 shadow-sm"><Printer className="w-3.5 h-3.5" /> PDF</button>
                              <button onClick={() => handleEdit(row)} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all duration-200 active:scale-95 font-bold text-xs border border-indigo-200 shadow-sm"><Edit className="w-3.5 h-3.5" /> Edit</button>
                              <button onClick={() => handleDeleteRequest(row.noCuti)} className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-all duration-200 active:scale-95 font-bold text-xs border border-rose-200 shadow-sm"><Trash2 className="w-3.5 h-3.5" /> Del</button>
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
    </>
  );
}