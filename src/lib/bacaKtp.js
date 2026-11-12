// SAKTI: Baca KTP langsung di browser (Tesseract.js). Foto KTP tidak dikirim ke server mana pun
// dan tidak disimpan; hanya teks hasil bacaan yang dipakai untuk mengisi form.
// Hasil bacaan lalu dicocokkan dengan data wilayah Kemendagri (wilayahKtp.json) untuk membetulkan
// huruf/angka yang salah baca pada Desa, Kecamatan, Kabupaten, dan 6 digit kode wilayah NIK.
// Sumber data wilayah: idn-area-data v4.0.1 (data Kepmendagri, lisensi ODbL 1.0); desa/kelurahan hanya
// untuk Sulawesi Tengah & Gorontalo, kabupaten & kecamatan untuk seluruh Indonesia.

const LABEL = {
  nik: 'NIK',
  nama: 'NAMA',
  lahir: 'TEMPAT/TGL LAHIR',
  desa: 'KEL/DESA',
  kecamatan: 'KECAMATAN',
};

// Jarak edit sederhana untuk mencocokkan teks yang salah baca (mis. "Kel/Desm" -> "KEL/DESA")
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
  const hasil = { nama: '', nikMentah: '', desa: '', jenisDesa: '', desaAlamat: '', jenisDesaAlamat: '', kecamatan: '', kabupaten: '', jenisKabupaten: '', provinsi: '', tglLahir: '', perempuan: null };

  for (const barisMentah of teks.split('\n')) {
    const baris = barisMentah.replace(/^[^A-Za-z]+/, '').trim();
    if (!baris) continue;
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

    // Baris NIK: ambil semua sisa baris (titik/spasi nyasar di tengah angka tidak memotong NIK)
    const tokenAwal = kata[0].replace(/[^A-Z]/g, '');
    if (!hasil.nikMentah && tokenAwal.length >= 2 && jarak(tokenAwal, 'NIK') <= 1) {
      const sisa = baris.slice(kata[0].length).replace(/^[\s:.—|-]+/, '').toUpperCase().replace(/\s+/g, '');
      if ((sisa.match(/[0-9OQDILZSGB?|!]/g) || []).length >= 14) { hasil.nikMentah = sisa; continue; }
    }

    if (/PEREMPUAN|WANITA/i.test(baris)) hasil.perempuan = true;
    else if (/LAKI/i.test(baris) && hasil.perempuan === null) hasil.perempuan = false;

    // Pisahkan label & isi pada ":" pertama (titik dua sering terbaca ".", "—", "|" atau " -")
    const pemisah = baris.search(/\s*[:.—|]\s*|\s+-/);
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

    if (cocok === 'nik' && !hasil.nikMentah) {
      hasil.nikMentah = isi.toUpperCase().replace(/\s+/g, '');
    } else if (cocok === 'nama' && !hasil.nama) {
      hasil.nama = rapikan(isi);
    } else if (cocok === 'desa' && !hasil.desa) {
      const awalan = bersihkanNilai(isi).match(/^(DESA|DS|KEL(URAHAN)?)(\.\s*|\s+)/);
      if (awalan) hasil.jenisDesa = awalan[1].startsWith('KEL') ? 'KEL.' : 'DESA';
      hasil.desa = bersihkanNilai(isi).replace(/^(DESA|DS|KEL(URAHAN)?)(\.\s*|\s+)/, '');
    } else if (cocok === 'kecamatan' && !hasil.kecamatan) {
      hasil.kecamatan = bersihkanNilai(isi).replace(/^(KEC(AMATAN)?)(\.\s*|\s+)/, '');
    } else if (label === 'ALAMAT' && !hasil.desaAlamat) {
      // "Alamat : DESA MULAT" / "Alamat : KEL. LEOK II": cadangan nama desa bila baris Kel/Desa gagal
      // terbaca, sekaligus petunjuk apakah tempat itu desa atau kelurahan
      const desaAlamat = bersihkanNilai(isi).match(/(?:^|\s)(DESA|DS[.\s]|KELURAHAN|KEL[.\s])\s*([A-Z][A-Z0-9 ]+)/);
      if (desaAlamat) {
        hasil.desaAlamat = desaAlamat[2].trim();
        hasil.jenisDesaAlamat = desaAlamat[1].startsWith('KEL') ? 'KEL.' : 'DESA';
      }
    } else if (cocok === 'lahir' && !hasil.tglLahir) {
      const tgl = isi.match(/(\d{2})[-/.](\d{2})[-/.](\d{4})/);
      if (tgl) hasil.tglLahir = `${tgl[1]}-${tgl[2]}-${tgl[3]}`;
    }
  }
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

// Tanggal lahir yang mustahil (mis. tahun 2091 karena salah baca) diabaikan
const tglLahirWajar = (tgl) => {
  const [d, m, y] = tgl.split('-').map(Number);
  return d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= new Date().getFullYear();
};
const cocokTglLahir = (nik, daftarTgl, perempuan) => daftarTgl.some((tgl) => !cekNik(nik, tgl, perempuan));

