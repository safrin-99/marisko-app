// Daftar pilihan yang dipakai bersama oleh BASTK dan Modul Penjualan (SPA).
// Ubah di sini saja bila ada kategori/leasing baru, agar kedua halaman tetap sama.

export const DAFTAR_KATEGORI = ['BASTK INDUK', 'BASTK POS BUOL', 'BASTK POS LAKEA'];

export const OPSI_PEMBIAYAAN = [
  { value: 'CASH', label: 'CASH (MARISKO PERKASA)' },
  { value: 'ADIRA', label: 'PT. ADIRA MULTI FINANCE' },
  { value: 'FIF', label: 'PT. FEDERAL INTERNATIONAL FINANCE' },
  { value: 'MANDALA', label: 'PT. 1204 ADIRA SYARIEF MANSYUR' }
];

// Nama leasing untuk ditampilkan; nilai lama dari Excel (mis. MMF) tampil apa adanya
export const labelPembiayaan = (nilai) => OPSI_PEMBIAYAAN.find((o) => o.value === nilai)?.label || nilai || '-';
