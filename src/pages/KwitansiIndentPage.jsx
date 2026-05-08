import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardSignature, Edit, Trash2, RefreshCw, Clock, X, CheckCircle2, AlertCircle, Printer, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { jsPDF } from "jspdf";

export default function KwitansiIndentPage() {
  const [historyData, setHistoryData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState('');

  const [modal, setModal] = useState({ isOpen: false, type: '', title: '', message: '', actionData: null });
  const [isEditing, setIsEditing] = useState(false);
  const [originalId, setOriginalId] = useState('');

  // Form Fields 100% Asli
  const [noInvoice, setNoInvoice] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [diterimaDari, setDiterimaDari] = useState('');
  const [namaKasir, setNamaKasir] = useState('');
  const [tipeMotor, setTipeMotor] = useState('');
  const [jenisIndent, setJenisIndent] = useState('');
  const [nominal, setNominal] = useState('');

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    fetchLogo();
    fetchHistory();
  }, []);

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
      .from('kwitansi_indent_history')
      .select('*')
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

  const handleNominalChange = (e) => {
    const val = parseNumber(e.target.value);
    setNominal(val === 0 ? '' : val);
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
    if (!noInvoice || !tanggal || !diterimaDari || !namaKasir || !jenisIndent || !nominal) {
      setModal({ isOpen: true, type: 'error', title: 'Data Belum Lengkap!', message: 'Mohon lengkapi semua field yang wajib diisi.' });
      return;
    }

    setIsSubmitting(true);
    const cleanNo = noInvoice.trim();

    const formData = {
      noInvoice: cleanNo,
      tanggal,
      diterimaDari: diterimaDari.toUpperCase(),
      namaKasir: namaKasir.toUpperCase(),
      tipeMotor: tipeMotor.toUpperCase(),
      jenisIndent: jenisIndent.toUpperCase(),
      nominal: Number(nominal)
    };

    try {
      if (isEditing) {
        await supabase.from('kwitansi_indent_history').update(formData).eq('id', originalId);
        setModal({ isOpen: true, type: 'success', title: 'Berhasil Diupdate!', message: `Data Kwitansi Indent diperbarui.`, actionData: formData });
        setIsEditing(false);
      } else {
        const { data: existing } = await supabase.from('kwitansi_indent_history').select('noInvoice').ilike('noInvoice', cleanNo);
        if (existing && existing.length > 0) {
          setIsSubmitting(false);
          setModal({ isOpen: true, type: 'error', title: 'Duplikasi!', message: `No. Invoice "${cleanNo}" sudah ada!` });
          return;
        }
        await supabase.from('kwitansi_indent_history').insert([formData]);
        setModal({ isOpen: true, type: 'success', title: 'Berhasil Disimpan!', message: `Kwitansi Indent siap dicetak.`, actionData: formData });
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
    setNoInvoice(data.noInvoice);
    setTanggal(data.tanggal);
    setDiterimaDari(data.diterimaDari);
    setNamaKasir(data.namaKasir);
    setTipeMotor(data.tipeMotor || '');
    setJenisIndent(data.jenisIndent);
    setNominal(data.nominal);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRequest = (id) => {
    setModal({ isOpen: true, type: 'confirm_delete', title: 'Hapus Kwitansi?', message: 'Data ini akan dihapus permanen.', actionData: id });
  };

  const executeDelete = async (id) => {
    setModal({ isOpen: false, type: '', title: '', message: '', actionData: null });
    await supabase.from('kwitansi_indent_history').delete().eq('id', id);
    fetchHistory();
    setModal({ isOpen: true, type: 'success_delete', title: 'Terhapus!', message: 'Data Kwitansi dihapus.', actionData: null });
  };

  const resetForm = () => {
    setNoInvoice(''); setTanggal(''); setDiterimaDari(''); setNamaKasir(''); 
    setTipeMotor(''); setJenisIndent(''); setNominal('');
    setIsEditing(false); setOriginalId('');
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
        doc.text("Nama Barang", col2 + 3, curY + 6.5); 
        doc.text("Total Harga", col3 + 27, curY + 6.5, {align: "center"});
        curY += headerH;
        
        // SAKTI: HANYA MENAMPILKAN NAMA MOTOR DI BARIS PERTAMA!
        const motor = data.tipeMotor ? data.tipeMotor : '-';
        
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
        
        curY += 24; const konsX = 50; const kasirX = 165;
        doc.setFontSize(9); doc.setFont("helvetica", "bold");
        
        const namaKonsum = (data.diterimaDari || '........................').trim();
        doc.text(namaKonsum, konsX, curY, { align: "center" });
        const wKonsum = doc.getTextWidth(namaKonsum);
        doc.setLineWidth(0.3);
        doc.line(konsX - (wKonsum/2), curY + 1, konsX + (wKonsum/2), curY + 1); 
        doc.setFont("helvetica", "normal"); doc.text("Konsumen", konsX, curY + 5, { align: "center" });
        
        doc.setFont("helvetica", "bold");
        const kasirTxt = (data.namaKasir || "STELY ARSYAD").trim();
        doc.text(kasirTxt, kasirX, curY, { align: "center" });
        const wKasir = doc.getTextWidth(kasirTxt);
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

  const renderModal = () => {
    if (!modal.isOpen) return null;
    return createPortal(
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all duration-300">
        <div className="bg-white rounded-4xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-300 border border-slate-100">
          <div className="flex flex-col items-center text-center mt-2">
            {modal.type === 'success' || modal.type === 'success_delete' ? <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 text-indigo-600 shadow-inner"><CheckCircle2 className="w-10 h-10" /></div> : <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 text-rose-600 shadow-inner"><AlertCircle className="w-10 h-10" /></div>}
            <h3 className="text-2xl font-extrabold text-slate-900 mb-2">{modal.title}</h3>
            <p className="text-slate-500 font-medium mb-8">{modal.message}</p>
            <div className="flex w-full gap-3 justify-center">
              {modal.type === 'confirm_delete' ? <><button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="flex-1 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl active:scale-95 transition-all">Batal</button><button onClick={() => executeDelete(modal.actionData)} className="flex-1 py-3.5 bg-rose-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all">Ya, Hapus!</button></> : modal.type === 'success' ? <><button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="flex-1 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl active:scale-95 transition-all">Tutup</button><button onClick={() => { generatePDF(modal.actionData); setModal({ isOpen: false, type: '', title: '', message: '', actionData: null }); }} className="flex-1 py-3.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-all"><Printer className="w-4 h-4 mr-2" /> Cetak PDF</button></> : <button onClick={() => setModal({ isOpen: false, type: '', title: '', message: '', actionData: null })} className="w-full py-3.5 bg-slate-950 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all">Mengerti</button>}
            </div>
          </div>
        </div>
      </div>, document.body
    );
  };

  const inputClass = "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-amber-500 outline-none transition-all placeholder:text-slate-400";
  const numInputClass = "w-full h-14 px-4 bg-amber-50/50 border border-amber-200 rounded-xl text-2xl font-black text-amber-700 text-right focus:bg-white focus:border-amber-500 outline-none transition-all placeholder:text-slate-300";
  const labelClass = "block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider";

  return (
    <>
      {renderModal()}
      
      {isSubmitting && createPortal(
        <div className="fixed inset-0 z-[99998] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-300 border border-slate-100 max-w-sm w-full mx-4">
            <div className="w-20 h-20 bg-amber-500 rounded-2xl flex items-center justify-center shadow-xl shadow-amber-500/30 mb-6 animate-bounce">
              <ClipboardSignature className="w-10 h-10 text-white animate-pulse" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-2">Memproses INDENT...</h3>
            <p className="text-sm font-medium text-slate-500 text-center">Menyimpan data dan menyiapkan PDF.</p>
          </div>
        </div>, document.body
      )}

      <div className="max-w-4xl mx-auto pb-12 space-y-8 relative">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 relative">
          <div className="p-6 md:p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-8 flex items-center"><ClipboardSignature className="w-7 h-7 mr-3 text-amber-500" /> {isEditing ? 'Edit Kwitansi Indent' : 'Form Kwitansi Indent'}</h2>
            <form onSubmit={handleSubmit} className="space-y-8">

              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className={labelClass}>No. Invoice (Manual)</label><input type="text" value={noInvoice} onChange={(e)=>setNoInvoice(e.target.value)} required placeholder="IND-001" className={inputClass} /></div>
                <div><label className={labelClass}>Tanggal</label><input type="date" value={tanggal} onChange={(e)=>setTanggal(e.target.value)} required className={inputClass} /></div>
                <div><label className={labelClass}>Di Terima Dari (Konsumen)</label><input type="text" value={diterimaDari} onChange={(e)=>setDiterimaDari(e.target.value)} required placeholder="NAMA LENGKAP" className={inputClass} /></div>
                <div><label className={labelClass}>Nama Kasir</label><input type="text" value={namaKasir} onChange={(e)=>setNamaKasir(e.target.value)} required placeholder="STELY ARSYAD" className={inputClass} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Tipe Motor & Warna</label><input type="text" value={tipeMotor} onChange={(e)=>setTipeMotor(e.target.value)} placeholder="(PCX160 ABS / BLUE)" className={inputClass} /></div>
              </section>

              <section className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    
                    <div className="relative">
                        <label className={labelClass}>Jenis Indent</label>
                        {isDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>}
                        <div 
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className={`w-full h-14 px-5 bg-white border-2 hover:border-amber-400 rounded-xl text-sm font-black flex items-center justify-between cursor-pointer transition-all shadow-sm ${jenisIndent ? 'border-amber-500 text-amber-700' : 'border-slate-200 text-slate-400'}`}
                        >
                          <span>{jenisIndent || '-- Pilih Jenis Indent --'}</span>
                          <ChevronDown className={`w-5 h-5 transition-transform ${isDropdownOpen ? 'rotate-180 text-amber-500' : ''}`} />
                        </div>
                        
                        {isDropdownOpen && (
                          <div className="absolute z-[99] w-full bottom-full mb-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                            <div className="p-2">
                              <div className="px-5 py-4 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors flex items-center" onClick={() => handleSelectJenis('')}>
                                <X className="w-4 h-4 mr-2" /> Batal / Kosongkan Pilihan
                              </div>
                              <div className="px-5 py-4 text-sm font-black text-slate-700 hover:bg-amber-50 hover:text-amber-700 rounded-lg cursor-pointer transition-colors" onClick={() => handleSelectJenis('INDENT KHUSUS')}>
                                INDENT KHUSUS
                              </div>
                              <div className="px-5 py-4 text-sm font-black text-slate-700 hover:bg-amber-50 hover:text-amber-700 rounded-lg cursor-pointer transition-colors" onClick={() => handleSelectJenis('INDENT REGULER')}>
                                INDENT REGULER
                              </div>
                            </div>
                          </div>
                        )}
                    </div>

                    <div>
                        <label className={labelClass}>Nominal Indent (Rp)</label>
                        <input type="text" value={nominal === 0 ? '' : formatRupiah(nominal)} onChange={handleInputChange(setNominal)} className={numInputClass} placeholder="0" />
                    </div>

                </div>
              </section>

              <div className="flex justify-center gap-4 pt-4 border-t border-slate-100">
                {isEditing && <button type="button" onClick={resetForm} className="px-8 py-3.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold active:scale-95 shadow-sm">Batal</button>}
                <button type="submit" className="px-12 py-3.5 bg-amber-500 text-white rounded-xl font-bold active:scale-95 shadow-lg tracking-wide flex items-center hover:bg-amber-600 transition-colors">
                  <ClipboardSignature className="w-5 h-5 mr-2" />
                  {isEditing ? 'Update Indent' : 'Simpan & Cetak Kwitansi Indent'}
                </button>
              </div>
            </form>
          </div>
        </div>
        
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50/80 border-b border-slate-200 p-5 px-6 flex justify-between items-center"><h3 className="text-lg font-bold text-slate-800 flex items-center"><ClipboardSignature className="w-5 h-5 mr-2 text-amber-500" /> Riwayat Kwitansi Indent</h3><button onClick={fetchHistory} className="flex items-center text-xs font-bold text-slate-700 bg-white border border-slate-300 px-4 py-2 rounded-xl active:scale-95 shadow-sm hover:bg-slate-100"><RefreshCw className={`w-3.5 h-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</button></div>
          <div className="overflow-x-auto max-h-[420px] scrollbar-thin">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-[11px] text-slate-500 uppercase sticky top-0 z-10 bg-slate-100 shadow-sm">
                <tr className="border-b border-slate-200">
                  <th className="px-6 py-4 font-bold tracking-wider">No. Invoice</th>
                  <th className="px-6 py-4 font-bold tracking-wider">Tanggal</th>
                  <th className="px-6 py-4 font-bold tracking-wider">Diterima Dari</th>
                  <th className="px-6 py-4 font-bold tracking-wider">Jenis & Nominal</th>
                  <th className="px-6 py-4 font-bold tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyData.map((row, idx) => {
                    const { date, time } = formatDateTime(row.created_at, row.tanggal);
                    return (
                    <tr key={`${row?.noInvoice || idx}-${idx}`} className="hover:bg-amber-50/40 transition-colors">
                      <td className="px-6 py-5 font-extrabold text-slate-900">{row?.noInvoice || '-'}</td>
                      <td className="px-6 py-5">
                        <div className="font-bold text-slate-700">{date}</div>
                        <div className="flex items-center text-[11px] font-medium text-slate-400 mt-1">
                          <Clock className="w-3.5 h-3.5 mr-1" /> Jam: {time}
                        </div>
                      </td>
                      <td className="px-6 py-5 font-bold text-slate-700 uppercase">{row?.diterimaDari || '-'}</td>
                      <td className="px-6 py-5"><div className="text-xs font-black text-amber-700 uppercase">{row?.jenisIndent}</div><div className="text-sm font-bold text-slate-900 mt-0.5">Rp {formatRupiah(row?.nominal)}</div></td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-end gap-2.5">
                          <button onClick={() => generatePDF(row)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all duration-200 active:scale-95 font-bold text-xs border border-emerald-200 shadow-sm">
                            <FileText className="w-3.5 h-3.5" /> PDF
                          </button>
                          <button onClick={() => handleEdit(row)} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all duration-200 active:scale-95 font-bold text-xs border border-indigo-200 shadow-sm">
                            <Edit className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button onClick={() => handleDeleteRequest(row.noInvoice)} className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-all duration-200 active:scale-95 font-bold text-xs border border-rose-200 shadow-sm">
                            <Trash2 className="w-3.5 h-3.5" /> Del
                          </button>
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