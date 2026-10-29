import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, BookOpen, CalendarDays, Receipt, Banknote, ClipboardSignature, ScrollText, Settings, LogOut, Menu, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLogoutClosing, setIsLogoutClosing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const userRole = localStorage.getItem('adminRole')?.toUpperCase() || '';

  const handleConfirmLogout = () => {
    localStorage.removeItem('isLoggedIn');
    navigate('/login');
  };

  // Popup keluar ditutup dengan animasi dulu (sama dengan durasi .ui-modal-closing), baru aksinya dijalankan
  const closeLogoutModal = (afterClose) => {
    if (isLogoutClosing) return;
    setIsLogoutClosing(true);
    setTimeout(() => {
      setShowLogoutModal(false);
      setIsLogoutClosing(false);
      if (afterClose) afterClose();
    }, 180);
  };

  let menuSections = [
    {
      title: "Ringkasan",
      items: [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }
      ]
    },
    {
      title: "Modul Utama",
      items: [
        ...(userRole !== 'KARYAWAN' ? [{ path: '/bastk', icon: FileText, label: 'Dokumen BASTK' }] : []),
        ...(userRole !== 'KARYAWAN' ? [{ path: '/buku-servis', icon: BookOpen, label: 'Buku Servis' }] : []),
        { path: '/cuti', icon: CalendarDays, label: 'Cuti & Izin' }
      ]
    }
  ];

  if (userRole !== 'KARYAWAN') {
    menuSections.push(
      {
        title: "Modul Keuangan",
        items: [
          { path: '/kwitansi-kredit', icon: Receipt, label: 'Kwitansi Kredit' },
          { path: '/kwitansi-cash', icon: Banknote, label: 'Kwitansi Cash' },
          { path: '/kwitansi-indent', icon: ClipboardSignature, label: 'Kwitansi Indent' },
          { path: '/nota', icon: ScrollText, label: 'Nota & Laporan' } 
        ]
      },
      {
        title: "Sistem",
        items: [
          { path: '/settings', icon: Settings, label: 'Pengaturan Akun' }
        ]
      }
    );
  }

  return (
    <div className="flex h-screen bg-stone-50 text-stone-900 overflow-hidden relative">

      {showLogoutModal && createPortal(
        <div className={`ui-overlay ${isLogoutClosing ? 'ui-overlay-closing' : ''}`}>
          <div className={`ui-modal max-w-sm ${isLogoutClosing ? 'ui-modal-closing' : ''}`}>
            <div className="flex flex-col items-center text-center">
              <div className="ui-modal-icon-danger">
                <LogOut className="w-6 h-6" />
              </div>
              <h3 className="ui-modal-title">Keluar dari Aplikasi?</h3>
              <p className="ui-modal-text">Anda harus login kembali untuk mengakses sistem MARISKO.</p>
              <div className="flex w-full gap-3">
                <button onClick={() => closeLogoutModal()} className="ui-btn-secondary flex-1">
                  Batal
                </button>
                <button onClick={() => closeLogoutModal(handleConfirmLogout)} className="ui-btn-danger flex-1">
                  Ya, Keluar
                </button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-stone-950/40 z-[90] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className={`fixed inset-y-0 left-0 z-[100] w-64 h-screen bg-stone-50 border-r border-stone-200 flex flex-col flex-shrink-0 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}`}>

        <div className="h-16 px-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center">
            <div className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center mr-3 text-brand-fg font-bold text-lg">M</div>
            <div>
              <h1 className="text-[15px] font-bold text-stone-900 tracking-tight leading-tight">MARISKO.APP</h1>
              <p className="text-[11px] font-medium text-stone-600 uppercase tracking-[0.06em] mt-0.5">CV. Marisko Perkasa</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Tutup menu"
            className="lg:hidden ui-btn-icon border-transparent bg-transparent -mr-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto ui-scroll-thin px-3 py-3">
          <nav className="flex flex-col gap-5">
            {menuSections.map((section, idx) => (
              <div key={idx}>
                <div className="px-2.5 mb-1.5 ui-caption">
                  {section.title}
                </div>
                <div className="flex flex-col gap-0.5">
                  {section.items.map((item) => {
                    const isActive = currentPath.startsWith(item.path) || (currentPath === '/' && item.path === '/dashboard');
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        aria-current={isActive ? 'page' : undefined}
                        className={isActive ? 'ui-nav-link-active' : 'ui-nav-link'}
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-stone-900' : 'text-stone-500'}`} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex-shrink-0 p-3 border-t border-stone-200 flex flex-col gap-2.5">
          <button onClick={() => setShowLogoutModal(true)} className="ui-btn-secondary w-full h-10 hover:text-red-700">
            <LogOut className="w-4 h-4" />
            <span>Keluar Aplikasi</span>
          </button>

          <div className="text-center">
             <p className="text-[11px] font-medium text-stone-600 uppercase tracking-[0.06em]">© 2026 CV. Marisko Perkasa</p>
          </div>
        </div>
      </div>

      <main className="flex-1 h-screen overflow-hidden relative flex flex-col bg-white">

        <div className="lg:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-stone-200 flex-shrink-0 z-40">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center mr-2.5 text-brand-fg font-bold text-base">M</div>
            <div>
              <h1 className="text-sm font-bold text-stone-900 tracking-tight leading-none">MARISKO.APP</h1>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Buka menu"
            className="ui-btn-icon border-transparent bg-transparent -mr-2"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 w-full h-full overflow-y-auto ui-scroll-thin p-4 md:px-8 md:py-6 bg-white">
          {children}
        </div>
      </main>
    </div>
  );
}
