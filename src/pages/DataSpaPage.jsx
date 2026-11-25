import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Table2, RefreshCw, Search, X, Edit, Trash2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { OPSI_PEMBIAYAAN, labelPembiayaan } from '../lib/pilihanBastk';
import { formatRupiah } from '../lib/angka';
import PilihanDropdown from '../components/PilihanDropdown';

// SAKTI: Modul Penjualan — Data SPA. Data diambil per halaman dari server agar tetap ringan
// walau nanti berisi ribuan baris dari Excel tahun-tahun sebelumnya.
const PER_HALAMAN = 50;
const MODAL_TUTUP = { isOpen: false, type: '', title: '', message: '', actionData: null };
const KOLOM = ['No. BASTK', 'Tanggal BASTK', 'Leasing', 'Pemohon', 'Nama STNK', 'No. HP 1', 'No. HP 2', 'Pekerjaan', 'Desa/Kelurahan', 'Kecamatan', 'Unit', 'Jenis Motor', 'No. Rangka', 'No. Mesin', 'Type', 'Warna', 'OTR', 'DP Stor', 'DP Gross', 'Tenor', 'Angsuran', 'Subsidi', 'Sales', 'Keterangan'];
const KOLOM_UANG = ['OTR', 'DP Stor', 'DP Gross', 'Angsuran', 'Subsidi'];
const BADGE_KETERANGAN = { 'ADMINISTRASI LENGKAP': 'ui-badge-success', 'MOTOROYAKU BELUM ADA': 'ui-badge-warning' };

const formatTanggal = (tgl) => {
  if (!tgl) return '-';
  const [y, m, d] = tgl.split('-');
  return `${d}/${m}/${y}`;
};
const rupiah = (n) => (n ? `Rp ${formatRupiah(n)}` : '-');

