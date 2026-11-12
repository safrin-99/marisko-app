import { useRef } from 'react';

// SAKTI: Nomor dokumen otomatis (No. Invoice dsb.) dengan meniru nomor terakhir yang sudah dipakai.
// Contoh: KWI-0718 -> KWI-0719, CSH-099 -> CSH-100, 012/NOTA/X/2026 -> 013/NOTA/<bulan ini>/<tahun ini>
const BULAN_ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const SEPERTI_TAHUN = (teks) => teks.length === 4 && Number(teks) >= 2000 && Number(teks) <= 2099;

// Pisahkan teks & angka: "KWI-0718" -> ["KWI-", "0718", ""] (indeks ganjil = angka)
const pecah = (nomor) => nomor.trim().split(/(\d+)/);
const kerangka = (bagian) => bagian.filter((_, i) => i % 2 === 0).join('#');

export function nomorBerikutnya(daftarNomor) {
  const terbaru = (daftarNomor || []).filter((n) => typeof n === 'string' && n.trim()).slice(0, 10);
  if (terbaru.length === 0) return null;

  // Acuan = nomor paling baru; hanya nomor dengan bentuk yang sama yang ikut dihitung
  const acuan = pecah(terbaru[0]);
  const jumlahAngka = (acuan.length - 1) / 2;
  if (jumlahAngka < 1) return null;
  const sebentuk = terbaru.map(pecah).filter((b) => kerangka(b) === kerangka(acuan));
  const nilai = (b, g) => parseInt(b[2 * g + 1], 10);

  // Bagian angka yang berubah-ubah antar nomor = nomor urut; bila belum terlihat, pilih yang bukan tahun
  let urut = -1;
  let ragamTerbanyak = 1;
  for (let g = 0; g < jumlahAngka; g++) {
    const ragam = new Set(sebentuk.map((b) => nilai(b, g))).size;
    if (ragam > ragamTerbanyak) { urut = g; ragamTerbanyak = ragam; }
  }
  if (urut < 0) {
    urut = acuan.findIndex((teks, i) => i % 2 === 1 && !SEPERTI_TAHUN(teks));
    urut = urut < 0 ? jumlahAngka - 1 : (urut - 1) / 2;
  }

  const sekarang = new Date();
  const hasil = [...acuan];
  hasil[2 * urut + 1] = String(Math.max(...sebentuk.map((b) => nilai(b, urut))) + 1).padStart(acuan[2 * urut + 1].length, '0');
  for (let g = 0; g < jumlahAngka; g++) {
    if (g !== urut && SEPERTI_TAHUN(hasil[2 * g + 1])) hasil[2 * g + 1] = String(sekarang.getFullYear());
  }
  // Bulan romawi (diapit / atau -) mengikuti bulan berjalan
  return hasil.join('').replace(/([/-])(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)(?=[/-]|$)/, `$1${BULAN_ROMAWI[sekarang.getMonth()]}`);
}

// Isi kolom nomor dengan usulan, kecuali pengguna sudah mengetik nomor sendiri / sedang mengedit
export function useNomorOtomatis(setNomor) {
  const usulanTerakhir = useRef('');
  return (daftarNomor) => {
    const usulan = nomorBerikutnya(daftarNomor) || '';
    const sebelumnya = usulanTerakhir.current;
    usulanTerakhir.current = usulan;
    setNomor((prev) => (prev === '' || prev === sebelumnya ? usulan : prev));
  };
}
