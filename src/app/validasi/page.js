'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

// Import Sub-Komponen Modular
import StatCards from './components/StatCards'
import VerificationQueue from './components/VerificationQueue'

export default function ValidasiPage() {
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [dataBansos, setDataBansos] = useState([])
  const [currentUserEmail, setCurrentUserEmail] = useState('') 
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  
  const [stats, setStats] = useState({ total: 0, perluValidasi: 0, disetujui: 0, ditolak: 0, pkh: 0, kip: 0, fakmis: 0 })
  const [activeTab, setActiveTab] = useState('Pending') 
  
  // State Pemicu Ekspor Excel (dari Header)
  const [exportExcelTrigger, setExportExcelTrigger] = useState(false)

  const fetchRealtimeData = useCallback(async () => {
    const { data, error } = await supabase.from('pengajuan_bantuan').select('*').order('created_at', { ascending: false })
    if (!error && data) {
      setDataBansos(data)
      setStats({
        total: data.length, 
        perluValidasi: data.filter(d => d.status === 'Menunggu Validasi').length,
        disetujui: data.filter(d => d.status === 'Disetujui').length, 
        ditolak: data.filter(d => d.status === 'Perlu Revisi').length,
        pkh: data.filter(d => d.jenis_bantuan === 'PKH').length, 
        kip: data.filter(d => d.jenis_bantuan === 'KIP').length, 
        fakmis: data.filter(d => d.jenis_bantuan === 'FAKMIS').length
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      
      setCurrentUserEmail(user.email) 

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'bidang') { router.push('/'); return }
      
      // Panggil data awal
      fetchRealtimeData()
    }
    
    fetchData()

    // --- PASANG RADAR REALTIME ---
    const channel = supabase
      .channel('validasi-realtime')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'pengajuan_bantuan' }, 
        () => { 
          fetchRealtimeData(); 
        }
      )
      .subscribe()

    return () => { 
      supabase.removeChannel(channel) 
    }
  }, [router, fetchRealtimeData])  

  const catatLog = useCallback(async (aksi, keterangan) => {
     try {
        await supabase.from('log_aktivitas').insert([{ 
           email_pengguna: currentUserEmail, role: 'Bidang', aksi: aksi, keterangan: keterangan 
        }])
     } catch (error) {}
  }, [currentUserEmail])

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div></div>

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
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Bidang Provinsi</p>
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

        {/* MENU NAVIGASI */}
        <nav className={`flex-1 py-6 space-y-2 overflow-y-auto ${isSidebarOpen ? 'px-4' : 'px-3'}`}>
          <button onClick={() => setActiveTab('Pending')} className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4 py-3 justify-start' : 'justify-center py-3 px-0'} rounded-xl text-sm font-bold transition-all ${activeTab === 'Pending' ? 'bg-blue-50 text-blue-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} title="Antrean Validasi">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            {isSidebarOpen && <span className="truncate">Antrean Validasi</span>}
          </button>
          <button onClick={() => setActiveTab('Riwayat')} className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4 py-3 justify-start' : 'justify-center py-3 px-0'} rounded-xl text-sm font-bold transition-all ${activeTab === 'Riwayat' ? 'bg-blue-50 text-blue-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} title="Riwayat Validasi">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {isSidebarOpen && <span className="truncate">Riwayat Validasi</span>}
          </button>
        </nav>

        {/* FOOTER LOGOUT */}
        <div className="p-4 border-t border-slate-100">
          <button onClick={() => setShowLogoutConfirm(true)} className={`w-full flex items-center ${isSidebarOpen ? 'justify-center gap-2 px-4' : 'justify-center px-0'} py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100`} title="Keluar Sistem">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            {isSidebarOpen && <span className="truncate">Keluar</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-extrabold text-slate-800">{activeTab === 'Pending' ? 'Menunggu Validasi Provinsi' : 'Arsip Keseluruhan Data'}</h2>
          <button onClick={() => setExportExcelTrigger(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Unduh Rekap Excel</button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 animate-fadeIn">
          
          {/* STATS & CHARTS CARDS */}
          <StatCards stats={stats} dataBansos={dataBansos} />

          {/* TABEL AREA / VERIFICATION QUEUE */}
          <VerificationQueue 
            dataBansos={dataBansos}
            activeTab={activeTab}
            fetchRealtimeData={fetchRealtimeData}
            catatLog={catatLog}
            currentUserEmail={currentUserEmail}
            exportExcelTrigger={exportExcelTrigger}
            setExportExcelTrigger={setExportExcelTrigger}
          />
        </div>
      </main>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-red-100 text-red-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1" />
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