export default function DataSpaPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [halaman, setHalaman] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [gagal, setGagal] = useState(false);
  const [leasing, setLeasing] = useState('');
  const [sales, setSales] = useState('');
  const [ketikCari, setKetikCari] = useState('');
  const [cari, setCari] = useState('');
  const [pilihan, setPilihan] = useState({ leasing: [], sales: [] });
  const [modal, setModal] = useState(MODAL_TUTUP);
  const tutupModal = () => setModal(MODAL_TUTUP);

  // Pencarian dijalankan sesaat setelah berhenti mengetik
  useEffect(() => {
    const t = setTimeout(() => { setCari(ketikCari.trim()); setHalaman(0); }, 350);
    return () => clearTimeout(t);
  }, [ketikCari]);

  const muatPilihan = async () => {
    const { data } = await supabase.rpc('spa_pilihan_filter');
    if (!data) return;
    setPilihan({
      leasing: data.filter((d) => d.jenis === 'leasing').map((d) => d.nilai),
      sales: data.filter((d) => d.jenis === 'sales').map((d) => d.nilai),
    });
  };

  const muatData = async () => {
    setIsLoading(true);
    setGagal(false);
    let query = supabase
      .from('spa_penjualan')
      .select('*', { count: 'exact' })
      .order('tanggal_bastk', { ascending: false })
      .order('created_at', { ascending: false })
      .range(halaman * PER_HALAMAN, halaman * PER_HALAMAN + PER_HALAMAN - 1);
    if (leasing) query = query.eq('leasing', leasing);
    if (sales) query = query.eq('nama_sales', sales);
    // Tanda baca yang mengganggu filter "or" dibuang dari kata kunci
    const kunci = cari.replace(/[,()%*\\]/g, ' ').trim();
    if (kunci) query = query.or(`pemohon.ilike.%${kunci}%,no_bastk.ilike.%${kunci}%,nama_stnk.ilike.%${kunci}%`);
    const { data, count, error } = await query;
    if (error) {
      setGagal(true);
      setRows([]);
      setTotal(0);
    } else {
      setRows(data || []);
      setTotal(count || 0);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat ulang saat filter atau halaman berubah
    muatData();
  }, [halaman, leasing, sales, cari]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat daftar pilihan filter sekali saat halaman dibuka
    muatPilihan();
  }, []);

  const segarkan = () => { muatData(); muatPilihan(); };

  const executeDelete = async (row) => {
    tutupModal();
    // Hapus tepat satu baris (berdasarkan id) dan pastikan database benar-benar menghapusnya
    const { data: deleted, error } = await supabase.from('spa_penjualan').delete().eq('id', row.id).select();
    segarkan();
    if (error || !deleted || deleted.length === 0) {
      setModal({ isOpen: true, type: 'error', title: 'Gagal Menghapus', message: `Data SPA BASTK ${row.no_bastk} belum terhapus. Periksa koneksi internet lalu coba lagi.`, actionData: null });
      return;
    }
    setModal({ isOpen: true, type: 'success_delete', title: 'Terhapus!', message: 'Data SPA telah berhasil dihapus.', actionData: null });
  };

  const opsiLeasing = [
    { value: '', label: 'Semua Leasing' },
    ...[...new Set([...OPSI_PEMBIAYAAN.map((o) => o.value), ...pilihan.leasing])].map((v) => ({ value: v, label: labelPembiayaan(v) })),
  ];
  const opsiSales = [{ value: '', label: 'Semua Sales' }, ...pilihan.sales.map((v) => ({ value: v, label: v }))];
  const adaFilter = leasing || sales || ketikCari;
  const dari = total === 0 ? 0 : halaman * PER_HALAMAN + 1;
  const sampai = Math.min(total, (halaman + 1) * PER_HALAMAN);
  const adaSebelumnya = halaman > 0;
  const adaBerikutnya = sampai < total;

  const renderModal = () => {
    if (!modal.isOpen) return null;
    return createPortal(
      <div className="ui-overlay">
        <div className="absolute inset-0" onClick={tutupModal}></div>
        <div className="ui-modal">
          <div className="flex flex-col items-center text-center">
            {modal.type === 'success_delete' ? (
              <div className="ui-modal-icon-success"><CheckCircle2 className="w-6 h-6" /></div>
            ) : (
              <div className="ui-modal-icon-danger"><AlertCircle className="w-6 h-6" /></div>
            )}
            <h3 className="ui-modal-title">{modal.title}</h3>
            <p className="ui-modal-text">{modal.message}</p>
            <div className="flex w-full gap-3 justify-center">
              {modal.type === 'confirm_delete' ? (
                <><button onClick={tutupModal} className="ui-btn-secondary flex-1">Batal</button><button onClick={() => executeDelete(modal.actionData)} className="ui-btn-danger flex-1">Ya, Hapus!</button></>
              ) : (
                <button onClick={tutupModal} className="ui-btn-primary w-full">Mengerti</button>
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
      <div className="max-w-6xl mx-auto pb-12 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <h2 className="ui-page-title"><FolderOpen className="w-6 h-6 text-stone-500" /> Database Penjualan SPA</h2>
            <p className="ui-page-subtitle">Pantau dan kelola seluruh riwayat data penjualan yang telah diinput.</p>
          </div>
          <button onClick={segarkan} disabled={isLoading} className="ui-btn-sm w-full md:w-auto">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Segarkan Data
          </button>
        </div>

        <div className="ui-card overflow-hidden">
          <div className="ui-card-header">
            <h3 className="ui-card-title shrink-0"><Table2 className="w-4 h-4 text-stone-500" /> Daftar SPA Tersimpan</h3>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <PilihanDropdown ukuran="filter" value={leasing} onChange={(v) => { setLeasing(v); setHalaman(0); }} options={opsiLeasing} placeholder="Semua Leasing" className="w-full sm:w-48" />
              <PilihanDropdown ukuran="filter" value={sales} onChange={(v) => { setSales(v); setHalaman(0); }} options={opsiSales} placeholder="Semua Sales" className="w-full sm:w-40" />
              <div className="relative w-full sm:w-56">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input type="text" placeholder="Cari pemohon, BASTK..." value={ketikCari} onChange={(e) => setKetikCari(e.target.value)} className="ui-search" />
              </div>
              {adaFilter && (
                <button onClick={() => { setLeasing(''); setSales(''); setKetikCari(''); setHalaman(0); }} className="ui-btn-icon" title="Reset Filter">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="ui-table-wrap ui-scroll-thin">
            <table className="ui-table whitespace-nowrap">
              <thead className="ui-thead">
                <tr>
                  {KOLOM.map((k) => <th key={k} className={`ui-th ${KOLOM_UANG.includes(k) || k === 'Unit' || k === 'Tenor' ? 'text-right' : ''}`}>{k}</th>)}
                  <th className="ui-th text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {isLoading && rows.length === 0 ? (
                  <tr><td colSpan={KOLOM.length + 1} className="ui-empty"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-stone-400" /> Memuat data...</td></tr>
                ) : gagal ? (
                  <tr><td colSpan={KOLOM.length + 1} className="ui-empty"><AlertCircle className="w-6 h-6 mx-auto mb-3 text-red-700" /> Gagal terhubung ke server database.</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={KOLOM.length + 1} className="ui-empty">Tidak ada data SPA yang ditemukan.</td></tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="ui-tr">
                      <td className="ui-td ui-docno">{row.no_bastk}</td>
                      <td className="ui-td">{formatTanggal(row.tanggal_bastk)}</td>
                      <td className="ui-td">{labelPembiayaan(row.leasing)}</td>
                      <td className="ui-td font-semibold text-stone-900 uppercase">{row.pemohon}</td>
                      <td className="ui-td uppercase">{row.nama_stnk || '-'}</td>
                      <td className="ui-td font-mono">{row.no_hp1 || '-'}</td>
                      <td className="ui-td font-mono">{row.no_hp2 || '-'}</td>
                      <td className="ui-td">{row.pekerjaan || '-'}</td>
                      <td className="ui-td">{row.desa || '-'}</td>
                      <td className="ui-td">{row.kecamatan || '-'}</td>
                      <td className="ui-td font-mono text-right">{row.unit}</td>
                      <td className="ui-td">{row.jenis_motor || '-'}</td>
                      <td className="ui-td font-mono">{row.no_rangka || '-'}</td>
                      <td className="ui-td font-mono">{row.no_mesin || '-'}</td>
                      <td className="ui-td">{row.type_motor || '-'}</td>
                      <td className="ui-td">{row.warna || '-'}</td>
                      <td className="ui-td font-mono text-right text-stone-900">{rupiah(row.otr)}</td>
                      <td className="ui-td font-mono text-right font-semibold text-stone-900">{rupiah(row.dp_stor)}</td>
                      <td className="ui-td font-mono text-right text-stone-900">{rupiah(row.dp_gross)}</td>
                      <td className="ui-td font-mono text-right">{row.tenor ? `${row.tenor} bln` : '-'}</td>
                      <td className="ui-td font-mono text-right text-stone-900">{rupiah(row.angsuran)}</td>
                      <td className="ui-td font-mono text-right text-stone-900">{rupiah(row.subsidi)}</td>
                      <td className="ui-td">{row.nama_sales || '-'}</td>
                      <td className="ui-td">{row.keterangan ? <span className={BADGE_KETERANGAN[row.keterangan] || 'ui-badge-neutral'}>{row.keterangan}</span> : '-'}</td>
                      <td className="ui-td">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => navigate(`/penjualan/input-spa?id=${row.id}`)} className="ui-action">
                            <Edit className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button onClick={() => setModal({ isOpen: true, type: 'confirm_delete', title: 'Yakin Ingin Menghapus?', message: `Data SPA BASTK ${row.no_bastk} (${row.pemohon}) akan dihapus secara permanen dari sistem.`, actionData: row })} className="ui-action-danger">
                            <Trash2 className="w-3.5 h-3.5" /> Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-t border-stone-200">
            <p className="text-xs text-stone-500 tabular-nums">Menampilkan <b className="text-stone-900">{dari}–{sampai}</b> dari <b className="text-stone-900">{formatRupiah(total)}</b> data</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setHalaman((h) => h - 1)} disabled={!adaSebelumnya || isLoading} className={`ui-btn-sm flex-1 sm:flex-none ${!adaSebelumnya ? 'opacity-60 pointer-events-none' : ''}`}>
                <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
              </button>
              <button onClick={() => setHalaman((h) => h + 1)} disabled={!adaBerikutnya || isLoading} className={`ui-btn-sm flex-1 sm:flex-none ${!adaBerikutnya ? 'opacity-60 pointer-events-none' : ''}`}>
                Selanjutnya <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
