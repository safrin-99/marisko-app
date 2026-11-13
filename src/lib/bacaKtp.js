// SAKTI: Baca KTP langsung di browser (Tesseract.js). Foto KTP tidak dikirim ke server mana pun
// dan tidak disimpan; hanya teks hasil bacaan yang dipakai untuk mengisi form.
// Hasil bacaan lalu dicocokkan dengan data wilayah Kemendagri (wilayahKtp.json) untuk membetulkan
// huruf/angka yang salah baca pada Desa, Kecamatan, Kabupaten, dan NIK.
// Sumber data wilayah: idn-area-data v4.0.1 (data Kepmendagri, lisensi ODbL 1.0); desa/kelurahan hanya
// untuk Sulawesi Tengah & Gorontalo, kabupaten & kecamatan untuk seluruh Indonesia.

// Label baris KTP beserta batas salah baca yang masih diterima (mis. "KellDesa" = "KEL/DESA")
const LABEL = {
  nik: ['NIK', 1],
  nama: ['NAMA', 1],
  lahir: ['TEMPAT/TGL LAHIR', 4],
  alamat: ['ALAMAT', 1],
  desa: ['KEL/DESA', 2],
  kecamatan: ['KECAMATAN', 3],
};

// Jarak edit sederhana untuk mencocokkan teks yang salah baca
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

// Gelar di belakang nama, mis. "S.Kep-.Ns" -> "S.KEP.NS"; kosong bila tidak berbentuk gelar
const bacaGelar = (teks) => {
  const t = teks.toUpperCase().replace(/[^A-Z.,]/g, '').replace(/^[.,]+|[,]+$/g, '');
  return /^[A-Z]{1,6}(\.[A-Z]{1,6}){1,4}\.?(,[A-Z]{1,6}(\.[A-Z]{1,6})*\.?)*$/.test(t) ? t : '';
};
// Gelar akademik yang umum di KTP. Gelar yang terbaca meleset 1 huruf (mis. "S.KEPNSE") disamakan ke sini;
// gelar lain dibiarkan apa adanya dan admin diberi catatan untuk mencocokkan.
const GELAR_UMUM = [
  'S.KEP.NS', 'S.KEP', 'NS', 'S.PD', 'S.PD.I', 'S.PD.SD', 'S.IP', 'S.H', 'S.E', 'S.SOS', 'S.KOM', 'S.T', 'S.SI', 'S.AG',
  'S.HUT', 'S.P', 'S.PT', 'S.TP', 'S.PI', 'S.FARM', 'S.KED', 'S.KM', 'S.PSI', 'S.KES', 'S.GZ', 'S.TR', 'S.ST', 'S.KEB',
  'S.TR.KEB', 'S.AK', 'S.STP', 'S.I.KOM', 'S.HI', 'S.TH.I', 'S.SY', 'S.KH', 'S.ARS', 'A.MD', 'A.MD.KEP', 'A.MD.KEB',
  'A.MD.FARM', 'A.MD.KES', 'A.MA', 'A.MA.PD', 'M.PD', 'M.SI', 'M.M', 'M.H', 'M.KES', 'M.KEP', 'M.KOM', 'M.T', 'M.E',
  'M.AG', 'M.AP', 'M.SC', 'M.PH', 'DR', 'DRS', 'DRA', 'IR', 'APT', 'BC',
];
function rapikanGelar(gelar) {
  let dikenal = true;
  const hasil = gelar.split(',').filter(Boolean).map((bagian) => {
    const k = bagian.replace(/[^A-Z]/g, '');
    const persis = GELAR_UMUM.find((g) => g.replace(/\./g, '') === k);
    if (persis) return persis;
    const mirip = GELAR_UMUM.filter((g) => k.length >= 4 && jarak(k, g.replace(/\./g, '')) === 1);
    if (mirip.length === 1) return mirip[0];
    dikenal = false;
    return bagian;
  });
  return { gelar: hasil.join(', '), dikenal };
}

