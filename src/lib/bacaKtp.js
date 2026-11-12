// SAKTI: Baca KTP langsung di browser (Tesseract.js). Foto KTP tidak dikirim ke server mana pun
// dan tidak disimpan; hanya teks hasil bacaan yang dipakai untuk mengisi form.

const LABEL = {
  nik: 'NIK',
  nama: 'NAMA',
  lahir: 'TEMPAT/TGL LAHIR',
  desa: 'KEL/DESA',
  kecamatan: 'KECAMATAN',
};

// Jarak edit sederhana untuk mencocokkan label yang salah baca (mis. "Kel/Desm" -> "KEL/DESA")
const jarak = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
};

const bersihkanNilai = (teks) => teks.toUpperCase().replace(/[^A-Z0-9'.,/\- ]/g, ' ').replace(/\s+/g, ' ').trim();
// Buang potongan sampah di ujung (mis. "MULAT AG", "ZAINUDIN DD") & tanda baca sisa
const rapikan = (teks) => bersihkanNilai(teks).replace(/^[.,\-/ ]+|[.,\-/ ]+$/g, '').replace(/(\s+[A-Z]{1,2})+$/, '').trim();

// Huruf yang sering tertukar dengan angka pada baris NIK
const KE_ANGKA = { O: '0', D: '0', Q: '0', I: '1', L: '1', '|': '1', '!': '1', Z: '2', S: '5', G: '6', B: '8' };

export function uraiKtp(teks) {
  const hasil = { nama: '', nik: '', desa: '', kecamatan: '', kabupaten: '', tglLahir: '', perempuan: null };

  for (const barisMentah of teks.split('\n')) {
    const baris = barisMentah.replace(/^[^A-Za-z]+/, '').trim();
    if (!baris) continue;

    const wilayah = baris.toUpperCase().match(/\b(KABUPATEN|KOTA)\s+([A-Z][A-Z ]+)/);
    if (wilayah && !hasil.kabupaten) hasil.kabupaten = `${wilayah[1] === 'KOTA' ? 'KOTA' : 'KAB.'} ${bersihkanNilai(wilayah[2])}`;

    if (/PEREMPUAN|WANITA/i.test(baris)) hasil.perempuan = true;
    else if (/LAKI/i.test(baris) && hasil.perempuan === null) hasil.perempuan = false;

    // Pisahkan label & isi pada ":" pertama (titik dua sering terbaca sebagai ".", "—" atau "|")
    const pemisah = baris.search(/\s*[:.—|]\s*/);
    if (pemisah <= 0) continue;
    const label = baris.slice(0, pemisah).toUpperCase().replace(/\s+/g, ' ').trim();
    const isi = baris.slice(pemisah).replace(/^[\s:.—|-]+/, '');

    let cocok = null;
    let terdekat = 3;
    for (const [kunci, target] of Object.entries(LABEL)) {
      const j = jarak(label, target);
      const batas = target.length <= 4 ? 1 : 3;
      if (j <= batas && j < terdekat) { cocok = kunci; terdekat = j; }
    }
    if (!cocok && /LAHIR/.test(label)) cocok = 'lahir';

    if (cocok === 'nik' && !hasil.nik) {
      const angka = isi.toUpperCase().replace(/\s+/g, '').split('').map((c) => KE_ANGKA[c] ?? c).join('').replace(/\D/g, '');
      if (angka.length >= 16) hasil.nik = angka.slice(0, 16);
    } else if (cocok === 'nama' && !hasil.nama) {
      hasil.nama = rapikan(isi);
    } else if (cocok === 'desa' && !hasil.desa) {
      hasil.desa = rapikan(isi).replace(/^(DESA|DS)\.?\s*/, '');
    } else if (cocok === 'kecamatan' && !hasil.kecamatan) {
      hasil.kecamatan = rapikan(isi).replace(/^(KEC(AMATAN)?)\.?\s*/, '');
    } else if (label === 'ALAMAT' && !hasil.desaAlamat) {
      // Cadangan bila baris Kel/Desa gagal terbaca: "Alamat : DESA MULAT"
      const desaAlamat = rapikan(isi).match(/^(?:DESA|DS)\.?\s*([A-Z][A-Z ]+)/);
      if (desaAlamat) hasil.desaAlamat = desaAlamat[1].trim();
    } else if (cocok === 'lahir' && !hasil.tglLahir) {
      const tgl = isi.match(/(\d{2})[-/.](\d{2})[-/.](\d{4})/);
      if (tgl) hasil.tglLahir = `${tgl[1]}-${tgl[2]}-${tgl[3]}`;
    }
  }

  if (!hasil.desa && hasil.desaAlamat) hasil.desa = hasil.desaAlamat;
  delete hasil.desaAlamat;
  return hasil;
}

// NIK 16 digit; digit ke-7 s.d. 12 = tanggal lahir DDMMYY (perempuan: tanggal + 40)
export function cekNik(nik, tglLahir, perempuan) {
  if (!/^\d{16}$/.test(nik)) return 'NIK harus 16 digit.';
  if (!tglLahir) return '';
  const [dd, mm, yyyy] = tglLahir.split('-');
  const tanggal = String(Number(dd) + (perempuan ? 40 : 0)).padStart(2, '0');
  const harapan = `${tanggal}${mm}${yyyy.slice(2)}`;
  if (perempuan === null) {
    const tanpaJenis = [`${dd}${mm}${yyyy.slice(2)}`, `${String(Number(dd) + 40)}${mm}${yyyy.slice(2)}`];
    return tanpaJenis.includes(nik.slice(6, 12)) ? '' : 'NIK tidak cocok dengan tanggal lahir di KTP.';
  }
  return nik.slice(6, 12) === harapan ? '' : 'NIK tidak cocok dengan tanggal lahir di KTP.';
}

export function susunAlamat({ desa, kecamatan, kabupaten }) {
  return [desa && `DESA ${desa}`, kecamatan && `KEC. ${kecamatan}`, kabupaten].filter(Boolean).join(' ');
}

const lengkap = (h) => h.nama && h.nik && h.desa && h.kecamatan;
const gabung = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, a[k] || a[k] === false ? a[k] : b[k]]));

