import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Receipt, Edit, Trash2, RefreshCw, X, CheckCircle2, AlertCircle, Printer, Search, ChevronDown, FileText, Clock, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getLogosSignedUrl } from '../lib/storage';
import { jsPDF } from "jspdf";

export default function KwitansiPage() {
  const [historyData, setHistoryData] = useState([]);
  const [bastkList, setBastkList] = useState([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [modal, setModal] = useState({ isOpen: false, type: '', title: '', message: '', actionData: null });
  const [isEditing, setIsEditing] = useState(false);
  const [originalNo, setOriginalNo] = useState('');
  
  const [noInvoice, setNoInvoice] = useState(''); 
  const [noBastk, setNoBastk] = useState(''); 
  const [tanggal, setTanggal] = useState('');
  const [diterimaDari, setDiterimaDari] = useState('');
  const [leasing, setLeasing] = useState('');
  const [tipeMotor, setTipeMotor] = useState('');
  const [kasir, setKasir] = useState('');
  const [pilihBastk, setPilihBastk] = useState(''); 

  const [offTheRoad, setOffTheRoad] = useState(0);
  const [bbn, setBbn] = useState(0);
  const [indent, setIndent] = useState(0);
  const [otr, setOtr] = useState(0);
  const [dpGross, setDpGross] = useState(0);
  const [diskon, setDiskon] = useState(0);
  const [transfer, setTransfer] = useState(0);
  
  const [accesoris, setAccesoris] = useState(0);
  const [potonganLecet, setPotonganLecet] = useState(0);
  const [sisaUangMuka, setSisaUangMuka] = useState(0);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [logoBase64, setLogoBase64] = useState('');

  // SAKTI: State baru untuk Filter Tanggal
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!isEditing) {
      const calculatedSisa = Math.max(0, dpGross - diskon - indent + accesoris - transfer - potonganLecet);
      setSisaUangMuka(calculatedSisa);
    }
  }, [dpGross, diskon, indent, accesoris, transfer, potonganLecet, isEditing]);

  // SAKTI: RUMUS OFF THE ROAD KREDIT SUDAH DIPERBAIKI SESUAI EXCEL (OTR - BBN) / 1.11
  useEffect(() => {
    if (otr > 0 && bbn > 0 && !isEditing) {
      const calculatedOffTheRoad = Math.round((otr - bbn) / 1.11);
      setOffTheRoad(calculatedOffTheRoad);
    }
  }, [otr, bbn, isEditing]);

  useEffect(() => {
    fetchHistory();
    fetchBastk();
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
      const { data } = await supabase.from('kwitansi_history').select('*').order('created_at', { ascending: false }).limit(100);
      if (data) setHistoryData(data);
    } catch (err) {}
    setIsLoading(false);
  };

  const fetchBastk = async () => {
    try {
      const { data } = await supabase.from('bastk_history').select('*').order('created_at', { ascending: false });
      if (data) setBastkList(data);
    } catch (err) {}
  };

  const handleSelectBastk = (val) => {
    setPilihBastk(val);
    setIsDropdownOpen(false);
    setDropdownSearch('');
    const foundBastk = bastkList.find(b => b?.noSurat === val);
    if (foundBastk && !isEditing) {
      setDiterimaDari(foundBastk?.namaKonsumen || '');
      setNoBastk(foundBastk?.noSurat || '');
    } else if (!val) {
      setDiterimaDari('');
      setNoBastk('');
    }
  };

  const filteredBastk = bastkList.filter(b => 
    (b?.namaKonsumen || '').toLowerCase().includes(dropdownSearch.toLowerCase()) || 
    (b?.noSurat || '').toLowerCase().includes(dropdownSearch.toLowerCase())
  );

  const formatRupiah = (number) => new Intl.NumberFormat('id-ID').format(number);
  const parseNumber = (val) => {
    if (!val) return 0;
    const parsed = parseInt(val.toString().replace(/[^0-9]/g, ''), 10);
    return isNaN(parsed) ? 0 : parsed;
  };
  const handleInputChange = (setter) => (e) => setter(parseNumber(e.target.value));

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!noInvoice || !tanggal || !diterimaDari || !leasing || !tipeMotor || !kasir) {
      setModal({ isOpen: true, type: 'error', title: 'Data Belum Lengkap!', message: 'Mohon isi semua kolom teks utama.' });
      return;
    }

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1200)); 
    const cleanNo = noInvoice.trim();
    const formData = {
      noInvoice: cleanNo, noBastk: noBastk.trim(), tanggal, diterimaDari: diterimaDari.toUpperCase(), 
      leasing: leasing.toUpperCase(), tipeMotor: tipeMotor.toUpperCase(), kasir: kasir.toUpperCase(),
      offTheRoad, bbn, indent, otr, dpGross, diskon, transfer, accesoris, potonganLecet, sisaUangMuka
    };

    try {
      if (isEditing) {
        const { data: updated, error } = await supabase.from('kwitansi_history').update(formData).eq('noInvoice', originalNo).select();
        if (error) throw error;
        if (!updated || updated.length === 0) throw new Error('Data tidak ditemukan di database. Muat ulang halaman lalu coba lagi.');
        setModal({ isOpen: true, type: 'success', title: 'Diperbarui!', message: 'Data Invoice berhasil diupdate.', actionData: formData });
        setIsEditing(false);
      } else {
        const { data: existing } = await supabase.from('kwitansi_history').select('noInvoice').ilike('noInvoice', cleanNo);
        if (existing && existing.length > 0) {
          setIsSubmitting(false);
          setModal({ isOpen: true, type: 'error', title: 'Duplikasi!', message: `Nomor Invoice "${cleanNo}" sudah ada!` });
          return;
        }
        const { error } = await supabase.from('kwitansi_history').insert([formData]);
        if (error) throw error;
        setModal({ isOpen: true, type: 'success', title: 'Tersimpan!', message: 'Kwitansi berhasil dibuat.', actionData: formData });
      }
      resetForm();
      fetchHistory();
    } catch (err) {
      setModal({ isOpen: true, type: 'error', title: 'Gagal', message: 'Koneksi database terputus.' });
    }
    setIsSubmitting(false);
  };

  const handleEdit = (data) => {
    setIsEditing(true);
    setOriginalNo(data.noInvoice);
    setNoInvoice(data.noInvoice); setNoBastk(data.noBastk || ''); setTanggal(data.tanggal); setDiterimaDari(data.diterimaDari);
    setLeasing(data.leasing); setTipeMotor(data.tipeMotor); setKasir(data.kasir);
    setOffTheRoad(data.offTheRoad); setBbn(data.bbn); setIndent(data.indent); setOtr(data.otr);
    setDpGross(data.dpGross); setDiskon(data.diskon); setTransfer(data.transfer);
    setAccesoris(data.accesoris || 0); setPotonganLecet(data.potonganLecet || 0);
    setSisaUangMuka(data.sisaUangMuka || 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRequest = (id) => {
    setModal({ isOpen: true, type: 'confirm_delete', title: 'Hapus Kwitansi?', message: `Invoice No: ${id} akan dihapus permanen.`, actionData: id });
  };

  const executeDelete = async (id) => {
    setModal({ isOpen: false, type: '', title: '', message: '', actionData: null });
    // SAKTI: Pastikan database benar-benar menghapus datanya; beri tahu bila gagal
    const { data: deleted, error } = await supabase.from('kwitansi_history').delete().eq('noInvoice', id).select();
    fetchHistory();
    if (error || !deleted || deleted.length === 0) {
      setModal({ isOpen: true, type: 'error', title: 'Gagal Menghapus', message: `Invoice No: ${id} belum terhapus. Periksa koneksi internet lalu coba lagi.`, actionData: null });
    }
  };

  const resetForm = () => {
    setNoInvoice(''); setNoBastk(''); setTanggal(''); setDiterimaDari(''); setLeasing(''); setTipeMotor(''); setKasir(''); setPilihBastk('');
    setOffTheRoad(0); setBbn(0); setIndent(0); setOtr(0); setDpGross(0); setDiskon(0); setTransfer(0);
    setAccesoris(0); setPotonganLecet(0); setSisaUangMuka(0);
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
        const titleText = "KWITANSI KREDIT";
        doc.text(titleText, pageWidth / 2, curY, { align: "center" });
        const titleW = doc.getTextWidth(titleText);
        doc.setLineWidth(0.5); doc.line((pageWidth / 2) - (titleW / 2), curY + 1.5, (pageWidth / 2) + (titleW / 2), curY + 1.5); 
        
        curY += 8;
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        const leftL = 15; const leftC = 45; const leftV = 48;
        const rightL = 135; const rightC = 155; const rightV = 158;
        
        doc.text("Tanggal", leftL, curY); doc.text(":", leftC, curY); doc.text(data.tanggal ? data.tanggal.split('-').reverse().join('/') : '', leftV, curY);
        doc.text("No. BASTK", rightL, curY); doc.text(":", rightC, curY); doc.text(data.noBastk || '-', rightV, curY);
        curY += 5;
        doc.text("Leasing/Surveyor", leftL, curY); doc.text(":", leftC, curY); doc.text(data.leasing || '', leftV, curY);
        doc.text("No. Invoice", rightL, curY); doc.text(":", rightC, curY); doc.text(data.noInvoice || '', rightV, curY);
        curY += 5;
        doc.text("Di Terima dari", leftL, curY); doc.text(":", leftC, curY); doc.text(data.diterimaDari || '', leftV, curY);
        
        curY += 6;
        const col1 = 15, col2 = 25, col3 = 145, col4 = 200;
        const headerH = 10; 
        const rowH = 6;     
        
        doc.setFillColor(210, 230, 250); doc.setLineWidth(0.2); 
        doc.rect(col1, curY, col4 - col1, headerH, 'FD'); 
        doc.line(col2, curY, col2, curY + headerH); doc.line(col3, curY, col3, curY + headerH);
        doc.setFontSize(10); doc.setFont("helvetica", "bold");
        doc.text("No.", col1 + 5, curY + 6.5, {align: "center"}); 
        doc.text("Nama Barang", col2 + 3, curY + 6.5); 
        doc.text("Total Harga", col3 + 27, curY + 6.5, {align: "center"});
        curY += headerH;
        
        const motor = data.tipeMotor ? `(${data.tipeMotor})` : '';
        const rows = [
            { no: 1, name: `Off The Road ${motor}`, val: data.offTheRoad },
            { no: 2, name: `BBN ${motor}`, val: data.bbn },
            { no: 3, name: `OTR`, val: data.otr },
            { no: 4, name: `DP Gross (diinput ke Leasing)`, val: data.dpGross },
            { no: 5, name: `Diskon`, val: data.diskon },
            { no: 6, name: `Indent`, val: data.indent },
            { no: 7, name: `Accesoris`, val: data.accesoris },
            { no: 8, name: `Transfer`, val: data.transfer },
            { no: 9, name: `Potongan Lecet`, val: data.potonganLecet },
            { no: 10, name: `Sisa Uang Muka dibayar`, val: data.sisaUangMuka },
        ];
        
        const startTableBody = curY;
        rows.forEach((r) => {
            doc.setFontSize(9); doc.setFont("helvetica", "normal"); 
            doc.line(col1, curY, col4, curY);
            doc.text(r.no.toString(), col1 + 5, curY + 4, {align: "center"}); 
            doc.text(r.name, col2 + 3, curY + 4);
            doc.text("Rp", col3 + 3, curY + 4); 
            const valStr = r.val === 0 ? "-" : formatRupiah(r.val);
            doc.text(valStr, col4 - 3, curY + 4, { align: "right" });
            curY += rowH;
        });
        
        doc.rect(col1, startTableBody, col4 - col1, curY - startTableBody);
        doc.line(col2, startTableBody, col2, curY); doc.line(col3, startTableBody, col3, curY);
        
        curY += 24; 
        const konsX = 50; const kasirX = 165;
        doc.setFontSize(9); doc.setFont("helvetica", "bold");
        
        const namaKonsum = (data.diterimaDari || '........................').trim();
        doc.text(namaKonsum, konsX, curY, { align: "center" });
        const wKonsum = doc.getTextWidth(namaKonsum);
        doc.setLineWidth(0.3);
        doc.line(konsX - (wKonsum/2), curY + 1, konsX + (wKonsum/2), curY + 1); 
        doc.setFont("helvetica", "normal"); doc.text("Konsumen", konsX, curY + 5, { align: "center" });
        
        doc.setFont("helvetica", "bold");
        const namaKasir = (data.kasir || "STELY ARSYAD").trim();
        doc.text(namaKasir, kasirX, curY, { align: "center" });
        const wKasir = doc.getTextWidth(namaKasir);
        doc.line(kasirX - (wKasir/2), curY + 1, kasirX + (wKasir/2), curY + 1); 
        doc.setFont("helvetica", "normal"); doc.text("Kasir", kasirX, curY + 5, { align: "center" });
        
        return curY; 
    };
    
    let yAkhirAtas = drawReceipt(15); 
    const yGarisPembatas = yAkhirAtas + 12; 
    doc.setLineDashPattern([3, 3], 0); doc.setLineWidth(0.3);
    doc.line(10, yGarisPembatas, 205, yGarisPembatas);
    doc.setLineDashPattern([], 0); 
    
    let yAkhirBawah = drawReceipt(yGarisPembatas + 12); 
    const yGarisPembatasBawah = yAkhirBawah + 12;
    doc.setLineDashPattern([3, 3], 0); doc.setLineWidth(0.3);
    doc.line(10, yGarisPembatasBawah, 205, yGarisPembatasBawah);
    doc.setLineDashPattern([], 0); 

    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
  };

  // =========================================================================
  // SAKTI: FUNGSI FILTER DATA BERDASARKAN TANGGAL & PENCARIAN
  // =========================================================================
  const getFilteredData = () => {
    return historyData.filter((row) => {
      // 1. Filter Tanggal
      if (startDate && row.tanggal < startDate) return false;
      if (endDate && row.tanggal > endDate) return false;
      
      // 2. Filter Teks Pencarian
      if (!searchTerm) return true;
      const keyword = searchTerm.toLowerCase();
      const searchString = `${row?.noInvoice || ''} ${row?.diterimaDari || ''} ${row?.tipeMotor || ''} ${row?.kasir || ''}`.toLowerCase();
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

    let csvContent = `No. Invoice,Tanggal,Diterima Dari,Leasing,Tipe Motor,Kasir,OTR,BBN,Off The Road,DP Gross,Diskon,Indent,Accesoris,Transfer,Potongan Lecet,Sisa Uang Muka\n`;

    filteredHistoryData.forEach((row) => {
        const rowData = [
            `"${row.noInvoice}"`,
            `"${row.tanggal}"`,
            `"${row.diterimaDari}"`,
            `"${row.leasing}"`,
            `"${row.tipeMotor || '-'}"`,
            `"${row.kasir}"`,
            row.otr,
            row.bbn,
            row.offTheRoad,
            row.dpGross,
            row.diskon,
            row.indent,
            row.accesoris || 0,
            row.transfer,
            row.potonganLecet || 0,
            row.sisaUangMuka
        ].join(",");
        csvContent += rowData + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Laporan_Kwitansi_Kredit_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderModal = () => {
    if (!modal.isOpen) return null;
    return createPortal(
      <div className="ui-overlay">
        <div className="ui-modal">
          <div className="flex flex-col items-center text-center">
            {modal.type === 'success' ? <div className="ui-modal-icon-success"><CheckCircle2 className="w-6 h-6" /></div> : <div className="ui-modal-icon-danger"><AlertCircle className="w-6 h-6" /></div>}
            <h3 className="ui-modal-title">{modal.title}</h3>
            <p className="ui-modal-text">{modal.message}</p>
            <div className="flex w-full gap-3 justify-center">
              {modal.type === 'confirm_delete' ? <><button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="ui-btn-secondary flex-1">Batal</button><button onClick={() => executeDelete(modal.actionData)} className="ui-btn-danger flex-1">Ya, Hapus!</button></> : modal.type === 'success' ? <><button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="ui-btn-secondary flex-1">Tutup</button><button onClick={() => { generatePDF(modal.actionData); setModal({ isOpen: false, type: '', title: '', message: '', actionData: null }); }} className="ui-btn-primary flex-1"><Printer className="w-4 h-4" /> Cetak PDF</button></> : <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="ui-btn-primary w-full">Mengerti</button>}
            </div>
          </div>
        </div>
      </div>, document.body
    );
  };

  const inputClass = "ui-input";
  const numInputClass = "ui-input-number";
  const labelClass = "ui-label";

  return (
    <>
      {renderModal()}
      {isSubmitting && createPortal(
        <div className="ui-overlay z-[99998]">
          <div className="ui-modal max-w-sm flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center mb-4">
              <Receipt className="w-6 h-6 text-brand-fg animate-pulse" />
            </div>
            <h3 className="ui-modal-title">Memproses Kredit...</h3>
            <p className="text-sm text-stone-600 text-center">Menyimpan data dan menyiapkan PDF.</p>
          </div>
        </div>, document.body
      )}

      <div className="max-w-5xl mx-auto pb-12 space-y-6 relative">
        <div className="ui-card overflow-hidden">
          <div className="p-5 md:p-7">
            <h2 className="ui-page-title mb-7"><Receipt className="w-6 h-6 text-stone-500" /> {isEditing ? 'Edit Kwitansi Kredit' : 'Form Kwitansi Kredit'}</h2>
            <form onSubmit={handleSubmit} className="space-y-7">
              {!isEditing && (
                <div className="ui-panel p-4 relative">
                  <label className="ui-label flex items-center"><Search className="w-3.5 h-3.5 mr-1.5" /> Helper BASTK :</label>
                  <div className="relative w-full">
                    <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="ui-input flex items-center justify-between cursor-pointer hover:border-stone-400">
                      <span className="truncate">{pilihBastk ? `${bastkList.find(b => b?.noSurat === pilihBastk)?.namaKonsumen || ''} - ${pilihBastk}` : '-- Cari BASTK --'}</span>
                      <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                    {isDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1.5 bg-white border border-stone-200 rounded-lg shadow-lg max-h-72 flex flex-col overflow-hidden">
                        <div className="p-2 border-b border-stone-200 bg-stone-50">
                          <input autoFocus type="text" className="w-full h-9 px-3 bg-white border border-stone-300 rounded-md text-sm outline-none focus:border-brand" placeholder="Ketik Nama/No BASTK..." value={dropdownSearch} onChange={(e) => setDropdownSearch(e.target.value)} />
                        </div>
                        <div className="overflow-y-auto p-1 ui-scroll-thin">
                          <div className="px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 rounded-md cursor-pointer transition-colors" onClick={() => handleSelectBastk('')}><X className="w-4 h-4 inline mr-2" /> Batal / Kosongkan Pilihan</div>
                          {filteredBastk.map((b, idx) => (
                            <div key={`${b?.noSurat}-${idx}`} className="px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-100 rounded-md cursor-pointer transition-colors" onClick={() => handleSelectBastk(b?.noSurat)}>
                              <span className="font-semibold block text-stone-900">{b?.namaKonsumen}</span>
                              <span className="font-mono text-xs text-stone-500 block">{b?.noSurat}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <section className="grid grid-cols-1 md:grid-cols-4 gap-x-5 gap-y-4">
                <div><label className={labelClass}>No. Invoice</label><input type="text" value={noInvoice} onChange={(e)=>setNoInvoice(e.target.value)} required placeholder="KWI-001" className={inputClass} /></div>
                <div><label className={labelClass}>No. BASTK</label><input type="text" value={noBastk} onChange={(e)=>setNoBastk(e.target.value)} placeholder="001/..." className={inputClass} /></div>
                <div><label className={labelClass}>Tanggal</label><input type="date" value={tanggal} onChange={(e)=>setTanggal(e.target.value)} required className={inputClass} /></div>
                <div><label className={labelClass}>Leasing/Surveyor</label><input type="text" value={leasing} onChange={(e)=>setLeasing(e.target.value)} required placeholder="ADIRA / BUDI" className={inputClass} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Di Terima Dari</label><input type="text" value={diterimaDari} onChange={(e)=>setDiterimaDari(e.target.value)} required placeholder="NAMA KONSUMEN" className={inputClass} /></div>
                <div><label className={labelClass}>Nama Motor & Warna</label><input type="text" value={tipeMotor} onChange={(e)=>setTipeMotor(e.target.value)} required placeholder="(BEAT SPORTY CBS / BLACK)" className={inputClass} /></div>
                <div><label className={labelClass}>Nama Kasir</label><input type="text" value={kasir} onChange={(e)=>setKasir(e.target.value)} required placeholder="STELY ARSYAD" className={inputClass} /></div>
              </section>

              <section className="ui-panel p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-4">
                    <div><label className={labelClass}>3. OTR</label><input type="text" value={otr === 0 ? '' : formatRupiah(otr)} onChange={handleInputChange(setOtr)} className={numInputClass} placeholder="0" /></div>
                    <div><label className={labelClass}>2. BBN</label><input type="text" value={bbn === 0 ? '' : formatRupiah(bbn)} onChange={handleInputChange(setBbn)} className={numInputClass} placeholder="0" /></div>
                    <div><label className={labelClass}>1. Off The Road (Auto)</label><input type="text" value={offTheRoad === 0 ? '' : formatRupiah(offTheRoad)} readOnly className="ui-input-readonly" /></div>
                    <div><label className={labelClass}>7. Accesoris</label><input type="text" value={accesoris === 0 ? '' : formatRupiah(accesoris)} onChange={handleInputChange(setAccesoris)} className={numInputClass} placeholder="0" /></div>
                    <div><label className={labelClass}>9. Potongan Lecet</label><input type="text" value={potonganLecet === 0 ? '' : formatRupiah(potonganLecet)} onChange={handleInputChange(setPotonganLecet)} className={numInputClass} placeholder="0" /></div>
                </div>
                <div className="space-y-4">
                    <div><label className={labelClass}>4. DP Gross</label><input type="text" value={dpGross === 0 ? '' : formatRupiah(dpGross)} onChange={handleInputChange(setDpGross)} className={numInputClass} placeholder="0" /></div>
                    <div><label className={labelClass}>5. Diskon</label><input type="text" value={diskon === 0 ? '' : formatRupiah(diskon)} onChange={handleInputChange(setDiskon)} className={numInputClass} placeholder="0" /></div>
                    <div><label className={labelClass}>6. Indent</label><input type="text" value={indent === 0 ? '' : formatRupiah(indent)} onChange={handleInputChange(setIndent)} className={numInputClass} placeholder="0" /></div>
                    <div><label className={labelClass}>8. Transfer</label><input type="text" value={transfer === 0 ? '' : formatRupiah(transfer)} onChange={handleInputChange(setTransfer)} className={numInputClass} placeholder="0" /></div>
                    <div><label className={labelClass}>10. Sisa Uang Muka (Auto / Manual)</label><input type="text" value={sisaUangMuka === 0 ? '' : formatRupiah(sisaUangMuka)} onChange={handleInputChange(setSisaUangMuka)} className="ui-input-emphasis" placeholder="0" /></div>
                </div>
              </section>

              <div className="pt-6 border-t border-stone-200 flex flex-col sm:flex-row justify-end items-center gap-3">
                {isEditing && (
                  <button type="button" onClick={resetForm} className="ui-btn-secondary w-full sm:w-auto">
                    <X className="w-4 h-4" /> Batal Edit
                  </button>
                )}
                <button type="submit" disabled={isSubmitting} className="ui-btn-primary w-full sm:w-auto px-8">
                  {isSubmitting ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Memproses...</>
                  ) : isEditing ? (
                    <><Edit className="w-4 h-4" /> Update Invoice</>
                  ) : (
                    <><Receipt className="w-4 h-4" /> Simpan & Cetak Kwitansi</>
                  )}
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
                <Receipt className="w-4 h-4 text-stone-500" /> Riwayat Kwitansi Kredit
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
                  <th className="ui-th">Tipe Kendaraan</th>
                  <th className="ui-th text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredHistoryData.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="ui-empty">
                      Tidak ada data Kwitansi Kredit yang ditemukan.
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
                        <td className="ui-td text-xs text-stone-600 uppercase">{row?.tipeMotor || '-'}</td>
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
