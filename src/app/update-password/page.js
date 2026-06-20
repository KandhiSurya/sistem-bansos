'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import toast from 'react-hot-toast'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    // Memastikan user memiliki session (dari link reset password)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error("Sesi tidak valid atau telah kedaluwarsa. Silakan ajukan reset password ulang.")
        router.push('/')
      }
    }
    checkSession()
  }, [router])

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error("Password minimal 6 karakter.")
      return
    }
    if (password !== confirmPassword) {
      toast.error("Password dan konfirmasi password tidak cocok.")
      return
    }

    setLoading(true)
    const toastId = toast.loading("Memperbarui kata sandi...")

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      toast.success("Kata sandi berhasil diperbarui! Silakan masuk kembali.", { id: toastId })
      // Sign out to clean up session and force re-login
      await supabase.auth.signOut()
      router.push('/')
    } catch (error) {
      toast.error("Gagal memperbarui kata sandi: " + error.message, { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 md:p-8 font-sans">
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-200 p-8 md:p-10">
        
        {/* Header */}
        <div className="mb-8 text-center">
          <img 
            src="/logo dinsos.png" 
            alt="Logo Dinsos Jatim" 
            className="w-20 h-auto mx-auto mb-6 drop-shadow-sm" 
          />
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Atur Ulang Kata Sandi</h2>
          <p className="text-xs text-slate-500 mt-2 font-medium">Masukkan kata sandi baru untuk akun Anda.</p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-6">
          
          {/* Password Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Kata Sandi Baru
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
              <button
                type="button"
                className="absolute right-4 text-slate-400 hover:text-blue-900 transition-colors focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Konfirmasi Kata Sandi Baru
            </label>
            <input 
              type={showPassword ? "text" : "password"} 
              required 
              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20 transition-all placeholder-slate-400" 
              placeholder="••••••••" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
            />
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex justify-center items-center gap-2 text-sm uppercase tracking-wide"
          >
            {loading ? 'Memperbarui...' : 'Simpan Kata Sandi Baru'}
          </button>
        </form>

      </div>
    </div>
  )
}
