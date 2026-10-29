import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Printer, AlertCircle, RefreshCw, X, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function BukuServisPage() {
  const [bastkData, setBastkData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
    
    // ====================================================================
    // SAKTI: Logika Pemotongan Nama Motor (Hanya Ambil NAMA MOTOR SAJA)
    // Mengambil teks yang berada SEBELUM garis miring "/" pertama.
    // Contoh: "NEW SCOOPY STYLISH / F1C02N47S3 A/T" -> "NEW SCOOPY STYLISH"
    // ====================================================================
    let kodeTipeJenis = data.tipeKendaraan || '-';
    if (kodeTipeJenis.includes('/')) {
      const firstSlashIndex = kodeTipeJenis.indexOf('/');
      kodeTipeJenis = kodeTipeJenis.substring(0, firstSlashIndex).trim(); 
    }

    // Logika Ukuran Font Otomatis untuk Tipe Kendaraan
    let fontClassTipe = "font-normal"; 
    if (kodeTipeJenis.length > 22) {
      fontClassTipe = "font-sangat-kecil"; 
    } else if (kodeTipeJenis.length > 15) {
      fontClassTipe = "font-agak-kecil"; 
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

    // Logika Pemotongan Nama (PEMOHON / STNK)
    let namaCetak = data.namaKonsumen || '-';
    if (namaCetak.includes('/')) {
      const namaParts = namaCetak.split('/');
      namaCetak = namaParts[namaParts.length - 1].trim(); 
    }

    // Logika Ukuran Font Otomatis Nama (Mengecil jika kepanjangan)
    let fontClassNama = "font-normal"; 
    if (namaCetak.length > 25) {
      fontClassNama = "font-sangat-kecil"; 
    } else if (namaCetak.length > 18) {
      fontClassNama = "font-agak-kecil"; 
    }

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
            
            .table-1, .table-2 { margin-bottom: 13pt; } 
            
            .row-sm { height: 12pt; } 
            .row-lg { height: 21pt; } 
            
            .font-normal { font-size: 10pt; } 
            .font-kecil { font-size: 9pt; }   
            
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
              <td class="col-label">Tipe/Jenis</td><td class="col-value ${fontClassTipe}">${kodeTipeJenis}</td>
              <td class="col-gap"></td>
              <td class="col-label">Tipe/Jenis</td><td class="col-value ${fontClassTipe}">${kodeTipeJenis}</td>
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

  const getFilteredData = () => {
    return bastkData.filter((row) => {
      if (startDate && row.tglSerah < startDate) return false;
      if (endDate && row.tglSerah > endDate) return false;
      
      if (!searchTerm) return true;
      const keyword = searchTerm.toLowerCase();
      const searchString = `${row?.noSurat || ''} ${row?.namaKonsumen || ''}`.toLowerCase();
      return searchString.includes(keyword);
    });
  };

  const filteredData = getFilteredData();

  const exportToExcel = () => {
    if (filteredData.length === 0) {
      alert('Tidak ada data untuk diekspor ke Excel.');
      return;
    }

    let csvContent = `No. BASTK,Tanggal BASTK,Nama Konsumen,Tipe Kendaraan,Warna,No. Rangka,No. Mesin\n`;

    filteredData.forEach((row) => {
        const rowData = [
            `"${row.noSurat}"`,
            `"${row.tglSerah}"`,
            `"${row.namaKonsumen}"`,
            `"${row.tipeKendaraan}"`,
            `"${row.warna}"`,
            `"${row.noRangka}"`,
            `"${row.noMesin}"`
        ].join(",");
        csvContent += rowData + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Laporan_Buku_Servis_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div>
          <h1 className="ui-page-title"><BookOpen className="w-6 h-6 text-stone-500" /> Cetak Buku Servis</h1>
          <p className="ui-page-subtitle">Cetak stiker identitas buku servis konsumen (terintegrasi otomatis dengan data BASTK).</p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button onClick={fetchBastkData} className="ui-btn-sm flex-1 md:flex-none">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={exportToExcel} className="ui-btn-sm flex-1 md:flex-none">
            <Download className="w-4 h-4" /> Ekspor Excel
          </button>
        </div>
      </div>

      <div className="ui-card overflow-hidden">

        <div className="border-b border-stone-200 px-5 py-3.5 flex flex-col sm:flex-row items-center gap-3 w-full">
          <div className="relative w-full sm:w-1/3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Cari nama atau No. BASTK..."
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
              className="ui-btn-icon ml-auto sm:ml-0"
              title="Reset Filter"
            >
               <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="overflow-auto max-h-[600px] ui-scroll-thin">
          <table className="ui-table min-w-[900px] lg:min-w-full">
            <thead className="ui-thead">
              <tr>
                <th className="ui-th">No. BASTK</th>
                <th className="ui-th">Konsumen & Kendaraan</th>
                <th className="ui-th">Tanggal BASTK</th>
                <th className="ui-th text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr><td colSpan="4" className="ui-empty"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-stone-400" /> Memuat data...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan="4" className="ui-empty"><AlertCircle className="w-6 h-6 mx-auto mb-3 text-stone-400" /> Belum ada data BASTK.</td></tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={idx} className="ui-tr">
                    <td className="ui-td ui-docno">{item.noSurat}</td>
                    <td className="ui-td whitespace-nowrap">
                      <div className="font-semibold text-stone-900">{item.namaKonsumen}</div>
                      <div className="text-xs text-stone-500 mt-0.5">{item.tipeKendaraan} • {item.warna}</div>
                    </td>
                    <td className="ui-td text-stone-700 whitespace-nowrap">
                      {item.tglSerah ? item.tglSerah.split('-').reverse().join('/') : '-'}
                    </td>
                    <td className="ui-td text-right whitespace-nowrap">
                      <button onClick={() => handlePrint(item)} className="ui-btn-sm">
                        <Printer className="w-4 h-4" /> Cetak Stiker
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
