import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { loadProfile, clearLocalLogin, signOutLocal } from './lib/auth';

// Import Komponen Layout (Ini yang berisi Sidebar)
import Layout from './components/Layout';

// Import Semua Halaman (Pages)
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BastkPage from './pages/BastkPage';
import BukuServisPage from './pages/BukuServisPage'; // SAKTI: Halaman Buku Servis Ditambahkan
import CutiPage from './pages/CutiPage';
import KwitansiPage from './pages/KwitansiPage';
import KwitansiCashPage from './pages/KwitansiCashPage';
import KwitansiIndentPage from './pages/KwitansiIndentPage';
import NotaPage from './pages/NotaPage';
import SettingsPage from './pages/SettingsPage';

// Komponen Sakti untuk Memblokir Akses (Protected Route)
// Berbasis sesi Supabase Auth: mengisi localStorage secara manual tidak membuka halaman.
const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [status, setStatus] = useState('checking'); // checking | ok | denied

  useEffect(() => {
    let active = true;

    const verify = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        clearLocalLogin();
        if (active) setStatus('denied');
        return;
      }

      // Profil dibaca ulang dari database (token palsu/kedaluwarsa akan gagal di sini)
      const profile = await loadProfile(session.user.id);
      if (!active) return;
      if (profile) {
        setStatus('ok');
        return;
      }

      // Tanpa internet profil tidak bisa dicek; pakai data terakhir agar tidak dilempar ke login
      if (!navigator.onLine && localStorage.getItem('adminRole')) {
        setStatus('ok');
        return;
      }

      await signOutLocal();
      if (active) setStatus('denied');
    };
    verify();

    // Sesi berakhir (keluar / token tidak bisa diperbarui) → kembali ke login
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        clearLocalLogin();
        setStatus('denied');
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (status === 'checking') return null;

  if (status === 'denied') {
    // Melempar kembali ke login jika belum login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// SAKTI: Halaman yang menunya disembunyikan untuk KARYAWAN juga ditolak bila dibuka lewat URL.
// Ini hanya lapisan tampilan; pengaman sebenarnya harus di database (Supabase Auth + RLS).
const NonKaryawanRoute = ({ children }) => {
  const userRole = localStorage.getItem('adminRole')?.toUpperCase() || '';

  if (userRole === 'KARYAWAN') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default function App() {
  return (
    <Router>
      <Routes>
        {/* =======================================================
            HALAMAN LOGIN (TIDAK ADA SIDEBAR, BEBAS AKSES)
            ======================================================= */}
        <Route path="/login" element={<LoginPage />} />

        {/* =======================================================
            SEMUA HALAMAN DI DALAM SINI AKAN MEMILIKI SIDEBAR 
            DAN DILINDUNGI OLEH <ProtectedRoute>
            ======================================================= */}
        <Route path="/*" element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                {/* Default route otomatis diarahkan ke Dashboard */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                
                {/* ROUTING RINGKASAN */}
                <Route path="/dashboard" element={<DashboardPage />} />
                
                {/* ROUTING MODUL UTAMA */}
                <Route path="/bastk" element={<NonKaryawanRoute><BastkPage /></NonKaryawanRoute>} />
                <Route path="/buku-servis" element={<NonKaryawanRoute><BukuServisPage /></NonKaryawanRoute>} /> {/* SAKTI: Rute Buku Servis Aktif */}
                <Route path="/cuti" element={<CutiPage />} />

                {/* ROUTING MODUL KEUANGAN */}
                <Route path="/kwitansi-kredit" element={<NonKaryawanRoute><KwitansiPage /></NonKaryawanRoute>} />
                <Route path="/kwitansi-cash" element={<NonKaryawanRoute><KwitansiCashPage /></NonKaryawanRoute>} />
                <Route path="/kwitansi-indent" element={<NonKaryawanRoute><KwitansiIndentPage /></NonKaryawanRoute>} />
                <Route path="/nota" element={<NonKaryawanRoute><NotaPage /></NonKaryawanRoute>} />

                {/* ROUTING SISTEM */}
                <Route path="/settings" element={<NonKaryawanRoute><SettingsPage /></NonKaryawanRoute>} />
                
                {/* Fallback jika URL tidak ditemukan (404) */}
                <Route path="*" element={
                  <div className="flex flex-col items-center justify-center h-[80vh]">
                    <h1 className="font-mono text-4xl font-semibold text-stone-300 mb-4">404</h1>
                    <p className="text-stone-600 font-medium">Halaman Tidak Ditemukan</p>
                  </div>
                } />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}