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

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      // 1. Login Auth
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // 2. Cek Role di Tabel Profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      // 3. Routing Berdasarkan Role (UPDATE DISINI)
      if (profile?.role === 'superadmin') {
        router.push('/super-admin') // <-- Mengarah ke folder super-admin
      } else if (profile?.role === 'bidang') {
        router.push('/validasi')
      } else {
        router.push('/input-data')
      }

    } catch (error) {
      setErrorMsg("Login gagal. Periksa email/password atau hubungi admin.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-6 font-sans text-gray-900">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="px-8 pt-12 pb-8 text-center">
          <div className="mx-auto w-14 h-14 bg-gray-900 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg mb-6">
            DS
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sistem Internal</h1>
          <p className="text-sm text-gray-500 mt-2 font-medium">Validasi Bantuan Sosial Jawa Timur</p>
        </div>

        <form onSubmit={handleLogin} className="px-8 pb-12 space-y-5">
          {errorMsg && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-bold px-4 py-3 rounded-lg flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Email Akun</label>
            <input type="email" required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all placeholder-gray-400" placeholder="admin@dinsos.jatimprov.go.id" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Kata Sandi</label>
            <input type="password" required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all placeholder-gray-400" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed mt-4 flex justify-center items-center gap-2 text-sm uppercase tracking-wide">
            {loading ? 'Memverifikasi...' : 'Masuk Aplikasi'}
          </button>
        </form>
      </div>
      <p className="text-center text-xs text-gray-400 mt-8 font-medium">© 2026 Dinas Sosial Provinsi Jawa Timur</p>
    </div>
  )
} 