'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import toast from 'react-hot-toast'

// Import Sub-Komponen Modular
import StatCards from './components/StatCards'
import BansosForm from './components/BansosForm'
import BansosHistory from './components/BansosHistory'

export default function InputDataPage() {
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState(null)
  const [currentUserEmail, setCurrentUserEmail] = useState('') 
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState('form')
  
  // State Pemicu Impor/Ekspor Excel (dari Header)
  const [importExcelTrigger, setImportExcelTrigger] = useState(false)
  const [exportExcelTrigger, setExportExcelTrigger] = useState(false)
  
  // State form input yang sinkron dengan aksi edit
  const [editId, setEditId] = useState(null) 
  const [formData, setFormData] = useState({ nik: '', no_kk: '', nama: '', alamat: '', pekerjaan: '', pendapatan: '< Rp 500.000', tanggungan: '', agama: '', status_pernikahan: '', pendidikan_terakhir: '', catatan_tambahan: '' })
  const [files, setFiles] = useState({ ktp: null, diri: null, kerja: null, rumah: null })
  const [oldUrls, setOldUrls] = useState({ ktp: '', diri: '', kerja: '', rumah: '' })
  
  const [historyData, setHistoryData] = useState([])
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })

  const initData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    setCurrentUserEmail(user.email) 
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setUserProfile(profile)
    if (profile?.role !== 'operator') { router.push('/'); return }

    const { data: history, error } = await supabase.from('pengajuan_bantuan').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    if (!error && history) {
      setHistoryData(history)
      setStats({
        total: history.length, 
        pending: history.filter(d => d.status === 'Menunggu Validasi').length,
        approved: history.filter(d => d.status === 'Disetujui').length, 
        rejected: history.filter(d => d.status === 'Perlu Revisi').length
      })
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    setTimeout(() => {
      initData()
    }, 0);
    const channel = supabase.channel('operator-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'pengajuan_bantuan' }, () => {
         initData(); 
         toast('Status pengajuan diperbarui!', { icon: '🔔' })
     }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [initData])

  const catatLog = useCallback(async (aksi, keterangan) => {
     try { 
       await supabase.from('log_aktivitas').insert([{ email_pengguna: currentUserEmail, role: 'Operator', aksi: aksi, keterangan: keterangan }])
     } catch (error) {}
  }, [currentUserEmail])

  const handleEdit = useCallback((item) => {
    setFormData({ 
      nik: item.nik, 
      no_kk: item.no_kk || '', 
      nama: item.nama_lengkap, 
      alamat: item.alamat, 
      pekerjaan: item.pekerjaan || '', 
      pendapatan: item.pendapatan || '< Rp 500.000', 
      tanggungan: item.tanggungan || '',
      agama: item.agama || '',
      status_pernikahan: item.status_pernikahan || '',
      pendidikan_terakhir: item.pendidikan_terakhir || '',
      catatan_tambahan: item.catatan_tambahan || ''
    })
    setOldUrls({ 
      ktp: item.foto_ktp, 
      diri: item.foto_diri, 
      kerja: item.foto_pekerjaan, 
      rumah: item.foto_rumah 
    })
    setEditId(item.id)
    setActiveTab('form')
    toast(`MODE REVISI AKTIF\nCatatan: ${item.alasan_penolakan}`, { icon: '📝', duration: 5000 })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditId(null)
    setFormData({ nik: '', no_kk: '', nama: '', alamat: '', pekerjaan: '', pendapatan: '< Rp 500.000', tanggungan: '', agama: '', status_pernikahan: '', pendidikan_terakhir: '', catatan_tambahan: '' })
    setFiles({ ktp: null, diri: null, kerja: null, rumah: null })
    setOldUrls({ ktp: '', diri: '', kerja: '', rumah: '' })
  }, [])

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
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{userProfile?.kabupaten_kota || 'Operator Daerah'}</p>
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

        {/* NAVIGASI MENU */}
        <nav className={`flex-1 py-6 space-y-2 overflow-y-auto ${isSidebarOpen ? 'px-4' : 'px-3'}`}>
          <button onClick={() => setActiveTab('form')} className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4 py-3 justify-start' : 'justify-center py-3 px-0'} rounded-xl text-sm font-bold transition-all ${activeTab === 'form' ? 'bg-blue-50 text-blue-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} title="Pengajuan Baru">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {isSidebarOpen && <span className="truncate">Pengajuan Baru</span>}
          </button>
          <button onClick={() => setActiveTab('history')} className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4 py-3 justify-start' : 'justify-center py-3 px-0'} rounded-xl text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-blue-50 text-blue-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} title="Riwayat Pengajuan">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            {isSidebarOpen && <span className="truncate">Riwayat Pengajuan</span>}
          </button>
        </nav>

        {/* LOGOUT */}
        <div className="p-4 border-t border-slate-100">
          <button onClick={() => setShowLogoutConfirm(true)} className={`w-full flex items-center ${isSidebarOpen ? 'justify-center gap-2 px-4' : 'justify-center px-0'} py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100`} title="Keluar Sistem">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1" /></svg>
            {isSidebarOpen && <span className="truncate">Keluar</span>}
          </button>
        </div>
      </aside>

      {/* VIEW UTAMA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-extrabold text-slate-800">{activeTab === 'form' ? 'Formulir Pengusulan Bansos' : 'Daftar Usulan Wilayah Saya'}</h2>
          {activeTab === 'history' && (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setImportExcelTrigger(true)} 
                className="bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Impor Masal Excel
              </button>
              <button 
                onClick={() => setExportExcelTrigger(true)} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Unduh Rekap Excel
              </button>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* STATS & DIAGRAMS */}
          <StatCards stats={stats} historyData={historyData} />

          {/* KONTEN UTAMA TAB */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {activeTab === 'form' && (
              <BansosForm 
                userProfile={userProfile}
                currentUserEmail={currentUserEmail}
                editId={editId}
                cancelEdit={cancelEdit}
                initData={initData}
                catatLog={catatLog}
                formData={formData}
                setFormData={setFormData}
                oldUrls={oldUrls}
                setOldUrls={setOldUrls}
                files={files}
                setFiles={setFiles}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'history' && (
              <BansosHistory 
                historyData={historyData}
                userProfile={userProfile}
                initData={initData}
                catatLog={catatLog}
                handleEdit={handleEdit}
                importExcelTrigger={importExcelTrigger}
                setImportExcelTrigger={setImportExcelTrigger}
                exportExcelTrigger={exportExcelTrigger}
                setExportExcelTrigger={setExportExcelTrigger}
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