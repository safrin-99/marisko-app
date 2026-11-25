import React, { useState, useEffect } from 'react';
import { FileText, Receipt, Banknote, Activity, ArrowUpRight, ScrollText, RefreshCw, AlertCircle, CalendarDays, ClipboardSignature, BarChart3, TrendingUp, TrendingDown, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

// SAKTI: Dashboard — kartu angka (menghitung naik + dibanding bulan lalu), grafik tren 6 bulan, aktivitas terbaru,
// akses cepat. Animasi hanya lewat token tema & dimatikan bila pengguna memilih "kurangi gerak".
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const JUMLAH_BULAN = 6;
const TABEL = { bastk: 'bastk_history', kredit: 'kwitansi_history', cash: 'kwitansi_cash_history', indent: 'kwitansi_indent_history' };
const KARTU = [
  { kunci: 'bastk', label: 'Dokumen BASTK', icon: FileText },
  { kunci: 'kredit', label: 'Kwitansi Kredit', icon: Receipt },
  { kunci: 'cash', label: 'Kwitansi Cash', icon: Banknote },
  { kunci: 'indent', label: 'Kwitansi Indent', icon: ClipboardSignature },
];

const kurangiGerak = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const formatAngka = (n) => Number(n || 0).toLocaleString('id-ID');

// Angka menghitung naik dari 0 ke nilai akhirnya (langsung nilai akhir bila "kurangi gerak")
function useHitungNaik(target) {
  const [nilai, setNilai] = useState(0);
  useEffect(() => {
    if (kurangiGerak()) return undefined;
    let mulai = null;
    let id;
    const langkah = (waktu) => {
      if (mulai === null) mulai = waktu;
      const p = Math.min(1, (waktu - mulai) / 900);
      setNilai(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) id = requestAnimationFrame(langkah);
    };
    id = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(id);
  }, [target]);
  return kurangiGerak() ? target : nilai;
}

function TitikLive() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-600 whitespace-nowrap" title="Data langsung dari database">
      <span className="relative flex w-2 h-2">
        <span className="absolute inline-flex w-full h-full rounded-full bg-green-700 opacity-60 animate-ping motion-reduce:animate-none"></span>
        <span className="relative inline-flex w-2 h-2 rounded-full bg-green-700"></span>
      </span>
      <span className="hidden sm:inline">Live DB</span>
    </span>
  );
}

