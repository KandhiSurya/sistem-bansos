'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import toast from 'react-hot-toast'

// Import Sub-Komponen Modular
import StatCards from './components/StatCards'
import UserManagement from './components/UserManagement'
import BansosMonitoring from './components/BansosMonitoring'
import ActivityLogs from './components/ActivityLogs'

export default function SuperAdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('users') 
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  
  const [users, setUsers] = useState([])
  const [allBansos, setAllBansos] = useState([])
  const [logs, setLogs] = useState([]) 
  const [stats, setStats] = useState({ users: 0, totalData: 0, cities: 0 })

  // State Pemicu Form Modal Tambah User (dari Header)
  const [isFormOpen, setIsFormOpen] = useState(false)
  
  // State Pemicu Ekspor Excel (dari Header)
  const [exportExcelTrigger, setExportExcelTrigger] = useState(false)

  const catatLog = useCallback(async (aksi, keterangan) => {
     try {
        await supabase.from('log_aktivitas').insert([{ 
           email_pengguna: currentUserEmail, role: 'Super Admin', aksi: aksi, keterangan: keterangan 
        }])
     } catch (error) { 
        console.error("Gagal mencatat log", error) 
     }
  }, [currentUserEmail])

  const fetchData = useCallback(async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/'); return }
        setCurrentUserEmail(user.email)

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (!profile || profile.role !== 'superadmin') { 
            toast.error("Akses Ditolak: Peran Anda bukan Super Admin.")
            router.push('/'); return 
        } 

        const { data: usersData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
        const { data: bansosData } = await supabase.from('pengajuan_bantuan').select('*').order('created_at', { ascending: false })
        const { data: logsData } = await supabase.from('log_aktivitas').select('*').order('created_at', { ascending: false }).limit(300)
        
        setUsers(usersData || [])
        setAllBansos(bansosData || [])
        setLogs(logsData || [])
        
        setStats({
          users: usersData?.length || 0,
          totalData: bansosData?.length || 0,
          cities: usersData?.filter(u => u.role === 'operator').length || 0
        })
    } catch (error) { 
        toast.error("Gagal memuat data: " + error.message) 
    } finally { 
        setLoading(false) 
    }
  }, [router])

  useEffect(() => { 
    fetchData() 
    const channel = supabase.channel('superadmin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'log_aktivitas' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pengajuan_bantuan' }, () => fetchData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className={`bg-white border-r border-slate-200 flex flex-col shrink-0 z-20 transition-all duration-300 ease-in-out print:hidden ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        
        {/* HEADER SIDEBAR */}
        <div className={`h-[72px] px-5 flex items-center border-b border-slate-100 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
          {isSidebarOpen ? (
            <>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">D</div>
                <div className="truncate">
                  <h1 className="text-[13px] font-black text-slate-900 tracking-wider leading-tight">DINSOS JATIM</h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Super Admin</p>
                </div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-blue-900 transition-colors shrink-0" title="Tutup Sidebar">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
              </button>
            </>
          ) : (
            <button onClick={() => setIsSidebarOpen(true)} className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-md shrink-0 hover:scale-105 transition-transform" title="Buka Sidebar">
              D
            </button>
          )}
        </div>

        {/* MENU NAVIGASI KIRI */}
        <nav className={`flex-1 py-6 space-y-2 overflow-y-auto ${isSidebarOpen ? 'px-4' : 'px-3'}`}>
          <button onClick={() => setActiveTab('users')} className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4 py-3 justify-start' : 'justify-center py-3 px-0'} rounded-xl text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-blue-50 text-blue-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} title="Pengguna">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            {isSidebarOpen && <span className="truncate">Pengguna</span>}
          </button>
          <button onClick={() => setActiveTab('data')} className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4 py-3 justify-start' : 'justify-center py-3 px-0'} rounded-xl text-sm font-bold transition-all ${activeTab === 'data' ? 'bg-blue-50 text-blue-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} title="Monitoring Data">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {isSidebarOpen && <span className="truncate">Monitoring Data</span>}
          </button>
          <button onClick={() => setActiveTab('logs')} className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4 py-3 justify-start' : 'justify-center py-3 px-0'} rounded-xl text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-blue-50 text-blue-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} title="Log Aktivitas">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            {isSidebarOpen && <span className="truncate">Log Aktivitas</span>}
          </button>
        </nav>

        {/* BAGIAN BAWAH (LOGOUT) */}
        <div className="p-4 border-t border-slate-100">
          <button onClick={() => setShowLogoutConfirm(true)} className={`w-full flex items-center ${isSidebarOpen ? 'justify-center gap-2 px-4' : 'justify-center px-0'} py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100`} title="Keluar Sistem">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            {isSidebarOpen && <span className="truncate">Keluar</span>}
          </button>
        </div>
      </aside>

      {/* VIEW UTAMA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shrink-0 print:hidden">
          <h2 className="text-xl font-extrabold text-slate-800">
             {activeTab === 'users' ? 'Manajemen Pengguna' : activeTab === 'data' ? 'Monitoring Data Bantuan' : 'Pusat Audit Log Sistem'}
          </h2>
          <div className="flex items-center gap-3">
             {activeTab === 'users' && (<button onClick={() => setIsFormOpen(true)} className="bg-blue-900 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm">Tambah User</button>)}
             {activeTab === 'data' && (<button onClick={() => setExportExcelTrigger(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm">Export Excel</button>)}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Baris Statistik */}
          <StatCards stats={stats} users={users} activeTab={activeTab} />

          {/* Konten Area Tabel / Konten Tab */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {activeTab === 'users' && (
              <UserManagement 
                users={users}
                currentUserEmail={currentUserEmail}
                fetchData={fetchData}
                isFormOpen={isFormOpen}
                setIsFormOpen={setIsFormOpen}
                catatLog={catatLog}
              />
            )}

            {activeTab === 'data' && (
              <BansosMonitoring 
                allBansos={allBansos}
                catatLog={catatLog}
                exportExcelTrigger={exportExcelTrigger}
                setExportExcelTrigger={setExportExcelTrigger}
              />
            )}

            {activeTab === 'logs' && (
              <ActivityLogs 
                logs={logs}
                fetchData={fetchData}
                catatLog={catatLog}
              />
            )}
          </div>
        </div>
      </main>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-red-100 text-red-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <h3 className="text-lg font-extrabold text-slate-800 leading-tight">Konfirmasi Keluar</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin keluar dari sistem? Anda harus masuk kembali untuk mengakses data.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => setShowLogoutConfirm(false)} 
                className="px-4 py-2 text-xs font-bold text-slate-500 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={async () => {
                  setShowLogoutConfirm(false);
                  await supabase.auth.signOut();
                  router.push('/');
                }} 
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-md rounded-xl transition-colors"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
} 