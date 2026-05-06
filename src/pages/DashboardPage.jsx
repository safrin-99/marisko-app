import React, { useState, useEffect } from 'react';
import { Users, FileText, Receipt, Banknote, TrendingUp, Activity, ArrowUpRight, ScrollText, RefreshCw, AlertCircle, CalendarDays, ClipboardSignature } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const [stats, setStats] = useState({ bastk: 0, kredit: 0, cash: 0, indent: 0, pemasukan: 0 });
  const [recentActivities, setRecentActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const adminName = localStorage.getItem('adminName') || 'Admin';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    
    if (!navigator.onLine) {
        setErrorMsg('Laptop Anda tidak terhubung internet! Data tidak bisa dimuat.');
        setIsLoading(false);
        return;
    }

    try {
      // SAKTI: resCuti dimasukkan kembali
      const [
        { count: cBastk }, { count: cKredit }, { count: cCash }, { count: cIndent },
        resBastk, resKredit, resCash, resIndent, resNota, resCuti
      ] = await Promise.all([
        supabase.from('bastk_history').select('*', { count: 'exact', head: true }),
        supabase.from('kwitansi_history').select('*', { count: 'exact', head: true }),
        supabase.from('kwitansi_cash_history').select('*', { count: 'exact', head: true }),
        supabase.from('kwitansi_indent_history').select('*', { count: 'exact', head: true }),
        
        supabase.from('bastk_history').select('noSurat, namaKonsumen, created_at').order('created_at', {ascending: false}).limit(6),
        supabase.from('kwitansi_history').select('noInvoice, diterimaDari, created_at').order('created_at', {ascending: false}).limit(6),
        supabase.from('kwitansi_cash_history').select('noInvoice, diterimaDari, created_at').order('created_at', {ascending: false}).limit(6),
        supabase.from('kwitansi_indent_history').select('noInvoice, diterimaDari, created_at').order('created_at', {ascending: false}).limit(6),
        supabase.from('nota_history').select('no_invoice, penerima, total, kategori, created_at').order('created_at', {ascending: false}).limit(10),
        
        // SAKTI: noRegistrasi diganti menjadi noCuti agar cocok dengan database Supabase!
        supabase.from('cuti_history').select('noCuti, namaPegawai, jenisCuti, created_at').order('created_at', {ascending: false}).limit(6)
      ]);

      let totalPemasukan = 0;
      if(resNota.data) {
          resNota.data.forEach(n => {
              if(n.kategori === 'PEMASUKAN') totalPemasukan += Number(n.total || 0);
          });
      }

      let activities = [];
      if(resBastk.data) activities.push(...resBastk.data.map(d => ({ id: d.noSurat, type: 'BASTK Induk', customer: d.namaKonsumen, time: d.created_at, status: 'Sukses', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' })));
      if(resKredit.data) activities.push(...resKredit.data.map(d => ({ id: d.noInvoice, type: 'Kwitansi Kredit', customer: d.diterimaDari, time: d.created_at, status: 'Sukses', icon: Receipt, color: 'text-indigo-600', bg: 'bg-indigo-50' })));
      if(resCash.data) activities.push(...resCash.data.map(d => ({ id: d.noInvoice, type: 'Kwitansi Cash', customer: d.diterimaDari, time: d.created_at, status: 'Sukses', icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50' })));
      if(resIndent.data) activities.push(...resIndent.data.map(d => ({ id: d.noInvoice, type: 'Kwitansi Indent', customer: d.diterimaDari, time: d.created_at, status: 'Sukses', icon: ClipboardSignature, color: 'text-amber-600', bg: 'bg-amber-50' })));
      
      // SAKTI: Pemetaan data cuti menggunakan d.noCuti
      if(resCuti.data) activities.push(...resCuti.data.map(d => ({ id: d.noCuti, type: 'Pengajuan Cuti', customer: d.namaPegawai, time: d.created_at, status: 'Diproses', icon: CalendarDays, color: 'text-purple-600', bg: 'bg-purple-50' })));
      
      if(resNota.data) {
          const recentNotas = resNota.data.slice(0, 6);
          activities.push(...recentNotas.map(d => ({ id: d.no_invoice, type: `Nota ${d.kategori}`, customer: d.penerima || 'BIAYA OPERASIONAL', time: d.created_at, status: 'Sukses', icon: ScrollText, color: 'text-rose-600', bg: 'bg-rose-50' })));
      }

      activities.sort((a,b) => new Date(b.time) - new Date(a.time));
      
      setStats({
          bastk: cBastk || 0,
          kredit: cKredit || 0,
          cash: cCash || 0,
          indent: cIndent || 0, 
          pemasukan: totalPemasukan
      });
      setRecentActivities(activities);

    } catch(e) {
      console.error("Gagal load data dashboard", e);
      setErrorMsg('Gagal terhubung ke database Supabase.');
    }
    setIsLoading(false);
  };

  const formatRupiah = (num) => new Intl.NumberFormat('id-ID').format(num);

  const timeAgo = (dateString) => {
    const past = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - past) / 1000);
    if (diff < 60) return `${diff} detik yang lalu`;
    if (diff < 3600) return `${Math.floor(diff / 60)} menit yang lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam yang lalu`;
    return `${Math.floor(diff / 86400)} hari yang lalu`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 pb-12 animate-in fade-in duration-500 relative">
      
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-600 px-6 py-4 rounded-2xl text-sm font-bold flex items-center animate-in shake shadow-sm">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" /> {errorMsg}
        </div>
      )}

      {/* HEADER DASHBOARD */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-50 rounded-full blur-[80px] -mr-20 -mt-20 z-0 pointer-events-none"></div>
        
        <div className="relative z-10 flex-1">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Selamat Datang, {adminName}! 👋</h1>
          <p className="text-sm md:text-base text-slate-500 font-medium mt-1">Ringkasan aktivitas MARISKO PERKASA hari ini.</p>
        </div>

        <div className="relative z-10 flex items-stretch gap-3">
          <button onClick={fetchDashboardData} className="px-4 py-2 flex items-center justify-center bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 active:scale-95 transition-all text-slate-500 shadow-sm">
             <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
          <div className="flex flex-col justify-center px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm min-w-[180px]">
             <span className="text-[10px] md:text-xs font-extrabold text-slate-400 uppercase tracking-widest">Total Pemasukan Nota</span>
             <span className="text-lg md:text-xl font-black text-indigo-700">Rp {isLoading ? '...' : formatRupiah(stats.pemasukan)}</span>
          </div>
        </div>
      </div>

      {/* STATISTIK KARTU */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className={`w-12 h-12 md:w-14 md:h-14 bg-blue-50 border-blue-100 border rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}><FileText className="w-6 h-6 md:w-7 md:h-7 text-blue-600" /></div>
            <div className="flex items-center gap-1 text-[10px] md:text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg"><TrendingUp className="w-3 h-3" /> Live DB</div>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{isLoading ? '-' : stats.bastk}</h3>
          <p className="text-xs md:text-sm font-bold text-slate-500 mt-1">Total Dokumen BASTK</p>
        </div>
        
        <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className={`w-12 h-12 md:w-14 md:h-14 bg-indigo-50 border-indigo-100 border rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}><Receipt className="w-6 h-6 md:w-7 md:h-7 text-indigo-600" /></div>
            <div className="flex items-center gap-1 text-[10px] md:text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg"><TrendingUp className="w-3 h-3" /> Live DB</div>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{isLoading ? '-' : stats.kredit}</h3>
          <p className="text-xs md:text-sm font-bold text-slate-500 mt-1">Kwitansi Kredit</p>
        </div>
        
        <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className={`w-12 h-12 md:w-14 md:h-14 bg-emerald-50 border-emerald-100 border rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}><Banknote className="w-6 h-6 md:w-7 md:h-7 text-emerald-600" /></div>
            <div className="flex items-center gap-1 text-[10px] md:text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg"><TrendingUp className="w-3 h-3" /> Live DB</div>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{isLoading ? '-' : stats.cash}</h3>
          <p className="text-xs md:text-sm font-bold text-slate-500 mt-1">Kwitansi Cash</p>
        </div>

        <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className={`w-12 h-12 md:w-14 md:h-14 bg-amber-50 border-amber-100 border rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}><ClipboardSignature className="w-6 h-6 md:w-7 md:h-7 text-amber-600" /></div>
            <div className="flex items-center gap-1 text-[10px] md:text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg"><TrendingUp className="w-3 h-3" /> Live DB</div>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{isLoading ? '-' : stats.indent}</h3>
          <p className="text-xs md:text-sm font-bold text-slate-500 mt-1">Kwitansi Indent</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start">
        
        {/* AKTIVITAS TERBARU */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[580px] overflow-hidden">
          <div className="p-5 md:p-6 border-b border-slate-100 flex justify-between items-center bg-white/90 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center"><Activity className="w-5 h-5 mr-2 text-indigo-600" /> Live Data Terbaru</h2>
          </div>
          
          <div className="p-2 flex-1 overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {isLoading ? (
               <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                  <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
                  <p className="font-bold text-sm">Menarik data dari database...</p>
               </div>
            ) : recentActivities.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                  <Activity className="w-8 h-8 mb-3 opacity-50" />
                  <p className="font-bold text-sm">Belum ada aktivitas terekam.</p>
               </div>
            ) : (
                <div className="w-full">
                    {recentActivities.slice(0, 6).map((act, idx) => {
                        const ActIcon = act.icon;
                        return (
                        <div key={idx} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors cursor-default group border-b border-slate-50 last:border-0">
                            <div className="flex items-center gap-3 md:gap-4">
                            <div className={`w-10 h-10 md:w-12 md:h-12 ${act.bg} rounded-xl flex items-center justify-center flex-shrink-0 ${act.color}`}>
                                <ActIcon className="w-4 h-4 md:w-5 md:h-5" />
                            </div>
                            <div>
                                <h4 className="font-extrabold text-sm md:text-base text-slate-900 truncate max-w-[150px] sm:max-w-[200px]">{act.customer}</h4>
                                <div className="flex items-center text-[10px] md:text-xs font-bold text-slate-500 mt-0.5">
                                <span className={`${act.color} uppercase mr-1 md:mr-2`}>{act.type}</span> <span className="hidden sm:inline">•</span> <span className="ml-1 md:ml-2 truncate max-w-[100px] sm:max-w-none">{timeAgo(act.time)}</span>
                                </div>
                            </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-4">
                            <div className="font-black text-xs md:text-sm text-slate-900">{act.id}</div>
                            <div className={`text-[9px] md:text-[10px] font-extrabold uppercase tracking-wider mt-1 px-2 py-0.5 rounded flex items-center justify-center w-fit ml-auto ${act.status === 'Sukses' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                {act.status}
                            </div>
                            </div>
                        </div>
                    )})}
                </div>
            )}
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="bg-slate-950 rounded-3xl border border-slate-800 shadow-xl relative text-white h-[580px] flex flex-col overflow-hidden antialiased">
          
          <div className="p-5 md:p-6 border-b border-white/10 relative z-10 flex-shrink-0">
            <h2 className="text-base md:text-lg font-bold text-white tracking-wide">Akses Cepat</h2>
          </div>
          
          <div className="p-4 md:p-6 space-y-3 relative z-10 flex-1 flex flex-col justify-center">
            <Link to="/bastk" className="w-full flex items-center justify-between p-3 md:p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors group cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform"><FileText className="w-4 h-4 md:w-5 md:h-5" /></div>
                <span className="font-semibold text-xs md:text-sm text-slate-100 drop-shadow-sm">Buat BASTK Baru</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
            </Link>
            
            <Link to="/cuti" className="w-full flex items-center justify-between p-3 md:p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors group cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform"><CalendarDays className="w-4 h-4 md:w-5 md:h-5" /></div>
                <span className="font-semibold text-xs md:text-sm text-slate-100 drop-shadow-sm">Ajukan Cuti & Izin</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
            </Link>
            
            <Link to="/kwitansi-kredit" className="w-full flex items-center justify-between p-3 md:p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors group cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform"><Receipt className="w-4 h-4 md:w-5 md:h-5" /></div>
                <span className="font-semibold text-xs md:text-sm text-slate-100 drop-shadow-sm">Cetak Kwitansi Kredit</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
            </Link>
            
            <Link to="/kwitansi-indent" className="w-full flex items-center justify-between p-3 md:p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors group cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform"><ClipboardSignature className="w-4 h-4 md:w-5 md:h-5" /></div>
                <span className="font-semibold text-xs md:text-sm text-slate-100 drop-shadow-sm">Kwitansi Indent</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
            </Link>
            
            <Link to="/nota" className="w-full flex items-center justify-between p-3 md:p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors group cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-rose-500/20 rounded-xl flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform"><ScrollText className="w-4 h-4 md:w-5 md:h-5" /></div>
                <span className="font-semibold text-xs md:text-sm text-slate-100 drop-shadow-sm">Nota & Laporan</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}