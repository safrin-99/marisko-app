import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardSignature, Edit, Trash2, RefreshCw, Clock, X, CheckCircle2, AlertCircle, Printer, FileText, ChevronDown, Search, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getLogosSignedUrl } from '../lib/storage';
import { jsPDF } from "jspdf";

export default function KwitansiIndentPage() {
  const [historyData, setHistoryData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState('');

  const [modal, setModal] = useState({ isOpen: false, type: '', title: '', message: '', actionData: null });
  const [isEditing, setIsEditing] = useState(false);
  const [originalNo, setOriginalNo] = useState('');

  const [noInvoice, setNoInvoice] = useState(''); 
  const [tanggal, setTanggal] = useState('');
  const [diterimaDari, setDiterimaDari] = useState('');
  const [tipeMotor, setTipeMotor] = useState('');
  const [kasir, setKasir] = useState('');
  const [nominal, setNominal] = useState('');
  const [jenisIndent, setJenisIndent] = useState('');
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  
  // SAKTI: State baru untuk Filter Tanggal
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchHistory();
    fetchLogo();
  }, []);

  const fetchLogo = async () => {
    try {
      const { data } = await supabase.from('dealer_settings').select('*').eq('id', 1).single();
      const logoUrl = await getLogosSignedUrl(data?.logo_url);
      if (logoUrl) {
        const response = await fetch(logoUrl, { cache: 'no-cache' });
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result);
        reader.readAsDataURL(blob);
      }
    } catch (err) { }
  };

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase.from('kwitansi_indent_history').select('*').order('created_at', { ascending: false }).limit(100);
      if (data) setHistoryData(data);
    } catch (err) {}
    setIsLoading(false);
  };

  const formatRupiah = (number) => new Intl.NumberFormat('id-ID').format(number || 0);
  const parseNumber = (val) => {
    if (!val) return 0;
    const parsed = parseInt(val.toString().replace(/[^0-9]/g, ''), 10);
    return isNaN(parsed) ? 0 : parsed;
  };
  
  const handleInputChange = (setter) => (e) => {
      const val = parseNumber(e.target.value);
      setter(val === 0 ? '' : val);
  };

  const formatDateTime = (isoString, tglSurat) => {
    if (!isoString) return { date: tglSurat || '-', time: '-' };
    const dateObj = new Date(isoString);
    const time = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    if (tglSurat) {
        const tglSplit = tglSurat.split('-');
        if(tglSplit.length === 3) return { date: `${tglSplit[2]}/${tglSplit[1]}/${tglSplit[0]}`, time };
    }
    return { date: tglSurat || '-', time };
  };

  const handleSelectJenis = (val) => {
    setJenisIndent(val);
    setIsDropdownOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!noInvoice || !tanggal || !diterimaDari || !tipeMotor || !kasir || !jenisIndent || !nominal) {
      setModal({ isOpen: true, type: 'error', title: 'Data Belum Lengkap!', message: 'Mohon isi semua kolom teks dan pilih Jenis Indent.' });
      return;
    }
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1200)); 
    const cleanNo = noInvoice.trim();
    
    const formData = {
      noInvoice: cleanNo, 
      tanggal, 
      diterimaDari: diterimaDari.toUpperCase(), 
      tipeMotor: tipeMotor.toUpperCase(), 
      kasir: kasir.toUpperCase(),
      jenisIndent, 
      nominal: Number(nominal)
    };

    try {
      if (isEditing) {
        const { data: updated, error } = await supabase.from('kwitansi_indent_history').update(formData).eq('noInvoice', originalNo).select();
        if (error) throw error;
        if (!updated || updated.length === 0) throw new Error('Data tidak ditemukan di database. Muat ulang halaman lalu coba lagi.');
        setModal({ isOpen: true, type: 'success', title: 'Diperbarui!', message: 'Data Berhasil diupdate.', actionData: formData });
        setIsEditing(false);
      } else {
        const { data: existing } = await supabase.from('kwitansi_indent_history').select('noInvoice').ilike('noInvoice', cleanNo);
        if (existing && existing.length > 0) {
          setIsSubmitting(false);
          setModal({ isOpen: true, type: 'error', title: 'Duplikasi!', message: `Nomor Invoice "${cleanNo}" sudah ada!` });
          return;
        }
        const { error } = await supabase.from('kwitansi_indent_history').insert([formData]);
        if (error) throw error;
        setModal({ isOpen: true, type: 'success', title: 'Tersimpan!', message: 'Kwitansi INDENT Berhasil dibuat.', actionData: formData });
      }
      resetForm();
      fetchHistory();
    } catch (err) {
      setModal({ isOpen: true, type: 'error', title: 'Gagal Simpan', message: err.message });
    }
    setIsSubmitting(false);
  };

  const handleEdit = (data) => {
    setIsEditing(true);
    setOriginalNo(data.noInvoice);
    setNoInvoice(data.noInvoice); 
    setTanggal(data.tanggal); 
    setDiterimaDari(data.diterimaDari);
    setTipeMotor(data.tipeMotor); 
    setKasir(data.kasir || ''); 
    setJenisIndent(data.jenisIndent); 
    setNominal(data.nominal);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRequest = (id) => {
    setModal({ isOpen: true, type: 'confirm_delete', title: 'Hapus?', message: `Invoice No: ${id} akan dihapus permanen.`, actionData: id });
  };

  const executeDelete = async (id) => {
    setModal({ isOpen: false, type: '', title: '', message: '', actionData: null });
    // SAKTI: Pastikan database benar-benar menghapus datanya; beri tahu bila gagal
    const { data: deleted, error } = await supabase.from('kwitansi_indent_history').delete().eq('noInvoice', id).select();
    fetchHistory();
    if (error || !deleted || deleted.length === 0) {
      setModal({ isOpen: true, type: 'error', title: 'Gagal Menghapus', message: `Invoice No: ${id} belum terhapus. Periksa koneksi internet lalu coba lagi.`, actionData: null });
      return;
    }
    setModal({ isOpen: true, type: 'success_delete', title: 'Terhapus!', message: 'Data Kwitansi dihapus.', actionData: null });
  };

  const resetForm = () => {
    setNoInvoice(''); setTanggal(''); setDiterimaDari(''); setTipeMotor(''); setKasir('');
    setJenisIndent(''); setNominal(''); 
    setIsEditing(false); setOriginalNo('');
  };

  const generatePDF = (data) => {
    const doc = new jsPDF({ format: [215, 330], unit: 'mm' }); 
    const pageWidth = doc.internal.pageSize.width;
    
    const drawReceipt = (startY) => {
        let curY = startY;

        doc.setFontSize(26); doc.setFont("helvetica", "bold");
        const kopText = "CV. MARISKO PERKASA";
        const textWidth = doc.getTextWidth(kopText);
        const startX = (pageWidth / 2) - (textWidth / 2);

        if (logoBase64) {
            try {
                let imgFormat = 'PNG';
                if (logoBase64.toLowerCase().includes('jpeg') || logoBase64.toLowerCase().includes('jpg')) imgFormat = 'JPEG';
                doc.addImage(logoBase64, imgFormat, startX - 25, curY - 10, 17, 17); 
            } catch (e) {}
        }

        doc.text(kopText, pageWidth / 2, curY, { align: "center" }); 
        curY += 5;
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text("Alamat: Jl. Buol-Gorontalo, Kel. Bugis, Kec. Biau, Kab. Buol", pageWidth / 2, curY, { align: "center" });
        curY += 3;
        doc.setLineWidth(0.8); doc.line(15, curY, 200, curY); 
        doc.setLineWidth(0.2); doc.line(15, curY + 1, 200, curY + 1); 
        
        curY += 8;
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        const titleText = "KWITANSI INDENT";
        doc.text(titleText, pageWidth / 2, curY, { align: "center" });
        const titleW = doc.getTextWidth(titleText);
        doc.setLineWidth(0.5); doc.line((pageWidth / 2) - (titleW / 2), curY + 1.5, (pageWidth / 2) + (titleW / 2), curY + 1.5); 
        
        curY += 10;
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        
        const leftL = 15; const leftC = 42; const leftV = 45;
        const rightL = 135; const rightC = 155; const rightV = 158;
        
        doc.text("Tanggal", leftL, curY); doc.text(":", leftC, curY); doc.text(data.tanggal ? data.tanggal.split('-').reverse().join('/') : '', leftV, curY);
        
        const printJenis = data.jenisIndent ? data.jenisIndent : 'INDENT REGULER';
        doc.text("Jenis Indent", rightL, curY); doc.text(":", rightC, curY); doc.setFont("helvetica", "bold"); doc.text(printJenis, rightV, curY); doc.setFont("helvetica", "normal");
        
        curY += 6;
        doc.text("Di Terima dari", leftL, curY); doc.text(":", leftC, curY); doc.text(data.diterimaDari || '', leftV, curY);
        doc.text("No. Invoice", rightL, curY); doc.text(":", rightC, curY); doc.text(data.noInvoice || '', rightV, curY);
        
        curY += 8; 
        const col1 = 15, col2 = 25, col3 = 145, col4 = 200;
        const headerH = 10; const rowH = 6;     
        
        doc.setFillColor(210, 230, 250); doc.setLineWidth(0.2); 
        doc.rect(col1, curY, col4 - col1, headerH, 'FD'); 
        doc.line(col2, curY, col2, curY + headerH); doc.line(col3, curY, col3, curY + headerH);
        doc.setFontSize(10); doc.setFont("helvetica", "bold");
        doc.text("No.", col1 + 5, curY + 6.5, {align: "center"}); 
        doc.text("Keterangan", col2 + 3, curY + 6.5); 
        doc.text("Total Harga", col3 + 27, curY + 6.5, {align: "center"});
        curY += headerH;
        
        const motor = data.tipeMotor ? `Tanda Jadi Kendaraan Motor (${data.tipeMotor})` : 'Tanda Jadi Kendaraan Motor';
        
        const rows = [
            { no: 1, name: motor, val: data.nominal || 0 },
            { no: 2, name: `-`, val: 0 },
            { no: 3, name: `-`, val: 0 },
            { no: 4, name: `-`, val: 0 },
            { no: 5, name: `-`, val: 0 },
        ];
        
        const startTableBody = curY;
        rows.forEach((r) => {
            doc.setFontSize(9); doc.setFont("helvetica", "normal"); 
            doc.line(col1, curY, col4, curY);
            doc.text(r.no.toString(), col1 + 5, curY + 4, {align: "center"}); 
            doc.text(r.name, col2 + 3, curY + 4);
            if (r.val > 0) {
                doc.text("Rp", col3 + 3, curY + 4); 
                doc.text(formatRupiah(r.val), col4 - 3, curY + 4, { align: "right" });
            } else {
                doc.text("Rp", col3 + 3, curY + 4); 
                doc.text("-", col4 - 3, curY + 4, { align: "right" });
            }
            curY += rowH;
        });
        
        doc.rect(col1, startTableBody, col4 - col1, curY - startTableBody);
        doc.line(col2, startTableBody, col2, curY); doc.line(col3, startTableBody, col3, curY);

        curY += 20; 
        const konsX = 50; const kasirX = 165;
        doc.setFontSize(9); doc.setFont("helvetica", "bold");
        
        const namaKonsum = (data.diterimaDari || '........................').trim();
        doc.text(namaKonsum, konsX, curY, { align: "center" });
        const wKonsum = doc.getTextWidth(namaKonsum);
        doc.setLineWidth(0.3);
        doc.line(konsX - (wKonsum/2), curY + 1, konsX + (wKonsum/2), curY + 1); 
        doc.setFont("helvetica", "normal"); doc.text("Konsumen", konsX, curY + 5, { align: "center" });
        
        doc.setFont("helvetica", "bold");
        const kasirTxt = (data.kasir || "STELY ARSYAD").trim(); 
        doc.text(kasirTxt, kasirX, curY, { align: "center" });
        const wKasir = doc.getTextWidth(kasirTxt);
        doc.line(kasirX - (wKasir/2), curY + 1, kasirX + (wKasir/2), curY + 1); 
        doc.setFont("helvetica", "normal"); doc.text("Kasir", kasirX, curY + 5, { align: "center" });
        
        return curY; 
    };
    
    let yAkhirAtas = drawReceipt(15); 
    const yGarisPembatas = yAkhirAtas + 15; 
    doc.setLineDashPattern([3, 3], 0); doc.setLineWidth(0.3);
    doc.line(10, yGarisPembatas, 205, yGarisPembatas);
    doc.setLineDashPattern([], 0); 
    
    let yAkhirBawah = drawReceipt(yGarisPembatas + 15); 
    const yGarisPembatasBawah = yAkhirBawah + 15;
    doc.setLineDashPattern([3, 3], 0); doc.setLineWidth(0.3);
    doc.line(10, yGarisPembatasBawah, 205, yGarisPembatasBawah);
    doc.setLineDashPattern([], 0); 

    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
  };

  const renderModal = () => {
    if (!modal.isOpen) return null;
    return createPortal(
      <div className="ui-overlay">
        <div className="ui-modal">
          <div className="flex flex-col items-center text-center">
            {modal.type === 'success' || modal.type === 'success_delete' ? <div className="ui-modal-icon-success"><CheckCircle2 className="w-6 h-6" /></div> : <div className="ui-modal-icon-danger"><AlertCircle className="w-6 h-6" /></div>}
            <h3 className="ui-modal-title">{modal.title}</h3>
            <p className="ui-modal-text">{modal.message}</p>
            <div className="flex flex-col sm:flex-row w-full gap-3 justify-center">
              {modal.type === 'confirm_delete' ? (
                <>
                  <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="ui-btn-secondary w-full sm:flex-1">Batal</button>
                  <button onClick={() => executeDelete(modal.actionData)} className="ui-btn-danger w-full sm:flex-1">Ya, Hapus!</button>
                </>
              ) : modal.type === 'success' ? (
                <>
                  <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="ui-btn-secondary w-full sm:flex-1">Tutup</button>
                  <button onClick={() => { generatePDF(modal.actionData); setModal({ isOpen: false, type: '', title: '', message: '', actionData: null }); }} className="ui-btn-primary w-full sm:flex-1"><Printer className="w-4 h-4" /> Cetak PDF</button>
                </>
              ) : (
                <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="ui-btn-primary w-full">Mengerti</button>
              )}
            </div>
          </div>
        </div>
      </div>, document.body
    );
  };

  const inputClass = "ui-input";
  const numInputClass = "ui-input-number h-12 text-lg";
  const labelClass = "ui-label";

  // =========================================================================
  // SAKTI: FUNGSI FILTER DATA BERDASARKAN TANGGAL & PENCARIAN
  // =========================================================================
  const getFilteredData = () => {
    return historyData.filter((row) => {
      if (startDate && row.tanggal < startDate) return false;
      if (endDate && row.tanggal > endDate) return false;
      
      if (!searchTerm) return true;
      const keyword = searchTerm.toLowerCase();
      const searchString = `${row?.noInvoice || ''} ${row?.diterimaDari || ''} ${row?.jenisIndent || ''}`.toLowerCase();
      return searchString.includes(keyword);
    });
  };

  const filteredHistoryData = getFilteredData();

  // =========================================================================
  // SAKTI: FUNGSI EKSPOR KE EXCEL BERDASARKAN FILTER SAAT INI
  // =========================================================================
  const exportToExcel = () => {
    if (filteredHistoryData.length === 0) {
      setModal({ isOpen: true, type: 'error', title: 'Data Kosong', message: 'Tidak ada data untuk diekspor ke Excel.' });
      return;
    }

    let csvContent = `No. Invoice,Tanggal,Diterima Dari,Tipe Motor,Jenis Indent,Nominal (Rp),Kasir\n`;

    filteredHistoryData.forEach((row) => {
        const rowData = [
            `"${row.noInvoice}"`,
            `"${row.tanggal}"`,
            `"${row.diterimaDari}"`,
            `"${row.tipeMotor || '-'}"`,
            `"${row.jenisIndent}"`,
            row.nominal,
            `"${row.kasir}"`
        ].join(",");
        csvContent += rowData + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Laporan_Kwitansi_Indent_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {renderModal()}
      
      {isSubmitting && createPortal(
        <div className="ui-overlay z-[99998]">
          <div className="ui-modal max-w-sm flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center mb-4">
              <ClipboardSignature className="w-6 h-6 text-brand-fg animate-pulse" />
            </div>
            <h3 className="ui-modal-title">Memproses INDENT...</h3>
            <p className="text-sm text-stone-600 text-center">Menyimpan data dan menyiapkan PDF.</p>
          </div>
        </div>, document.body
      )}

      <div className="max-w-4xl mx-auto pb-12 space-y-6 relative">
        <div className="ui-card relative">
          <div className="p-5 md:p-7">
            <h2 className="ui-page-title mb-7"><ClipboardSignature className="w-6 h-6 text-stone-500" /> {isEditing ? 'Edit Kwitansi Indent' : 'Form Kwitansi Indent'}</h2>
            <form onSubmit={handleSubmit} className="space-y-7">

              <section className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                <div><label className={labelClass}>No. Invoice</label><input type="text" value={noInvoice} onChange={(e)=>setNoInvoice(e.target.value)} required placeholder="IND-001" className={inputClass} /></div>
                <div><label className={labelClass}>Tanggal</label><input type="date" value={tanggal} onChange={(e)=>setTanggal(e.target.value)} required className={inputClass} /></div>
                <div><label className={labelClass}>Di Terima Dari (Konsumen)</label><input type="text" value={diterimaDari} onChange={(e)=>setDiterimaDari(e.target.value)} required placeholder="NAMA LENGKAP" className={inputClass} /></div>
                <div><label className={labelClass}>Nama Kasir</label><input type="text" value={kasir} onChange={(e)=>setKasir(e.target.value)} required placeholder="STELY ARSYAD" className={inputClass} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Tipe Motor & Warna</label><input type="text" value={tipeMotor} onChange={(e)=>setTipeMotor(e.target.value)} placeholder="(PCX160 ABS / BLUE)" className={inputClass} /></div>
              </section>

              <section className="ui-panel p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-end">
                    
                    <div className="relative">
                        <label className={labelClass}>Jenis Indent</label>
                        {isDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>}
                        <div 
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className={`ui-input h-12 flex items-center justify-between cursor-pointer hover:border-stone-400 ${jenisIndent ? 'font-semibold text-stone-900' : 'text-stone-500'}`}
                        >
                          <span>{jenisIndent || '-- Pilih Jenis Indent --'}</span>
                          <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>
                        
                        {isDropdownOpen && (
                          <div className="absolute z-[99] w-full mt-1.5 bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden">
                            <div className="p-1">
                              <div className="px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 rounded-md cursor-pointer transition-colors flex items-center" onClick={() => handleSelectJenis('')}>
                                <X className="w-4 h-4 mr-2" /> Batal / Kosongkan Pilihan
                              </div>
                              <div className="px-3 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-md cursor-pointer transition-colors" onClick={() => handleSelectJenis('INDENT KHUSUS')}>
                                INDENT KHUSUS
                              </div>
                              <div className="px-3 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-md cursor-pointer transition-colors" onClick={() => handleSelectJenis('INDENT REGULER')}>
                                INDENT REGULER
                              </div>
                            </div>
                          </div>
                        )}
                    </div>

                    <div>
                        <label className={labelClass}>Nominal Indent (Rp)</label>
                        <input type="text" value={nominal === '' ? '' : formatRupiah(nominal)} onChange={handleInputChange(setNominal)} className={numInputClass} placeholder="0" />
                    </div>

                </div>
              </section>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-stone-200">
                {isEditing && <button type="button" onClick={resetForm} className="ui-btn-secondary w-full sm:w-auto">Batal</button>}
                <button type="submit" disabled={isSubmitting} className="ui-btn-primary w-full sm:w-auto px-8">
                  <ClipboardSignature className="w-4 h-4 shrink-0" />
                  <span>{isEditing ? 'Update Indent' : 'Simpan & Cetak Kwitansi Indent'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
        
        {/* =========================================================================
            SAKTI: UI TABEL RIWAYAT DENGAN FILTER TANGGAL & EKSPOR EXCEL
            ========================================================================= */}
        <div className="ui-card overflow-hidden">
          
          <div className="border-b border-stone-200 px-5 py-3.5 flex flex-col justify-between items-start gap-3">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-3">
              <h3 className="ui-card-title shrink-0">
                <ClipboardSignature className="w-4 h-4 text-stone-500" /> Riwayat Kwitansi Indent
              </h3>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button onClick={fetchHistory} className="ui-btn-sm flex-1 sm:flex-none">
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
                <button onClick={exportToExcel} className="ui-btn-sm flex-1 sm:flex-none">
                  <Download className="w-4 h-4" /> Ekspor ke Excel
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <div className="relative w-full sm:w-1/3">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Cari Nama / No. Invoice..."
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
            <table className="ui-table min-w-[820px] lg:min-w-full">
              <thead className="ui-thead">
                <tr>
                  <th className="ui-th">No. Invoice</th>
                  <th className="ui-th">Tanggal</th>
                  <th className="ui-th">Diterima Dari</th>
                  <th className="ui-th">Jenis & Nominal</th>
                  <th className="ui-th text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredHistoryData.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="ui-empty">
                      Tidak ada data Kwitansi Indent yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredHistoryData.map((row, idx) => {
                    const { date, time } = formatDateTime(row.created_at, row.tanggal);
                    return (
                      <tr key={`${row?.noInvoice || idx}-${idx}`} className="ui-tr">
                        <td className="ui-td ui-docno">{row?.noInvoice || '-'}</td>
                        <td className="ui-td whitespace-nowrap">
                          <div className="font-medium text-stone-800">{date}</div>
                          <div className="ui-meta">
                            <Clock className="w-3.5 h-3.5" /> Jam: {time}
                          </div>
                        </td>
                        <td className="ui-td font-semibold text-stone-900 uppercase">{row?.diterimaDari || '-'}</td>
                        <td className="ui-td whitespace-nowrap">
                          <div className="text-xs font-semibold text-stone-600 uppercase tracking-[0.03em]">{row?.jenisIndent}</div>
                          <div className="font-mono text-sm font-semibold text-stone-900 mt-0.5">Rp {formatRupiah(row?.nominal)}</div>
                        </td>
                        <td className="ui-td whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => generatePDF(row)} className="ui-action">
                              <FileText className="w-3.5 h-3.5" /> PDF
                            </button>
                            <button onClick={() => handleEdit(row)} className="ui-action">
                              <Edit className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button onClick={() => handleDeleteRequest(row.noInvoice)} className="ui-action-danger">
                              <Trash2 className="w-3.5 h-3.5" /> Del
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
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