const tanggalWajar = (nik) => {
  const dd = Number(nik.slice(6, 8));
  const mm = Number(nik.slice(8, 10));
  const hari = dd > 40 ? dd - 40 : dd;
  return hari >= 1 && hari <= 31 && mm >= 1 && mm <= 12;
};

const bacaAngka = (mentah, gantiTanya) => mentah.toUpperCase().split('')
  .map((c) => (c === '?' ? gantiTanya : KE_ANGKA[c] ?? c)).join('').replace(/\D/g, '');

// Pilih NIK paling masuk akal dari semua bacaan: 6 digit awal harus kode kecamatan yang ada
// (sebaiknya sama dengan kecamatan/kabupaten di KTP) dan digit 7-12 cocok dengan tanggal lahir.
function pilihNik(daftarMentah, petunjuk, wilayah) {
  const adaKode = (nik) => Boolean(wilayah.kecamatan[nik.slice(0, 6)]);
  const calon = new Map(); // nik -> jumlah perubahan dari bacaan asli
  const tambah = (nik, ubah) => { if (!calon.has(nik) || calon.get(nik) > ubah) calon.set(nik, ubah); };
  let polos = '';

  for (const mentah of daftarMentah.filter(Boolean)) {
    const tanya = (mentah.match(/\?/g) || []).length;
    // "7" sering terbaca "?" atau "2?": coba "?" dibuang dan "?" = 7
    for (const [angka, ubahAwal] of [[bacaAngka(mentah, ''), 0], [bacaAngka(mentah, '7'), tanya]]) {
      if (!polos && ubahAwal === 0) polos = angka;
      if (angka.length === 16) tambah(angka, ubahAwal);
      else if (angka.length === 17 || angka.length === 18) {
        // ada 1-2 karakter sisipan: coba buang
        for (let i = 0; i < angka.length; i++) {
          const a = angka.slice(0, i) + angka.slice(i + 1);
          if (a.length === 16) tambah(a, ubahAwal + 1);
          else for (let j = i; j < a.length; j++) tambah(a.slice(0, j) + a.slice(j + 1), ubahAwal + 2);
        }
      }
    }
  }

  // Kode wilayah yang tidak ada di mana pun = pasti salah baca: coba ganti satu digitnya.
  // (Kode yang ada tidak diubah, karena pemilik KTP bisa saja pindahan dari kecamatan lain.)
  for (const [nik, ubah] of [...calon]) {
    if (adaKode(nik)) continue;
    for (let i = 0; i < 6; i++) {
      for (let d = 0; d <= 9; d++) {
        const a = nik.slice(0, i) + d + nik.slice(i + 1);
        if (a !== nik && adaKode(a)) tambah(a, ubah + 1);
      }
    }
  }

  const nilai = (nik, ubah) => {
    let n = -ubah;
    if (adaKode(nik)) n += 4;
    if (petunjuk.kabupaten && nik.startsWith(petunjuk.kabupaten)) n += 2;
    if (petunjuk.kecamatan && nik.startsWith(petunjuk.kecamatan)) n += 2;
    if (cocokTglLahir(nik, petunjuk.daftarTgl, petunjuk.perempuan)) n += 4;
    else if (tanggalWajar(nik)) n += 1;
    return n;
  };

  let terbaik = null;
  let seri = false;
  for (const [nik, ubah] of calon) {
    const n = nilai(nik, ubah);
    if (!terbaik || n > terbaik.n || (n === terbaik.n && ubah < terbaik.ubah)) { terbaik = { nik, ubah, n }; seri = false; }
    else if (n === terbaik.n && ubah === terbaik.ubah && nik !== terbaik.nik) seri = true;
  }
  if (!terbaik || (seri && terbaik.ubah > 0)) return { nik: polos.slice(0, 16), dikoreksi: false, kodeAda: adaKode(polos) };
  return { nik: terbaik.nik, dikoreksi: terbaik.ubah > 0, kodeAda: adaKode(terbaik.nik) };
}

const pertama = (bacaan, kunciBacaan) => bacaan.map((b) => b[kunciBacaan]).find((v) => v !== '' && v !== null && v !== undefined);

