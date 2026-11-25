import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Dropdown pilihan dengan gaya yang sama seperti "Jenis Pembiayaan" di halaman BASTK.
// ukuran="form" untuk isian formulir (tinggi 44px), ukuran="filter" untuk baris filter tabel (36px).
export default function PilihanDropdown({ value, onChange, options, placeholder, ukuran = 'form', className = '' }) {
  const [terbuka, setTerbuka] = useState(false);
  const terpilih = options.find((o) => o.value === value);
  const pemicu = ukuran === 'filter'
    ? 'ui-filter-date flex items-center justify-between gap-2 cursor-pointer select-none'
    : 'ui-input flex items-center justify-between cursor-pointer select-none';

  return (
    <div className={`relative ${className}`}>
      <div onClick={() => setTerbuka(!terbuka)} className={`${pemicu} ${terbuka ? 'border-stone-900 ring-3 ring-brand/45' : ''}`}>
        <span className={terpilih ? 'text-stone-900 font-medium truncate' : 'text-stone-500 truncate pr-2'}>{terpilih ? terpilih.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform duration-200 flex-shrink-0 ${terbuka ? 'rotate-180' : ''}`} />
      </div>
      {terbuka && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setTerbuka(false)}></div>
          {/* Daftar panjang (mis. nama sales) bisa digulir */}
          <div className="ui-menu max-h-64 overflow-y-auto ui-scroll-thin">
            {options.map((opt) => (
              <div key={opt.value} onClick={() => { onChange(opt.value); setTerbuka(false); }} className={value === opt.value ? 'ui-menu-item-active' : 'ui-menu-item'}>{opt.label}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
