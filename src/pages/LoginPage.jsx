import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck, RefreshCw, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lupaSandiMsg, setLupaSandiMsg] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setLupaSandiMsg('');

    if (!navigator.onLine) {
        setErrorMsg('Tidak ada koneksi internet. Cek WiFi Anda!');
        setIsLoading(false);
        return;
    }

    try {
      const { data, error } = await supabase
        .from('admin_accounts')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

      if (error || !data) {
        setErrorMsg('Email atau Kata Sandi salah!');
      } else {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('adminName', data.nama);
        localStorage.setItem('adminRole', data.role);
        
        setTimeout(() => {
          navigate('/dashboard');
        }, 800);
      }
    } catch (err) {
      setErrorMsg('Gagal terhubung ke server database.');
    }
    
    setIsLoading(false);
  };

  const handleLupaSandi = (e) => {
      e.preventDefault();
      setLupaSandiMsg('Silakan hubungi IT Support (Admin Pusat) untuk mereset kata sandi Anda.');
      setErrorMsg('');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-4 sm:p-6 relative">

      {/* Card Utama Login (Rasio 50:50) */}
      <div className="w-full max-w-4xl bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row relative z-10">

          {/* SISI KIRI - BRANDING */}
          <div className="w-full md:w-1/2 bg-brand p-10 lg:p-12 flex-col justify-between relative overflow-hidden hidden md:flex">

            <div className="relative z-10">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-brand font-bold text-xl mb-8">M</div>

              <h1 className="text-3xl lg:text-[34px] font-semibold text-brand-fg tracking-tight leading-tight">
                  Sistem HRIS & <br/><span className="text-brand-fg">Keuangan</span>
              </h1>

              <p className="text-stone-300 mt-4 text-[15px] leading-relaxed max-w-sm">
                  Platform Enterprise untuk mengelola BASTK, Kwitansi, Nota, dan Laporan Keuangan secara terpusat.
              </p>
            </div>

            <div className="relative z-10 mt-12">
              <div className="flex items-center gap-3 border border-white/15 p-3.5 rounded-lg w-fit">
                  <ShieldCheck className="w-5 h-5 text-stone-300" />
                  <div className="text-left">
                    <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em]">Keamanan Server</p>
                    <p className="text-sm font-medium text-brand-fg">Enkripsi Data 256-bit</p>
                  </div>
              </div>
            </div>
          </div>

          {/* SISI KANAN - FORM LOGIN */}
          <div className="w-full md:w-1/2 p-8 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">

            <div className="text-center md:text-left mb-8">
              <div className="flex justify-center mb-6 md:hidden">
                <div className="w-11 h-11 bg-brand rounded-xl flex items-center justify-center text-brand-fg font-bold text-lg">M</div>
              </div>
              <h2 className="text-2xl lg:text-[28px] font-semibold text-stone-900 tracking-tight">Selamat Datang</h2>
              <p className="text-stone-600 mt-1 text-[15px]">Masuk ke akun MARISKO.APP Anda</p>
            </div>

            {errorMsg && (
              <div className="ui-alert-danger mb-6">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errorMsg}
              </div>
            )}

            {lupaSandiMsg && (
              <div className="ui-alert-neutral mb-6">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 text-stone-500" /> {lupaSandiMsg}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-3">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-[18px] w-[18px] text-stone-400 group-focus-within:text-stone-900 transition-colors" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Alamat Email"
                    aria-label="Alamat Email"
                    required
                    className="ui-input h-12 pl-11 pr-4"
                  />
                </div>

               <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-[18px] w-[18px] text-stone-400 group-focus-within:text-stone-900 transition-colors" />
                    </div>

                    {/* PERBAIKAN: Gunakan variabel showPassword untuk menentukan tipe input */}
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Kata Sandi"
                      aria-label="Kata Sandi"
                      required
                      className="ui-input h-12 pl-11 pr-12"
                    />

                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                      {/* PERBAIKAN: Pastikan onClick memicu setShowPassword */}
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                        className="text-stone-500 hover:text-stone-900 hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 p-2 rounded-md transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                      </button>
                    </div>
                  </div>
                </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-stone-300 accent-stone-900 cursor-pointer" />
                  <span className="text-sm text-stone-700 group-hover:text-stone-900 transition-colors">Ingat saya</span>
                </label>
                <button type="button" onClick={handleLupaSandi} className="text-sm font-medium text-stone-900 underline underline-offset-4 decoration-stone-300 hover:decoration-stone-900 transition-colors">Lupa sandi?</button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`ui-btn-primary w-full h-12 mt-1 ${isLoading ? 'cursor-wait' : ''}`}
              >
                {isLoading ? (
                  <><RefreshCw className="w-[18px] h-[18px] animate-spin" /> Memverifikasi...</>
                ) : (
                  <>Masuk ke Sistem <ArrowRight className="w-[18px] h-[18px]" /></>
                )}
              </button>
            </form>
          </div>
      </div>

      {/* FOOTER COPYRIGHT */}
      <div className="mt-8 w-full text-center">
        <p className="text-xs font-medium text-stone-600">
          &copy; {new Date().getFullYear()} CV. MARISKO PERKASA
        </p>
        <p className="text-xs text-stone-500 mt-0.5">
          Hak Cipta Dilindungi Undang-Undang.
        </p>
      </div>

    </div>
  );
}
