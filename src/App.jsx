import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

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
const ProtectedRoute = ({ children }) => {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const location = useLocation();

  if (!isLoggedIn) {
    // Melempar kembali ke login jika belum login
    return <Navigate to="/login" state={{ from: location }} replace />;
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
                <Route path="/bastk" element={<BastkPage />} />
                <Route path="/buku-servis" element={<BukuServisPage />} /> {/* SAKTI: Rute Buku Servis Aktif */}
                <Route path="/cuti" element={<CutiPage />} /> 
                
                {/* ROUTING MODUL KEUANGAN */}
                <Route path="/kwitansi-kredit" element={<KwitansiPage />} />
                <Route path="/kwitansi-cash" element={<KwitansiCashPage />} />
                <Route path="/kwitansi-indent" element={<KwitansiIndentPage />} />
                <Route path="/nota" element={<NotaPage />} />
                
                {/* ROUTING SISTEM */}
                <Route path="/settings" element={<SettingsPage />} />
                
                {/* Fallback jika URL tidak ditemukan (404) */}
                <Route path="*" element={
                  <div className="flex flex-col items-center justify-center h-[80vh]">
                    <h1 className="text-4xl font-black text-slate-300 mb-4">404</h1>
                    <p className="text-slate-500 font-bold">Halaman Tidak Ditemukan</p>
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