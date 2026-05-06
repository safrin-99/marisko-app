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
    <div className="min-h-screen flex items-center justify-center bg-slate-100 font-sans p-4 relative overflow-hidden">
      
      {/* Card Utama Login (Rasio 50:50) */}
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row relative z-10 animate-in zoom-in-95 duration-500">
          
          {/* SISI KIRI - BRANDING */}
          <div className="w-full md:w-1/2 bg-red-600 p-10 lg:p-12 flex-col justify-between relative overflow-hidden hidden md:flex">
            <div className="absolute top-[-20%] left-[-10%] w-64 h-64 bg-white rounded-full blur-[80px] opacity-10 pointer-events-none z-0"></div>

            <div className="relative z-10 mt-6">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg text-red-600 font-black text-2xl tracking-tighter mb-6">M</div>
              
              <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight antialiased drop-shadow-md">
                  Sistem HRIS & <br/><span className="text-white">Keuangan</span>
              </h1>
              
              <p className="text-white font-semibold mt-4 text-sm leading-relaxed antialiased drop-shadow-sm">
                  Platform Enterprise untuk mengelola BASTK, Kwitansi, Nota, dan Laporan Keuangan secara terpusat.
              </p>
            </div>

            <div className="relative z-10 mb-6 mt-12">
              <div className="flex items-center gap-3 bg-red-700/80 border border-red-500/50 p-4 rounded-xl w-fit shadow-md">
                  <ShieldCheck className="w-6 h-6 text-white drop-shadow-sm" />
                  <div className="text-left antialiased">
                    <p className="text-[10px] font-extrabold text-white uppercase tracking-widest drop-shadow-sm">Keamanan Server</p>
                    <p className="text-xs font-black text-white drop-shadow-sm">Enkripsi Data 256-bit</p>
                  </div>
              </div>
            </div>
          </div>

          {/* SISI KANAN - FORM LOGIN */}
          <div className="w-full md:w-1/2 p-8 lg:p-12 flex flex-col justify-center bg-white">
            
            <div className="text-center lg:text-left mb-8">
              <div className="flex justify-center mb-6 md:hidden">
                <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg text-white font-black text-xl tracking-tighter">M</div>
              </div>
              <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight antialiased">Selamat Datang</h2>
              <p className="text-slate-500 font-medium mt-1 text-sm lg:text-base antialiased">Masuk ke akun MARISKO.APP Anda</p>
            </div>

            {errorMsg && (
              <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center animate-in shake">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" /> {errorMsg}
              </div>
            )}
            
            {lupaSandiMsg && (
              <div className="mb-6 bg-slate-50 border border-slate-200 text-slate-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center animate-in fade-in">
                <ShieldCheck className="w-4 h-4 mr-2 flex-shrink-0 text-red-500" /> {lupaSandiMsg}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-red-500 transition-colors" />
                  </div>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Alamat Email" 
                    required
                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
                
               <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-red-500 transition-colors" />
                    </div>
                    
                    {/* PERBAIKAN: Gunakan variabel showPassword untuk menentukan tipe input */}
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Kata Sandi" 
                      required
                      className="block w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-slate-400"
                    />

                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      {/* PERBAIKAN: Pastikan onClick memicu setShowPassword */}
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)} 
                        className="text-slate-400 hover:text-red-600 focus:outline-none p-1 rounded transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500/20 cursor-pointer" />
                  <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Ingat saya</span>
                </label>
                <button type="button" onClick={handleLupaSandi} className="text-sm font-bold text-red-600 hover:text-red-800 transition-colors">Lupa sandi?</button>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className={`w-full py-4 mt-2 bg-red-600 text-white rounded-xl font-bold shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 transition-all duration-300 hover:bg-red-700 hover:shadow-red-600/40 active:scale-95 ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
              >
                {isLoading ? (
                  <><RefreshCw className="w-5 h-5 animate-spin" /> Memverifikasi...</>
                ) : (
                  <>Masuk ke Sistem <ArrowRight className="w-5 h-5" /></>
                )}
              </button>
            </form>
          </div>
      </div>

      {/* FOOTER COPYRIGHT */}
      <div className="absolute bottom-4 lg:bottom-8 left-0 w-full text-center z-0">
        <p className="text-xs font-semibold text-slate-400">
          &copy; {new Date().getFullYear()} CV. MARISKO PERKASA
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Hak Cipta Dilindungi Undang-Undang.
        </p>
      </div>

    </div>
  );
}