// Pisahkan label & isi. Titik dua sering terbaca ".", "—", "|", " -" atau hilang sama sekali
// ("KellDesa “TEOKE"), jadi bila label belum dikenali, coba 1-3 kata pertama sebagai label.
function pisahLabel(baris) {
  const coba = [];
  const p = baris.search(/\s*[:.—|]\s*|\s+-/);
  if (p > 0) coba.push([baris.slice(0, p), baris.slice(p)]);
  const kata = baris.split(/\s+/);
  for (let n = 1; n <= Math.min(3, kata.length - 1); n++) coba.push([kata.slice(0, n).join(' '), kata.slice(n).join(' ')]);
  for (const [labelMentah, isi] of coba) {
    const label = labelMentah.toUpperCase().replace(/\s+/g, ' ').trim();
    let cocok = null;
    let terdekat = Infinity;
    for (const [kunciLabel, [target, batas]] of Object.entries(LABEL)) {
      const j = jarak(label, target);
      if (j <= batas && j < terdekat) { cocok = kunciLabel; terdekat = j; }
    }
    if (!cocok && /LAHIR/.test(label)) cocok = 'lahir';
    if (!cocok && /^[A-Z]{1,4}\/?DESA$/.test(label.replace(/[^A-Z/]/g, ''))) cocok = 'desa'; // "Kaif/Desa", "KelDesa"
    if (cocok) return { label: cocok, isi: isi.replace(/^[\s:.—|"“”'-]+/, '') };
  }
  return null;
}

export function uraiKtp(teks) {
  const hasil = {
    nama: '', gelar: '', namaBergelar: false, nikMentah: '', desa: '', jenisDesa: '', desaAlamat: '', jenisDesaAlamat: '',
    kecamatan: '', kabupaten: '', jenisKabupaten: '', provinsi: '', tglLahir: '', perempuan: null,
  };
  let barisSetelahNama = false;

  for (const barisMentah of teks.split('\n')) {
    const baris = barisMentah.replace(/^[^A-Za-z]+/, '').trim();
    if (!baris) continue;
    const lanjutanNama = barisSetelahNama;
    barisSetelahNama = false;
    const kata = baris.toUpperCase().split(/\s+/);

    // Kepala KTP (di atas baris NIK): "PROVINSI SULAWESI TENGAH" / "KABUPATEN BUOL" / "KOTA PALU"
    if (!hasil.nikMentah) {
      const iKab = kata.slice(0, 2).findIndex((k) => k === 'KOTA' || jarak(k, 'KABUPATEN') <= 2);
      if (iKab >= 0 && !hasil.kabupaten && kata.length > iKab + 1) {
        hasil.jenisKabupaten = kata[iKab] === 'KOTA' ? 'KOTA' : 'KAB.';
        hasil.kabupaten = bersihkanNilai(kata.slice(iKab + 1).join(' '));
        continue;
      }
      const iProv = kata.slice(0, 2).findIndex((k) => jarak(k, 'PROVINSI') <= 2);
      if (iProv >= 0 && !hasil.provinsi && kata.length > iProv + 1) {
        hasil.provinsi = bersihkanNilai(kata.slice(iProv + 1).join(' '));
        continue;
      }
    }

    // Baris NIK: simpan apa adanya (huruf besar/kecil dipakai untuk menebak angka, mis. "b" = 6)
    const tokenAwal = kata[0].replace(/[^A-Z]/g, '');
    if (!hasil.nikMentah && tokenAwal.length >= 2 && jarak(tokenAwal, 'NIK') <= 1) {
      const sisa = baris.slice(kata[0].length).replace(/^[\s:.—|-]+/, '');
      if ((sisa.match(/[0-9A-Za-z?|!#]/g) || []).length >= 14) { hasil.nikMentah = sisa; continue; }
    }

    if (/PEREMPUAN|WANITA/i.test(baris)) hasil.perempuan = true;
    else if (/LAKI/i.test(baris) && hasil.perempuan === null) hasil.perempuan = false;

    const pasangan = pisahLabel(baris);
    if (!pasangan) {
      // Baris kedua nama berisi gelar, mis. "MOHAMMAD TAUFIK HIDAYAT," lalu "S.Kep.Ns"
      if (lanjutanNama && !hasil.gelar) hasil.gelar = bacaGelar(baris);
      continue;
    }
    const { label, isi } = pasangan;

    if (label === 'nik' && !hasil.nikMentah) {
      hasil.nikMentah = isi;
    } else if (label === 'nama' && !hasil.nama) {
      const [namaSaja, ...gelar] = isi.split(',');
      hasil.nama = rapikan(namaSaja);
      hasil.namaBergelar = gelar.length > 0;
      hasil.gelar = bacaGelar(gelar.join(','));
      barisSetelahNama = hasil.namaBergelar && !hasil.gelar;
    } else if (label === 'desa' && !hasil.desa) {
      const awalan = bersihkanNilai(isi).match(/^(DESA|DS|KEL(URAHAN)?)(\.\s*|\s+)/);
      if (awalan) hasil.jenisDesa = awalan[1].startsWith('KEL') ? 'KEL.' : 'DESA';
      hasil.desa = bersihkanNilai(isi).replace(/^(DESA|DS|KEL(URAHAN)?)(\.\s*|\s+)/, '');
    } else if (label === 'kecamatan' && !hasil.kecamatan) {
      hasil.kecamatan = bersihkanNilai(isi).replace(/^(KEC(AMATAN)?)(\.\s*|\s+)/, '');
    } else if (label === 'alamat' && !hasil.desaAlamat) {
      // "Alamat : DESA MULAT" / "Alamat : KEL. LEOK II": cadangan nama desa bila baris Kel/Desa gagal
      // terbaca, sekaligus petunjuk apakah tempat itu desa atau kelurahan
      const desaAlamat = bersihkanNilai(isi).match(/(?:^|\s)(DESA|DS[.\s]|KELURAHAN|KEL[.\s])\s*([A-Z][A-Z0-9 ]+)/);
      if (desaAlamat) {
        hasil.desaAlamat = desaAlamat[2].trim();
        hasil.jenisDesaAlamat = desaAlamat[1].startsWith('KEL') ? 'KEL.' : 'DESA';
      }
    } else if (label === 'lahir' && !hasil.tglLahir) {
      const tgl = isi.match(/(\d{2})[-/.](\d{2})[-/.](\d{4})/);
      if (tgl) hasil.tglLahir = `${tgl[1]}-${tgl[2]}-${tgl[3]}`;
    }
  }
  return hasil;
}

// NIK 16 digit; digit ke-7 s.d. 12 = tanggal lahir DDMMYY (perempuan: tanggal + 40)
const kodeTanggal = (tglLahir, perempuan) => {
  const [dd, mm, yyyy] = tglLahir.split('-');
  return `${String(Number(dd) + (perempuan ? 40 : 0)).padStart(2, '0')}${mm}${yyyy.slice(2)}`;
};
export function cekNik(nik, tglLahir, perempuan) {
  if (!/^\d{16}$/.test(nik)) return 'NIK harus 16 digit.';
  if (!tglLahir) return '';
  const harapan = perempuan === null ? [kodeTanggal(tglLahir, false), kodeTanggal(tglLahir, true)] : [kodeTanggal(tglLahir, perempuan)];
  return harapan.includes(nik.slice(6, 12)) ? '' : 'NIK tidak cocok dengan tanggal lahir di KTP.';
}

export function susunAlamat({ desa, kelurahan, kecamatan, kabupaten }) {
  return [desa && `${kelurahan ? 'KEL.' : 'DESA'} ${desa}`, kecamatan && `KEC. ${kecamatan}`, kabupaten].filter(Boolean).join(' ');
}

// ---------- Pencocokan dengan data wilayah ----------

// Kunci pembanding: huruf saja; angka 1/0 dianggap I/O (mis. "LEOK 1" = "LEOK I")
const kunci = (teks) => teks.toUpperCase().replace(/1/g, 'I').replace(/0/g, 'O').replace(/[^A-Z]/g, '');
const batasJarak = (panjang) => (panjang <= 4 ? 1 : panjang <= 7 ? 2 : 3);

// Cari nama resmi yang paling mirip. Setiap teks dicoba beserta potongan awalnya
// ("DOULAN 4 API" -> "DOULAN"), sehingga sampah di ujung baris tidak mengganggu.
// daftar: [{ nama, ... }]. Hasil null bila tidak ada yang cukup mirip atau ada dua nama sama mirip.
function cocokkan(daftarTeks, daftar) {
  const kunciDaftar = daftar.map((d) => kunci(d.nama));
  let terbaik = null;
  for (const teks of daftarTeks) {
    const kata = bersihkanNilai(teks || '').split(' ').filter(Boolean);
    for (let n = 1; n <= Math.min(kata.length, 4); n++) {
      const potongan = kata.slice(0, n).join(' ');
      const k = kunci(potongan);
      if (k.length < 3) continue;
      let jMin = Infinity;
      let pilihan = [];
      kunciDaftar.forEach((kd, i) => {
        const j = jarak(k, kd);
        if (j < jMin) { jMin = j; pilihan = [i]; } else if (j === jMin) pilihan.push(i);
      });
      if (jMin > batasJarak(k.length)) continue;
      if (new Set(pilihan.map((i) => kunciDaftar[i])).size > 1) continue; // dua nama berbeda sama mirip
      const skor = k.length - 2 * jMin; // utamakan cocok persis, lalu potongan yang lebih panjang
      if (!terbaik || skor > terbaik.skor || (skor === terbaik.skor && k.length > terbaik.panjang)) {
        terbaik = { ...daftar[pilihan[0]], kembar: pilihan.length > 1, jarak: jMin, dibaca: potongan, skor, panjang: k.length };
      }
    }
  }
  return terbaik;
}

// Nama desa bernomor (LEOK I / LEOK II, BOKAT / BOKAT IV): angka romawinya sering salah baca
// ("TEOK HE", "CLEOKIH"), jadi nama dasarnya dicocokkan dulu, lalu nomornya ditebak dari jumlah
// garis tegak sesudahnya. Bila nomornya tidak terbaca jelas, hasil ditandai "ragu".
const pecahRomawi = (nama) => {
  const m = nama.match(/\s+(I{1,3}|IV|V|VI{1,3})$/);
  return m ? [nama.slice(0, m.index), m[1]] : [nama, ''];
};
const NILAI_ROMAWI = { '': 0, I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
function bacaRomawi(sisa) {
  if (!sisa) return { romawi: '', jelas: true };
  if (/^(IV|IY|LV|TV)$/.test(sisa)) return { romawi: 'IV', jelas: sisa === 'IV' };
  if (/^[VY]$/.test(sisa)) return { romawi: 'V', jelas: sisa === 'V' };
  const garis = sisa.split('').filter((c) => /[ILTEFHJ]/.test(c)).length;
  return { romawi: 'I'.repeat(Math.min(3, garis)), jelas: /^I{1,3}$/.test(sisa) };
}

function cocokkanDesa(daftarTeks, daftar) {
  const biasa = cocokkan(daftarTeks, daftar);
  const kelompok = new Map();
  for (const d of daftar) {
    const [dasar, romawi] = pecahRomawi(d.nama);
    if (!kelompok.has(dasar)) kelompok.set(dasar, []);
    kelompok.get(dasar).push({ ...d, romawi });
  }
  const bernomor = (dasar) => (kelompok.get(dasar) || []).some((v) => v.romawi);
  if (biasa && (biasa.jarak === 0 || !bernomor(pecahRomawi(biasa.nama)[0]))) return biasa;

  const dasarDaftar = [...kelompok.keys()].filter(bernomor);
  const temuan = [];
  for (const teks of daftarTeks) {
    const kata = bersihkanNilai(teks || '').split(' ').map(kunci).filter(Boolean);
    if (!kata.length) continue;
    let terbaik = null;
    let seri = false;
    for (const dasar of dasarDaftar) {
      const kb = kunci(dasar);
      let gabung = '';
      let i = 0;
      while (i < kata.length && gabung.length < kb.length - 1) gabung += kata[i++];
      for (let k = Math.max(2, kb.length - 2); k <= Math.min(gabung.length, kb.length + 2); k++) {
        const ekor = gabung.slice(k);
        if (ekor.length > 3) continue;
        const j = jarak(gabung.slice(0, k), kb);
        if (j > batasJarak(kb.length)) continue;
        const sisa = ekor || (kata[i] && kata[i].length <= 3 ? kata[i] : '');
        if (!terbaik || j < terbaik.j) { terbaik = { dasar, j, sisa, dibaca: gabung.slice(0, k) + (sisa ? ` ${sisa}` : '') }; seri = false; }
        else if (j === terbaik.j && dasar !== terbaik.dasar) seri = true;
      }
    }
    if (terbaik && !seri) temuan.push(terbaik);
  }
  if (!temuan.length) return biasa;

  // Utamakan bacaan yang nomornya jelas; bila semua ragu, ambil yang garisnya paling banyak
  const dinilai = temuan.map((t) => ({ ...t, ...bacaRomawi(t.sisa) }));
  dinilai.sort((a, b) => Number(b.jelas) - Number(a.jelas) || b.romawi.length - a.romawi.length || a.j - b.j);
  const pilih = dinilai[0];
  const varian = kelompok.get(pilih.dasar);
  const cocok = varian.find((v) => v.romawi === pilih.romawi)
    || [...varian].sort((a, b) => Math.abs(NILAI_ROMAWI[a.romawi] - NILAI_ROMAWI[pilih.romawi]) - Math.abs(NILAI_ROMAWI[b.romawi] - NILAI_ROMAWI[pilih.romawi]))[0];
  const ragu = varian.length > 1 && (!pilih.jelas || cocok.romawi !== pilih.romawi || dinilai.some((t) => t.romawi !== pilih.romawi));
  return { ...cocok, jarak: kunci(pilih.dibaca) === kunci(cocok.nama) ? 0 : Math.max(1, pilih.j), dibaca: pilih.dibaca, ragu, varian: varian.map((v) => v.nama) };
}

// ---------- NIK ----------

// Tanggal lahir yang mustahil (mis. tahun 2091 karena salah baca) diabaikan
const tglLahirWajar = (tgl) => {
  const [d, m, y] = tgl.split('-').map(Number);
  return d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= new Date().getFullYear();
};
const cocokTglLahir = (nik, daftarTgl, perempuan) => daftarTgl.some((tgl) => !cekNik(nik, tgl, perempuan));

// Huruf yang sering tertukar dengan angka pada font NIK KTP (huruf -> kemungkinan angka)
const MIRIP_ANGKA = {
  O: '0', o: '0', D: '0', Q: '0', U: '0', C: '0',
  I: '1', i: '1', l: '1', '|': '1', '!': '1', J: '1', L: '16', T: '17',
  Z: '2', z: '2', A: '4', S: '5', s: '5', G: '6', b: '6', B: '8',
  Y: '7', y: '7', '?': '7', '#': '7', P: '7', F: '7', '/': '7', g: '9', q: '9',
};

// Ambil potongan baris NIK sampai kira-kira 16 karakter (buang sampah di ujung baris)
const potongNik = (mentah) => {
  let hasil = '';
  for (const token of mentah.split(/\s+/)) {
    if (hasil.length >= 16) break;
    hasil += token.replace(/[.,:;'"`\-—–_~^°*()[\]{}“”]/g, '');
  }
  return hasil;
};

// Bacaan langsung: hanya angka asli; huruf diterjemahkan dengan tebakan pertamanya
const bacaLangsung = (teks) => teks.split('').map((c) => (/\d/.test(c) ? c : (MIRIP_ANGKA[c] || '')[0] || '')).join('');

// Aturan utama: ANGKA YANG TERBACA JELAS TIDAK PERNAH DITIMPA. Yang boleh dilakukan hanya:
// (a) mengisi karakter yang tidak jelas (mis. "?", "Y", "L", "b") dengan angka yang cocok dengan pola NIK,
// (b) membuang karakter sisipan (mis. "7" terbaca "71" atau "2?"), (c) mengisi angka yang hilang.
const angkaJelas = (c) => /\d/.test(c);

// Biaya mengisi slot pola dengan karakter bacaan. slot null = bebas (angka dibaca apa adanya).
function biayaIsi(c, slot) {
  const tebakan = MIRIP_ANGKA[c] || '';
  if (slot === null) {
    if (angkaJelas(c)) return [0, c];
    return tebakan ? [0.5, tebakan[0]] : [Infinity, ''];
  }
  if (c === slot) return [0, c];
  if (angkaJelas(c)) return [Infinity, '']; // angka jelas yang berbeda: tidak boleh ditimpa
  return [tebakan.includes(slot) ? 0.5 : 1, slot];
}
// Membuang karakter sisipan: tanda/huruf di ujung murah; angka jelas mahal
const biayaBuang = (c, j, n) => (j === n || (j === 0 && !angkaJelas(c)) ? 0.5 : 1);

// Batas bawah biaya untuk satu kode kecamatan: hanya 6 digit awal yang disejajarkan (ujung bebas).
// Dipakai untuk mengurutkan & melewati ribuan kode yang jelas tidak cocok sebelum penyejajaran penuh.
function biayaAwal(teks, kode) {
  const m = Math.min(teks.length, 12);
  const b = Array.from({ length: m + 1 }, () => new Array(7).fill(Infinity));
  b[0][0] = 0;
  let terendah = Infinity;
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= 6; j++) {
      const v = b[i][j];
      if (v === Infinity) continue;
      if (j === 6) { terendah = Math.min(terendah, v); continue; }
      if (i < m) {
        b[i + 1][j + 1] = Math.min(b[i + 1][j + 1], v + biayaIsi(teks[i], kode[j])[0]);
        b[i + 1][j] = Math.min(b[i + 1][j], v + biayaBuang(teks[i], j, 16));
      }
      b[i][j + 1] = Math.min(b[i][j + 1], v + 1);
    }
  }
  return terendah;
}

// Sejajarkan bacaan NIK dengan pola: 6 digit kode kecamatan + 6 digit tanggal lahir + 4 digit nomor urut.
// "_" atau null = angka di posisi itu dibaca apa adanya (mis. "7205__" = kabupaten pasti, kecamatan bebas).
function sejajarkanNik(teks, kodeKec, kodeTgl) {
  const slot = (kode) => (kode || '______').split('').map((c) => (c === '_' ? null : c));
  const pola = [...slot(kodeKec), ...slot(kodeTgl), ...Array(4).fill(null)];
  const m = teks.length;
  const n = pola.length;
  const biaya = Array.from({ length: m + 1 }, () => Array(n + 1).fill(Infinity));
  const asal = Array.from({ length: m + 1 }, () => Array(n + 1).fill(null));
  biaya[0][0] = 0;
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      const b = biaya[i][j];
      if (b === Infinity) continue;
      if (i < m && j < n) {
        const [tambah, digit] = biayaIsi(teks[i], pola[j]);
        if (b + tambah < biaya[i + 1][j + 1]) { biaya[i + 1][j + 1] = b + tambah; asal[i + 1][j + 1] = [i, j, digit]; }
      }
      if (i < m) {
        const tambah = biayaBuang(teks[i], j, n);
        if (b + tambah < biaya[i + 1][j]) { biaya[i + 1][j] = b + tambah; asal[i + 1][j] = [i, j, null]; }
      }
      // Angka yang hilang hanya boleh diisi di 6 angka kode wilayah (mis. angka 7 di depan tidak terbaca).
      // Di tanggal & nomor urut tidak boleh: "buang satu + isi satu" sama saja dengan menimpa angka yang jelas.
      if (j < 6 && pola[j] !== null && b + 1 < biaya[i][j + 1]) {
        biaya[i][j + 1] = b + 1; asal[i][j + 1] = [i, j, pola[j]];
      }
    }
  }
  if (biaya[m][n] === Infinity) return null;
  const digit = [];
  let [i, j] = [m, n];
  while (i > 0 || j > 0) {
    const [pi, pj, d] = asal[i][j];
    if (pj !== j) digit.unshift(d);
    [i, j] = [pi, pj];
  }
  return { nik: digit.join(''), biaya: biaya[m][n] };
}

// Pilih NIK dari semua bacaan (gambar dipotong & gambar utuh). Setiap bacaan menghasilkan kandidat:
// - bacaan bersih (tepat 16 angka jelas) = kandidat tanpa perubahan;
// - bacaan tidak bersih disejajarkan dengan pola NIK (semua kode kecamatan, "kabupaten kepala KTP + kecamatan
//   bebas" untuk kode lama mis. 720512, dan pola bebas). Angka jelas tidak pernah ditimpa.
// Kandidat dinilai bersama: yang tidak cocok dengan tanggal lahir / kode provinsinya tidak ada kalah; yang sesuai
// kabupaten di kepala KTP diutamakan. Bila dua bacaan memberi dua NIK berbeda yang sama-sama masuk akal,
// hasil ditandai agar admin mencocokkan.
function pilihNik(daftarMentah, petunjuk, wilayah) {
  const prov = petunjuk.kabupaten?.slice(0, 2);
  const daftarKodeTgl = [...new Set(petunjuk.daftarTgl.flatMap((t) => (petunjuk.perempuan === null ? [kodeTanggal(t, false), kodeTanggal(t, true)] : [kodeTanggal(t, petunjuk.perempuan)])))];
  daftarKodeTgl.push(null); // tanggal di NIK dibaca apa adanya (agar NIK yang tanggalnya beda tetap terbaca & diberi peringatan)
  const polaUmum = [...(petunjuk.kabupaten ? [`${petunjuk.kabupaten}__`] : []), null];

  const nilai = (nik, biaya, umum) => {
    const tglCocok = !petunjuk.daftarTgl.length || cocokTglLahir(nik, petunjuk.daftarTgl, petunjuk.perempuan);
    const provAda = Boolean(wilayah.provinsi[nik.slice(0, 2)]);
    const skor = biaya + (tglCocok ? 0 : 2) + (provAda ? 0 : 3) + (umum ? 0.25 : 0)
      - (petunjuk.kabupaten && nik.startsWith(petunjuk.kabupaten) ? 1.25 : prov && nik.startsWith(prov) ? 0.5 : 0);
    const prioritas = nik.startsWith(petunjuk.kecamatan || '#') ? 0 : nik.startsWith(petunjuk.kabupaten || '#') ? 1 : 2;
    return { skor, prioritas, konsisten: tglCocok && provAda };
  };
  const lebihBaik = (a, b) => !b || a.skor < b.skor - 1e-9 || (Math.abs(a.skor - b.skor) < 1e-9 && a.prioritas < b.prioritas);

  const terbaikPerBacaan = [];
  daftarMentah.forEach((mentah) => {
    const teks = mentah ? potongNik(mentah) : '';
    if (teks.length < 12) return;
    // 2 angka awal yang bukan kode provinsi mana pun pasti salah baca (mis. 7 terbaca "2" -> "2205..."):
    // coba ganti dengan provinsi kepala KTP, hanya bila angka ke-3 & ke-4 sudah sama dengan kabupatennya.
    const varian = [{ teks, tambahan: 0 }];
    if (/^\d\d/.test(teks) && !wilayah.provinsi[teks.slice(0, 2)] && petunjuk.kabupaten && teks.slice(2, 4) === petunjuk.kabupaten.slice(2, 4)) {
      varian.push({ teks: prov + teks.slice(2), tambahan: 0.5, provinsiDiganti: teks.slice(0, 2) });
    }
    let terbaik = null;
    const coba = (nik, biaya, umum, v) => {
      if (!/^\d{16}$/.test(nik) || biaya > 3.5) return;
      const k = { nik, ...nilai(nik, biaya + v.tambahan, umum), dikoreksi: biaya + v.tambahan > 0, provinsiDiganti: v.provinsiDiganti };
      if (lebihBaik(k, terbaik)) terbaik = k;
    };
    for (const v of varian) {
      if (/^\d{16}$/.test(v.teks)) { coba(v.teks, 0, false, v); continue; } // bersih: dipakai apa adanya
      for (const kodeKec of polaUmum) {
        for (const kodeTgl of daftarKodeTgl) {
          const h = sejajarkanNik(v.teks, kodeKec, kodeTgl);
          if (h) coba(h.nik, h.biaya, true, v);
        }
      }
      const urut = Object.keys(wilayah.kecamatan).map((kode) => [biayaAwal(v.teks, kode), kode]).sort((a, b) => a[0] - b[0]);
      for (const [awal, kode] of urut) {
        if (terbaik && awal + v.tambahan - 1.25 > terbaik.skor) break; // sisa kode pasti lebih buruk
        for (const kodeTgl of daftarKodeTgl) {
          const h = sejajarkanNik(v.teks, kode, kodeTgl);
          if (h) coba(h.nik, h.biaya, false, v);
        }
      }
    }
    if (terbaik) terbaikPerBacaan.push(terbaik);
  });

  if (!terbaikPerBacaan.length) {
    // Tidak bisa dipulihkan: tampilkan bacaan apa adanya (akan diberi peringatan)
    const terdekat = daftarMentah.filter(Boolean).map((m) => bacaLangsung(potongNik(m))).sort((a, b) => Math.abs(a.length - 16) - Math.abs(b.length - 16))[0] || '';
    return { nik: terdekat.slice(0, 16), dikoreksi: false };
  }
  const pilih = terbaikPerBacaan.reduce((a, b) => (lebihBaik(b, a) ? b : a));
  // Bacaan lain yang juga masuk akal, atau yang hanya beda di 4 angka nomor urut (bagian yang tidak bisa dicek)
  const lain = terbaikPerBacaan.find((k) => k.nik !== pilih.nik && (k.konsisten || k.nik.slice(0, 12) === pilih.nik.slice(0, 12)));
  // dukungan = berapa kali bacaan menghasilkan NIK yang sama (NIK yang baru terbaca sekali dibaca ulang dulu)
  const dukungan = terbaikPerBacaan.filter((k) => k.nik === pilih.nik).length;
  return { ...pilih, berbeda: pilih.konsisten && lain ? lain.nik : '', dukungan };
}

// ---------- Nama ----------

const NAMA_DEPAN_MENEMPEL = /^(MUHAMMAD|MUHAMAD|MOHAMMAD|MOHAMAD|MOCHAMMAD|MOCHAMAD|MUCHAMMAD|MUCHAMAD|MOHAMMED|MUHAMMED)(?=[A-Z]{3})/;
function pilihNama(bacaan) {
  const daftar = bacaan.map((b) => b.nama).filter(Boolean);
  if (!daftar.length) return { nama: '', gelarDikenal: true };
  // Bacaan lain dengan huruf sama tapi spasinya lebih lengkap ("MOHAMMADTAUFIK" vs "MOHAMMAD TAUFIK")
  let nama = daftar[0];
  for (const lain of daftar) {
    if (kunci(lain) === kunci(nama) && lain.split(' ').length > nama.split(' ').length) nama = lain;
  }
  nama = nama.replace(NAMA_DEPAN_MENEMPEL, '$1 ');
  const gelarMentah = bacaan.map((b) => b.gelar).find(Boolean);
  if (!gelarMentah) return { nama, gelarDikenal: true };
  const { gelar, dikenal } = rapikanGelar(gelarMentah);
  return { nama: `${nama}, ${gelar}`, gelarDikenal: dikenal };
}

const pertama = (bacaan, kunciBacaan) => bacaan.map((b) => b[kunciBacaan]).find((v) => v !== '' && v !== null && v !== undefined);

// Gabungkan satu atau beberapa bacaan KTP (mis. gambar dipotong & gambar utuh) menjadi isian form
export function tetapkan(bacaan, wilayah) {
  const koreksi = [];
  const catatan = [];
  const peringatan = [];
  const catat = (nama, hasilCocok) => {
    if (hasilCocok && hasilCocok.jarak > 0) koreksi.push(`${nama} ${rapikan(hasilCocok.dibaca)} → ${hasilCocok.nama}`);
  };
  const daftarTgl = [...new Set(bacaan.map((b) => b.tglLahir).filter((t) => t && tglLahirWajar(t)))];
  let perempuan = pertama(bacaan, 'perempuan') ?? null;

  // 1. Kabupaten/kota dari kepala KTP (dibatasi ke provinsinya bila terbaca)
  const provinsi = cocokkan(bacaan.map((b) => b.provinsi), Object.entries(wilayah.provinsi).map(([kode, nama]) => ({ kode, nama })));
  const daftarKab = Object.entries(wilayah.kabupaten)
    .filter(([kode]) => !provinsi || kode.startsWith(provinsi.kode))
    .map(([kode, nama]) => ({ kode, nama, jenis: nama.startsWith('KOTA ') ? 'KOTA' : 'KAB.', inti: nama.replace(/^(KAB\.|KOTA) /, '') }));
  const jenisKab = pertama(bacaan, 'jenisKabupaten');
  const kabCocok = cocokkan(bacaan.map((b) => b.kabupaten), daftarKab.filter((k) => !jenisKab || k.jenis === jenisKab).map((k) => ({ ...k, nama: k.inti })));
  let kab = kabCocok && { kode: kabCocok.kode, nama: wilayah.kabupaten[kabCocok.kode] };

  // 2. Kecamatan & desa di dalam kabupaten tersebut
  const cariKecDesa = (kodeKab) => {
    const daftarKec = Object.entries(wilayah.kecamatan).filter(([kode]) => kode.startsWith(kodeKab)).map(([kode, nama]) => ({ kode, nama }));
    let kec = cocokkan(bacaan.map((b) => b.kecamatan), daftarKec);
    const teksDesa = [...bacaan.map((b) => b.desa), ...bacaan.map((b) => b.desaAlamat)];
    const daftarDesa = (kodeKec) => (wilayah.desa[kodeKec] || []).map((n) => ({ nama: n.replace(/^\*/, ''), kelurahan: n.startsWith('*'), kec: kodeKec }));
    let desa = null;
    if (kec) desa = cocokkanDesa(teksDesa, daftarDesa(kec.kode));
    else {
      // Kecamatan tidak terbaca: cari desanya di seluruh kabupaten, lalu ambil kecamatannya
      desa = cocokkanDesa(teksDesa, daftarKec.flatMap((k) => daftarDesa(k.kode)));
      if (desa && !desa.kembar) kec = { kode: desa.kec, nama: wilayah.kecamatan[desa.kec], jarak: 0 };
      else desa = null;
    }
    return { kec, desa, adaDataDesa: Boolean(kec && wilayah.desa[kec.kode]) };
  };

  let kodeKab = kab?.kode;
  let { kec, desa, adaDataDesa } = kodeKab ? cariKecDesa(kodeKab) : {};

  // 3. NIK
  const petunjukNik = () => ({ kabupaten: kodeKab, kecamatan: kec?.kode, daftarTgl, perempuan });
  let nik = pilihNik(bacaan.map((b) => b.nikMentah), petunjukNik(), wilayah);
  if (!kodeKab && wilayah.kecamatan[nik.nik.slice(0, 6)]) {
    // Kepala KTP tidak terbaca: pakai kabupaten dari kode NIK sebagai petunjuk
    kodeKab = nik.nik.slice(0, 4);
    ({ kec, desa, adaDataDesa } = cariKecDesa(kodeKab));
    if (kec) kab = { kode: kodeKab, nama: wilayah.kabupaten[kodeKab] };
    nik = pilihNik(bacaan.map((b) => b.nikMentah), petunjukNik(), wilayah);
  }
  if (perempuan === null && /^\d{16}$/.test(nik.nik)) perempuan = Number(nik.nik.slice(6, 8)) > 40;

  catat('Kabupaten', kabCocok);
  catat('Kecamatan', kec);
  catat(desa?.kelurahan ? 'Kelurahan' : 'Desa', desa);
  if (nik.berbeda && nik.berbeda.slice(0, 12) === nik.nik.slice(0, 12)) {
    peringatan.push(`4 angka terakhir NIK terbaca berbeda (${nik.nik.slice(12)} / ${nik.berbeda.slice(12)}), mungkin angkanya aus/kurang jelas. Terisi ${nik.nik.slice(12)}, cocokkan dengan KTP.`);
  } else if (nik.berbeda) peringatan.push(`NIK terbaca berbeda pada dua kali baca (${nik.nik} / ${nik.berbeda}). Terisi ${nik.nik}, cocokkan dengan KTP.`);
  if (nik.provinsiDiganti) koreksi.push(`NIK: 2 angka awal terbaca ${nik.provinsiDiganti} (tidak ada provinsi berkode ${nik.provinsiDiganti}), diganti ${nik.nik.slice(0, 2)} sesuai kepala KTP`);
  else if (nik.dikoreksi) koreksi.push('NIK (angka yang tidak terbaca jelas dilengkapi sesuai pola NIK; angka yang jelas tidak diubah)');

  let nikBermasalah = false;
  if (nik.nik) {
    const kodeNik = nik.nik.slice(0, 6);
    // Catatan: kode kecamatan yang tidak ada di data BUKAN tanda salah (NIK bisa memakai kode lama, mis. 720512)
    if (!/^\d{16}$/.test(nik.nik)) peringatan.push('NIK tidak terbaca lengkap (harus 16 digit). Ketik NIK dari KTP.');
    else if (daftarTgl.length && !cocokTglLahir(nik.nik, daftarTgl, perempuan)) peringatan.push('NIK tidak cocok dengan tanggal lahir di KTP. Periksa NIK.');
    else if (!wilayah.provinsi[kodeNik.slice(0, 2)]) {
      const provKtp = kodeKab && wilayah.provinsi[kodeKab.slice(0, 2)] ? ` (kemungkinan seharusnya ${kodeKab.slice(0, 2)}, ${wilayah.provinsi[kodeKab.slice(0, 2)]})` : '';
      peringatan.push(`2 angka awal NIK (${kodeNik.slice(0, 2)}) bukan kode provinsi${provKtp}. Cocokkan NIK dengan KTP.`);
    }
    else if (!wilayah.kabupaten[kodeNik.slice(0, 4)]) peringatan.push(`4 angka awal NIK (${kodeNik.slice(0, 4)}) bukan kode kabupaten/kota. Kemungkinan salah baca, cocokkan NIK dengan KTP.`);
    else if (!daftarTgl.length && nik.dikoreksi) peringatan.push('Tanggal lahir tidak terbaca, jadi NIK hasil perbaikan belum bisa dicek. Cocokkan NIK dengan KTP.');
    else if (kec && wilayah.kecamatan[kodeNik] && kodeNik !== kec.kode) {
      catatan.push(`NIK berkode Kec. ${wilayah.kecamatan[kodeNik]}, alamat di Kec. ${kec.nama} (wajar bila pindahan/pemekaran). Cocokkan 6 digit awal NIK dengan KTP.`);
    }
    nikBermasalah = peringatan.length > 0;
  }

  const teksMentah = (k) => rapikan(pertama(bacaan, k) || '');
  const desaMentah = rapikan(pertama(bacaan, 'desa') || pertama(bacaan, 'desaAlamat') || '');
  const kabMentah = pertama(bacaan, 'kabupaten') ? `${jenisKab || 'KAB.'} ${rapikan(pertama(bacaan, 'kabupaten'))}` : '';
  const namaDesa = desa ? desa.nama : desaMentah;
  const kabupaten = kab ? kab.nama : kabMentah;

  // Desa atau kelurahan. Di wilayah yang ada datanya (Sulteng & Gorontalo) selalu ikut status resmi
  // Kemendagri, bukan tulisan KTP yang bisa salah baca (mis. Kab. Buol: kelurahan hanya 7, semuanya di
  // Kec. Biau; selebihnya desa). Di luar data: ikut tulisan "DESA X"/"KEL. X" di KTP, lalu KOTA = kelurahan.
  const isiKec = (kec && wilayah.desa[kec.kode]) || [];
  const semuaKel = isiKec.length > 0 && isiKec.every((n) => n.startsWith('*'));
  const semuaDesa = isiKec.length > 0 && isiKec.every((n) => !n.startsWith('*'));
  const petunjukKtp = bacaan
    .flatMap((b) => [[b.jenisDesa, b.desa], [b.jenisDesaAlamat, b.desaAlamat]])
    .find(([jenis, teks]) => jenis && teks && namaDesa && cocokkan([teks], [{ nama: namaDesa }]))?.[0];
  let kelurahan;
  if (desa) kelurahan = desa.kelurahan;
  else if (semuaKel || semuaDesa) kelurahan = semuaKel; // nama desa tak terbaca, tapi kecamatannya seragam
  else if (petunjukKtp) kelurahan = petunjukKtp === 'KEL.';
  else kelurahan = isiKec.length === 0 && kabupaten.startsWith('KOTA ');
  if (desa && petunjukKtp && (petunjukKtp === 'KEL.') !== desa.kelurahan) {
    catatan.push(`${desa.nama} tercatat ${desa.kelurahan ? 'kelurahan' : 'desa'} di data resmi (di KTP terbaca ${petunjukKtp === 'KEL.' ? 'kelurahan' : 'desa'}).`);
  }
  const jenis = kelurahan ? 'Kelurahan' : 'Desa';
  if (desa?.ragu) peringatan.push(`Nomor ${jenis.toLowerCase()} kurang jelas terbaca: terisi ${desa.nama}, pilihan lain ${desa.varian.filter((v) => v !== desa.nama).join(' / ')}. Cocokkan dengan KTP.`);
  if (!desa && adaDataDesa && namaDesa) peringatan.push(`${jenis} "${namaDesa}" tidak ada di data Kec. ${kec.nama}. Periksa alamat.`);

  const { nama, gelarDikenal } = pilihNama(bacaan);
  if (nama && !nama.includes(',') && bacaan.some((b) => b.namaBergelar)) catatan.push('Nama di KTP diikuti gelar yang tidak terbaca. Tambahkan bila perlu.');
  if (!gelarDikenal) catatan.push('Gelar di belakang nama tidak ada di daftar gelar umum. Cocokkan penulisan gelar dengan KTP.');

  return {
    nama,
    nik: nik.nik,
    desa: namaDesa,
    kelurahan,
    kecamatan: kec ? kec.nama : teksMentah('kecamatan'),
    kabupaten,
    tglLahir: daftarTgl[0] || '',
    perempuan,
    peringatan,
    koreksi,
    catatan,
    // Yakin = semua isian terbaca, NIK cocok dengan tanggal lahir & semuanya cocok dengan data wilayah;
    // bila tidak, foto dibaca sekali lagi
    // NIK yang diperbaiki / berbeda kecamatan dengan alamat selalu dibandingkan dengan bacaan kedua
    yakin: Boolean(nama && nik.nik && nik.dukungan >= 2 && daftarTgl.length && !nikBermasalah && !nik.dikoreksi && kab && kec && nik.nik.startsWith(kec.kode)
      && (desa ? !desa.ragu : !adaDataDesa && desaMentah)),
  };
}

// Cari letak kartu KTP di foto (mis. KTP difoto di atas meja / dipegang tangan). KTP berwarna biru muda,
// sedangkan latar umumnya tidak kebiruan. Hasil null bila kartu tidak jelas atau sudah memenuhi foto.
export function cariKartu(px, w, h) {
  const baris = new Array(h).fill(0);
  const kolom = new Array(w).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 2] - px[i] > 8 && px[i + 2] > 80) { baris[y]++; kolom[x]++; }
    }
  }
  // Rentang terpanjang yang cukup kebiruan (celah kecil, mis. baris teks tebal, diabaikan)
  const rentang = (arr, min, celah) => {
    let terbaik = null;
    let mulai = -1;
    let akhir = -1;
    arr.forEach((v, i) => {
      if (v < min) return;
      if (mulai < 0 || i - akhir > celah) mulai = i;
      akhir = i;
      if (!terbaik || akhir - mulai > terbaik[1] - terbaik[0]) terbaik = [mulai, akhir];
    });
    return terbaik;
  };
  const ry = rentang(baris, w * 0.15, h * 0.03);
  const rx = rentang(kolom, h * 0.08, w * 0.03);
  if (!ry || !rx) return null;
  const lebar = rx[1] - rx[0] + 1;
  const tinggi = ry[1] - ry[0] + 1;
  if (lebar < w * 0.3 || tinggi < h * 0.12 || lebar / tinggi < 1.2 || lebar / tinggi > 2.1) return null;
  if (lebar > w * 0.9 && tinggi > h * 0.9) return null; // kartu sudah memenuhi foto
  const tepiX = Math.round(lebar * 0.03);
  const tepiY = Math.round(tinggi * 0.04);
  const x = Math.max(0, rx[0] - tepiX);
  const y = Math.max(0, ry[0] - tepiY);
  return { x, y, w: Math.min(w, rx[1] + tepiX + 1) - x, h: Math.min(h, ry[1] + tepiY + 1) - y };
}

// Siapkan gambar: kartu KTP dipotong dari latar (bila perlu), abu-abu + kontras, diperbesar;
// versi "potong" membuang sisi kanan kartu (pas foto)
export async function siapkanGambar(file, potong, buangBiru = false) {
  const bitmap = await createImageBitmap(file);
  let kartu = { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
  const skalaUji = Math.min(1, 320 / bitmap.width);
  const uji = document.createElement('canvas');
  uji.width = Math.round(bitmap.width * skalaUji);
  uji.height = Math.round(bitmap.height * skalaUji);
  const ctxUji = uji.getContext('2d', { willReadFrequently: true });
  ctxUji.drawImage(bitmap, 0, 0, uji.width, uji.height);
  const temu = cariKartu(ctxUji.getImageData(0, 0, uji.width, uji.height).data, uji.width, uji.height);
  if (temu) kartu = { x: temu.x / skalaUji, y: temu.y / skalaUji, w: temu.w / skalaUji, h: temu.h / skalaUji };

  const lebarSumber = Math.round(potong ? kartu.w * 0.74 : kartu.w);
  // Kartu yang kecil di foto boleh diperbesar lebih banyak agar hurufnya cukup besar untuk dibaca
  const skala = Math.min(temu ? 3 : 2, 2000 / lebarSumber);
  const kanvas = document.createElement('canvas');
  kanvas.width = Math.round(lebarSumber * skala);
  kanvas.height = Math.round(kartu.h * skala);
  const ctx = kanvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, kartu.x, kartu.y, lebarSumber, kartu.h, 0, 0, kanvas.width, kanvas.height);
  bitmap.close?.();
  const gambar = ctx.getImageData(0, 0, kanvas.width, kanvas.height);
  const px = gambar.data;
  for (let i = 0; i < px.length; i += 4) {
    let abu = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    // Garis pengaman KTP berwarna biru, tulisan hitam netral: piksel kebiruan dibuat terang agar garisnya hilang
    if (buangBiru) abu += 2.5 * Math.max(0, px[i + 2] - px[i] - 8);
    const nilai = Math.max(0, Math.min(255, (abu - 128) * 1.8 + 141));
    px[i] = px[i + 1] = px[i + 2] = nilai;
  }
  ctx.putImageData(gambar, 0, 0);
  return kanvas;
}

// Urutan pembacaan: [potong pas foto?, buang garis biru?]. Berhenti begitu hasilnya meyakinkan.
// 1) dipotong biasa, 2) dipotong + buang garis biru (KTP dengan garis pengaman tebal), 3) gambar utuh.
export const URUTAN_BACA = [[true, false], [true, true], [false, false]];

export async function scanKtp(file, onProgress, urutan = URUTAN_BACA) {
  const [{ createWorker }, { default: wilayah }] = await Promise.all([import('tesseract.js'), import('./wilayahKtp.json')]);
  let keBaca = 1;
  const worker = await createWorker('ind', 1, {
    logger: (m) => { if (m.status === 'recognizing text' && onProgress) onProgress(m.progress, keBaca); },
  });
  try {
    // rotateAuto: luruskan otomatis foto yang sedikit miring
    const baca = async ([potong, buangBiru]) => uraiKtp((await worker.recognize(await siapkanGambar(file, potong, buangBiru), { rotateAuto: true })).data.text);
    const bacaan = [];
    let hasil = null;
    // Bila ada isian yang belum terbaca / belum cocok dengan data wilayah, baca ulang dengan cara berikutnya
    for (const [i, cara] of urutan.entries()) {
      keBaca = i + 1;
      bacaan.push(await baca(cara));
      hasil = tetapkan(bacaan, wilayah);
      if (hasil.yakin) break;
    }
    return hasil;
  } finally {
    await worker.terminate();
  }
}
