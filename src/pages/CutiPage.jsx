import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileSignature, Edit, Trash2, RefreshCw, Clock, ChevronDown, X, CheckCircle2, AlertCircle, Printer, CalendarDays, Search, MessageCircle, CheckCircle, XCircle, Users, Download, BellRing } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { jsPDF } from "jspdf";

export default function CutiPage() {
  const userRole = localStorage.getItem('adminRole')?.toUpperCase() || '';
  
  const isRestrictedRole = userRole === 'KARYAWAN' || userRole === 'POS BUOL';

  const [historyData, setHistoryData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [modal, setModal] = useState({ isOpen: false, type: '', title: '', message: '', actionData: null });
  const [liveNotif, setLiveNotif] = useState(null);

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

  const [rekapSearchTerm, setRekapSearchTerm] = useState('');
  const [rekapStartDate, setRekapStartDate] = useState('');
  const [rekapEndDate, setRekapEndDate] = useState('');

  const [ttdBase64, setTtdBase64] = useState('');

  const opsiCuti = [
    { value: 'TAHUNAN', label: 'Cuti Tahunan' },
    { value: 'MENIKAH', label: 'Cuti Menikah' },
    { value: 'MELAHIRKAN', label: 'Cuti Melahirkan' },
    { value: 'DUKA', label: 'Izin Kedukaan' },
    { value: 'SETENGAH_HARI_AWAL', label: 'Izin Setengah Hari (08:00 s/d 13:00)' },
    { value: 'SETENGAH_HARI_AKHIR', label: 'Izin Setengah Hari (13:00 s/d 17:00)' },
    { value: 'LAINNYA', label: 'Keperluan Lainnya' }
  ];

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await supabase.from('dealer_settings').select('*').eq('id', 1).single();
        const urlTtd = data?.ttd_url || data?.ttd_kacab || data?.signature_url || data?.ttd_kacab_url;
        if (urlTtd) {
          const response = await fetch(urlTtd, { cache: 'no-cache' });
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => setTtdBase64(reader.result);
          reader.readAsDataURL(blob);
        }
      } catch (err) { }
    };
    fetchSettings();

    const checkMagicLink = () => {
      const params = new URLSearchParams(window.location.search);
      const actionId = params.get('action'); 
      
      if (actionId) {
        if (isRestrictedRole) {
          setModal({ isOpen: true, type: 'error', title: 'Akses Ditolak', message: 'Anda tidak memiliki wewenang untuk menyetujui/menolak permohonan.', actionData: 'MAGIC_LINK' });
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        setModal({ 
          isOpen: true, 
          type: 'action_select', 
          title: 'Persetujuan Dokumen', 
          message: `Silakan tinjau dan pilih status untuk permohonan No. Registrasi: ${actionId}`, 
          actionData: actionId 
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
    
    checkMagicLink();
    fetchHistory();
  }, [userRole]);

  useEffect(() => {
    const cutiSubscription = supabase
      .channel('custom-update-channel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cuti_history' }, (payload) => {
        const newData = payload.new;
        
        if (newData && newData.status) {
          if (isRestrictedRole) {
            setLiveNotif(newData);
            setTimeout(() => {
              setLiveNotif(null);
            }, 15000); 
          }
          fetchHistory();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(cutiSubscription);
    };
  }, [userRole]);

  const executeActionStatus = async (id, newStatus) => {
    setModal({ isOpen: false, type: '', title: '', message: '', actionData: null });
    setIsLoading(true);
    try {
      const { error } = await supabase.from('cuti_history').update({ status: newStatus }).eq('noCuti', id);
      if (error) throw error;
      setModal({ isOpen: true, type: 'success', title: `Berhasil ${newStatus}!`, message: `Status permohonan ${id} telah diperbarui menjadi ${newStatus}.`, actionData: 'MAGIC_LINK' });
      fetchHistory();
    } catch (err) {
      setModal({ isOpen: true, type: 'error', title: 'Gagal', message: 'Gagal mengubah status di database.' });
    }
    setIsLoading(false);
  };

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
        
        await supabase.from('cuti_history').insert([{ ...formData, status: 'DIPROSES' }]);
        setModal({ isOpen: true, type: 'success', title: 'Berhasil Disimpan!', message: 'Surat Permohonan Cuti berhasil dibuat dan siap dicetak.', actionData: formData });
      }
      resetForm();
      fetchHistory();
    } catch (err) {
      setModal({ isOpen: true, type: 'error', title: 'Kesalahan Sistem', message: 'Gagal menghubungi database.' });
    }
    setIsSubmitting(false);
  };

  const handleEdit = (data) => {
    setIsEditing(true);
    setOriginalNoCuti(data.noCuti);
    setNoCuti(data.noCuti); setNamaPegawai(data.namaPegawai); setJabatan(data.jabatan);
    setJenisCuti(data.jenisCuti); setTglMulai(data.tglMulai); setTglSelesai(data.tglSelesai);
    setAlasan(data.alasan || '');
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
    const nomorWAKacab = "6282271461103"; 
    const formatTgl = (tgl) => tgl ? tgl.split('-').reverse().join('/') : '-';
    const jenis = opsiCuti.find(o => o.value === data.jenisCuti)?.label || data.jenisCuti;
    const magicLink = `https://marisko-app.vercel.app/cuti?action=${encodeURIComponent(data.noCuti)}`;

    const teksWA = `Salam Satu Hati Owner/Kepala Cabang,\n\nSaya mengajukan permohonan persetujuan:\n\n*No. Registrasi:* ${data.noCuti}\n*Nama Pegawai:* ${data.namaPegawai}\n*Jabatan:* ${data.jabatan}\n*Jenis Cuti:* ${jenis}\n*Tanggal:* ${formatTgl(data.tglMulai)} s/d ${formatTgl(data.tglSelesai)}\n*Alasan:* ${data.alasan || '-'}\n\n✅ *KLIK LINK DI BAWAH INI UNTUK MEMILIH STATUS PERSETUJUAN:*\n${magicLink}\n\nTerima kasih. 🙏`;

    const waUrl = `https://wa.me/${nomorWAKacab}?text=${encodeURIComponent(teksWA)}`;
    window.open(waUrl, '_blank');
  };

  const generateCutiPDF = (data) => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    const leftMargin = 25; const rightMargin = 25; 
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - leftMargin - rightMargin; 
    let currentY = 30; 

    const monthsLower = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
    const daysLower = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
    
    const createdDate = data.created_at ? new Date(data.created_at) : new Date();
    const todayStr = `Buol, ${createdDate.getDate()} ${monthsLower[createdDate.getMonth()]} ${createdDate.getFullYear()}`;

    let perihalStr = ""; let jenisKata = "";
    if (data.jenisCuti === 'TAHUNAN') { perihalStr = "cuti tahunan"; jenisKata = "CUTI"; }
    else if (data.jenisCuti === 'MENIKAH') { perihalStr = "cuti menikah"; jenisKata = "CUTI"; }
    else if (data.jenisCuti === 'MELAHIRKAN') { perihalStr = "cuti melahirkan"; jenisKata = "CUTI"; }
    else if (data.jenisCuti === 'DUKA') { perihalStr = "izin kedukaan"; jenisKata = "IZIN"; }
    else if (data.jenisCuti === 'SETENGAH_HARI_AWAL') { perihalStr = "izin setengah hari (08:00 - 13:00)"; jenisKata = "IZIN"; }
    else if (data.jenisCuti === 'SETENGAH_HARI_AKHIR') { perihalStr = "izin setengah hari (13:00 - 17:00)"; jenisKata = "IZIN"; }
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

    const isSetengahHari = data.jenisCuti === 'SETENGAH_HARI_AWAL' || data.jenisCuti === 'SETENGAH_HARI_AKHIR';
    let diffDaysText = isSetengahHari ? "setengah hari" : `${diffDays} hari`;

    const dKembali = new Date(d2);
    let tglKembaliStr = "";

    if (isSetengahHari) {
        tglKembaliStr = "pada hari yang sama";
    } else {
        dKembali.setDate(dKembali.getDate() + 1);
        const hariKembaliStr = daysLower[dKembali.getDay()];
        tglKembaliStr = `pada hari ${hariKembaliStr} ${dKembali.getDate()} ${monthsLower[dKembali.getMonth()]} ${dKembali.getFullYear()}`;
    }

    const startNum = d1.getDate();
    const endNum = d2.getDate();
    const endMonthYear = `${monthsLower[d2.getMonth()]} ${d2.getFullYear()}`;
    
    let tglRangeStr = "";
    if (startNum === endNum && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()) {
        tglRangeStr = `${startNum} ${monthsLower[d1.getMonth()]} ${d1.getFullYear()}`;
    } else if(d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()) { 
        tglRangeStr = `${startNum} s/d ${endNum} ${endMonthYear}`; 
    } else { 
        tglRangeStr = `${startNum} ${monthsLower[d1.getMonth()]} s/d ${endNum} ${endMonthYear}`; 
    }
    
    const kataKerjaKembali = isSetengahHari ? "bekerja kembali" : "memulai bekerja kembali";

    const textParagraf1 = `Melalui surat ini saya mengajukan permohonan ${jenisKata} untuk tidak masuk kerja selama ${diffDaysText} pada tanggal ${tglRangeStr}, saya akan ${kataKerjaKembali} ${tglKembaliStr}.`;
    doc.text(textParagraf1, leftMargin, currentY, { maxWidth: contentWidth, align: "justify", lineHeightFactor: 1.5 });
    currentY += (doc.splitTextToSize(textParagraf1, contentWidth).length * 6.5) + 4;

    const textParagraf2 = `Demikian permohonan ${jenisKata} ini saya ajukan, dan atas ${jenisKata} yang diberikan saya ucapkan terima kasih.`;
    doc.text(textParagraf2, leftMargin, currentY, { maxWidth: contentWidth, align: "justify", lineHeightFactor: 1.5 });
    
    currentY += 20; 

    const centerKiri = leftMargin + 25;
    const centerKanan = pageWidth - rightMargin - 25;

    doc.text("Mengetahui,", centerKiri, currentY, { align: "center" });
    doc.text("Hormat saya,", centerKanan, currentY, { align: "center" }); currentY += 6;
    doc.text("Kepala Cabang", centerKiri, currentY, { align: "center" });

    currentY += 30; 
    doc.setFont("helvetica", "bold"); 
    
    if (ttdBase64) {
      try {
        let imgFormat = 'PNG';
        if (ttdBase64.toLowerCase().includes('jpeg') || ttdBase64.toLowerCase().includes('jpg')) imgFormat = 'JPEG';
        
        // SAKTI: Menaikkan sedikit (3 poin) dari Y=-28 menjadi Y=-31 agar pas di tengah dan tidak menyentuh nama.
        doc.addImage(ttdBase64, imgFormat, centerKiri - 20, currentY - 31, 40, 26);
      } catch (e) {}
    }

    doc.text("BACHTIAR LATIEF", centerKiri, currentY, { align: "center" });
    const wKacab = doc.getTextWidth("BACHTIAR LATIEF");
    doc.setLineWidth(0.4);
    doc.line(centerKiri - (wKacab/2), currentY + 1, centerKiri + (wKacab/2), currentY + 1);

    doc.text(data.namaPegawai, centerKanan, currentY, { align: "center" });
    const wKaryawan = doc.getTextWidth(data.namaPegawai);
    doc.line(centerKanan - (wKaryawan/2), currentY + 1, centerKanan + (wKaryawan/2), currentY + 1);

    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
  };

  const formatTimeOnly = (isoString) => {
    if (!isoString) return '-';
    const dateObj = new Date(isoString);
    return dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const inputClass = "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500).focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-400";
  const labelClass = "block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider";

  const rekapCutiData = Object.values(historyData.reduce((acc, row) => {
    if (row.status !== 'DISETUJUI') return acc; 
    
    if (rekapStartDate && row.tglMulai < rekapStartDate) return acc;
    if (rekapEndDate && row.tglMulai > rekapEndDate) return acc;
    
    const d1 = new Date(row.tglMulai);
    const d2 = new Date(row.tglSelesai);
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
    
    let calculatedDays = diffDays;
    let isCuti = false;

    if (['TAHUNAN', 'MENIKAH', 'MELAHIRKAN'].includes(row.jenisCuti)) {
        isCuti = true; 
    } else if (['SETENGAH_HARI_AWAL', 'SETENGAH_HARI_AKHIR'].includes(row.jenisCuti)) {
        calculatedDays = 0.5;
        isCuti = false; 
    } else {
        isCuti = false; 
    }
    
    const key = row.namaPegawai?.toUpperCase() || 'NN';
    
    if (!acc[key]) {
        acc[key] = { 
            nama: row.namaPegawai?.toUpperCase(), 
            jabatan: row.jabatan?.toUpperCase(), 
            totalCuti: 0, 
            totalIzin: 0 
        };
    }

    if (isCuti) {
        acc[key].totalCuti += calculatedDays;
    } else {
        acc[key].totalIzin += calculatedDays;
    }
    
    return acc;
  }, {}))
  .filter(item => {
    if (!rekapSearchTerm) return true;
    return item.nama.toLowerCase().includes(rekapSearchTerm.toLowerCase());
  })
  .sort((a, b) => b.totalCuti - a.totalCuti);

  const exportToExcel = () => {
    let csvContent = "Peringkat,Nama Pegawai,Posisi / Jabatan,Total Cuti Terpakai (Hari),Sisa Cuti (Dari 12 Hari),Total Izin (Hari)\n";

    rekapCutiData.forEach((item, index) => {
        const sisaCuti = 12 - item.totalCuti;
        const row = [
            index + 1,
            `"${item.nama}"`,
            `"${item.jabatan}"`,
            item.totalCuti,
            sisaCuti,
            item.totalIzin
        ].join(",");
        csvContent += row + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Rekap_Cuti_Izin_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderLiveNotif = () => {
    if (!liveNotif) return null;
    const isSetuju = liveNotif.status === 'DISETUJUI';
    const isTolak = liveNotif.status === 'DITOLAK';
    const bgColor = isSetuju ? 'bg-emerald-50' : isTolak ? 'bg-rose-50' : 'bg-amber-50';
    const iconColor = isSetuju ? 'text-emerald-600' : isTolak ? 'text-rose-600' : 'text-amber-600';
    const textColor = isSetuju ? 'text-emerald-700' : isTolak ? 'text-rose-700' : 'text-amber-700';
    const IconComponent = isSetuju ? CheckCircle2 : isTolak ? XCircle : Clock;

    return createPortal(
      <div className="fixed top-4 sm:top-6 left-1/2 transform -translate-x-1/2 z-[999999] w-[92%] sm:w-full max-w-sm animate-in slide-in-from-top-10 fade-in duration-500">
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200/60 shadow-2xl rounded-2xl sm:rounded-3xl p-3 sm:p-5 flex items-center sm:items-start gap-3 sm:gap-4">
          <div className="relative shrink-0 flex items-center justify-center">
             <div className={`absolute w-10 h-10 sm:w-12 sm:h-12 rounded-full opacity-50 animate-ping ${bgColor}`}></div>
             <div className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-inner ${bgColor} ${iconColor}`}>
                <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />
             </div>
          </div>
          <div className="flex-1 pt-0.5 sm:pt-1">
             <h4 className="text-[14px] sm:text-[15px] font-black text-slate-900 leading-tight mb-0.5 sm:mb-1">Status Diperbarui!</h4>
             <p className="text-[12px] sm:text-[13px] font-medium text-slate-500 leading-relaxed">
               Permohonan <b className="text-slate-800">{liveNotif.namaPegawai}</b> kini <span className={`font-black ${textColor}`}>{liveNotif.status}</span>.
             </p>
          </div>
          <button onClick={() => setLiveNotif(null)} className="shrink-0 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full transition-colors focus:outline-none"><X className="w-4 h-4" /></button>
        </div>
      </div>, document.body
    );
  };

  const renderModal = () => {
    if (!modal.isOpen) return null;
    return createPortal(
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all duration-300">
        <div className="bg-white rounded-4xl shadow-2xl w-full max-w-[90%] sm:max-w-md p-6 sm:p-8 relative z-10 animate-in zoom-in-95 fade-in duration-300 border border-slate-100 overflow-hidden">
          {modal.type === 'action_select' && <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-50 to-transparent -z-10"></div>}
          <div className="flex flex-col items-center text-center mt-2">
            {modal.type === 'action_select' ? (
              <div className="relative flex items-center justify-center mb-6">
                 <div className="absolute w-24 h-24 bg-indigo-100/50 rounded-full animate-pulse"></div>
                 <div className="relative w-20 h-20 bg-gradient-to-br from-indigo-100 to-indigo-50 border border-indigo-200 rounded-full flex items-center justify-center text-indigo-600 shadow-inner"><FileSignature className="w-10 h-10" /></div>
              </div>
            ) : modal.type === 'success' || modal.type === 'success_delete' ? (
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 text-emerald-600 shadow-inner"><CheckCircle2 className="w-10 h-10" /></div>
            ) : (<div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 text-rose-600 shadow-inner"><AlertCircle className="w-10 h-10" /></div>)}
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">{modal.title}</h3>
            <p className="text-slate-500 font-medium text-[14px] leading-relaxed mb-8 px-2">{modal.message}</p>
            <div className="flex w-full gap-3 justify-center">
              {modal.type === 'action_select' ? (
                <div className="flex flex-col gap-3 w-full">
                  <button onClick={() => executeActionStatus(modal.actionData, 'DISETUJUI')} className="group relative w-full p-4 bg-white border border-slate-200 hover:border-emerald-500 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4 focus:outline-none focus:ring-4 focus:ring-emerald-500/10">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300"><CheckCircle className="w-6 h-6" /></div>
                    <div className="flex-1"><h4 className="text-[15px] font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">Setujui Permohonan</h4><p className="text-[11px] font-bold text-slate-400 mt-0.5">Izinkan dan validasi cuti/izin ini</p></div>
                  </button>
                  <button onClick={() => executeActionStatus(modal.actionData, 'DITOLAK')} className="group relative w-full p-4 bg-white border border-slate-200 hover:border-rose-500 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4 focus:outline-none focus:ring-4 focus:ring-rose-500/10">
                    <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300"><XCircle className="w-6 h-6" /></div>
                    <div className="flex-1"><h4 className="text-[15px] font-extrabold text-slate-900 group-hover:text-rose-700 transition-colors">Tolak Permohonan</h4><p className="text-[11px] font-bold text-slate-400 mt-0.5">Tolak dan batalkan permohonan ini</p></div>
                  </button>
                  <button onClick={() => executeActionStatus(modal.actionData, 'DIPROSES')} className="group relative w-full p-4 bg-white border border-slate-200 hover:border-amber-500 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4 focus:outline-none focus:ring-4 focus:ring-amber-500/10">
                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300"><Clock className="w-6 h-6" /></div>
                    <div className="flex-1"><h4 className="text-[15px] font-extrabold text-slate-900 group-hover:text-amber-700 transition-colors">Tinjau Ulang</h4><p className="text-[11px] font-bold text-slate-400 mt-0.5">Kembalikan status ke DIPROSES</p></div>
                  </button>
                  <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="w-full py-3.5 mt-2 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 font-bold rounded-xl active:scale-95 transition-all text-xs uppercase tracking-wider">Batal / Tutup</button>
                </div>
              ) : modal.type === 'confirm_delete' ? (
                <><button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all duration-200 active:scale-95">Batal</button><button onClick={() => executeDelete(modal.actionData)} className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg shadow-rose-600/20 transition-all duration-200 active:scale-95">Ya, Hapus!</button></>
              ) : modal.actionData === 'MAGIC_LINK' ? (
                <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all duration-200 active:scale-95">Tutup & Lanjutkan</button>
              ) : modal.type === 'success' ? (
                <><button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all duration-200 active:scale-95">Tutup</button><button onClick={() => { generateCutiPDF(modal.actionData); setModal({ isOpen: false, type: '', title: '', message: '', actionData: null }); }} className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-200 active:scale-95 flex items-center justify-center"><Printer className="w-4 h-4 mr-2" /> Buka PDF</button></>
              ) : (<button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="w-full py-3.5 bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-all duration-200 active:scale-95">Mengerti</button>)}
            </div>
          </div>
        </div>
      </div>, document.body
    );
  };

  return (
    <>
      {renderModal()}
      {renderLiveNotif()}

      <div className="max-w-5xl mx-auto pb-12 space-y-8 relative">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300">
          <div className="p-6 md:p-8">
            <div className="mb-8 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{isEditing ? 'Edit Permohonan Cuti' : 'Form Pengajuan Cuti & Izin'}</h2>
                <p className="text-slate-500 text-sm">Ajukan permohonan cuti atau izin absen kerja melalui formulir di bawah ini.</p>
              </div>
              {isEditing && <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-bold flex items-center shadow-sm"><Edit className="w-3.5 h-3.5 mr-1.5" /> Mengedit Data</span>}
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <section>
                <h3 className="flex items-center text-base font-bold text-slate-800 mb-5"><span className="bg-indigo-100 text-indigo-700 w-7 h-7 rounded-lg flex items-center justify-center mr-3 text-xs shadow-sm">1</span>Data Pegawai & Cuti</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label className={labelClass}>No. Registrasi / Cuti</label><input type="text" value={noCuti} onChange={(e)=>setNoCuti(e.target.value)} required placeholder="Contoh: CT/101/2026" className={inputClass} /></div>
                  <div className="relative">
                    <label className={labelClass}>Jenis Cuti / Izin</label>
                    <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} className={`${inputClass} flex items-center justify-between cursor-pointer select-none transition-all duration-200 active:scale-95 ${isDropdownOpen ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/10' : ''}`}>
                      <span className={jenisCuti ? 'text-slate-900 font-bold' : 'text-slate-400 font-normal'}>{jenisCuti ? opsiCuti.find(o => o.value === jenisCuti)?.label : '-- Pilih Kategori Cuti --'}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                    </div>
                    {isDropdownOpen && (
                      <><div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                      <div className="absolute z-20 w-full mt-2.5 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-950/10 overflow-hidden py-2.5 animate-in fade-in slide-in-from-top-3 duration-200">
                        {opsiCuti.map((opt) => (<div key={opt.value} onClick={() => { setJenisCuti(opt.value); setIsDropdownOpen(false); }} className={`px-6 py-3.5 text-sm font-bold cursor-pointer transition-colors ${jenisCuti === opt.value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-indigo-50/50 hover:text-indigo-600'}`}>{opt.label}</div>))}
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
                {isEditing && <button type="button" disabled={isSubmitting} onClick={resetForm} className="px-8 py-3.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all duration-200 active:scale-95 shadow-sm flex items-center justify-center w-full sm:w-auto"><X className="w-4 h-4 mr-2" /> Batal Edit</button>}
                <button type="submit" disabled={isSubmitting} className={`px-12 py-3.5 text-white rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 shadow-lg shadow-slate-900/30 tracking-wide flex items-center justify-center w-full sm:w-auto ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-950 hover:bg-slate-800'}`}>{isSubmitting ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Memproses...</> : isEditing ? <><Edit className="w-4 h-4 mr-2" /> Update Permohonan</> : <><FileSignature className="w-4 h-4 mr-2" /> Ajukan Cuti & Cetak</>}</button>
              </div>
            </form>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300">
          <div className="bg-slate-50/80 border-b border-slate-200 p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center"><CalendarDays className="w-5 h-5 mr-2 text-indigo-600" /> Riwayat Permohonan</h3>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64"><Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Cari Nama / No. Registrasi..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm" /></div>
              <button onClick={fetchHistory} className="w-full sm:w-auto flex items-center justify-center text-xs font-bold text-slate-700 bg-white border border-slate-300 px-4 py-2.5 rounded-xl active:scale-95 shadow-sm hover:bg-slate-100 transition-all duration-200"><RefreshCw className={`w-3.5 h-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Segarkan Data</button>
            </div>
          </div>
          <div className="overflow-y-auto overflow-x-auto max-h-[420px] scrollbar-thin">
            <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
              <thead className="text-[11px] text-slate-500 uppercase sticky top-0 z-10"><tr className="bg-slate-50 border-b border-slate-200 shadow-sm"><th className="px-6 py-4 font-bold tracking-wider">No. Registrasi</th><th className="px-6 py-4 font-bold tracking-wider">Nama & Jabatan</th><th className="px-6 py-4 font-bold tracking-wider">Jenis & Status</th><th className="px-6 py-4 font-bold tracking-wider">Tanggal Pelaksanaan</th><th className="px-6 py-4 font-bold tracking-wider text-right">Aksi</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {historyData.length === 0 ? (<tr><td colSpan="5" className="text-center py-12 text-slate-400 font-medium">Belum ada data pengajuan cuti/izin.</td></tr>) : (
                  historyData.filter((row) => {
                    if (!searchTerm) return true;
                    return `${row?.noCuti || ''} ${row?.namaPegawai || ''} ${row?.jabatan || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
                  }).map((row, index) => {
                    const statusCuti = row.status || 'DIPROSES';
                    let statusText = statusCuti === 'DISETUJUI' ? <div className="mt-1.5 text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider flex items-center"><CheckCircle className="w-3.5 h-3.5 mr-1" /> DISETUJUI</div> : statusCuti === 'DITOLAK' ? <div className="mt-1.5 text-[10px] font-extrabold text-rose-600 uppercase tracking-wider flex items-center"><XCircle className="w-3.5 h-3.5 mr-1" /> DITOLAK</div> : <div className="mt-1.5 text-[10px] font-extrabold text-amber-500 uppercase tracking-wider flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> DIPROSES</div>;
                    
                    const mulai = row.tglMulai ? row.tglMulai.split('-').reverse().join('/') : '-';
                    const selesai = row.tglSelesai ? row.tglSelesai.split('-').reverse().join('/') : '-';

                    return (
                      <tr key={index} className="hover:bg-indigo-50/40 transition-colors">
                        <td className="px-6 py-5 whitespace-nowrap"><div className="font-bold text-slate-950">{row.noCuti}</div><div className="flex items-center text-[11px] text-slate-500 font-medium mt-1"><Clock className="w-3 h-3 mr-1" /> Jam: {formatTimeOnly(row.created_at)}</div></td>
                        <td className="px-6 py-5 whitespace-nowrap"><div className="font-bold text-slate-950 uppercase">{row.namaPegawai}</div><div className="text-[11px] text-slate-500 font-bold mt-0.5">{row.jabatan}</div></td>
                        <td className="px-6 py-5 whitespace-nowrap"><div className="font-bold text-indigo-700">{opsiCuti.find(o => o.value === row.jenisCuti)?.label || row.jenisCuti}</div>{statusText}</td>
                        <td className="px-6 py-5 whitespace-nowrap"><div className="font-bold text-slate-700">{mulai} - {selesai}</div></td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2.5">
                            <button onClick={() => handleSendWA(row)} className="flex items-center gap-1.5 px-3 py-2 bg-[#25D366]/10 text-[#075E54] hover:bg-[#25D366]/20 rounded-lg transition-all duration-200 active:scale-95 font-bold text-xs border border-[#25D366]/30 shadow-sm"><MessageCircle className="w-3.5 h-3.5" /> Kirim WA</button>
                            <button onClick={() => generateCutiPDF(row)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all duration-200 active:scale-95 font-bold text-xs border border-emerald-200 shadow-sm"><Printer className="w-3.5 h-3.5" /> PDF</button>
                            
                            {(!isRestrictedRole || statusCuti === 'DIPROSES') && (
                              <button onClick={() => handleEdit(row)} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all duration-200 active:scale-95 font-bold text-xs border border-indigo-200 shadow-sm"><Edit className="w-3.5 h-3.5" /> Edit</button>
                            )}

                            {!isRestrictedRole && (
                              <button onClick={() => handleDeleteRequest(row.noCuti)} className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-all duration-200 active:scale-95 font-bold text-xs border border-rose-200 shadow-sm"><Trash2 className="w-3.5 h-3.5" /> Del</button>
                            )}
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

        {!isRestrictedRole && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300">
            <div className="bg-indigo-50/80 border-b border-indigo-100 p-4 md:p-5 flex flex-col justify-between items-start gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-3.5">
                <div><h3 className="text-lg font-bold text-indigo-900 flex items-center"><Users className="w-5 h-5 mr-2 text-indigo-600" /> Rekapitulasi Cuti & Izin</h3><p className="text-[11px] font-medium text-indigo-700/70 mt-1">Pantau sisa jatah Cuti (Maks 12 Hari/Tahun) dan total Izin karyawan.</p></div>
                <button onClick={exportToExcel} className="w-full sm:w-auto flex items-center justify-center text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-4 py-2.5 rounded-xl active:scale-95 shadow-sm hover:bg-emerald-200 transition-all duration-200"><Download className="w-4 h-4 mr-2" /> Ekspor ke Excel</button>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full bg-white p-3 rounded-2xl border border-indigo-100 shadow-sm">
                <div className="relative w-full sm:w-1/3"><Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Cari Nama Pegawai..." value={rekapSearchTerm} onChange={(e) => setRekapSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" /></div>
                <div className="flex items-center gap-2 w-full sm:w-auto"><span className="text-xs font-bold text-slate-500 whitespace-nowrap">Dari:</span><input type="date" value={rekapStartDate} onChange={(e) => setRekapStartDate(e.target.value)} className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" /></div>
                <div className="flex items-center gap-2 w-full sm:w-auto"><span className="text-xs font-bold text-slate-500 whitespace-nowrap">Sampai:</span><input type="date" value={rekapEndDate} onChange={(e) => setRekapEndDate(e.target.value)} className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" /></div>
                {(rekapSearchTerm || rekapStartDate || rekapEndDate) && (<button onClick={() => { setRekapSearchTerm(''); setRekapStartDate(''); setRekapEndDate(''); }} className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all shadow-sm" title="Reset Filter"><X className="w-4 h-4" /></button>)}
              </div>
            </div>
            <div className="overflow-y-auto overflow-x-auto max-h-[420px] scrollbar-thin">
              <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
                <thead className="text-[11px] text-slate-500 uppercase sticky top-0 z-10"><tr className="bg-slate-50 border-b border-slate-200 shadow-sm"><th className="px-6 py-4 font-bold tracking-wider w-16 text-center">Peringkat</th><th className="px-6 py-4 font-bold tracking-wider">Nama Pegawai</th><th className="px-6 py-4 font-bold tracking-wider">Posisi / Jabatan</th><th className="px-6 py-4 font-bold tracking-wider text-center">Total Cuti Terpakai</th><th className="px-6 py-4 font-bold tracking-wider text-center">Sisa Cuti (12 Hari)</th><th className="px-6 py-4 font-bold tracking-wider text-center">Total Izin (Hari)</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rekapCutiData.length === 0 ? (<tr><td colSpan="6" className="text-center py-8 text-slate-400 font-medium">Belum ada rekap data cuti/izin yang disetujui untuk filter tersebut.</td></tr>) : (
                    rekapCutiData.map((item, idx) => {
                      const sisaCuti = 12 - item.totalCuti;
                      return (<tr key={idx} className="hover:bg-indigo-50/40 transition-colors"><td className="px-6 py-4 font-black text-slate-400 text-center">{idx + 1}</td><td className="px-6 py-4 font-black text-slate-900">{item.nama}</td><td className="px-6 py-4 font-bold text-slate-500 text-[11px]">{item.jabatan}</td><td className="px-6 py-4 text-center font-bold text-slate-700">{item.totalCuti} Hari</td><td className="px-6 py-4 text-center"><span className={`px-3 py-1.5 rounded-lg text-xs font-black shadow-sm border ${sisaCuti <= 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{sisaCuti} Hari</span></td><td className="px-6 py-4 text-center font-bold text-slate-700">{item.totalIzin} Hari</td></tr>)
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}