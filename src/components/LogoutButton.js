'use client'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/') // Kembali ke halaman login
  }

  return (
    <button 
      onClick={handleLogout}
      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm"
    >
      Keluar
    </button>
  )
}   