// bulanIni = tanggal 1 s.d. hari ini; pembanding = tanggal yang sama di bulan lalu (adil untuk bulan yang masih berjalan)
function KartuAngka({ label, icon, total, bulanIni, pembanding, labelPembanding, seriBastk, isLoading }) {
  const Icon = icon;
  const tampil = useHitungNaik(isLoading ? 0 : total);
  const persen = pembanding > 0 ? Math.round(((bulanIni - pembanding) / pembanding) * 100) : null;
  return (
    <div className="ui-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        {/* Di HP label turun ke bawah ikon agar tidak terpotong */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 min-w-0">
          {/* Warna ikon = warna batangnya di grafik tren (kuning BASTK, abu gelap kwitansi) */}
          <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${seriBastk ? 'bg-brand text-brand-fg' : 'bg-stone-900 text-white'}`}>
            <Icon className="w-4 h-4" />
          </span>
          <p className="text-[13px] font-medium text-stone-600 sm:truncate">{label}</p>
        </div>
        <span className="h-9 inline-flex items-center"><TitikLive /></span>
      </div>
      <p className="mt-4 text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900 tabular-nums">{isLoading ? '-' : formatAngka(tampil)}</p>
      <div className="mt-2 flex flex-col gap-1 text-xs text-stone-500">
        <span className="tabular-nums">{isLoading ? '\u00a0' : `${formatAngka(bulanIni)} bulan ini`}</span>
        {!isLoading && persen !== null && (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className={persen > 0 ? 'ui-badge-success' : persen < 0 ? 'ui-badge-danger' : 'ui-badge-neutral'} title={`${labelPembanding}: ${formatAngka(pembanding)}`}>
              {persen > 0 ? <TrendingUp className="w-3 h-3" /> : persen < 0 ? <TrendingDown className="w-3 h-3" /> : null}
              {persen > 0 ? '+' : ''}{persen}%
            </span>
            dari {labelPembanding}
          </span>
        )}
      </div>
    </div>
  );
}

function GrafikTren({ bulan, isLoading, catatanBulanIni }) {
  // Batang tumbuh dari bawah setelah data tiba (langsung penuh bila "kurangi gerak")
  const [tumbuh, setTumbuh] = useState(false);
  useEffect(() => {
    if (isLoading) return undefined;
    const id = requestAnimationFrame(() => setTumbuh(true));
    return () => { cancelAnimationFrame(id); setTumbuh(false); };
  }, [isLoading]);

  const tertinggi = Math.max(1, ...bulan.flatMap((b) => [b.bastk, b.kwitansi]));
  const kosong = bulan.every((b) => !b.bastk && !b.kwitansi);
  const ringkasan = bulan.map((b) => `${b.label}: ${b.bastk} BASTK, ${b.kwitansi} kwitansi`).join('; ');
  const tinggi = (nilai) => `${tumbuh ? Math.max(nilai ? 4 : 0, (nilai / tertinggi) * 85) : 0}%`;

  return (
    <div className="ui-card overflow-hidden">
      <div className="ui-card-header">
        <h3 className="ui-card-title"><BarChart3 className="w-4 h-4 text-stone-500" /> Tren 6 Bulan Terakhir</h3>
        <div className="flex items-center gap-4 text-xs font-medium text-stone-600">
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand"></span>BASTK</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-stone-900"></span>Kwitansi</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center text-stone-500 py-10">
          <RefreshCw className="w-6 h-6 animate-spin mb-3 text-stone-400" />
          <p className="text-sm">Memuat data...</p>
        </div>
      ) : kosong ? (
        <div className="flex flex-col items-center justify-center text-stone-500 py-10">
          <BarChart3 className="w-6 h-6 mb-3 text-stone-400" />
          <p className="text-sm">Belum ada data 6 bulan terakhir.</p>
        </div>
      ) : (
        <div className="px-5 pt-5 pb-4">
          <div role="img" aria-label={`Tren 6 bulan terakhir. ${ringkasan}.`} className="grid grid-cols-6 gap-2 sm:gap-4">
            {bulan.map((b, i) => (
              <div key={b.label} className="flex h-44 items-end justify-center gap-1 sm:gap-1.5">
                {[{ nilai: b.bastk, warna: 'bg-brand' }, { nilai: b.kwitansi, warna: 'bg-stone-900' }].map((seri, j) => (
                  <div key={j} className="flex h-full w-3.5 sm:w-6 flex-col items-center justify-end">
                    <span className={`mb-1 text-[11px] font-semibold tabular-nums text-stone-600 transition-opacity duration-500 motion-reduce:transition-none ${tumbuh ? 'opacity-100' : 'opacity-0'}`}>{seri.nilai}</span>
                    <div
                      className={`w-full rounded-t-md ${seri.warna} transition-[height] duration-700 ease-out motion-reduce:transition-none`}
                      style={{ height: tinggi(seri.nilai), transitionDelay: `${i * 70 + j * 35}ms` }}
                    ></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-6 gap-2 sm:gap-4 border-t border-stone-200 pt-2">
            {bulan.map((b, i) => (
              <p key={b.label} className={`text-center text-xs ${i === bulan.length - 1 ? 'font-semibold text-stone-900' : 'text-stone-500'}`}>{b.label}</p>
            ))}
          </div>
          <p className="mt-3 text-xs text-stone-500">{catatanBulanIni}</p>
        </div>
      )}
    </div>
  );
}

const BADGE_CUTI = {
  DISETUJUI: { kelas: 'ui-badge-success', icon: CheckCircle },
  DITOLAK: { kelas: 'ui-badge-danger', icon: XCircle },
  DIPROSES: { kelas: 'ui-badge-warning', icon: Clock },
};

export default function DashboardPage() {
  const [stats, setStats] = useState({ bastk: 0, kredit: 0, cash: 0, indent: 0 });
  const [bulanan, setBulanan] = useState([]);
  const [pembanding, setPembanding] = useState({ label: '', catatan: '' });
  const [recentActivities, setRecentActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const adminName = localStorage.getItem('adminName') || 'Admin';
  // SAKTI: Ambil Role dari localStorage untuk mengamankan Akses Cepat!
  const userRole = localStorage.getItem('adminRole')?.toUpperCase() || '';

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setErrorMsg('');

    if (!navigator.onLine) {
      setErrorMsg('Tidak ada koneksi internet. Periksa koneksi lalu coba lagi.');
      setIsLoading(false);
      return;
    }

    // Batas 6 bulan terakhir (termasuk bulan berjalan), menurut jam perangkat
    const sekarang = new Date();
    const awal = (mundur) => new Date(sekarang.getFullYear(), sekarang.getMonth() - mundur, 1);
    const rentang = Array.from({ length: JUMLAH_BULAN }, (_, i) => {
      const mundur = JUMLAH_BULAN - 1 - i;
      return { label: BULAN[awal(mundur).getMonth()], mulai: awal(mundur).toISOString(), akhir: awal(mundur - 1).toISOString() };
    });
    // Pembanding adil untuk bulan berjalan: tanggal 1 s.d. jam yang sama di bulan lalu
    const hariTerakhirBulanLalu = new Date(sekarang.getFullYear(), sekarang.getMonth(), 0).getDate();
    const batasLalu = new Date(sekarang.getFullYear(), sekarang.getMonth() - 1, Math.min(sekarang.getDate(), hariTerakhirBulanLalu), sekarang.getHours(), sekarang.getMinutes(), sekarang.getSeconds());
    const periodeLalu = { mulai: awal(1).toISOString(), akhir: batasLalu.toISOString() };
    const hitung = (tabel, r) => {
      const q = supabase.from(tabel).select('*', { count: 'exact', head: true });
      return r ? q.gte('created_at', r.mulai).lt('created_at', r.akhir) : q;
    };

    try {
      const kunciTabel = Object.keys(TABEL);
      const [totalRes, pembandingRes, bulanRes, recentRes] = await Promise.all([
        Promise.all(kunciTabel.map((k) => hitung(TABEL[k]))),
        Promise.all(kunciTabel.map((k) => hitung(TABEL[k], periodeLalu))),
        Promise.all(kunciTabel.map((k) => Promise.all(rentang.map((r) => hitung(TABEL[k], r))))),
        Promise.all([
          supabase.from('bastk_history').select('noSurat, namaKonsumen, created_at').order('created_at', { ascending: false }).limit(6),
          supabase.from('kwitansi_history').select('noInvoice, diterimaDari, created_at').order('created_at', { ascending: false }).limit(6),
          supabase.from('kwitansi_cash_history').select('noInvoice, diterimaDari, created_at').order('created_at', { ascending: false }).limit(6),
          supabase.from('kwitansi_indent_history').select('noInvoice, diterimaDari, created_at').order('created_at', { ascending: false }).limit(6),
          supabase.from('nota_history').select('no_invoice, penerima, kategori, created_at').order('created_at', { ascending: false }).limit(6),
          supabase.from('cuti_history').select('noCuti, namaPegawai, status, created_at').order('created_at', { ascending: false }).limit(6),
        ]),
      ]);

      // Semua permintaan gagal = server tidak terjangkau. Tabel yang tidak boleh dibaca role ini tampil 0, seperti sebelumnya.
      const semua = [...totalRes, ...pembandingRes, ...bulanRes.flat(), ...recentRes];
      if (semua.every((r) => r.error)) throw new Error('Semua permintaan gagal');

      const [resBastk, resKredit, resCash, resIndent, resNota, resCuti] = recentRes;
      const activities = [];
      if (resBastk.data) activities.push(...resBastk.data.map((d) => ({ id: d.noSurat, type: 'BASTK Induk', customer: d.namaKonsumen, time: d.created_at, status: 'Sukses', icon: FileText })));
      if (resKredit.data) activities.push(...resKredit.data.map((d) => ({ id: d.noInvoice, type: 'Kwitansi Kredit', customer: d.diterimaDari, time: d.created_at, status: 'Sukses', icon: Receipt })));
      if (resCash.data) activities.push(...resCash.data.map((d) => ({ id: d.noInvoice, type: 'Kwitansi Cash', customer: d.diterimaDari, time: d.created_at, status: 'Sukses', icon: Banknote })));
      if (resIndent.data) activities.push(...resIndent.data.map((d) => ({ id: d.noInvoice, type: 'Kwitansi Indent', customer: d.diterimaDari, time: d.created_at, status: 'Sukses', icon: ClipboardSignature })));
      if (resCuti.data) activities.push(...resCuti.data.map((d) => ({ id: d.noCuti, type: 'Pengajuan Cuti', customer: d.namaPegawai, time: d.created_at, status: BADGE_CUTI[d.status] ? d.status : 'DIPROSES', icon: CalendarDays })));
      if (resNota.data) activities.push(...resNota.data.map((d) => ({ id: d.no_invoice, type: `Nota ${d.kategori}`, customer: d.penerima || 'BIAYA OPERASIONAL', time: d.created_at, status: 'Sukses', icon: ScrollText })));
      activities.sort((a, b) => new Date(b.time) - new Date(a.time));

      setStats(Object.fromEntries(kunciTabel.map((k, i) => [k, totalRes[i].count || 0])));
      setPembanding({
        ...Object.fromEntries(kunciTabel.map((k, i) => [k, pembandingRes[i].count || 0])),
        label: `${awal(1).getDate()}–${batasLalu.getDate()} ${BULAN[batasLalu.getMonth()]}`,
        catatan: `${BULAN[sekarang.getMonth()]} dihitung sampai hari ini (${sekarang.getDate()} ${BULAN[sekarang.getMonth()]}).`,
      });
      setBulanan(rentang.map((r, i) => {
        const per = Object.fromEntries(kunciTabel.map((k, j) => [k, bulanRes[j][i].count || 0]));
        return { label: r.label, ...per, kwitansi: per.kredit + per.cash + per.indent };
      }));
      setRecentActivities(activities);
    } catch (e) {
      console.error('Gagal load data dashboard', e);
      setErrorMsg('Gagal terhubung ke server database.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat data sekali saat halaman dibuka
    fetchDashboardData();
  }, []);

  const timeAgo = (dateString) => {
    const diff = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (diff < 60) return `${diff} detik yang lalu`;
    if (diff < 3600) return `${Math.floor(diff / 60)} menit yang lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam yang lalu`;
    return `${Math.floor(diff / 86400)} hari yang lalu`;
  };

  const bulanIni = bulanan[bulanan.length - 1] || {};

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-6">

      <div>
        <h2 className="ui-page-title">Selamat Datang, {adminName}! 👋</h2>
        <p className="ui-page-subtitle">Ringkasan aktivitas MARISKO PERKASA hari ini.</p>
      </div>

      {errorMsg && (
        <div className="ui-alert-danger">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errorMsg}
        </div>
      )}

      {/* KARTU ANGKA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {KARTU.map((k) => (
          <KartuAngka
            key={k.kunci}
            label={k.label}
            icon={k.icon}
            total={stats[k.kunci]}
            bulanIni={bulanIni[k.kunci] || 0}
            pembanding={pembanding[k.kunci] || 0}
            labelPembanding={pembanding.label}
            seriBastk={k.kunci === 'bastk'}
            isLoading={isLoading}
          />
        ))}
      </div>

      {/* GRAFIK TREN */}
      <GrafikTren bulan={bulanan} isLoading={isLoading} catatanBulanIni={pembanding.catatan} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* AKTIVITAS TERBARU */}
        <div className="lg:col-span-2 ui-card flex flex-col overflow-hidden">
          <div className="ui-card-header">
            <h3 className="ui-card-title"><Activity className="w-4 h-4 text-stone-500" /> Live Data Terbaru</h3>
            <button onClick={fetchDashboardData} disabled={isLoading} className="ui-btn-sm">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          <div className="flex-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center text-stone-500 py-10">
                <RefreshCw className="w-6 h-6 animate-spin mb-3 text-stone-400" />
                <p className="text-sm">Memuat data...</p>
              </div>
            ) : recentActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-stone-500 py-10">
                <Activity className="w-6 h-6 mb-3 text-stone-400" />
                <p className="text-sm">Belum ada aktivitas terekam.</p>
              </div>
            ) : (
              <div className="w-full divide-y divide-stone-100">
                {recentActivities.slice(0, 6).map((act, idx) => {
                  const ActIcon = act.icon;
                  const badgeCuti = BADGE_CUTI[act.status];
                  const BadgeIcon = badgeCuti?.icon;
                  return (
                    <div
                      key={`${act.type}-${act.id}-${idx}`}
                      className="ui-tr flex items-center justify-between gap-4 px-5 py-3 animate-page-in motion-reduce:animate-none"
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-9 h-9 bg-stone-100 rounded-lg flex items-center justify-center flex-shrink-0 text-stone-600">
                          <ActIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm text-stone-900 truncate">{act.customer}</h4>
                          <div className="ui-meta flex-wrap">
                            <span className="font-semibold text-stone-700 uppercase tracking-[0.03em]">{act.type}</span><span className="hidden sm:inline">•</span><span className="truncate">{timeAgo(act.time)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="ui-docno">{act.id}</div>
                        <div className={`mt-1 ${badgeCuti ? badgeCuti.kelas : 'ui-badge-success'}`}>
                          {BadgeIcon && <BadgeIcon className="w-3 h-3" />} {act.status}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* AKSES CEPAT */}
        <div className="ui-card flex flex-col overflow-hidden">

          <div className="ui-card-header">
            <h3 className="ui-card-title">Akses Cepat</h3>
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
                {[
                  { to: '/kwitansi-kredit', icon: Receipt, label: 'Cetak Kwitansi Kredit' },
                  { to: '/kwitansi-cash', icon: Banknote, label: 'Cetak Kwitansi Cash' },
                  { to: '/kwitansi-indent', icon: ClipboardSignature, label: 'Cetak Kwitansi Indent' },
                  { to: '/nota', icon: ScrollText, label: 'Nota & Laporan' },
                ].map((menu) => {
                  const MenuIcon = menu.icon;
                  return (
                    <Link key={menu.to} to={menu.to} className="w-full flex items-center justify-between h-11 px-3 rounded-lg text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition-colors group/btn">
                      <div className="flex items-center gap-2.5">
                        <MenuIcon className="w-4 h-4 text-stone-500" />
                        <span className="font-medium text-sm">{menu.label}</span>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover/btn:text-stone-900 transition-colors" />
                    </Link>
                  );
                })}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
