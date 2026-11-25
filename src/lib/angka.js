// Format angka rupiah tanpa "Rp" (1.250.000) dan pembacaan kembali dari ketikan pengguna.
export const formatRupiah = (number) => new Intl.NumberFormat('id-ID').format(number || 0);

export const parseNumber = (val) => {
  if (!val) return 0;
  const parsed = parseInt(val.toString().replace(/[^0-9]/g, ''), 10);
  return isNaN(parsed) ? 0 : parsed;
};
