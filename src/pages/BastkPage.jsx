import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
// SAKTI: Menambahkan Search pada import lucide-react
import { FileText, Edit, Trash2, RefreshCw, Clock, ChevronDown, X, CheckCircle2, AlertCircle, Printer, Search } from 'lucide-react';
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

  // SAKTI: State baru untuk fitur pencarian
  const [searchTerm, setSearchTerm] = useState('');

  // SAKTI: State baru untuk Filter Tanggal
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const opsiPembiayaan = [
    { value: 'CASH', label: 'CASH (MARISKO PERKASA)' },
    { value: 'ADIRA', label: 'PT. ADIRA MULTI FINANCE' },
    { value: 'FIF', label: 'PT. FEDERAL INTERNATIONAL FINANCE' },
    { value: 'MANDALA', label: 'PT. 1204 ADIRA SYARIEF MANSYUR' }
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

  // =========================================================================
  // SAKTI: FUNGSI FILTER DATA BERDASARKAN TANGGAL & PENCARIAN
  // =========================================================================
  const getFilteredData = () => {
    return historyData.filter((row) => {
      // 1. Filter Tanggal (berdasarkan Tanggal Serah Terima)
      if (startDate && row.tglSerah < startDate) return false;
      if (endDate && row.tglSerah > endDate) return false;

      // 2. Filter Teks Pencarian
      if (!searchTerm) return true;
      const keyword = searchTerm.toLowerCase();
      const searchString = `${row?.noSurat || ''} ${row?.namaKonsumen || ''}`.toLowerCase();
      return searchString.includes(keyword);
    });
  };

  const filteredHistoryData = getFilteredData();

  const inputClass = "ui-input";
  const labelClass = "ui-label";

  const renderModal = () => {
    if (!modal.isOpen) return null;
    return createPortal(
      <div className="ui-overlay">
        <div className="absolute inset-0" onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })}></div>
        <div className="ui-modal">
          <div className="flex flex-col items-center text-center">
            {modal.type === 'success' || modal.type === 'success_delete' ? (
              <div className="ui-modal-icon-success"><CheckCircle2 className="w-6 h-6" /></div>
            ) : (
              <div className="ui-modal-icon-danger"><AlertCircle className="w-6 h-6" /></div>
            )}
            <h3 className="ui-modal-title">{modal.title}</h3>
            <p className="ui-modal-text">{modal.message}</p>
            <div className="flex w-full gap-3 justify-center">
              {modal.type === 'confirm_delete' ? (
                <><button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="ui-btn-secondary flex-1">Batal</button><button onClick={() => executeDelete(modal.actionData)} className="ui-btn-danger flex-1">Ya, Hapus!</button></>
              ) : modal.type === 'success' ? (
                <><button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="ui-btn-secondary flex-1">Tutup</button><button onClick={() => { generateBastkPDF(modal.actionData); setModal({ isOpen: false, type: '', title: '', message: '', actionData: null }); }} className="ui-btn-primary flex-1"><Printer className="w-4 h-4" /> Cetak PDF</button></>
              ) : (
                <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="ui-btn-primary w-full">Mengerti</button>
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
      <div className="max-w-5xl mx-auto pb-12 space-y-6 relative">
        <div className="ui-card overflow-hidden">
          <div className="p-5 md:p-7">
            <div className="mb-7 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div>
                <h2 className="ui-page-title">{isEditing ? 'Mode Edit Dokumen BASTK' : 'Form Serah Terima Kendaraan'}</h2>
                <p className="ui-page-subtitle">Lengkapi formulir di bawah ini untuk menghasilkan dokumen BASTK yang sah.</p>
              </div>
              {isEditing && (
                <span className="ui-badge-warning w-fit px-2 py-1">
                  <Edit className="w-3.5 h-3.5" /> Sedang Mengedit
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="ui-panel p-4 sm:p-5">
                <label className="ui-label mb-3 text-center md:text-left">Pilih Kategori BASTK</label>
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <button type="button" onClick={() => setKategori('BASTK INDUK')} className={kategori === 'BASTK INDUK' ? 'ui-choice-active' : 'ui-choice'}>1. BASTK INDUK</button>
                  <button type="button" onClick={() => setKategori('BASTK POS BUOL')} className={kategori === 'BASTK POS BUOL' ? 'ui-choice-active' : 'ui-choice'}>2. BASTK POS BUOL</button>
                </div>
              </div>

              <section>
                <h3 className="ui-section-title"><span className="ui-step">1</span>Informasi Surat & Konsumen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  <div><label className={labelClass}>Nomor Surat (BASTK)</label><input type="text" value={noSurat} onChange={(e)=>setNoSurat(e.target.value)} required placeholder="Contoh: 6526/MP/BL/III/2026" className={inputClass} /></div>
                  <div><label className={labelClass}>Tanggal Serah Terima</label><input type="date" value={tglSerah} onChange={(e)=>setTglSerah(e.target.value)} required className={inputClass} /></div>

                  <div className="relative">
                    <label className={labelClass}>Jenis Pembiayaan</label>
                    <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} className={`${inputClass} flex items-center justify-between cursor-pointer select-none ${isDropdownOpen ? 'border-brand ring-3 ring-brand/10' : ''}`}>
                      <span className={jenisPembiayaan ? 'text-stone-900 font-medium' : 'text-stone-500 truncate pr-2'}>{jenisPembiayaan ? opsiPembiayaan.find(o => o.value === jenisPembiayaan)?.label : '-- Pilih Pembiayaan --'}</span>
                      <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform duration-200 flex-shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                    {isDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                        <div className="ui-menu">
                          {opsiPembiayaan.map((opt) => (
                            <div key={opt.value} onClick={() => { setJenisPembiayaan(opt.value); setIsDropdownOpen(false); }} className={jenisPembiayaan === opt.value ? 'ui-menu-item-active' : 'ui-menu-item'}>{opt.label}</div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div><label className={labelClass}>Nama Lengkap Konsumen</label><input type="text" value={namaKonsumen} onChange={(e)=>setNamaKonsumen(e.target.value)} required placeholder="Sesuai KTP" className={inputClass} /></div>
                  <div><label className={labelClass}>Nomor NIK / KTP</label><input type="text" value={noKtp} onChange={(e)=>setNoKtp(e.target.value)} required placeholder="16 digit NIK" className={inputClass} /></div>
                  <div><label className={labelClass}>Alamat Lengkap</label><input type="text" value={alamat} onChange={(e)=>setAlamat(e.target.value)} required placeholder="DESA TALUAN  KEC. MOMUNU  KAB. BUOL" className={inputClass} /></div>
                </div>
              </section>

              <section>
                <h3 className="ui-section-title"><span className="ui-step">2</span>Spesifikasi Kendaraan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  <div><label className={labelClass}>Jenis / Type Kendaraan</label><input type="text" value={tipeKendaraan} onChange={(e)=>setTipeKendaraan(e.target.value)} required placeholder="Beat Sporty CBS / H1B02N41S3 A/T" className={inputClass} /></div>
                  <div><label className={labelClass}>Tahun Pembuatan / CC</label><input type="text" value={tahunCc} onChange={(e)=>setTahunCc(e.target.value)} required placeholder="2026 / 110" className={inputClass} /></div>
                  <div><label className={labelClass}>Nomor Rangka</label><input type="text" value={noRangka} onChange={(e)=>setNoRangka(e.target.value)} required placeholder="MH1..." className={inputClass} /></div>
                  <div><label className={labelClass}>Nomor Mesin</label><input type="text" value={noMesin} onChange={(e)=>setNoMesin(e.target.value)} required placeholder="JM..." className={inputClass} /></div>
                  <div><label className={labelClass}>Warna Kendaraan</label><input type="text" value={warna} onChange={(e)=>setWarna(e.target.value)} required placeholder="Black Red" className={inputClass} /></div>
                  <div><label className={labelClass}>Hadiah (Opsional)</label><input type="text" value={hadiah} onChange={(e)=>setHadiah(e.target.value)} placeholder="Helm / Jaket / -" className={inputClass} /></div>
                </div>
              </section>

              <div className="pt-6 border-t border-stone-200 flex flex-col sm:flex-row justify-end items-center gap-3">
                {isEditing && (
                  <button type="button" disabled={isSubmitting} onClick={resetForm} className="ui-btn-secondary w-full sm:w-auto">
                    <X className="w-4 h-4" /> Batal Edit
                  </button>
                )}
                <button type="submit" disabled={isSubmitting} className="ui-btn-primary w-full sm:w-auto px-8">
                  {isSubmitting ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Memproses...</>
                  ) : isEditing ? (
                    <><Edit className="w-4 h-4" /> Update Data BASTK</>
                  ) : (
                    <><FileText className="w-4 h-4" /> Simpan & Cetak BASTK</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="ui-card overflow-hidden">

          {/* SAKTI: Judul + Tombol Segarkan Data, lalu baris FITUR SEARCH & FILTER TANGGAL (sama seperti Kwitansi) */}
          <div className="border-b border-stone-200 px-5 py-3.5 flex flex-col justify-between items-start gap-3">

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-3">
              <h3 className="ui-card-title shrink-0">Riwayat {kategori}</h3>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button onClick={fetchHistory} className="ui-btn-sm flex-1 sm:flex-none">
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <div className="relative w-full sm:w-1/3">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Cari Nama / No. Surat..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="ui-search"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="ui-filter-label">Dari:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="ui-filter-date"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="ui-filter-label">Sampai:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="ui-filter-date"
                />
              </div>

              {(searchTerm || startDate || endDate) && (
                <button
                  onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }}
                  className="ui-btn-icon"
                  title="Reset Filter"
                >
                   <X className="w-4 h-4" />
                </button>
              )}
            </div>

          </div>

          <div className="ui-table-wrap ui-scroll-thin">
            <table className="ui-table min-w-[720px] lg:min-w-full">
              <thead className="ui-thead">
                <tr>
                  <th className="ui-th">No. BASTK</th>
                  <th className="ui-th">Tanggal</th>
                  <th className="ui-th">Nama Konsumen</th>
                  <th className="ui-th text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredHistoryData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="ui-empty">
                      Tidak ada data BASTK yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredHistoryData.map((row, index) => {
                    const { date, time } = formatDateTime(row.created_at, row.tglSerah);
                    return (
                      <tr key={index} className="ui-tr">
                        <td className="ui-td ui-docno">{row.noSurat}</td>
                        <td className="ui-td whitespace-nowrap">
                          <div className="font-medium text-stone-800">{date}</div>
                            <div className="ui-meta">
                              <Clock className="w-3.5 h-3.5" /> Jam: {time}
                            </div>
                        </td>
                        <td className="ui-td font-semibold text-stone-900 uppercase whitespace-nowrap">{row.namaKonsumen}</td>
                        <td className="ui-td">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => generateBastkPDF(row)} className="ui-action">
                              <FileText className="w-3.5 h-3.5" /> PDF
                            </button>
                            <button onClick={() => handleEdit(row)} className="ui-action">
                              <Edit className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button onClick={() => handleDeleteRequest(row.noSurat)} className="ui-action-danger">
                              <Trash2 className="w-3.5 h-3.5" /> Del
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
    </>
  );
}
