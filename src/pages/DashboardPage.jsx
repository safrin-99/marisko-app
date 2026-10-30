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
  // SAKTI: Ambil Role dari localStorage untuk mengamankan Akses Cepat!
  const userRole = localStorage.getItem('adminRole')?.toUpperCase() || '';

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
    <div className="max-w-6xl mx-auto space-y-6 pb-2 relative">

      {errorMsg && (
        <div className="ui-alert-danger">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /> {errorMsg}
        </div>
      )}

      {/* SAKTI: HEADER DASHBOARD MINIMALIS (TanPA Kotak Pemasukan) */}
      <div>
        <h1 className="ui-page-title">Selamat Datang, {adminName}! 👋</h1>
        <p className="ui-page-subtitle">Ringkasan aktivitas MARISKO PERKASA hari ini.</p>
      </div>

      {/* STATISTIK: satu strip, empat sel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-stone-200 border border-stone-200 rounded-xl overflow-hidden">

        {/* CARD BASTK */}
        <div className="bg-white px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[13px] font-medium text-stone-600"><FileText className="w-4 h-4 text-stone-400" />Total Dokumen BASTK</p>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-600 whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>Live DB</span>
          </div>
          <h3 className="mt-3 text-[32px] leading-none font-semibold tracking-tight text-stone-900 tabular-nums">{isLoading ? '-' : stats.bastk}</h3>
        </div>

        {/* CARD KREDIT */}
        <div className="bg-white px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[13px] font-medium text-stone-600"><Receipt className="w-4 h-4 text-stone-400" />Kwitansi Kredit</p>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-600 whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>Live DB</span>
          </div>
          <h3 className="mt-3 text-[32px] leading-none font-semibold tracking-tight text-stone-900 tabular-nums">{isLoading ? '-' : stats.kredit}</h3>
        </div>

        {/* CARD CASH */}
        <div className="bg-white px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[13px] font-medium text-stone-600"><Banknote className="w-4 h-4 text-stone-400" />Kwitansi Cash</p>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-600 whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>Live DB</span>
          </div>
          <h3 className="mt-3 text-[32px] leading-none font-semibold tracking-tight text-stone-900 tabular-nums">{isLoading ? '-' : stats.cash}</h3>
        </div>

        {/* CARD INDENT */}
        <div className="bg-white px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[13px] font-medium text-stone-600"><ClipboardSignature className="w-4 h-4 text-stone-400" />Kwitansi Indent</p>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-600 whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>Live DB</span>
          </div>
          <h3 className="mt-3 text-[32px] leading-none font-semibold tracking-tight text-stone-900 tabular-nums">{isLoading ? '-' : stats.indent}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* AKTIVITAS TERBARU */}
        <div className="lg:col-span-2 ui-card flex flex-col overflow-hidden">
          <div className="ui-card-header">
            <h2 className="ui-card-title"><Activity className="w-4 h-4 text-stone-500" /> Live Data Terbaru</h2>
          </div>

          <div className="flex-1">
            {isLoading ? (
               <div className="flex flex-col items-center justify-center text-stone-500 py-16">
                  <RefreshCw className="w-6 h-6 animate-spin mb-3 text-stone-400" />
                  <p className="text-sm">Menarik data dari database...</p>
               </div>
            ) : recentActivities.length === 0 ? (
               <div className="flex flex-col items-center justify-center text-stone-500 py-16">
                  <Activity className="w-6 h-6 mb-3 text-stone-400" />
                  <p className="text-sm">Belum ada aktivitas terekam.</p>
               </div>
            ) : (
                <div className="w-full divide-y divide-stone-100">
                    {recentActivities.slice(0, 6).map((act, idx) => {
                        const ActIcon = act.icon;
                        return (
                        <div key={idx} className="flex items-center justify-between gap-4 px-5 py-2.5 hover:bg-stone-50 transition-colors">
                            <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-9 h-9 bg-stone-100 rounded-lg flex items-center justify-center flex-shrink-0 text-stone-600">
                                <ActIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-semibold text-sm text-stone-900 truncate">{act.customer}</h4>
                                <div className="flex flex-wrap items-center text-xs text-stone-500 mt-0.5">
                                <span className="font-semibold text-stone-700 uppercase tracking-[0.03em] mr-1.5">{act.type}</span> <span className="hidden sm:inline">•</span> <span className="ml-1.5 truncate">{timeAgo(act.time)}</span>
                                </div>
                            </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                            <div className="ui-docno">{act.id}</div>
                            <div className={`mt-1 ${act.status === 'Sukses' ? 'ui-badge-success' : 'ui-badge-warning'}`}>
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
        <div className="ui-card flex flex-col overflow-hidden">

          <div className="ui-card-header">
            <h2 className="ui-card-title">Akses Cepat</h2>
          </div>

          <div className="p-3 flex flex-col gap-1">

            {/* SAKTI: HANYA ADMIN YANG BISA MELIHAT DAN MENGKLIK BASTK */}
            {userRole !== 'KARYAWAN' && (
              <Link to="/bastk" className="w-full flex items-center justify-between h-11 px-3 mb-1.5 bg-brand hover:bg-brand-hover text-brand-fg rounded-lg transition-colors group/btn">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4" />
                  <span className="font-semibold text-sm">Buat BASTK Baru</span>
                </div>
                <ArrowUpRight className="w-4 h-4 opacity-70 group-hover/btn:opacity-100 transition-opacity" />
              </Link>
            )}

            {/* Cuti & Izin untuk ADMIN dan KARYAWAN (akun POS tidak punya menu Cuti) */}
            {userRole !== 'POS BUOL' && (
              <Link to="/cuti" className="w-full flex items-center justify-between h-11 px-3 rounded-lg text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition-colors group/btn">
                <div className="flex items-center gap-2.5">
                  <CalendarDays className="w-4 h-4 text-stone-500" />
                  <span className="font-medium text-sm">Ajukan Cuti & Izin</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover/btn:text-stone-900 transition-colors" />
              </Link>
            )}

            {/* SAKTI: HANYA ADMIN YANG BISA MELIHAT SEMUA MENU KEUANGAN INI */}
            {userRole !== 'KARYAWAN' && (
              <>
                <Link to="/kwitansi-kredit" className="w-full flex items-center justify-between h-11 px-3 rounded-lg text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition-colors group/btn">
                  <div className="flex items-center gap-2.5">
                    <Receipt className="w-4 h-4 text-stone-500" />
                    <span className="font-medium text-sm">Cetak Kwitansi Kredit</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover/btn:text-stone-900 transition-colors" />
                </Link>

                <Link to="/kwitansi-indent" className="w-full flex items-center justify-between h-11 px-3 rounded-lg text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition-colors group/btn">
                  <div className="flex items-center gap-2.5">
                    <ClipboardSignature className="w-4 h-4 text-stone-500" />
                    <span className="font-medium text-sm">Kwitansi Indent</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover/btn:text-stone-900 transition-colors" />
                </Link>

                <Link to="/nota" className="w-full flex items-center justify-between h-11 px-3 rounded-lg text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition-colors group/btn">
                  <div className="flex items-center gap-2.5">
                    <ScrollText className="w-4 h-4 text-stone-500" />
                    <span className="font-medium text-sm">Nota & Laporan</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover/btn:text-stone-900 transition-colors" />
                </Link>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
