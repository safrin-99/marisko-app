import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Receipt, Edit, Trash2, RefreshCw, X, CheckCircle2, AlertCircle, Printer, Search, ChevronDown, FileText, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
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

  useEffect(() => {
    if (!isEditing) {
      const calculatedSisa = Math.max(0, dpGross - diskon - indent + accesoris - transfer - potonganLecet);
      setSisaUangMuka(calculatedSisa);
    }
  }, [dpGross, diskon, indent, accesoris, transfer, potonganLecet, isEditing]);

  useEffect(() => {
    if (otr > 0 && bbn > 0 && !isEditing) {
      const calculatedOffTheRoad = (otr / 1.11) - bbn - dpGross;
      setOffTheRoad(Math.round(calculatedOffTheRoad));
    }
  }, [otr, bbn, dpGross, isEditing]);

  useEffect(() => {
    fetchHistory();
    fetchBastk();
    fetchLogo();
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
        const { error } = await supabase.from('kwitansi_history').update(formData).eq('noInvoice', originalNo);
        if (error) throw error;
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
    await supabase.from('kwitansi_history').delete().eq('noInvoice', id);
    fetchHistory();
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
                // SAKTI: Logo 17x17, Posisi di Y - 10 (Agar presisi)
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
        
        // SAKTI: UKURAN TABEL DIKUNCI MATI (Header 10, Baris 6)
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
    
    // SAKTI: StartY = 15 (Turun sedikit saja)
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
            {modal.type === 'success' ? <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 text-indigo-600 shadow-inner"><CheckCircle2 className="w-10 h-10" /></div> : <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 text-rose-600 shadow-inner"><AlertCircle className="w-10 h-10" /></div>}
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

  const inputClass = "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400";
  const numInputClass = "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-indigo-900 text-right focus:bg-white focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400";
  const labelClass = "block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider";

  return (
    <>
      {renderModal()}
      {isSubmitting && createPortal(
        <div className="fixed inset-0 z-[99998] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-300 border border-slate-100 max-w-sm w-full mx-4">
            <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-600/30 mb-6 animate-bounce">
              <Receipt className="w-10 h-10 text-white animate-pulse" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-2">Memproses Kredit...</h3>
            <p className="text-sm font-medium text-slate-500 text-center">Menyimpan data dan menyiapkan PDF.</p>
          </div>
        </div>, document.body
      )}

      <div className="max-w-5xl mx-auto pb-12 space-y-8 relative">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 md:p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-8 flex items-center"><Receipt className="w-7 h-7 mr-3 text-indigo-600" /> {isEditing ? 'Edit Kwitansi Kredit' : 'Form Kwitansi Kredit'}</h2>
            <form onSubmit={handleSubmit} className="space-y-8">
              {!isEditing && (
                <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 relative">
                  <label className="block text-xs font-extrabold text-indigo-800 mb-3 uppercase tracking-wider flex items-center"><Search className="w-3.5 h-3.5 mr-1.5" /> Helper BASTK :</label>
                  <div className="relative w-full">
                    <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="w-full h-12 px-4 bg-white border border-indigo-200 hover:border-indigo-400 rounded-xl text-sm font-bold text-slate-800 flex items-center justify-between cursor-pointer transition-all shadow-sm">
                      <span className="truncate">{pilihBastk ? `${bastkList.find(b => b?.noSurat === pilihBastk)?.namaKonsumen || ''} - ${pilihBastk}` : '-- Cari BASTK --'}</span>
                      <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                    {isDropdownOpen && (
                      <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-72 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-3 border-b border-slate-100 bg-slate-50">
                          <input autoFocus type="text" className="w-full h-10 px-4 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 font-medium" placeholder="Ketik Nama/No BASTK..." value={dropdownSearch} onChange={(e) => setDropdownSearch(e.target.value)} />
                        </div>
                        <div className="overflow-y-auto p-2">
                          <div className="px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors" onClick={() => handleSelectBastk('')}><X className="w-4 h-4 inline mr-2" /> Batal / Kosongkan Pilihan</div>
                          {filteredBastk.map((b, idx) => (
                            <div key={`${b?.noSurat}-${idx}`} className="px-4 py-3 text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg cursor-pointer transition-colors" onClick={() => handleSelectBastk(b?.noSurat)}>
                              <span className="font-extrabold block text-slate-900">{b?.namaKonsumen}</span>
                              <span className="text-xs text-slate-500 block">{b?.noSurat}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div><label className={labelClass}>No. Invoice</label><input type="text" value={noInvoice} onChange={(e)=>setNoInvoice(e.target.value)} required placeholder="KWI-001" className={inputClass} /></div>
                <div><label className={labelClass}>No. BASTK</label><input type="text" value={noBastk} onChange={(e)=>setNoBastk(e.target.value)} placeholder="001/..." className={inputClass} /></div>
                <div><label className={labelClass}>Tanggal</label><input type="date" value={tanggal} onChange={(e)=>setTanggal(e.target.value)} required className={inputClass} /></div>
                <div><label className={labelClass}>Leasing/Surveyor</label><input type="text" value={leasing} onChange={(e)=>setLeasing(e.target.value)} required placeholder="ADIRA / BUDI" className={inputClass} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Di Terima Dari</label><input type="text" value={diterimaDari} onChange={(e)=>setDiterimaDari(e.target.value)} required placeholder="NAMA KONSUMEN" className={inputClass} /></div>
                <div><label className={labelClass}>Nama Motor & Warna</label><input type="text" value={tipeMotor} onChange={(e)=>setTipeMotor(e.target.value)} required placeholder="(BEAT SPORTY CBS / BLACK)" className={inputClass} /></div>
                <div><label className={labelClass}>Nama Kasir</label><input type="text" value={kasir} onChange={(e)=>setKasir(e.target.value)} required placeholder="STELY ARSYAD" className={inputClass} /></div>
              </section>
              
              <section className="bg-slate-50 p-6 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div><label className={labelClass}>3. OTR</label><input type="text" value={otr === 0 ? '' : formatRupiah(otr)} onChange={handleInputChange(setOtr)} className={numInputClass} placeholder="0" /></div>
                    <div><label className={labelClass}>2. BBN</label><input type="text" value={bbn === 0 ? '' : formatRupiah(bbn)} onChange={handleInputChange(setBbn)} className={numInputClass} placeholder="0" /></div>
                    <div><label className={labelClass}>1. Off The Road (Auto)</label><input type="text" value={offTheRoad === 0 ? '' : formatRupiah(offTheRoad)} readOnly className="w-full h-12 px-4 bg-indigo-50 border border-indigo-200 rounded-xl text-lg font-black text-indigo-900 text-right cursor-not-allowed outline-none" /></div>
                    <div><label className={labelClass}>7. Accesoris</label><input type="text" value={accesoris === 0 ? '' : formatRupiah(accesoris)} onChange={handleInputChange(setAccesoris)} className={numInputClass} placeholder="0" /></div>
                    <div><label className={labelClass}>9. Potongan Lecet</label><input type="text" value={potonganLecet === 0 ? '' : formatRupiah(potonganLecet)} onChange={handleInputChange(setPotonganLecet)} className={numInputClass} placeholder="0" /></div>
                </div>
                <div className="space-y-4">
                    <div><label className={labelClass}>4. DP Gross</label><input type="text" value={dpGross === 0 ? '' : formatRupiah(dpGross)} onChange={handleInputChange(setDpGross)} className={numInputClass} placeholder="0" /></div>
                    <div><label className={labelClass}>5. Diskon</label><input type="text" value={diskon === 0 ? '' : formatRupiah(diskon)} onChange={handleInputChange(setDiskon)} className={numInputClass} placeholder="0" /></div>
                    <div><label className={labelClass}>6. Indent</label><input type="text" value={indent === 0 ? '' : formatRupiah(indent)} onChange={handleInputChange(setIndent)} className={numInputClass} placeholder="0" /></div>
                    <div><label className={labelClass}>8. Transfer</label><input type="text" value={transfer === 0 ? '' : formatRupiah(transfer)} onChange={handleInputChange(setTransfer)} className={numInputClass} placeholder="0" /></div>
                    <div><label className={labelClass}>10. Sisa Uang Muka (Auto / Manual)</label><input type="text" value={sisaUangMuka === 0 ? '' : formatRupiah(sisaUangMuka)} onChange={handleInputChange(setSisaUangMuka)} className="w-full h-12 px-4 bg-white border-2 border-indigo-400 rounded-xl text-base sm:text-lg font-black text-indigo-800 text-right outline-none transition-all focus:ring-4 focus:ring-indigo-500/20" placeholder="0" /></div>
                </div>
              </section>
              
              <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-center items-center gap-4 transition-all duration-300">
                {isEditing && (
                  <button type="button" onClick={resetForm} className="px-8 py-3.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all duration-200 active:scale-95 shadow-sm flex items-center justify-center w-full sm:w-auto">
                    <X className="w-4 h-4 mr-2" /> Batal Edit
                  </button>
                )}
                <button type="submit" disabled={isSubmitting} className={`px-12 py-3.5 text-white rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 shadow-lg tracking-wide flex items-center justify-center w-full sm:w-auto ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-950 hover:bg-slate-800'}`}>
                  {isSubmitting ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Memproses...</>
                  ) : isEditing ? (
                    <><Edit className="w-4 h-4 mr-2" /> Update Invoice</>
                  ) : (
                    <><Receipt className="w-4 h-4 mr-2" /> Simpan & Cetak Kwitansi</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50/80 border-b border-slate-200 p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5">
            <h3 className="text-lg font-bold text-slate-800 flex items-center"><Receipt className="w-5 h-5 mr-2 text-indigo-600" /> Riwayat Kwitansi Kredit</h3>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari Nama / No. Invoice..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                />
              </div>
              <button onClick={fetchHistory} className="w-full sm:w-auto flex items-center justify-center text-xs font-bold text-slate-700 bg-white border border-slate-300 px-4 py-2.5 rounded-xl active:scale-95 shadow-sm hover:bg-slate-100 transition-all duration-200">
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[420px] scrollbar-thin">
            {/* SAKTI: TABEL DIKEMBALIKAN TANPA MIN-W AGAR TIDAK ADA SCROLLBAR JELEK */}
            <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
              <thead className="text-[11px] text-slate-500 uppercase sticky top-0 z-10 bg-slate-100 shadow-sm">
                <tr className="border-b border-slate-200">
                  <th className="px-6 py-4 font-bold tracking-wider">No. Invoice</th>
                  <th className="px-6 py-4 font-bold tracking-wider">Tanggal</th>
                  <th className="px-6 py-4 font-bold tracking-wider">Diterima Dari</th>
                  <th className="px-6 py-4 font-bold tracking-wider">Tipe Kendaraan</th>
                  <th className="px-6 py-4 font-bold tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyData
                  .filter((row) => {
                    if (!searchTerm) return true;
                    const keyword = searchTerm.toLowerCase();
                    const searchString = `${row?.noInvoice || ''} ${row?.diterimaDari || ''} ${row?.tipeMotor || ''} ${row?.kasir || ''}`.toLowerCase();
                    return searchString.includes(keyword);
                  })
                  .map((row, idx) => {
                    const { date, time } = formatDateTime(row.created_at, row.tanggal);
                    return (
                    <tr key={`${row?.noInvoice || idx}-${idx}`} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="px-6 py-5 font-extrabold text-slate-900 whitespace-nowrap">{row?.noInvoice || '-'}</td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="font-bold text-slate-700">{date}</div>
                        <div className="flex items-center text-[11px] font-medium text-slate-400 mt-1">
                          <Clock className="w-3.5 h-3.5 mr-1" /> Jam: {time}
                        </div>
                      </td>
                      <td className="px-6 py-5 font-bold text-slate-700 uppercase">{row?.diterimaDari || '-'}</td>
                      <td className="px-6 py-5 text-xs font-bold text-slate-500 uppercase">{row?.tipeMotor || '-'}</td>
                      <td className="px-6 py-5 whitespace-nowrap">
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