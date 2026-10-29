import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileSignature, Edit, Trash2, RefreshCw, Clock, ChevronDown, X, CheckCircle2, AlertCircle, Printer, CalendarDays, Search, MessageCircle, CheckCircle, XCircle, Users, Download, BellRing } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getLogosSignedUrl } from '../lib/storage';
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
        const urlTtd = await getLogosSignedUrl(data?.ttd_url || data?.ttd_kacab || data?.signature_url || data?.ttd_kacab_url);
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
      const { data: updated, error } = await supabase.from('cuti_history').update({ status: newStatus }).eq('noCuti', id).select();
      if (error) throw error;
      if (!updated || updated.length === 0) throw new Error('Data tidak ditemukan di database. Muat ulang halaman lalu coba lagi.');
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
        const { data: updated, error } = await supabase.from('cuti_history').update(formData).eq('noCuti', originalNoCuti).select();
        if (error) throw error;
        if (!updated || updated.length === 0) throw new Error('Data tidak ditemukan di database. Muat ulang halaman lalu coba lagi.');
        setModal({ isOpen: true, type: 'success', title: 'Berhasil Diupdate!', message: 'Data Permohonan Cuti telah diperbarui.', actionData: formData });
        setIsEditing(false);
      } else {
        const { data: existing } = await supabase.from('cuti_history').select('noCuti').ilike('noCuti', cleanNoCuti);
        if (existing && existing.length > 0) {
          setIsSubmitting(false);
          setModal({ isOpen: true, type: 'error', title: 'Peringatan Duplikasi!', message: `Nomor Registrasi "${cleanNoCuti}" sudah digunakan. Data tidak boleh kembar!` });
          return;
        }
        
        const { error } = await supabase.from('cuti_history').insert([{ ...formData, status: 'DIPROSES' }]);
        if (error) throw error;
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
    // SAKTI: Pastikan database benar-benar menghapus datanya sebelum bilang "Terhapus"
    const { data: deleted, error } = await supabase.from('cuti_history').delete().eq('noCuti', id).select();
    fetchHistory();
    if (error || !deleted || deleted.length === 0) {
      setModal({ isOpen: true, type: 'error', title: 'Gagal Menghapus', message: `Permohonan Cuti No: ${id} belum terhapus. Periksa koneksi internet lalu coba lagi.`, actionData: null });
      return;
    }
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

    // SAKTI: Jarak Normal 30 agar nama tidak jatuh ke bawah
    currentY += 30; 
    doc.setFont("helvetica", "bold"); 
    
    if (ttdBase64) {
      try {
        let imgFormat = 'PNG';
        if (ttdBase64.toLowerCase().includes('jpeg') || ttdBase64.toLowerCase().includes('jpg')) imgFormat = 'JPEG';
        
        // SAKTI: Ukuran 40x26, posisi Y persis di -28 (Pas di tengah, tidak gepeng, tidak mepet nama)
        doc.addImage(ttdBase64, imgFormat, centerKiri - 20, currentY - 28, 40, 26);
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

  const inputClass = "ui-input";
  const labelClass = "ui-label";

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
      <div className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[999999] w-[92%] sm:w-full max-w-sm">
        <div className="bg-white border border-stone-200 shadow-lg rounded-xl p-4 flex items-start gap-3 font-sans">
          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${bgColor} ${iconColor}`}>
             <IconComponent className="w-5 h-5" />
          </div>
          <div className="flex-1 pt-0.5">
             <h4 className="text-sm font-semibold text-stone-900 leading-tight mb-1">Status Diperbarui!</h4>
             <p className="text-[13px] text-stone-600 leading-relaxed">
               Permohonan <b className="font-semibold text-stone-900">{liveNotif.namaPegawai}</b> kini <span className={`font-semibold ${textColor}`}>{liveNotif.status}</span>.
             </p>
          </div>
          <button onClick={() => setLiveNotif(null)} aria-label="Tutup notifikasi" className="shrink-0 p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 rounded-md transition-colors"><X className="w-4 h-4" /></button>
        </div>
      </div>, document.body
    );
  };

  const renderModal = () => {
    if (!modal.isOpen) return null;
    return createPortal(
      <div className="ui-overlay">
        <div className="ui-modal">
          <div className="flex flex-col items-center text-center">
            {modal.type === 'action_select' ? (
              <div className="ui-modal-icon-neutral"><FileSignature className="w-6 h-6" /></div>
            ) : modal.type === 'success' || modal.type === 'success_delete' ? (
              <div className="ui-modal-icon-success"><CheckCircle2 className="w-6 h-6" /></div>
            ) : (<div className="ui-modal-icon-danger"><AlertCircle className="w-6 h-6" /></div>)}
            <h3 className="ui-modal-title">{modal.title}</h3>
            <p className="ui-modal-text">{modal.message}</p>
            <div className="flex w-full gap-3 justify-center">
              {modal.type === 'action_select' ? (
                <div className="flex flex-col gap-2 w-full">
                  <button onClick={() => executeActionStatus(modal.actionData, 'DISETUJUI')} className="w-full p-3 bg-white border border-stone-200 hover:border-green-600 hover:bg-green-50/40 rounded-lg transition-colors text-left flex items-center gap-3 focus:outline-none focus-visible:ring-3 focus-visible:ring-green-600/15">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-green-50 flex items-center justify-center text-green-700"><CheckCircle className="w-5 h-5" /></div>
                    <div className="flex-1"><h4 className="text-sm font-semibold text-stone-900">Setujui Permohonan</h4><p className="text-xs text-stone-500 mt-0.5">Izinkan dan validasi cuti/izin ini</p></div>
                  </button>
                  <button onClick={() => executeActionStatus(modal.actionData, 'DITOLAK')} className="w-full p-3 bg-white border border-stone-200 hover:border-red-600 hover:bg-red-50/40 rounded-lg transition-colors text-left flex items-center gap-3 focus:outline-none focus-visible:ring-3 focus-visible:ring-red-600/15">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-red-50 flex items-center justify-center text-red-700"><XCircle className="w-5 h-5" /></div>
                    <div className="flex-1"><h4 className="text-sm font-semibold text-stone-900">Tolak Permohonan</h4><p className="text-xs text-stone-500 mt-0.5">Tolak dan batalkan permohonan ini</p></div>
                  </button>
                  <button onClick={() => executeActionStatus(modal.actionData, 'DIPROSES')} className="w-full p-3 bg-white border border-stone-200 hover:border-amber-600 hover:bg-amber-50/40 rounded-lg transition-colors text-left flex items-center gap-3 focus:outline-none focus-visible:ring-3 focus-visible:ring-amber-600/15">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-amber-50 flex items-center justify-center text-amber-700"><Clock className="w-5 h-5" /></div>
                    <div className="flex-1"><h4 className="text-sm font-semibold text-stone-900">Tinjau Ulang</h4><p className="text-xs text-stone-500 mt-0.5">Kembalikan status ke DIPROSES</p></div>
                  </button>
                  <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="ui-btn-secondary w-full mt-2">Batal / Tutup</button>
                </div>
              ) : modal.type === 'confirm_delete' ? (
                <><button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="ui-btn-secondary flex-1">Batal</button><button onClick={() => executeDelete(modal.actionData)} className="ui-btn-danger flex-1">Ya, Hapus!</button></>
              ) : modal.actionData === 'MAGIC_LINK' ? (
                <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="ui-btn-primary w-full">Tutup & Lanjutkan</button>
              ) : modal.type === 'success' ? (
                <><button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="ui-btn-secondary flex-1">Tutup</button><button onClick={() => { generateCutiPDF(modal.actionData); setModal({ isOpen: false, type: '', title: '', message: '', actionData: null }); }} className="ui-btn-primary flex-1"><Printer className="w-4 h-4" /> Buka PDF</button></>
              ) : (<button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="ui-btn-primary w-full">Mengerti</button>)}
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

      <div className="max-w-5xl mx-auto pb-12 space-y-6 relative">
        <div className="ui-card overflow-hidden">
          <div className="p-5 md:p-7">
            <div className="mb-7 flex justify-between items-start gap-4">
              <div>
                <h2 className="ui-page-title">{isEditing ? 'Edit Permohonan Cuti' : 'Form Pengajuan Cuti & Izin'}</h2>
                <p className="ui-page-subtitle">Ajukan permohonan cuti atau izin absen kerja melalui formulir di bawah ini.</p>
              </div>
              {isEditing && <span className="ui-badge-warning px-2 py-1 shrink-0"><Edit className="w-3.5 h-3.5" /> Mengedit Data</span>}
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <section>
                <h3 className="ui-section-title"><span className="ui-step">1</span>Data Pegawai & Cuti</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  <div><label className={labelClass}>No. Registrasi / Cuti</label><input type="text" value={noCuti} onChange={(e)=>setNoCuti(e.target.value)} required placeholder="Contoh: CT/101/2026" className={inputClass} /></div>
                  <div className="relative">
                    <label className={labelClass}>Jenis Cuti / Izin</label>
                    <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} className={`${inputClass} flex items-center justify-between cursor-pointer select-none ${isDropdownOpen ? 'border-brand ring-3 ring-brand/10' : ''}`}>
                      <span className={jenisCuti ? 'text-stone-900 font-medium' : 'text-stone-500'}>{jenisCuti ? opsiCuti.find(o => o.value === jenisCuti)?.label : '-- Pilih Kategori Cuti --'}</span>
                      <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                    {isDropdownOpen && (
                      <><div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                      <div className="ui-menu">
                        {opsiCuti.map((opt) => (<div key={opt.value} onClick={() => { setJenisCuti(opt.value); setIsDropdownOpen(false); }} className={jenisCuti === opt.value ? 'ui-menu-item-active' : 'ui-menu-item'}>{opt.label}</div>))}
                      </div></>
                    )}
                  </div>
                  <div><label className={labelClass}>Nama Pegawai</label><input type="text" value={namaPegawai} onChange={(e)=>setNamaPegawai(e.target.value)} required placeholder="Contoh: AUFAR" className={inputClass} /></div>
                  <div><label className={labelClass}>Posisi / Jabatan</label><input type="text" value={jabatan} onChange={(e)=>setJabatan(e.target.value)} required placeholder="Contoh: STAFF ADMIN" className={inputClass} /></div>
                </div>
              </section>

              <section>
                <h3 className="ui-section-title"><span className="ui-step">2</span>Waktu & Keterangan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  <div><label className={labelClass}>Tanggal Mulai Cuti</label><input type="date" value={tglMulai} onChange={(e)=>setTglMulai(e.target.value)} required className={inputClass} /></div>
                  <div><label className={labelClass}>Tanggal Selesai Cuti</label><input type="date" value={tglSelesai} onChange={(e)=>setTglSelesai(e.target.value)} required className={inputClass} /></div>
                  <div className="md:col-span-2"><label className={labelClass}>Alasan / Keperluan Tambahan</label><textarea value={alasan} onChange={(e)=>setAlasan(e.target.value)} placeholder="Tuliskan keterangan detail jika diperlukan..." rows="3" className={`${inputClass} h-auto py-2.5 resize-none`} /></div>
                </div>
              </section>

              <div className="pt-6 border-t border-stone-200 flex flex-col sm:flex-row justify-end items-center gap-3">
                {isEditing && <button type="button" disabled={isSubmitting} onClick={resetForm} className="ui-btn-secondary w-full sm:w-auto"><X className="w-4 h-4" /> Batal Edit</button>}
                <button type="submit" disabled={isSubmitting} className="ui-btn-primary w-full sm:w-auto px-8">{isSubmitting ? <><RefreshCw className="w-4 h-4 animate-spin" /> Memproses...</> : isEditing ? <><Edit className="w-4 h-4" /> Update Permohonan</> : <><FileSignature className="w-4 h-4" /> Ajukan Cuti & Cetak</>}</button>
              </div>
            </form>
          </div>
        </div>

        <div className="ui-card overflow-hidden">
          <div className="ui-card-header">
            <div className="flex items-center gap-3">
              <h3 className="ui-card-title"><CalendarDays className="w-4 h-4 text-stone-500" /> Riwayat Permohonan</h3>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" /><input type="text" placeholder="Cari Nama / No. Registrasi..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="ui-search" /></div>
              <button onClick={fetchHistory} className="ui-btn-sm w-full sm:w-auto"><RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Segarkan Data</button>
            </div>
          </div>
          <div className="ui-table-wrap ui-scroll-thin">
            <table className="ui-table whitespace-nowrap">
              <thead className="ui-thead"><tr><th className="ui-th">No. Registrasi</th><th className="ui-th">Nama & Jabatan</th><th className="ui-th">Jenis & Status</th><th className="ui-th">Tanggal Pelaksanaan</th><th className="ui-th text-right">Aksi</th></tr></thead>
              <tbody className="divide-y divide-stone-100">
                {historyData.length === 0 ? (<tr><td colSpan="5" className="ui-empty">Belum ada data pengajuan cuti/izin.</td></tr>) : (
                  historyData.filter((row) => {
                    if (!searchTerm) return true;
                    return `${row?.noCuti || ''} ${row?.namaPegawai || ''} ${row?.jabatan || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
                  }).map((row, index) => {
                    const statusCuti = row.status || 'DIPROSES';
                    let statusText = statusCuti === 'DISETUJUI' ? <div className="mt-1 ui-badge-success"><CheckCircle className="w-3 h-3" /> DISETUJUI</div> : statusCuti === 'DITOLAK' ? <div className="mt-1 ui-badge-danger"><XCircle className="w-3 h-3" /> DITOLAK</div> : <div className="mt-1 ui-badge-warning"><Clock className="w-3 h-3" /> DIPROSES</div>;

                    const mulai = row.tglMulai ? row.tglMulai.split('-').reverse().join('/') : '-';
                    const selesai = row.tglSelesai ? row.tglSelesai.split('-').reverse().join('/') : '-';

                    return (
                      <tr key={index} className="ui-tr">
                        <td className="ui-td whitespace-nowrap"><div className="ui-docno">{row.noCuti}</div><div className="ui-meta"><Clock className="w-3 h-3" /> Jam: {formatTimeOnly(row.created_at)}</div></td>
                        <td className="ui-td whitespace-nowrap"><div className="font-semibold text-stone-900 uppercase">{row.namaPegawai}</div><div className="text-xs text-stone-500 mt-0.5">{row.jabatan}</div></td>
                        <td className="ui-td whitespace-normal min-w-[180px] max-w-[260px]"><div className="font-medium text-stone-900">{opsiCuti.find(o => o.value === row.jenisCuti)?.label || row.jenisCuti}</div>{statusText}</td>
                        <td className="ui-td whitespace-nowrap"><div className="text-stone-700">{mulai} - {selesai}</div></td>
                        <td className="ui-td whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleSendWA(row)} className="ui-action"><MessageCircle className="w-3.5 h-3.5 text-green-700" /> Kirim WA</button>
                            <button onClick={() => generateCutiPDF(row)} className="ui-action"><Printer className="w-3.5 h-3.5" /> PDF</button>

                            {(!isRestrictedRole || statusCuti === 'DIPROSES') && (
                              <button onClick={() => handleEdit(row)} className="ui-action"><Edit className="w-3.5 h-3.5" /> Edit</button>
                            )}

                            {!isRestrictedRole && (
                              <button onClick={() => handleDeleteRequest(row.noCuti)} className="ui-action-danger"><Trash2 className="w-3.5 h-3.5" /> Del</button>
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
          <div className="ui-card overflow-hidden">
            <div className="border-b border-stone-200 px-5 py-3.5 flex flex-col justify-between items-start gap-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-3">
                <div><h3 className="ui-card-title"><Users className="w-4 h-4 text-stone-500" /> Rekapitulasi Cuti & Izin</h3><p className="text-xs text-stone-500 mt-1">Pantau sisa jatah Cuti (Maks 12 Hari/Tahun) dan total Izin karyawan.</p></div>
                <button onClick={exportToExcel} className="ui-btn-sm w-full sm:w-auto"><Download className="w-4 h-4" /> Ekspor ke Excel</button>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                <div className="relative w-full sm:w-1/3"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" /><input type="text" placeholder="Cari Nama Pegawai..." value={rekapSearchTerm} onChange={(e) => setRekapSearchTerm(e.target.value)} className="ui-search" /></div>
                <div className="flex items-center gap-2 w-full sm:w-auto"><span className="ui-filter-label">Dari:</span><input type="date" value={rekapStartDate} onChange={(e) => setRekapStartDate(e.target.value)} className="ui-filter-date" /></div>
                <div className="flex items-center gap-2 w-full sm:w-auto"><span className="ui-filter-label">Sampai:</span><input type="date" value={rekapEndDate} onChange={(e) => setRekapEndDate(e.target.value)} className="ui-filter-date" /></div>
                {(rekapSearchTerm || rekapStartDate || rekapEndDate) && (<button onClick={() => { setRekapSearchTerm(''); setRekapStartDate(''); setRekapEndDate(''); }} className="ui-btn-icon" title="Reset Filter"><X className="w-4 h-4" /></button>)}
              </div>
            </div>
            <div className="ui-table-wrap ui-scroll-thin">
              <table className="ui-table whitespace-nowrap">
                <thead className="ui-thead"><tr><th className="ui-th w-16 text-center">Peringkat</th><th className="ui-th">Nama Pegawai</th><th className="ui-th">Posisi / Jabatan</th><th className="ui-th text-center">Total Cuti Terpakai</th><th className="ui-th text-center">Sisa Cuti (12 Hari)</th><th className="ui-th text-center">Total Izin (Hari)</th></tr></thead>
                <tbody className="divide-y divide-stone-100">
                  {rekapCutiData.length === 0 ? (<tr><td colSpan="6" className="ui-empty">Belum ada rekap data cuti/izin yang disetujui untuk filter tersebut.</td></tr>) : (
                    rekapCutiData.map((item, idx) => {
                      const sisaCuti = 12 - item.totalCuti;
                      return (<tr key={idx} className="ui-tr"><td className="ui-td font-mono text-stone-500 text-center">{idx + 1}</td><td className="ui-td font-semibold text-stone-900">{item.nama}</td><td className="ui-td text-xs text-stone-600">{item.jabatan}</td><td className="ui-td text-center text-stone-800">{item.totalCuti} Hari</td><td className="ui-td text-center"><span className={`${sisaCuti <= 0 ? 'ui-badge-danger' : 'ui-badge-success'} normal-case tracking-normal text-xs`}>{sisaCuti} Hari</span></td><td className="ui-td text-center text-stone-800">{item.totalIzin} Hari</td></tr>)
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