// Siapkan gambar: abu-abu + kontras, diperbesar; versi "potong" membuang sisi kanan (pas foto)
async function siapkanGambar(file, potong) {
  const bitmap = await createImageBitmap(file);
  const lebarSumber = potong ? Math.round(bitmap.width * 0.74) : bitmap.width;
  const skala = Math.min(2, 2000 / lebarSumber);
  const kanvas = document.createElement('canvas');
  kanvas.width = Math.round(lebarSumber * skala);
  kanvas.height = Math.round(bitmap.height * skala);
  const ctx = kanvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, lebarSumber, bitmap.height, 0, 0, kanvas.width, kanvas.height);
  bitmap.close?.();
  const gambar = ctx.getImageData(0, 0, kanvas.width, kanvas.height);
  const px = gambar.data;
  for (let i = 0; i < px.length; i += 4) {
    const abu = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const nilai = Math.max(0, Math.min(255, (abu - 128) * 1.8 + 141));
    px[i] = px[i + 1] = px[i + 2] = nilai;
  }
  ctx.putImageData(gambar, 0, 0);
  return kanvas;
}

export async function scanKtp(file, onProgress) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('ind', 1, {
    logger: (m) => { if (m.status === 'recognizing text' && onProgress) onProgress(m.progress); },
  });
  try {
    // rotateAuto: luruskan otomatis foto yang sedikit miring
    let hasil = uraiKtp((await worker.recognize(await siapkanGambar(file, true), { rotateAuto: true })).data.text);
    // Bila ada isian penting yang belum terbaca, ulangi dengan gambar utuh (KTP yang difoto lebih lebar)
    if (!lengkap(hasil)) hasil = gabung(hasil, uraiKtp((await worker.recognize(await siapkanGambar(file, false), { rotateAuto: true })).data.text));
    return { ...hasil, peringatanNik: hasil.nik ? cekNik(hasil.nik, hasil.tglLahir, hasil.perempuan) : '' };
  } finally {
    await worker.terminate();
  }
}
