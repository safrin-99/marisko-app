import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ScrollText, Edit, Trash2, RefreshCw, Clock, X, CheckCircle2, AlertCircle, Printer, FileText, Search, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getLogosSignedUrl } from '../lib/storage';
import { jsPDF } from "jspdf";

export default function NotaPage() {
  const [kategoriNota, setKategoriNota] = useState('PEMASUKAN');
  const [historyData, setHistoryData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState('');

  const [modal, setModal] = useState({ isOpen: false, type: '', title: '', message: '', actionData: null });
  const [isEditing, setIsEditing] = useState(false);
  const [originalId, setOriginalId] = useState('');

  // Form Fields
  const [noInvoice, setNoInvoice] = useState('');
  const [noBastk, setNoBastk] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [penerima, setPenerima] = useState('');
  const [kasir, setKasir] = useState('');
  
  const getInitialItems = () => Array.from({ length: 5 }, () => ({ nama: '', jumlah: '', warna: '', leasing: '', harga: 0 }));
  const [items, setItems] = useState(getInitialItems());

  // SAKTI: State untuk Pencarian dan Filter Tanggal
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const tabs = ['PEMASUKAN', 'PENGELUARAN', 'INSENTIF', 'MATERAI'];

  useEffect(() => {
    fetchLogo();
    fetchHistory();
    resetForm();
  }, [kategoriNota]);

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
    const { data, error } = await supabase
      .from('nota_history')
      .select('*')
      .eq('kategori', kategoriNota)
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data) setHistoryData(data);
    setIsLoading(false);
  };

  const formatRupiah = (number) => new Intl.NumberFormat('id-ID').format(number || 0);
  const parseNumber = (val) => {
    if (!val) return 0;
    const parsed = parseInt(val.toString().replace(/[^0-9]/g, ''), 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index] }; 
    if (field === 'harga') {
      newItems[index][field] = parseNumber(value);
    } else {
      newItems[index][field] = value.toUpperCase();
    }
    setItems(newItems);
  };

  const totalHarga = items.reduce((sum, item) => sum + (item.harga || 0), 0);

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
    if (!noInvoice || !tanggal || !kasir) {
      setModal({ isOpen: true, type: 'error', title: 'Data Belum Lengkap!', message: 'Mohon isi Nomor Invoice, Tanggal, dan Kasir.' });
      return;
    }

    if (totalHarga === 0) {
      setModal({ isOpen: true, type: 'error', title: 'Total Kosong!', message: 'Mohon isi minimal 1 baris barang beserta harganya.' });
      return;
    }

    setIsSubmitting(true);
    const cleanNo = noInvoice.trim();

    const formData = {
      kategori: kategoriNota,
      no_invoice: cleanNo,
      no_bastk: noBastk.trim(),
      tanggal,
      penerima: penerima.toUpperCase(),
      kasir: kasir.toUpperCase(),
      items: items,
      total: totalHarga
    };

    try {
      if (isEditing) {
        const { data: updated, error } = await supabase.from('nota_history').update(formData).eq('id', originalId).select();
        if (error) throw error;
        if (!updated || updated.length === 0) throw new Error('Data tidak ditemukan di database. Muat ulang halaman lalu coba lagi.');
        setModal({ isOpen: true, type: 'success', title: 'Berhasil Diupdate!', message: `Data Nota ${kategoriNota} diperbarui.`, actionData: formData });
        setIsEditing(false);
      } else {
        const { data: existing } = await supabase.from('nota_history').select('no_invoice').eq('kategori', kategoriNota).ilike('no_invoice', cleanNo);
        if (existing && existing.length > 0) {
          setIsSubmitting(false);
          setModal({ isOpen: true, type: 'error', title: 'Duplikasi!', message: `No. Invoice "${cleanNo}" sudah ada!` });
          return;
        }
        const { error } = await supabase.from('nota_history').insert([formData]);
        if (error) throw error;
        setModal({ isOpen: true, type: 'success', title: 'Berhasil Disimpan!', message: `Nota ${kategoriNota} siap dicetak.`, actionData: formData });
      }
      resetForm();
      fetchHistory();
    } catch (err) {
      setModal({ isOpen: true, type: 'error', title: 'Gagal', message: 'Koneksi database terputus / Tabel belum dibuat.' });
    }
    setIsSubmitting(false);
  };

  const handleEdit = (data) => {
    setIsEditing(true);
    setOriginalId(data.id);
    setKategoriNota(data.kategori);
    setNoInvoice(data.no_invoice);
    setNoBastk(data.no_bastk || '');
    setTanggal(data.tanggal);
    setPenerima(data.penerima || '');
    setKasir(data.kasir);
    
    let parsedItems = data.items;
    if (typeof parsedItems === 'string') {
      try { parsedItems = JSON.parse(parsedItems); } catch (e) { parsedItems = []; }
    }
    
    const newItems = getInitialItems();
    if (parsedItems && parsedItems.length > 0) {
      parsedItems.forEach((it, idx) => {
        if (idx < 5) newItems[idx] = { ...newItems[idx], ...it };
      });
    }
    setItems(newItems);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRequest = (id) => {
    setModal({ isOpen: true, type: 'confirm_delete', title: 'Hapus Nota?', message: 'Data ini akan dihapus permanen.', actionData: id });
  };

  const executeDelete = async (id) => {
    setModal({ isOpen: false, type: '', title: '', message: '', actionData: null });
    // SAKTI: Pastikan database benar-benar menghapus datanya sebelum bilang "Terhapus"
    const { data: deleted, error } = await supabase.from('nota_history').delete().eq('id', id).select();
    fetchHistory();
    if (error || !deleted || deleted.length === 0) {
      setModal({ isOpen: true, type: 'error', title: 'Gagal Menghapus', message: 'Nota belum terhapus. Periksa koneksi internet lalu coba lagi.', actionData: null });
      return;
    }
    setModal({ isOpen: true, type: 'success_delete', title: 'Terhapus!', message: 'Data Nota dihapus.', actionData: null });
  };

  const resetForm = () => {
    setNoInvoice(''); setNoBastk(''); setTanggal(''); setPenerima(''); setKasir('');
    setItems(getInitialItems());
    setIsEditing(false); setOriginalId('');
  };

  const generatePDF = (data) => {
    const doc = new jsPDF({ format: [215, 330], unit: 'mm' }); 
    const pageWidth = doc.internal.pageSize.width;
    
    let curY = 18; 

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
    const titleText = `NOTA ${data.kategori}`;
    doc.text(titleText, pageWidth / 2, curY, { align: "center" });
    const titleW = doc.getTextWidth(titleText);
    doc.setLineWidth(0.5); doc.line((pageWidth / 2) - (titleW / 2), curY + 1.5, (pageWidth / 2) + (titleW / 2), curY + 1.5); 
    
    curY += 10;
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    const leftL = 15; 
    const leftC = 40; 
    const leftV = 43; 
    
    const tglFormat = data.tanggal ? data.tanggal.split('-').reverse().join('/') : '';
    doc.text("Tanggal", leftL, curY); doc.text(":", leftC, curY); doc.text(tglFormat, leftV, curY);
    
    if (data.kategori === 'INSENTIF') {
        curY += 6;
        doc.text("No. BASTK", leftL, curY); doc.text(":", leftC, curY); doc.text(data.no_bastk || '-', leftV, curY);
    }
    curY += 6;
    doc.text("No. Invoice", leftL, curY); doc.text(":", leftC, curY); doc.text(data.no_invoice || '', leftV, curY);
    
    curY += 8; 

    const headerH = 10; 
    const rowH = 7;
    let col3, col4, col5;

    doc.setFillColor(210, 230, 250); doc.setLineWidth(0.2); 
    doc.rect(15, curY, 185, headerH, 'FD'); 
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("No.", 20, curY + 6.5, {align: "center"}); 
    doc.text("Nama Barang", 28, curY + 6.5); 
    
    if (data.kategori === 'INSENTIF') {
        col3 = 105; col4 = 140; col5 = 170;
        doc.line(col3, curY, col3, curY + headerH);
        doc.line(col4, curY, col4, curY + headerH);
        doc.line(col5, curY, col5, curY + headerH);
        doc.text("Warna", col3 + 3, curY + 6.5);
        doc.text("Leasing", col4 + 3, curY + 6.5);
        doc.text("Total Harga", col5 + 15, curY + 6.5, {align: "center"});
    } else {
        col3 = 145; col5 = 165;
        doc.line(col3, curY, col3, curY + headerH);
        doc.line(col5, curY, col5, curY + headerH);
        doc.text("Jumlah", col3 + 10, curY + 6.5, {align: "center"});
        doc.text("Total Harga", col5 + 17.5, curY + 6.5, {align: "center"});
    }
    doc.line(25, curY, 25, curY + headerH);
    curY += headerH;
    
    const startTableBody = curY;
    let parsedItems = data.items;
    if (typeof parsedItems === 'string') { try { parsedItems = JSON.parse(parsedItems); } catch(e){ parsedItems = []; } }

    for (let i = 0; i < 5; i++) {
        const item = parsedItems[i] || { nama: '', jumlah: '', warna: '', leasing: '', harga: 0 };
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); 
        doc.line(15, curY, 200, curY);
        doc.text((i + 1).toString(), 20, curY + 5, {align: "center"}); 
        doc.text(item.nama || '', 28, curY + 5);
        
        if (data.kategori === 'INSENTIF') {
            doc.text(item.warna || '', col3 + 3, curY + 5);
            doc.text(item.leasing || '', col4 + 3, curY + 5);
            if(item.harga > 0) {
                doc.text("Rp", col5 + 3, curY + 5); 
                doc.text(formatRupiah(item.harga), 197, curY + 5, { align: "right" });
            } 
        } else {
            doc.text(item.jumlah || '', col3 + 10, curY + 5, {align: "center"});
            if(item.harga > 0) {
                doc.text("Rp", col5 + 3, curY + 5); 
                doc.text(formatRupiah(item.harga), 197, curY + 5, { align: "right" });
            } 
        }
        curY += rowH;
    }

    doc.rect(15, startTableBody, 185, rowH * 5); 
    doc.line(25, startTableBody, 25, curY);
    if (data.kategori === 'INSENTIF') {
        doc.line(col3, startTableBody, col3, curY);
        doc.line(col4, startTableBody, col4, curY);
        doc.line(col5, startTableBody, col5, curY);
    } else {
        doc.line(col3, startTableBody, col3, curY);
        doc.line(col5, startTableBody, col5, curY);
    }

    doc.rect(15, curY, 185, rowH); 
    doc.setFont("helvetica", "bold");
    if (data.kategori === 'INSENTIF') {
         doc.text("TOTAL", col4 + 15, curY + 5, {align: "center"}); 
         doc.line(col5, curY, col5, curY + rowH);
         doc.text("Rp", col5 + 3, curY + 5);
         doc.text(formatRupiah(data.total), 197, curY + 5, { align: "right" });
    } else {
         doc.text("TOTAL", col3 + 10, curY + 5, {align: "center"});
         doc.line(col5, curY, col5, curY + rowH);
         doc.text("Rp", col5 + 3, curY + 5);
         doc.text(formatRupiah(data.total), 197, curY + 5, { align: "right" });
    }
    curY += rowH;
    
    curY += 24; 
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    const kasirX = 165;
    const penerimaX = 50;

    if (data.kategori === 'PENGELUARAN' || data.kategori === 'INSENTIF') {
        const namaPenerima = (data.penerima || '........................').trim();
        doc.text(namaPenerima, penerimaX, curY, { align: "center" });
        const wPenerima = doc.getTextWidth(namaPenerima);
        doc.setLineWidth(0.3);
        doc.line(penerimaX - (wPenerima/2), curY + 1, penerimaX + (wPenerima/2), curY + 1); 
        doc.setFont("helvetica", "normal"); doc.text("Penerima", penerimaX, curY + 5, { align: "center" });
    }

    doc.setFont("helvetica", "bold");
    const namaKasir = (data.kasir || "STELY ARSYAD").trim();
    doc.text(namaKasir, kasirX, curY, { align: "center" });
    const wKasir = doc.getTextWidth(namaKasir);
    doc.line(kasirX - (wKasir/2), curY + 1, kasirX + (wKasir/2), curY + 1); 
    doc.setFont("helvetica", "normal"); doc.text("Kasir", kasirX, curY + 5, { align: "center" });

    curY += 8; 
    doc.setLineDashPattern([3, 3], 0); doc.setLineWidth(0.3);
    doc.line(10, curY, 205, curY);
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
      const searchString = `${row?.no_invoice || ''} ${row?.penerima || ''} ${row?.kasir || ''}`.toLowerCase();
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

    let csvContent = `No. Invoice,Tanggal,Kasir,Penerima,Kategori,Total Nominal (Rp)\n`;

    filteredHistoryData.forEach((row) => {
        const rowData = [
            `"${row.no_invoice}"`,
            `"${row.tanggal}"`,
            `"${row.kasir}"`,
            `"${row.penerima || '-'}"`,
            `"${row.kategori}"`,
            row.total
        ].join(",");
        csvContent += rowData + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Laporan_Nota_${kategoriNota}_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const inputClass = "ui-input";
  const tableInputClass = "w-full h-10 px-2.5 bg-transparent border border-transparent rounded-md outline-none transition-colors text-stone-800 placeholder:text-stone-400 hover:border-stone-200 focus:border-brand focus:bg-white focus:ring-3 focus:ring-brand/10";

  return (
    <>
      {modal.isOpen && createPortal(
        <div className="ui-overlay">
          <div className="absolute inset-0" onClick={() => setModal({ isOpen: false })}></div>
          <div className="ui-modal">
            <div className="flex flex-col items-center text-center">
              {modal.type === 'success' || modal.type === 'success_delete' ? <div className="ui-modal-icon-success"><CheckCircle2 className="w-6 h-6" /></div> : <div className="ui-modal-icon-danger"><AlertCircle className="w-6 h-6" /></div>}
              <h3 className="ui-modal-title">{modal.title}</h3>
              <p className="ui-modal-text">{modal.message}</p>
              <div className="flex w-full gap-3 justify-center flex-col sm:flex-row">
                {modal.type === 'confirm_delete' ? <><button onClick={() => setModal({ isOpen: false })} className="ui-btn-secondary flex-1">Batal</button><button onClick={() => executeDelete(modal.actionData)} className="ui-btn-danger flex-1">Ya, Hapus!</button></> : modal.type === 'success' ? <><button onClick={() => setModal({ isOpen: false })} className="ui-btn-secondary flex-1">Tutup</button><button onClick={() => { generatePDF(modal.actionData); setModal({ isOpen: false }); }} className="ui-btn-primary flex-1"><Printer className="w-4 h-4" /> Cetak PDF</button></> : <button onClick={() => setModal({ isOpen: false })} className="ui-btn-primary w-full">Mengerti</button>}
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      {/* =======================================================================
          SAKTI: CARD LOADING SUDAH DISERAGAMKAN UKURANNYA! (max-w-sm w-full mx-4)
          ======================================================================= */}
      {isSubmitting && createPortal(
        <div className="ui-overlay z-[99998]">
          <div className="ui-modal max-w-sm flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center mb-4">
              <ScrollText className="w-6 h-6 text-brand-fg animate-pulse" />
            </div>
            <h3 className="ui-modal-title">Memproses Nota...</h3>
            <p className="text-sm text-stone-600 text-center">Menyimpan data dan menyiapkan PDF.</p>
          </div>
        </div>, document.body
      )}

      <div className="max-w-5xl mx-auto pb-12 space-y-6 relative">
        <div className="ui-card overflow-hidden">
          <div className="p-5 md:p-7">
            <div className="mb-7 flex justify-between items-start gap-4">
              <div><h2 className="ui-page-title"><ScrollText className="w-6 h-6 text-stone-500" /> {isEditing ? `Edit Nota ${kategoriNota}` : 'Pembuatan Nota'}</h2></div>
              {isEditing && <span className="ui-badge-warning px-2 py-1"><Edit className="w-3.5 h-3.5" /> Sedang Mengedit</span>}
            </div>

            <form onSubmit={handleSubmit} className="space-y-7">
              <div className="ui-panel p-4 sm:p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                  {tabs.map(tab => (
                    <button key={tab} type="button" onClick={() => { if(!isEditing) setKategoriNota(tab); }} className={`${kategoriNota === tab ? 'ui-choice-active' : 'ui-choice'} ${isEditing && kategoriNota !== tab ? 'opacity-40 cursor-not-allowed hover:bg-white' : ''}`}>{tab}</button>
                  ))}
                </div>
              </div>

              <section className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                <div><label className="ui-label">No. Invoice</label><input type="text" value={noInvoice} onChange={(e)=>setNoInvoice(e.target.value)} required placeholder="INV-001" className={inputClass} /></div>
                <div><label className="ui-label">Tanggal</label><input type="date" value={tanggal} onChange={(e)=>setTanggal(e.target.value)} required className={inputClass} /></div>

                {kategoriNota === 'INSENTIF' && (
                  <div><label className="ui-label">No. BASTK (Opsional)</label><input type="text" value={noBastk} onChange={(e)=>setNoBastk(e.target.value)} placeholder="001/..." className={inputClass} /></div>
                )}

                {(kategoriNota === 'PENGELUARAN' || kategoriNota === 'INSENTIF') && (
                  <div><label className="ui-label">Nama Penerima</label><input type="text" value={penerima} onChange={(e)=>setPenerima(e.target.value)} placeholder="EVA" className={inputClass} /></div>
                )}

                <div><label className="ui-label">Nama Kasir</label><input type="text" value={kasir} onChange={(e)=>setKasir(e.target.value)} required placeholder="STELY ARSYAD" className={inputClass} /></div>
              </section>

              <div className="mt-7">
                <h3 className="ui-label mb-2.5">Rincian Barang / Transaksi</h3>
                <div className="border border-stone-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto ui-scroll-thin">
                      <table className="w-full text-sm text-left min-w-[600px] whitespace-nowrap">
                         <thead className="bg-stone-50 text-[11px] uppercase tracking-[0.06em] text-stone-600 font-semibold border-b border-stone-200">
                            <tr>
                               <th className="px-4 py-2.5 w-12 text-center">No</th>
                               <th className="px-4 py-2.5 border-l border-stone-200">Nama Barang</th>
                               {kategoriNota === 'INSENTIF' ? (
                                  <>
                                    <th className="px-4 py-2.5 w-32 border-l border-stone-200">Warna</th>
                                    <th className="px-4 py-2.5 w-32 border-l border-stone-200">Leasing</th>
                                  </>
                               ) : (
                                  <th className="px-4 py-2.5 w-28 text-center border-l border-stone-200">Jumlah</th>
                               )}
                               <th className="px-4 py-2.5 w-48 text-right border-l border-stone-200">Harga (Rp)</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-stone-100">
                            {items.map((item, index) => (
                               <tr key={index} className="bg-white">
                                  <td className="px-4 py-1.5 text-center font-mono text-xs text-stone-500 border-r border-stone-100">{index + 1}</td>
                                  <td className="px-1.5 py-1 border-r border-stone-100"><input value={item.nama} onChange={(e) => handleItemChange(index, 'nama', e.target.value)} className={tableInputClass} placeholder="..." /></td>
                                  {kategoriNota === 'INSENTIF' ? (
                                      <>
                                        <td className="px-1.5 py-1 border-r border-stone-100"><input value={item.warna} onChange={(e) => handleItemChange(index, 'warna', e.target.value)} className={tableInputClass} placeholder="..." /></td>
                                        <td className="px-1.5 py-1 border-r border-stone-100"><input value={item.leasing} onChange={(e) => handleItemChange(index, 'leasing', e.target.value)} className={tableInputClass} placeholder="..." /></td>
                                      </>
                                  ) : (
                                        <td className="px-1.5 py-1 border-r border-stone-100"><input value={item.jumlah} onChange={(e) => handleItemChange(index, 'jumlah', e.target.value)} className={`${tableInputClass} text-center`} placeholder="0" /></td>
                                  )}
                                  <td className="px-1.5 py-1"><input value={item.harga === 0 ? '' : formatRupiah(item.harga)} onChange={(e) => handleItemChange(index, 'harga', e.target.value)} className={`${tableInputClass} text-right font-mono font-semibold text-stone-900`} placeholder="0" /></td>
                               </tr>
                            ))}
                         </tbody>
                         <tfoot className="bg-stone-50 border-t border-stone-200">
                            <tr>
                               <td colSpan={kategoriNota === 'INSENTIF' ? 4 : 3} className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-600">TOTAL KESELURUHAN</td>
                               <td className="px-4 py-3.5 text-right font-mono text-base font-semibold text-stone-900">Rp {formatRupiah(totalHarga)}</td>
                            </tr>
                         </tfoot>
                      </table>
                    </div>
                </div>
              </div>

              <div className="pt-6 border-t border-stone-200 flex flex-col sm:flex-row justify-end items-center gap-3">
                {isEditing && (
                  <button type="button" onClick={resetForm} className="ui-btn-secondary w-full sm:w-auto">
                    <X className="w-4 h-4" /> Batal Edit
                  </button>
                )}
                <button type="submit" disabled={isSubmitting} className="ui-btn-primary w-full sm:w-auto px-8">
                  {isSubmitting ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Memproses...</>
                  ) : (
                    <><ScrollText className="w-4 h-4" /> {isEditing ? `Update Nota` : `Simpan & Cetak Nota ${kategoriNota}`}</>
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
              <h3 className="ui-card-title">
                <ScrollText className="w-4 h-4 text-stone-500" /> Riwayat Nota {kategoriNota}
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
                  placeholder="Cari No / Penerima / Kasir..."
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
            <table className="ui-table min-w-[900px] lg:min-w-full">
              <thead className="ui-thead">
                <tr>
                  <th className="ui-th">No. Invoice & Waktu</th>
                  <th className="ui-th">Kasir / Penerima</th>
                  <th className="ui-th">Total Nominal</th>
                  <th className="ui-th text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredHistoryData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="ui-empty">
                      Tidak ada data nota yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredHistoryData.map((row) => {
                    const { date, time } = formatDateTime(row.created_at, row.tanggal);
                    return (
                      <tr key={row.id} className="ui-tr">
                        <td className="ui-td whitespace-nowrap">
                          <div className="ui-docno">{row.no_invoice}</div>
                          <div className="flex items-center mt-0.5">
                            <span className="text-xs text-stone-600 mr-2">{date}</span>
                              <div className="flex items-center text-xs text-stone-500">
                                <Clock className="w-3.5 h-3.5 mr-1" /> Jam: {time}
                              </div>
                          </div>
                        </td>
                        <td className="ui-td font-semibold text-stone-900 uppercase whitespace-nowrap">
                          {row.kasir} {row.penerima && <><br/><span className="text-xs font-normal text-stone-500">Penerima: {row.penerima}</span></>}
                        </td>
                        <td className="ui-td font-mono text-sm font-semibold text-stone-900 whitespace-nowrap">Rp {formatRupiah(row.total)}</td>
                        <td className="ui-td whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => generatePDF(row)} className="ui-action"><FileText className="w-3.5 h-3.5" /> PDF</button>
                            <button onClick={() => handleEdit(row)} className="ui-action"><Edit className="w-3.5 h-3.5" /> Edit</button>
                            <button onClick={() => handleDeleteRequest(row.id)} className="ui-action-danger"><Trash2 className="w-3.5 h-3.5" /> Del</button>
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
