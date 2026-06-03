'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  
  // State baru untuk fitur lihat password
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'superadmin') {
        router.push('/super-admin') 
      } else if (profile?.role === 'bidang') {
        router.push('/validasi')
      } else {
        router.push('/input-data')
      }

    } catch (error) {
      setErrorMsg("Login gagal. Periksa kembali email dan kata sandi Anda.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 md:p-8 font-sans">
      
      {/* --- KOTAK UTAMA (SPLIT LAYOUT) --- */}
      <div className="w-full max-w-5xl bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col md:flex-row border border-slate-200">
        
        {/* --- PANEL KIRI: BRANDING DINSOS (LIGHT THEME) --- */}
        <div className="md:w-5/12 bg-gradient-to-br from-slate-50 to-slate-100 p-10 md:p-14 flex flex-col justify-between border-r border-slate-200">
          
          {/* Konten Atas */}
          <div>
            <img 
              src="/logo dinsos.png" 
              alt="Logo Dinsos Jatim" 
              className="w-28 h-auto mb-8 drop-shadow-sm hover:scale-105 transition-transform duration-500" 
            />
            
            <h1 className="text-3xl font-black text-slate-800 leading-snug mb-3 tracking-tight">
              Sistem Informasi<br />Bantuan Sosial
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              Dinas Sosial Provinsi Jawa Timur
            </p>
          </div>

          {/* Konten Bawah (Motto) */}
          <div className="hidden md:block mt-12 border-t border-slate-200 pt-6">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
              Motto Pelayanan
            </p>
            <p className="text-blue-900 text-sm font-bold tracking-wide">
              Melayani - Menyelesaikan
            </p>
          </div>
          
        </div>

        {/* --- PANEL KANAN: FORM LOGIN --- */}
        <div className="md:w-7/12 p-10 md:p-16 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto">
            
            {/* Header Form */}
            <div className="mb-10 text-center md:text-left">
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Selamat Datang!</h2>
              <p className="text-sm text-slate-500 mt-2 font-medium">Silakan masuk menggunakan akun yang telah terdaftar di sistem.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              
              {/* Notifikasi Error */}
              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold px-4 py-3.5 rounded-xl flex items-start gap-3 animate-fade-in-up">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-5">
                {/* Input Email */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Email Akun
                  </label>
                  <input 
                    type="email" 
                    required 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20 transition-all placeholder-slate-400" 
                    placeholder="contoh: admin@dinsos.jatimprov.go.id" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                  />
                </div>

                {/* Input Password */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Kata Sandi
                  </label>
                  <div className="relative flex items-center">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required 
                      className="w-full pl-5 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20 transition-all placeholder-slate-400" 
                      placeholder="••••••••" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                    />
                    
                    {/* Tombol Toggle Mata */}
                    <button
                      type="button"
                      className="absolute right-4 text-slate-400 hover:text-blue-900 transition-colors focus:outline-none"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "Sembunyikan password" : "Lihat password"}
                    >
                      {showPassword ? (
                        // Ikon Mata Terbuka (Show)
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      ) : (
                        // Ikon Mata Dicoret (Hide)
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Tombol Login */}
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-8 flex justify-center items-center gap-2 text-sm uppercase tracking-wide"
              >
                {loading ? (
                  <><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Memverifikasi...</>
                ) : 'Masuk ke Sistem'}
              </button>
            </form>

            <div className="mt-12 text-center md:text-left border-t border-slate-100 pt-6">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                Hak Cipta &copy; 2026
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                Pemerintah Provinsi Jawa Timur
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}