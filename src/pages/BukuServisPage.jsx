import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Printer, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function BukuServisPage() {
  const [bastkData, setBastkData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBastkData();
  }, []);

  const fetchBastkData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bastk_history')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setBastkData(data);
      }
    } catch (err) {
      console.error("Gagal menarik data BASTK", err);
    }
    setIsLoading(false);
  };

  const handlePrint = (data) => {
    const printWindow = window.open('', '_blank', 'width=1000,height=700');
    
    // Logika Pemotongan Nama Motor
    let kodeTipeJenis = data.tipeKendaraan || '-';
    if (kodeTipeJenis.includes(' / ')) {
      const parts = kodeTipeJenis.split(' / ');
      kodeTipeJenis = parts[parts.length - 1].trim(); 
    }

    // Logika Pemotongan Alamat (Hanya mengambil bagian sebelum kata "KEC")
    let alamatCetak = data.alamat || '-';
    const upperAlamat = alamatCetak.toUpperCase();
    if (upperAlamat.includes(' KEC')) {
      alamatCetak = alamatCetak.substring(0, upperAlamat.indexOf(' KEC')).trim();
    }

    // Logika Perbaikan dan Format Tanggal Pembelian (DD/MM/YYYY)
    let tglBeli = '-';
    if (data.tglSerah) {
      const parts = data.tglSerah.split('-');
      if (parts.length === 3) {
        tglBeli = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        tglBeli = data.tglSerah;
      }
    }

    // ====================================================================
    // SAKTI 1: LOGIKA PEMOTONGAN NAMA (PEMOHON / STNK)
    // ====================================================================
    let namaCetak = data.namaKonsumen || '-';
    if (namaCetak.includes('/')) {
      // Jika ada tanda "/", pecah namanya, lalu ambil bagian paling belakang (Nama STNK), lalu bersihkan spasinya.
      const namaParts = namaCetak.split('/');
      namaCetak = namaParts[namaParts.length - 1].trim(); 
    }

    // ====================================================================
    // SAKTI 2: LOGIKA UKURAN FONT OTOMATIS (Mengecil jika kepanjangan)
    // ====================================================================
    // Normal = 10pt. Jika lebih dari 20 karakter = 8pt. Jika lebih dari 25 karakter = 7pt.
    let fontClassNama = "font-normal"; // bawaan 10pt
    if (namaCetak.length > 25) {
      fontClassNama = "font-sangat-kecil"; // 7pt
    } else if (namaCetak.length > 18) {
      fontClassNama = "font-agak-kecil"; // 8.5pt
    }

    // HTML MURNI MENIRU SEL EXCEL PRESISI TINGGI
    const htmlContent = `
      <html>
        <head>
          <title>Cetak Buku Servis - ${namaCetak}</title>
          <style>
            @media screen {
              body { display: none; }
            }
            
            @media print {
              @page { size: A4 portrait; margin: 0; } 
              body { 
                display: block; 
                padding: 15mm; 
                -webkit-print-color-adjust: exact; 
              }
            }
            
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1;
              color: #000;
              margin: 0;
              background-color: #ffffff;
            }
            table { 
              border-collapse: collapse; 
              width: 100%;
              max-width: 180mm; 
              table-layout: fixed; 
            }
            
            /* Jarak antar blok meniru baris kosong Excel persis 13pt */
            .table-1, .table-2 { margin-bottom: 13pt; } 
            
            /* Tinggi baris dibedakan persis seperti data Excel fisik Anda! */
            .row-sm { height: 12pt; } /* Area Identitas (Kotak Merah) */
            .row-lg { height: 21pt; } /* Area Kupon KPB (Kotak Kuning) */
            
            /* Perbedaan Font sesuai analisa Excel */
            .font-normal { font-size: 10pt; } /* Teks biasa & Label */
            .font-kecil { font-size: 9pt; }   /* Khusus Teks isian Kupon KPB */
            
            /* SAKTI: Class khusus untuk nama yang kepanjangan */
            .font-agak-kecil { font-size: 8.5pt; font-weight: bold; } 
            .font-sangat-kecil { font-size: 7.5pt; font-weight: bold; letter-spacing: -0.5px; } 

            td { 
              padding: 0 4px; 
              vertical-align: middle; 
              white-space: nowrap; 
              overflow: hidden; 
            }
            .col-label { width: 23%; }
            .col-value { width: 25%; }
            .col-gap { width: 4%; }
          </style>
        </head>
        <body onload="window.print(); window.onafterprint = function(){ window.close(); }">
          
          <table class="table-1 font-normal">
            <tr class="row-sm">
              <td class="col-label">Tipe/Jenis</td><td class="col-value">${kodeTipeJenis}</td>
              <td class="col-gap"></td>
              <td class="col-label">Tipe/Jenis</td><td class="col-value">${kodeTipeJenis}</td>
            </tr>
            <tr class="row-sm">
              <td class="col-label">Warna</td><td class="col-value">${data.warna || '-'}</td>
              <td class="col-gap"></td>
              <td class="col-label">Warna</td><td class="col-value">${data.warna || '-'}</td>
            </tr>
            <tr class="row-sm">
              <td class="col-label">No. Seri Rangka</td><td class="col-value">${data.noRangka || '-'}</td>
              <td class="col-gap"></td>
              <td class="col-label">No. Seri Rangka</td><td class="col-value">${data.noRangka || '-'}</td>
            </tr>
            <tr class="row-sm">
              <td class="col-label">No. Seri Mesin</td><td class="col-value">${data.noMesin || '-'}</td>
              <td class="col-gap"></td>
              <td class="col-label">No. Seri Mesin</td><td class="col-value">${data.noMesin || '-'}</td>
            </tr>
            <tr class="row-sm">
              <td class="col-label">No. Polisi</td><td class="col-value">DN</td>
              <td class="col-gap"></td>
              <td class="col-label">No. Polisi</td><td class="col-value">DN</td>
            </tr>
            <tr class="row-sm">
              <td class="col-label">Nama Pemilik</td><td class="col-value ${fontClassNama}">${namaCetak}</td>
              <td class="col-gap"></td>
              <td class="col-label">Nama Pemilik</td><td class="col-value ${fontClassNama}">${namaCetak}</td>
            </tr>
            <tr class="row-sm">
              <td class="col-label">Alamat</td><td class="col-value">${alamatCetak}</td>
              <td class="col-gap"></td>
              <td class="col-label">Alamat</td><td class="col-value">${alamatCetak}</td>
            </tr>
          </table>

          <table class="table-2">
            <tr class="row-lg">
              <td class="col-label font-normal">No. Polisi</td><td class="col-value font-kecil">DN</td>
              <td class="col-gap"></td>
              <td class="col-label font-normal">No. Polisi</td><td class="col-value font-kecil">DN</td>
            </tr>
            <tr class="row-lg">
              <td class="col-label font-normal">No. Rangka</td><td class="col-value font-kecil">${data.noRangka || '-'}</td>
              <td class="col-gap"></td>
              <td class="col-label font-normal">No. Rangka</td><td class="col-value font-kecil">${data.noRangka || '-'}</td>
            </tr>
            <tr class="row-lg">
              <td class="col-label font-normal">No. Mesin</td><td class="col-value font-kecil">${data.noMesin || '-'}</td>
              <td class="col-gap"></td>
              <td class="col-label font-normal">No. Mesin</td><td class="col-value font-kecil">${data.noMesin || '-'}</td>
            </tr>
            <tr class="row-lg">
              <td class="col-label font-normal">Tgl. Pembelian</td><td class="col-value font-kecil">${tglBeli}</td>
              <td class="col-gap"></td>
              <td class="col-label font-normal">Tgl. Pembelian</td><td class="col-value font-kecil">${tglBeli}</td>
            </tr>
          </table>

          <table class="table-3">
            <tr class="row-lg">
              <td class="col-label font-normal">No. Polisi</td><td class="col-value font-kecil">DN</td>
              <td class="col-gap"></td>
              <td class="col-label font-normal">No. Polisi</td><td class="col-value font-kecil">DN</td>
            </tr>
            <tr class="row-lg">
              <td class="col-label font-normal">No. Rangka</td><td class="col-value font-kecil">${data.noRangka || '-'}</td>
              <td class="col-gap"></td>
              <td class="col-label font-normal">No. Rangka</td><td class="col-value font-kecil">${data.noRangka || '-'}</td>
            </tr>
            <tr class="row-lg">
              <td class="col-label font-normal">No. Mesin</td><td class="col-value font-kecil">${data.noMesin || '-'}</td>
              <td class="col-gap"></td>
              <td class="col-label font-normal">No. Mesin</td><td class="col-value font-kecil">${data.noMesin || '-'}</td>
            </tr>
            <tr class="row-lg">
              <td class="col-label font-normal">Tgl. Pembelian</td><td class="col-value font-kecil">${tglBeli}</td>
              <td class="col-gap"></td>
              <td class="col-label font-normal">Tgl. Pembelian</td><td class="col-value font-kecil">${tglBeli}</td>
            </tr>
          </table>

        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const filteredData = bastkData.filter(item => 
    item.namaKonsumen?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.noSurat?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 antialiased">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center"><BookOpen className="w-8 h-8 mr-3 text-indigo-600" /> Cetak Buku Servis</h1>
          <p className="text-slate-500 font-medium mt-1">Cetak stiker identitas buku servis konsumen (terintegrasi otomatis dengan data BASTK).</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari nama atau No. BASTK..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden antialiased">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px] lg:min-w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-widest">
                <th className="p-5 font-extrabold whitespace-nowrap">No. BASTK</th>
                <th className="p-5 font-extrabold whitespace-nowrap">Konsumen & Kendaraan</th>
                <th className="p-5 font-extrabold whitespace-nowrap">Tanggal BASTK</th>
                <th className="p-5 font-extrabold text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan="4" className="py-12 text-center text-slate-400 font-bold"><RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" /> Memuat data...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan="4" className="py-12 text-center text-slate-400 font-bold"><AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-50" /> Belum ada data BASTK.</td></tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="p-5 font-black text-sm text-slate-900 whitespace-nowrap">{item.noSurat}</td>
                    <td className="p-5 whitespace-nowrap">
                      <div className="font-extrabold text-sm text-slate-900">{item.namaKonsumen}</div>
                      {/* SAKTI: Di sini juga diperbaiki agar warnanya muncul di tabel layar monitor */}
                      <div className="font-bold text-xs text-indigo-600 mt-1">{item.tipeKendaraan} • {item.warna}</div>
                    </td>
                    <td className="p-5 font-bold text-sm text-slate-600 whitespace-nowrap">{item.tglSerah}</td>
                    <td className="p-5 text-center whitespace-nowrap">
                      <button onClick={() => handlePrint(item)} className="inline-flex items-center justify-center px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl font-bold text-xs transition-all active:scale-95 shadow-sm">
                        <Printer className="w-4 h-4 mr-2" /> Cetak Stiker
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}