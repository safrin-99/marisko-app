import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, BookOpen, CalendarDays, Receipt, Banknote, ClipboardSignature, ScrollText, Settings, LogOut, Menu, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const userRole = localStorage.getItem('adminRole')?.toUpperCase() || '';

  const handleConfirmLogout = () => {
    localStorage.removeItem('isLoggedIn');
    navigate('/login');
  };

  // =========================================================================
  // SAKTI: KAMUS TEMA WARNA MEWAH UNTUK SETIAP MENU (Murni & Anti-Purge)
  // =========================================================================
  const themes = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', hoverText: 'hover:text-blue-600', groupHoverText: 'group-hover:text-blue-500', shadow: 'hover:shadow-blue-100/50', border: 'hover:border-blue-50', grad: 'via-blue-500/10' },
    sky: { bg: 'bg-sky-50', text: 'text-sky-700', hoverText: 'hover:text-sky-600', groupHoverText: 'group-hover:text-sky-500', shadow: 'hover:shadow-sky-100/50', border: 'hover:border-sky-50', grad: 'via-sky-500/10' },
    teal: { bg: 'bg-teal-50', text: 'text-teal-700', hoverText: 'hover:text-teal-600', groupHoverText: 'group-hover:text-teal-500', shadow: 'hover:shadow-teal-100/50', border: 'hover:border-teal-50', grad: 'via-teal-500/10' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', hoverText: 'hover:text-purple-600', groupHoverText: 'group-hover:text-purple-500', shadow: 'hover:shadow-purple-100/50', border: 'hover:border-purple-50', grad: 'via-purple-500/10' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', hoverText: 'hover:text-indigo-600', groupHoverText: 'group-hover:text-indigo-500', shadow: 'hover:shadow-indigo-100/50', border: 'hover:border-indigo-50', grad: 'via-indigo-500/10' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', hoverText: 'hover:text-emerald-600', groupHoverText: 'group-hover:text-emerald-500', shadow: 'hover:shadow-emerald-100/50', border: 'hover:border-emerald-50', grad: 'via-emerald-500/10' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', hoverText: 'hover:text-amber-600', groupHoverText: 'group-hover:text-amber-500', shadow: 'hover:shadow-amber-100/50', border: 'hover:border-amber-50', grad: 'via-amber-500/10' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', hoverText: 'hover:text-rose-600', groupHoverText: 'group-hover:text-rose-500', shadow: 'hover:shadow-rose-100/50', border: 'hover:border-rose-50', grad: 'via-rose-500/10' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-800', hoverText: 'hover:text-slate-700', groupHoverText: 'group-hover:text-slate-600', shadow: 'hover:shadow-slate-200/50', border: 'hover:border-slate-100', grad: 'via-slate-500/10' }
  };

  let menuSections = [
    {
      title: "Ringkasan",
      items: [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', theme: themes.blue }
      ]
    },
    {
      title: "Modul Utama",
      items: [
        ...(userRole !== 'KARYAWAN' ? [{ path: '/bastk', icon: FileText, label: 'Dokumen BASTK', theme: themes.sky }] : []),
        ...(userRole !== 'KARYAWAN' ? [{ path: '/buku-servis', icon: BookOpen, label: 'Buku Servis', theme: themes.teal }] : []),
        { path: '/cuti', icon: CalendarDays, label: 'Cuti & Izin', theme: themes.purple }
      ]
    }
  ];

  if (userRole !== 'KARYAWAN') {
    menuSections.push(
      {
        title: "Modul Keuangan",
        items: [
          { path: '/kwitansi-kredit', icon: Receipt, label: 'Kwitansi Kredit', theme: themes.indigo },
          { path: '/kwitansi-cash', icon: Banknote, label: 'Kwitansi Cash', theme: themes.emerald },
          { path: '/kwitansi-indent', icon: ClipboardSignature, label: 'Kwitansi Indent', theme: themes.amber },
          { path: '/nota', icon: ScrollText, label: 'Nota & Laporan', theme: themes.rose } 
        ]
      },
      {
        title: "Sistem",
        items: [
          { path: '/settings', icon: Settings, label: 'Pengaturan Akun', theme: themes.slate }
        ]
      }
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden relative">
      
      <style>{`
        .sidebar-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 20px;
        }
        .sidebar-scroll:hover::-webkit-scrollbar-thumb {
          background: #cbd5e1;
        }
      `}</style>

      {showLogoutModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4 text-rose-600 shadow-inner">
                <LogOut className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Keluar dari Aplikasi?</h3>
              <p className="text-slate-500 font-medium text-sm mb-6">Anda harus login kembali untuk mengakses sistem MARISKO.</p>
              <div className="flex w-full gap-3">
                <button onClick={() => setShowLogoutModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl active:scale-95 transition-all">
                  Batal
                </button>
                <button onClick={handleConfirmLogout} className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30 active:scale-95 transition-all">
                  Ya, Keluar
                </button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[90] lg:hidden transition-all duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className={`fixed inset-y-0 left-0 z-[100] w-72 h-screen bg-white border-r border-slate-200 flex flex-col flex-shrink-0 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 shadow-2xl lg:shadow-sm ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="h-24 px-8 flex items-center justify-between flex-shrink-0 bg-white border-b border-slate-100 z-10">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 mr-3.5 text-white font-black text-2xl tracking-tighter">M</div>
            <div>
              <h1 className="text-[17px] font-black text-slate-900 tracking-tight leading-tight">MARISKO.APP</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">CV. Marisko Perkasa</p>
            </div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-2 -mr-3 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto sidebar-scroll py-4">
          <nav className="flex flex-col flex-shrink-0">
            {menuSections.map((section, idx) => (
              <div key={idx}>
                <div className={`px-9 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 ${idx !== 0 ? 'mt-6' : 'mt-2'}`}>
                  {section.title}
                </div>
                {section.items.map((item) => {
                  const isActive = currentPath.startsWith(item.path) || (currentPath === '/' && item.path === '/dashboard');
                  const Icon = item.icon;
                  // Terapkan Tema yang dipilih!
                  const theme = item.theme;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`group relative flex items-center px-5 py-3.5 mx-4 rounded-xl text-sm font-bold transition-all duration-300 ease-out active:scale-95 mb-1 cursor-pointer overflow-hidden ${
                        isActive
                          ? `${theme.bg} ${theme.text} shadow-sm`
                          : `text-slate-500 ${theme.hoverText} hover:bg-white hover:shadow-lg ${theme.shadow} hover:-translate-y-0.5 border border-transparent ${theme.border}`
                      }`}
                    >
                      {!isActive && (
                        <div className={`absolute inset-0 bg-gradient-to-r from-transparent ${theme.grad} to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out z-0`}></div>
                      )}
                      
                      <Icon className={`w-[22px] h-[22px] mr-3.5 transition-colors duration-300 z-10 flex-shrink-0 ${
                        isActive 
                          ? theme.text 
                          : `text-slate-400 ${theme.groupHoverText}`
                      }`} />
                      <span className="z-10">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="flex-shrink-0 p-5 border-t border-slate-100 bg-white flex flex-col gap-3">
          <button onClick={() => setShowLogoutModal(true)} className="group relative w-full flex items-center justify-center gap-2.5 py-3.5 bg-rose-50 text-rose-600 rounded-xl font-bold text-[15px] transition-all duration-300 hover:bg-rose-100 hover:shadow-lg hover:shadow-rose-100/50 hover:-translate-y-0.5 active:scale-95 overflow-hidden border border-transparent hover:border-rose-200">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out z-0"></div>
            <LogOut className="w-[22px] h-[22px] transition-colors duration-300 z-10" /> 
            <span className="z-10">Keluar Aplikasi</span>
          </button>
          
          <div className="text-center mt-1">
             <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">© 2026 CV. Marisko Perkasa</p>
          </div>
        </div>
      </div>

      <main className="flex-1 h-screen overflow-hidden bg-slate-50 relative flex flex-col">
        
        <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 flex-shrink-0 shadow-sm z-40">
          <div className="flex items-center">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-600/20 mr-3 text-white font-black text-xl tracking-tighter">M</div>
            <div>
              <h1 className="text-sm font-black text-slate-900 tracking-tight leading-none">MARISKO.APP</h1>
            </div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -mr-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 w-full h-full overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          {children}
        </div>
      </main>
    </div>
  );
}