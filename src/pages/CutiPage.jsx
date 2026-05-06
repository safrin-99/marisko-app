import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileSignature, Edit, Trash2, RefreshCw, Clock, ChevronDown, X, CheckCircle2, AlertCircle, Printer, CalendarDays } from 'lucide-react';
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

  const opsiCuti = [
    { value: 'TAHUNAN', label: 'Cuti Tahunan' },
    { value: 'SAKIT', label: 'Izin Sakit (Dengan Surat Dokter)' },
    { value: 'MENIKAH', label: 'Cuti Menikah' },
    { value: 'MELAHIRKAN', label: 'Cuti Melahirkan' },
    { value: 'DUKA', label: 'Izin Kedukaan' },
    { value: 'LAINNYA', label: 'Keperluan Lainnya' }
  ];

  useEffect(() => {
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

        await supabase.from('cuti_history').insert([formData]);
        setModal({ isOpen: true, type: 'success', title: 'Berhasil Disimpan!', message: 'Surat Permohonan Cuti berhasil dibuat dan siap dicetak.', actionData: formData });
      }
      resetForm();
      fetchHistory();
    } catch (err) {
      setModal({ isOpen: true, type: 'error', title: 'Kesalahan Sistem', message: 'Gagal menghubungi database. Cek koneksi Anda.' });
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

  // =========================================================================
  // MESIN CETAK PDF (100% IDENTIK DENGAN FILE "CUTI FIX.docx")
  // =========================================================================
  const generateCutiPDF = (data) => {
    const doc = new jsPDF();
    
    // Setting murni Helvetica (setara Arial) ukuran 12
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    
    const leftMargin = 25; 
    const rightMargin = 25; 
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - leftMargin - rightMargin; 

    let currentY = 30; 

    // Tanggal Cetak (Disamakan dengan tanggal input data)
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const createdDate = data.created_at ? new Date(data.created_at) : new Date();
    const todayStr = `Buol, ${createdDate.getDate()} ${months[createdDate.getMonth()]} ${createdDate.getFullYear()}`;

    let perihalStr = "";
    let jenisKata = "";
    if (data.jenisCuti === 'TAHUNAN') { perihalStr = "cuti tahunan"; jenisKata = "CUTI"; }
    else if (data.jenisCuti === 'MENIKAH') { perihalStr = "cuti menikah"; jenisKata = "CUTI"; }
    else if (data.jenisCuti === 'MELAHIRKAN') { perihalStr = "cuti melahirkan"; jenisKata = "CUTI"; }
    else if (data.jenisCuti === 'SAKIT') { perihalStr = "izin sakit"; jenisKata = "IZIN"; }
    else if (data.jenisCuti === 'DUKA') { perihalStr = "izin kedukaan"; jenisKata = "IZIN"; }
    else { perihalStr = "izin keperluan lainnya"; jenisKata = "IZIN"; }

    // Bagian Kepala Surat (Kiri Atas Persis Docx)
    doc.text(todayStr, leftMargin, currentY); currentY += 6;
    doc.text("Perihal", leftMargin, currentY); doc.text(`: Permohonan ${perihalStr}`, leftMargin + 20, currentY);
    currentY += 12;

    doc.text("Kepada Yth", leftMargin, currentY); currentY += 6;
    doc.text("Kacab/Owner", leftMargin, currentY); currentY += 12;

    doc.text("Dengan Hormat,", leftMargin, currentY); currentY += 8;
    doc.text("Saya yang bertanda tangan dibawah ini :", leftMargin, currentY); currentY += 12;

    // Identitas
    doc.text("No Regis", leftMargin, currentY); doc.text(`: ${data.noCuti}`, leftMargin + 25, currentY); currentY += 7;
    doc.text("Nama", leftMargin, currentY); doc.text(`: ${data.namaPegawai}`, leftMargin + 25, currentY); currentY += 7;
    doc.text("Jabatan", leftMargin, currentY); doc.text(`: ${data.jabatan}`, leftMargin + 25, currentY); currentY += 7;
    doc.text("Pekerjaan", leftMargin, currentY); doc.text(`: Karyawan Dealer Honda Marisko Perkasa`, leftMargin + 25, currentY); currentY += 15;

    // Kalkulasi Hari & Tanggal Murni Otomatis
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
    if(d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()) {
        tglRangeStr = `${startNum} s/d ${endNum} ${endMonthYear}`;
    } else {
        tglRangeStr = `${startNum} ${monthsLower[d1.getMonth()]} s/d ${endNum} ${endMonthYear}`;
    }
    
    const hariKembaliStr = daysLower[dKembali.getDay()];
    const tglKembaliFullStr = `${hariKembaliStr} ${dKembali.getDate()} ${monthsLower[dKembali.getMonth()]} ${dKembali.getFullYear()}`;

    // Paragraf Justify Rapi
    const textParagraf1 = `Melalui surat ini saya mengajukan permohonan ${jenisKata} untuk tidak masuk kerja selama ${diffDays} hari pada tanggal ${tglRangeStr}, saya akan memulai bekerja kembali pada hari ${tglKembaliFullStr}.`;
    doc.text(textParagraf1, leftMargin, currentY, { maxWidth: contentWidth, align: "justify", lineHeightFactor: 1.5 });
    currentY += (doc.splitTextToSize(textParagraf1, contentWidth).length * 6.5) + 4;

    const textParagraf2 = `Demikian permohonan ${jenisKata} ini saya ajukan, dan atas ${jenisKata} yang diberikan saya ucapkan terima kasih.`;
    doc.text(textParagraf2, leftMargin, currentY, { maxWidth: contentWidth, align: "justify", lineHeightFactor: 1.5 });
    currentY += 25;

    // Titik Tanda Tangan
    const centerKiri = leftMargin + 25;
    const centerKanan = pageWidth - rightMargin - 25;

    doc.text("Mengetahui,", centerKiri, currentY, { align: "center" });
    doc.text("Hormat saya,", centerKanan, currentY, { align: "center" });
    currentY += 6;
    doc.text("Kepala Cabang", centerKiri, currentY, { align: "center" });

    currentY += 35; // Jarak untuk TTD Manual

    doc.setFont("helvetica", "bold"); 
    
    // Garis bawah tegas untuk nama
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
    if (!isoString) return { date: tgl.split('-').reverse().join('/'), time: '-' };
    return { date: tgl.split('-').reverse().join('/'), time: '-' };
  };

  const inputClass = "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-400";
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
                  <button onClick={() => { generateCutiPDF(modal.actionData); setModal({ isOpen: false, type: '', title: '', message: '', actionData: null }); }} className="flex-1 py-3 sm:py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-all"><Printer className="w-4 h-4 mr-2" /> Buka PDF</button>
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
            <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">{isEditing ? 'Edit Permohonan Cuti' : 'Form Pengajuan Cuti & Izin'}</h2>
                <p className="text-slate-500 text-xs sm:text-sm">Ajukan permohonan cuti atau izin absen kerja melalui formulir di bawah ini.</p>
              </div>
              {isEditing && (
                <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-bold flex items-center shadow-sm"><Edit className="w-3.5 h-3.5 mr-1.5" /> Mengedit Data</span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
              <section>
                <h3 className="flex items-center text-sm sm:text-base font-bold text-slate-800 mb-4 sm:mb-5"><span className="bg-indigo-100 text-indigo-700 w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center mr-2 sm:mr-3 text-xs shadow-sm">1</span>Data Pegawai & Cuti</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className={labelClass}>No. Registrasi / Cuti</label>
                    <input type="text" value={noCuti} onChange={(e)=>setNoCuti(e.target.value)} required placeholder="Contoh: CT/101/2026" className={inputClass} />
                  </div>
                  
                  <div className="relative">
                    <label className={labelClass}>Jenis Cuti / Izin</label>
                    <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} className={`${inputClass} flex items-center justify-between cursor-pointer select-none transition-all duration-200 ${isDropdownOpen ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/10' : ''}`}>
                      <span className={jenisCuti ? 'text-slate-900 font-bold truncate' : 'text-slate-400 font-normal truncate'}>{jenisCuti ? opsiCuti.find(o => o.value === jenisCuti)?.label : '-- Pilih Kategori Cuti --'}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 flex-shrink-0 ${isDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                    </div>
                    {isDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                        <div className="absolute z-20 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                          {opsiCuti.map((opt) => (
                            <div key={opt.value} onClick={() => { setJenisCuti(opt.value); setIsDropdownOpen(false); }} className={`px-4 sm:px-6 py-3 sm:py-3.5 text-xs sm:text-sm font-bold cursor-pointer transition-colors ${jenisCuti === opt.value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>{opt.label}</div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div><label className={labelClass}>Nama Pegawai</label><input type="text" value={namaPegawai} onChange={(e)=>setNamaPegawai(e.target.value)} required placeholder="Contoh: AUFAR" className={inputClass} /></div>
                  <div><label className={labelClass}>Posisi / Jabatan</label><input type="text" value={jabatan} onChange={(e)=>setJabatan(e.target.value)} required placeholder="Contoh: STAFF ADMIN" className={inputClass} /></div>
                </div>
              </section>

              <section>
                <h3 className="flex items-center text-sm sm:text-base font-bold text-slate-800 mb-4 sm:mb-5"><span className="bg-indigo-100 text-indigo-700 w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center mr-2 sm:mr-3 text-xs shadow-sm">2</span>Waktu & Keterangan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div><label className={labelClass}>Tanggal Mulai Cuti</label><input type="date" value={tglMulai} onChange={(e)=>setTglMulai(e.target.value)} required className={inputClass} /></div>
                  <div><label className={labelClass}>Tanggal Selesai Cuti</label><input type="date" value={tglSelesai} onChange={(e)=>setTglSelesai(e.target.value)} required className={inputClass} /></div>
                  <div className="md:col-span-2"><label className={labelClass}>Alasan / Keperluan Tambahan</label><textarea value={alasan} onChange={(e)=>setAlasan(e.target.value)} placeholder="Tuliskan keterangan detail jika diperlukan..." rows="3" className={`${inputClass} h-auto py-3 resize-none`} /></div>
                </div>
              </section>

              <div className="pt-6 sm:pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4">
                {isEditing && (
                  <button type="button" disabled={isSubmitting} onClick={resetForm} className="px-6 sm:px-8 py-3 sm:py-3.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-50 transition-all duration-200 active:scale-95 shadow-sm flex items-center justify-center w-full sm:w-auto"><X className="w-4 h-4 mr-2" /> Batal Edit</button>
                )}
                <button type="submit" disabled={isSubmitting} className={`px-8 sm:px-12 py-3 sm:py-3.5 text-white rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 active:scale-95 shadow-lg tracking-wide flex items-center justify-center w-full sm:w-auto ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-950 hover:bg-slate-800'}`}>
                  {isSubmitting ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Memproses...</> : isEditing ? <><Edit className="w-4 h-4 mr-2" /> Update Permohonan</> : <><FileSignature className="w-4 h-4 mr-2" /> Ajukan Cuti & Cetak</>}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50/80 border-b border-slate-200 p-4 sm:p-5 px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center"><CalendarDays className="w-5 h-5 mr-2 text-indigo-600" /> Riwayat Permohonan</h3>
            <button onClick={fetchHistory} className="flex items-center text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 sm:px-4 py-2 rounded-xl hover:bg-slate-100 transition-all duration-200 active:scale-95 shadow-sm w-full sm:w-auto justify-center"><RefreshCw className={`w-3.5 h-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Segarkan Data</button>
          </div>
          
          {/* PERBAIKAN: Tabel Responsif dengan overflow-x-auto */}
          <div className="max-h-[420px] overflow-y-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse min-w-[700px] sm:min-w-full">
                <thead className="text-[10px] sm:text-[11px] text-slate-500 uppercase sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200 shadow-sm">
                    <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold tracking-wider">No. Registrasi</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold tracking-wider">Nama & Jabatan</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold tracking-wider">Jenis Cuti</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold tracking-wider">Tanggal Pelaksanaan</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyData.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-10 sm:py-12 text-slate-400 font-medium text-sm">Belum ada data pengajuan cuti/izin.</td></tr>
                  ) : (
                    historyData.map((row, index) => {
                      const mulai = formatDateTime(null, row.tglMulai).date;
                      const selesai = formatDateTime(null, row.tglSelesai).date;
                      const jenis = opsiCuti.find(o => o.value === row.jenisCuti)?.label || row.jenisCuti;
                      return (
                        <tr key={index} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="px-4 sm:px-6 py-4 sm:py-5 font-bold text-slate-950 whitespace-nowrap text-xs sm:text-sm">{row.noCuti}</td>
                          <td className="px-4 sm:px-6 py-4 sm:py-5">
                            <div className="font-bold text-slate-950 uppercase text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{row.namaPegawai}</div>
                            <div className="text-[10px] sm:text-[11px] text-slate-500 font-bold mt-0.5 truncate max-w-[120px] sm:max-w-none">{row.jabatan}</div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 sm:py-5 font-bold text-indigo-700 whitespace-nowrap text-xs sm:text-sm">{jenis}</td>
                          <td className="px-4 sm:px-6 py-4 sm:py-5 whitespace-nowrap">
                            <div className="font-bold text-slate-700 text-xs sm:text-sm">{mulai} - {selesai}</div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 sm:py-5">
                            <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 flex-wrap">
                              <button onClick={() => generateCutiPDF(row)} className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all duration-200 active:scale-95 font-bold text-[10px] sm:text-xs border border-emerald-200 shadow-sm"><Printer className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> PDF</button>
                              <button onClick={() => handleEdit(row)} className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all duration-200 active:scale-95 font-bold text-[10px] sm:text-xs border border-indigo-200 shadow-sm"><Edit className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Edit</button>
                              <button onClick={() => handleDeleteRequest(row.noCuti)} className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-all duration-200 active:scale-95 font-bold text-[10px] sm:text-xs border border-rose-200 shadow-sm"><Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Del</button>
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