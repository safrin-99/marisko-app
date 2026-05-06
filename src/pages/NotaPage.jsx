import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ScrollText, Edit, Trash2, RefreshCw, Clock, X, CheckCircle2, AlertCircle, Printer, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
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

  const tabs = ['PEMASUKAN', 'PENGELUARAN', 'INSENTIF', 'MATERAI'];

  useEffect(() => {
    fetchLogo();
    fetchHistory();
    resetForm();
  }, [kategoriNota]);

  const fetchLogo = async () => {
    try {
      const { data } = await supabase.from('dealer_settings').select('*').eq('id', 1).single();
      if (data?.logo_url) {
        const response = await fetch(data.logo_url, { cache: 'no-cache' });
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
        await supabase.from('nota_history').update(formData).eq('id', originalId);
        setModal({ isOpen: true, type: 'success', title: 'Berhasil Diupdate!', message: `Data Nota ${kategoriNota} diperbarui.`, actionData: formData });
        setIsEditing(false);
      } else {
        const { data: existing } = await supabase.from('nota_history').select('no_invoice').eq('kategori', kategoriNota).ilike('no_invoice', cleanNo);
        if (existing && existing.length > 0) {
          setIsSubmitting(false);
          setModal({ isOpen: true, type: 'error', title: 'Duplikasi!', message: `No. Invoice "${cleanNo}" sudah ada!` });
          return;
        }
        await supabase.from('nota_history').insert([formData]);
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
    await supabase.from('nota_history').delete().eq('id', id);
    fetchHistory();
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
    let curY = 12;

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

  const inputClass = "w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-400";
  const tableInputClass = "w-full h-10 px-3 bg-transparent border-0 border-b border-transparent focus:border-indigo-300 focus:bg-white rounded outline-none transition-all font-medium text-slate-700";

  return (
    <>
      {modal.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setModal({ isOpen: false })}></div>
          <div className="bg-white rounded-4xl shadow-2xl w-full max-w-md p-8 relative z-10 animate-in zoom-in-95 fade-in duration-300">
            <div className="flex flex-col items-center text-center mt-2">
              {modal.type === 'success' || modal.type === 'success_delete' ? <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 text-indigo-600"><CheckCircle2 className="w-10 h-10" /></div> : <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 text-rose-600"><AlertCircle className="w-10 h-10" /></div>}
              <h3 className="text-2xl font-extrabold text-slate-900 mb-2">{modal.title}</h3>
              <p className="text-slate-500 font-medium mb-8">{modal.message}</p>
              <div className="flex w-full gap-3 justify-center flex-col sm:flex-row">
                {modal.type === 'confirm_delete' ? <><button onClick={() => setModal({ isOpen: false })} className="flex-1 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl active:scale-95 transition-all">Batal</button><button onClick={() => executeDelete(modal.actionData)} className="flex-1 py-3.5 bg-rose-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all">Ya, Hapus!</button></> : modal.type === 'success' ? <><button onClick={() => setModal({ isOpen: false })} className="flex-1 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl active:scale-95 transition-all">Tutup</button><button onClick={() => { generatePDF(modal.actionData); setModal({ isOpen: false }); }} className="flex-1 py-3.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-all"><Printer className="w-4 h-4 mr-2" /> Cetak PDF</button></> : <button onClick={() => setModal({ isOpen: false })} className="w-full py-3.5 bg-slate-950 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all">Mengerti</button>}
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      {isSubmitting && createPortal(
        <div className="fixed inset-0 z-[99998] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center animate-in zoom-in-95">
            <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-600/30 mb-6 animate-bounce"><ScrollText className="w-10 h-10 text-white animate-pulse" /></div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-2">Memproses Nota...</h3>
          </div>
        </div>, document.body
      )}

      <div className="max-w-5xl mx-auto pb-12 space-y-8 relative">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="mb-8 flex justify-between items-start">
              <div><h2 className="text-2xl font-bold text-slate-900 mb-2 flex items-center"><ScrollText className="w-7 h-7 mr-3 text-indigo-600" /> {isEditing ? `Edit Nota ${kategoriNota}` : 'Pembuatan Nota'}</h2></div>
              {isEditing && <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-bold flex items-center"><Edit className="w-3.5 h-3.5 mr-1.5" /> Sedang Mengedit</span>}
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {tabs.map(tab => (
                    <button key={tab} type="button" onClick={() => { if(!isEditing) setKategoriNota(tab); }} className={`h-12 rounded-xl font-bold text-xs transition-all border ${kategoriNota === tab ? 'bg-slate-950 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'} ${isEditing && kategoriNota !== tab ? 'opacity-50 cursor-not-allowed' : ''}`}>{tab}</button>
                  ))}
                </div>
              </div>

              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase">No. Invoice</label><input type="text" value={noInvoice} onChange={(e)=>setNoInvoice(e.target.value)} required placeholder="INV-001" className={inputClass} /></div>
                <div><label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase">Tanggal</label><input type="date" value={tanggal} onChange={(e)=>setTanggal(e.target.value)} required className={inputClass} /></div>
                
                {kategoriNota === 'INSENTIF' && (
                  <div><label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase">No. BASTK (Opsional)</label><input type="text" value={noBastk} onChange={(e)=>setNoBastk(e.target.value)} placeholder="001/..." className={inputClass} /></div>
                )}
                
                {(kategoriNota === 'PENGELUARAN' || kategoriNota === 'INSENTIF') && (
                  <div><label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase">Nama Penerima</label><input type="text" value={penerima} onChange={(e)=>setPenerima(e.target.value)} placeholder="EVA" className={inputClass} /></div>
                )}
                
                <div><label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase">Nama Kasir</label><input type="text" value={kasir} onChange={(e)=>setKasir(e.target.value)} required placeholder="STELY ARSYAD" className={inputClass} /></div>
              </section>

              <div className="mt-8">
                <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Rincian Barang / Transaksi</h3>
                <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-inner">
                    {/* SAKTI: Tambahan overflow agar tabel input tidak menyusut di HP */}
                    <div className="overflow-x-auto scrollbar-thin">
                      <table className="w-full text-sm text-left min-w-[600px] whitespace-nowrap">
                         <thead className="bg-slate-100 text-[11px] uppercase text-slate-500 font-extrabold border-b border-slate-200">
                            <tr>
                               <th className="px-4 py-3 w-12 text-center">No</th>
                               <th className="px-4 py-3 border-l border-slate-200">Nama Barang</th>
                               {kategoriNota === 'INSENTIF' ? (
                                  <>
                                    <th className="px-4 py-3 w-32 border-l border-slate-200">Warna</th>
                                    <th className="px-4 py-3 w-32 border-l border-slate-200">Leasing</th>
                                  </>
                               ) : (
                                  <th className="px-4 py-3 w-28 text-center border-l border-slate-200">Jumlah</th>
                               )}
                               <th className="px-4 py-3 w-48 text-right border-l border-slate-200">Harga (Rp)</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-200">
                            {items.map((item, index) => (
                               <tr key={index} className="bg-white hover:bg-slate-50/50 transition-colors">
                                  <td className="px-4 py-2 text-center font-bold text-slate-400 border-r border-slate-100">{index + 1}</td>
                                  <td className="px-2 py-1 border-r border-slate-100"><input value={item.nama} onChange={(e) => handleItemChange(index, 'nama', e.target.value)} className={tableInputClass} placeholder="..." /></td>
                                  {kategoriNota === 'INSENTIF' ? (
                                      <>
                                        <td className="px-2 py-1 border-r border-slate-100"><input value={item.warna} onChange={(e) => handleItemChange(index, 'warna', e.target.value)} className={tableInputClass} placeholder="..." /></td>
                                        <td className="px-2 py-1 border-r border-slate-100"><input value={item.leasing} onChange={(e) => handleItemChange(index, 'leasing', e.target.value)} className={tableInputClass} placeholder="..." /></td>
                                      </>
                                  ) : (
                                        <td className="px-2 py-1 border-r border-slate-100"><input value={item.jumlah} onChange={(e) => handleItemChange(index, 'jumlah', e.target.value)} className={`${tableInputClass} text-center`} placeholder="0" /></td>
                                  )}
                                  <td className="px-2 py-1"><input value={item.harga === 0 ? '' : formatRupiah(item.harga)} onChange={(e) => handleItemChange(index, 'harga', e.target.value)} className={`${tableInputClass} text-right font-bold text-indigo-700`} placeholder="0" /></td>
                               </tr>
                            ))}
                         </tbody>
                         <tfoot className="bg-indigo-50/50 font-bold text-slate-700 border-t-2 border-slate-200">
                            <tr>
                               <td colSpan={kategoriNota === 'INSENTIF' ? 4 : 3} className="px-6 py-4 text-right tracking-widest text-xs">TOTAL KESELURUHAN</td>
                               <td className="px-5 py-4 text-right text-indigo-700 text-lg">Rp {formatRupiah(totalHarga)}</td>
                            </tr>
                         </tfoot>
                      </table>
                    </div>
                </div>
              </div>

              {/* SAKTI: Tombol aksi disesuaikan memanjang rapi di HP */}
              <div className="flex justify-center gap-3 sm:gap-4 pt-6 border-t border-slate-100 flex-col sm:flex-row">
                {isEditing && (
                  <button type="button" onClick={resetForm} className="px-6 sm:px-8 py-3 sm:py-3.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all duration-200 active:scale-95 shadow-sm flex items-center justify-center w-full sm:w-auto">
                    <X className="w-4 h-4 mr-2" /> Batal Edit
                  </button>
                )}
                <button type="submit" disabled={isSubmitting} className={`px-8 sm:px-12 py-3 sm:py-3.5 text-white rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 shadow-lg tracking-wide flex items-center justify-center w-full sm:w-auto ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-950 hover:bg-slate-800'}`}>
                  {isSubmitting ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Memproses...</>
                  ) : (
                    <><ScrollText className="w-5 h-5 mr-2" /> {isEditing ? `Update Nota` : `Simpan & Cetak Nota ${kategoriNota}`}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          {/* SAKTI: Bagian Judul dan Tombol Segarkan Data disesuaikan untuk layar HP dan Desktop */}
          <div className="bg-slate-50/80 border-b border-slate-200 p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5">
            <h3 className="text-lg font-bold text-slate-800 flex items-center"><ScrollText className="w-5 h-5 mr-2 text-indigo-600" /> Riwayat Nota {kategoriNota}</h3>
            <button onClick={fetchHistory} className="w-full sm:w-auto flex items-center justify-center text-xs font-bold text-slate-700 bg-white border border-slate-300 px-4 py-2.5 rounded-xl active:scale-95 shadow-sm hover:bg-slate-100 transition-all duration-200">
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
          
          <div className="overflow-x-auto max-h-[420px] scrollbar-thin">
            {/* SAKTI: Tambahan whitespace-nowrap pada tag table */}
            <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
              <thead className="text-[11px] text-slate-500 uppercase sticky top-0 z-10 bg-slate-100 shadow-sm">
                <tr className="border-b border-slate-200">
                  <th className="px-6 py-4 font-bold tracking-wider">No. Invoice & Waktu</th>
                  <th className="px-6 py-4 font-bold tracking-wider">Kasir / Penerima</th>
                  <th className="px-6 py-4 font-bold tracking-wider">Total Nominal</th>
                  <th className="px-6 py-4 font-bold tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyData.map((row) => {
                    const { date, time } = formatDateTime(row.created_at, row.tanggal);
                    return (
                    <tr key={row.id} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="font-extrabold text-slate-900">{row.no_invoice}</div>
                        <div className="flex items-center mt-1">
                          <span className="text-[11px] font-bold text-slate-700 mr-2">{date}</span>
                            <div className="flex items-center text-[11px] font-medium text-slate-400">
                              <Clock className="w-3.5 h-3.5 mr-1" /> Jam: {time}
                            </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 font-bold text-slate-700 uppercase whitespace-nowrap">
                        {row.kasir} {row.penerima && <><br/><span className="text-xs text-slate-400">Penerima: {row.penerima}</span></>}
                      </td>
                      <td className="px-6 py-5 text-sm font-black text-indigo-700 whitespace-nowrap">Rp {formatRupiah(row.total)}</td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2.5">
                          <button onClick={() => generatePDF(row)} className="flex items-center px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg active:scale-95 font-bold text-xs border border-emerald-200 transition-all duration-200"><FileText className="w-3.5 h-3.5 mr-1" /> PDF</button>
                          <button onClick={() => handleEdit(row)} className="flex items-center px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg active:scale-95 font-bold text-xs border border-indigo-200 transition-all duration-200"><Edit className="w-3.5 h-3.5 mr-1" /> Edit</button>
                          <button onClick={() => handleDeleteRequest(row.id)} className="flex items-center px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg active:scale-95 font-bold text-xs border border-rose-200 transition-all duration-200"><Trash2 className="w-3.5 h-3.5 mr-1" /> Del</button>
                        </div>
                      </td>
                    </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}