// Gabungkan satu atau beberapa bacaan KTP (mis. gambar dipotong & gambar utuh) menjadi isian form
export function tetapkan(bacaan, wilayah) {
  const koreksi = [];
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
    if (kec) desa = cocokkan(teksDesa, daftarDesa(kec.kode));
    else {
      // Kecamatan tidak terbaca: cari desanya di seluruh kabupaten, lalu ambil kecamatannya
      desa = cocokkan(teksDesa, daftarKec.flatMap((k) => daftarDesa(k.kode)));
      if (desa && !desa.kembar) kec = { kode: desa.kec, nama: wilayah.kecamatan[desa.kec], jarak: 0 };
      else desa = null;
    }
    return { kec, desa, adaDataDesa: Boolean(kec && wilayah.desa[kec.kode]) };
  };

  let kodeKab = kab?.kode;
  let { kec, desa, adaDataDesa } = kodeKab ? cariKecDesa(kodeKab) : {};

  // 3. NIK
  let nik = pilihNik(bacaan.map((b) => b.nikMentah), { kabupaten: kodeKab, kecamatan: kec?.kode, daftarTgl, perempuan }, wilayah);
  if (!kodeKab && nik.kodeAda) {
    // Kepala KTP tidak terbaca: pakai kabupaten dari kode NIK sebagai petunjuk
    kodeKab = nik.nik.slice(0, 4);
    ({ kec, desa, adaDataDesa } = cariKecDesa(kodeKab));
    if (kec) kab = { kode: kodeKab, nama: wilayah.kabupaten[kodeKab] };
    nik = pilihNik(bacaan.map((b) => b.nikMentah), { kabupaten: kodeKab, kecamatan: kec?.kode, daftarTgl, perempuan }, wilayah);
  }
  if (perempuan === null && /^\d{16}$/.test(nik.nik)) perempuan = Number(nik.nik.slice(6, 8)) > 40;

  catat('Kabupaten', kabCocok);
  catat('Kecamatan', kec);
  catat('Desa', desa);
  if (nik.dikoreksi) koreksi.push('NIK (disesuaikan dengan kode wilayah & tanggal lahir)');

  let peringatanNik = '';
  if (nik.nik) {
    if (!/^\d{16}$/.test(nik.nik)) peringatanNik = 'NIK harus 16 digit.';
    else if (daftarTgl.length && !cocokTglLahir(nik.nik, daftarTgl, perempuan)) peringatanNik = 'NIK tidak cocok dengan tanggal lahir di KTP.';
    else if (!nik.kodeAda) peringatanNik = '6 digit awal NIK bukan kode wilayah yang dikenal. Periksa NIK.';
  }

  const teksMentah = (k) => rapikan(pertama(bacaan, k) || '');
  const desaMentah = rapikan(pertama(bacaan, 'desa') || pertama(bacaan, 'desaAlamat') || '');
  const kabMentah = pertama(bacaan, 'kabupaten') ? `${jenisKab || 'KAB.'} ${rapikan(pertama(bacaan, 'kabupaten'))}` : '';
  const namaDesa = desa ? desa.nama : desaMentah;
  const kabupaten = kab ? kab.nama : kabMentah;

  // Desa atau kelurahan: ikuti tulisan di KTP ("DESA X" / "KEL. X") bila menyebut tempat yang sama;
  // bila KTP tidak menyebut, pakai data Kemendagri; di luar data, wilayah KOTA umumnya kelurahan
  const petunjukKtp = bacaan
    .flatMap((b) => [[b.jenisDesa, b.desa], [b.jenisDesaAlamat, b.desaAlamat]])
    .find(([jenis, teks]) => jenis && teks && namaDesa && cocokkan([teks], [{ nama: namaDesa }]))?.[0];
  const kelurahan = petunjukKtp ? petunjukKtp === 'KEL.' : desa ? desa.kelurahan : kabupaten.startsWith('KOTA ');

  return {
    nama: pertama(bacaan, 'nama') || '',
    nik: nik.nik,
    desa: namaDesa,
    kelurahan,
    kecamatan: kec ? kec.nama : teksMentah('kecamatan'),
    kabupaten,
    tglLahir: daftarTgl[0] || '',
    perempuan,
    peringatanNik,
    koreksi,
    // Yakin = semua isian terbaca, NIK cocok dengan tanggal lahir & semuanya cocok dengan data wilayah;
    // bila tidak, foto dibaca sekali lagi
    yakin: Boolean(pertama(bacaan, 'nama') && nik.nik && daftarTgl.length && !peringatanNik && kab && kec && (desa || (!adaDataDesa && desaMentah))),
  };
}

// Siapkan gambar: abu-abu + kontras, diperbesar; versi "potong" membuang sisi kanan (pas foto)
export async function siapkanGambar(file, potong) {
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
  const [{ createWorker }, { default: wilayah }] = await Promise.all([import('tesseract.js'), import('./wilayahKtp.json')]);
  const worker = await createWorker('ind', 1, {
    logger: (m) => { if (m.status === 'recognizing text' && onProgress) onProgress(m.progress); },
  });
  try {
    // rotateAuto: luruskan otomatis foto yang sedikit miring
    const baca = async (potong) => uraiKtp((await worker.recognize(await siapkanGambar(file, potong), { rotateAuto: true })).data.text);
    const bacaan = [await baca(true)];
    let hasil = tetapkan(bacaan, wilayah);
    // Bila ada isian yang belum terbaca / belum cocok dengan data wilayah, baca ulang gambar utuh
    if (!hasil.yakin) {
      bacaan.push(await baca(false));
      hasil = tetapkan(bacaan, wilayah);
    }
    return hasil;
  } finally {
    await worker.terminate();
  }
}
