'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

// --- 1. KOMPONEN KARTU STATISTIK ---
const StatCard = ({ title, count, icon, color }) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-300 group">
    <div>
      <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1 group-hover:text-gray-600 transition-colors">{title}</p>
      <h3 className="text-3xl font-extrabold text-gray-900 tracking-tight">{count}</h3>
    </div>
    <div className={`p-4 rounded-xl text-white shadow-lg ${color} shadow-${color.replace('bg-', '')}/30 transform group-hover:scale-110 transition-transform duration-300`}>
      {icon}
    </div>
  </div>
)

// --- 2. HELPER: BIKIN INISIAL NAMA ---
const getInitials = (name) => {
  if (!name) return '?'
  return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().substring(0, 2)
}

// --- 3. HELPER: WARNA BADGE STATUS PENGAJUAN ---
const getStatusBadge = (status) => {
  switch (status) {
    case 'Disetujui':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Disetujui
        </span>
      )
    case 'Perlu Revisi':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Perlu Revisi
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Menunggu
        </span>
      )
  }
}

// --- 4. HELPER: BADGE STATUS KEAKTIFAN PENERIMA (READ ONLY) ---
const getActiveBadge = (isActive) => {
    if (isActive) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-100">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
              Aktif
            </span>
        )
    } else {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-500 border border-slate-200">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              Non-Aktif
            </span>
        )
    }
}

export default function SuperAdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('users') // 'users' or 'data'
  
  // Data State
  const [users, setUsers] = useState([])
  const [allBansos, setAllBansos] = useState([])
  const [stats, setStats] = useState({ users: 0, totalData: 0, cities: 0 })

  // --- FITUR BARU: STATE FILTER ---
  const [filterProgram, setFilterProgram] = useState('Semua')

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'operator', kota: '' })
  const [creating, setCreating] = useState(false)

  // --- FETCH DATA ---
  const fetchData = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/'); return }
        
        // Cek apakah benar superadmin
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        
        if (!profile || profile.role !== 'superadmin') { 
            alert("Akses Ditolak: Anda bukan Super Admin atau Data Profil Error.")
            router.push('/')
            return 
        } 

        const { data: usersData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
        const { data: bansosData } = await supabase.from('pengajuan_bantuan').select('*').order('created_at', { ascending: false })
        
        setUsers(usersData || [])
        setAllBansos(bansosData || [])
        
        setStats({
        users: usersData?.length || 0,
        totalData: bansosData?.length || 0,
        cities: usersData?.filter(u => u.role === 'operator').length || 0
        })
    } catch (error) {
        console.error("Error Fetching Data:", error)
    } finally {
        setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [router])

  // --- FITUR BARU: LOGIKA FILTER ---
  // 1. Dapatkan daftar program unik secara otomatis dari data yang ada
  const uniquePrograms = ['Semua', ...new Set(allBansos.map(item => item.jenis_bantuan))]

  // 2. Filter data berdasarkan pilihan dropdown
  const filteredData = filterProgram === 'Semua' 
    ? allBansos 
    : allBansos.filter(item => item.jenis_bantuan === filterProgram)


  // --- ACTIONS UTAMA ---

  // 1. HAPUS USER
  const handleDeleteUser = async (id) => {
    if(!confirm("PERINGATAN KERAS:\nUser ini akan dihapus permanen dari Database & Authentication.\nData bansos yang terkait juga akan hilang.\n\nYakin hapus?")) return;
    
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }) 
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal menghapus user')

      setUsers(currentUsers => currentUsers.filter(user => user.id !== id))
      alert("Sukses! User dan semua datanya sudah hilang bersih.")
      
    } catch (error) {
      if (error.message?.includes("User not found") || error.message?.includes("not found")) {
        setUsers(currentUsers => currentUsers.filter(user => user.id !== id))
        alert("Data user 'hantu' berhasil dibersihkan dari layar.")
      } else {
        alert("Error: " + error.message)
        fetchData()
      }
    }
  }

  // 2. HAPUS DATA BANSOS
  const handleDeleteBansos = async (id) => {
    if(!confirm("Hapus data bansos ini secara permanen beserta fotonya?")) return;

    try {
      const { data: dataLama, error: fetchError } = await supabase
        .from('pengajuan_bantuan')
        .select('foto_ktp, foto_diri, foto_pekerjaan, foto_rumah')
        .eq('id', id)
        .single()
      
      if (fetchError) throw fetchError

      const filesToDelete = []
      const extractName = (url) => {
        if (!url) return null
        const parts = url.split('/')
        return parts[parts.length - 1]
      }

      if (dataLama.foto_ktp) filesToDelete.push(extractName(dataLama.foto_ktp))
      if (dataLama.foto_diri) filesToDelete.push(extractName(dataLama.foto_diri))
      if (dataLama.foto_pekerjaan) filesToDelete.push(extractName(dataLama.foto_pekerjaan))
      if (dataLama.foto_rumah) filesToDelete.push(extractName(dataLama.foto_rumah))

      if (filesToDelete.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('dokumen_bansos') 
          .remove(filesToDelete)
        
        if (storageError) console.error("Gagal hapus file fisik:", storageError)
      }

      const { error: deleteError } = await supabase
        .from('pengajuan_bantuan')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      setAllBansos(currentData => currentData.filter(item => item.id !== id))
      alert("Data dan semua foto buktinya berhasil dihapus.")

    } catch (error) {
      alert("Gagal hapus data: " + error.message)
    }
  }

  // 3. BUAT USER BARU
  const handleCreateUser = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })
      
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal membuat user')
      
      alert("User berhasil dibuat!")
      setIsFormOpen(false)
      setNewUser({ email: '', password: '', role: 'operator', kota: '' })
      fetchData()
    } catch (error) { 
      alert("Error: " + error.message) 
    } finally { 
      setCreating(false) 
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-10 h-10 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-gray-800 pb-20">
      
      {/* NAVBAR */}
      <nav className="bg-gray-900 sticky top-0 z-30 px-6 md:px-10 py-4 flex justify-between items-center shadow-xl shadow-gray-200/20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-black rounded-xl flex items-center justify-center text-white font-bold text-sm border border-gray-600 shadow-inner">SA</div>
          <div><h1 className="text-lg font-bold text-white leading-tight tracking-tight">Super Admin</h1><p className="text-xs text-gray-400 font-medium">Control Center</p></div>
        </div>
        <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="text-xs font-bold text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-5 py-2.5 rounded-lg transition-all">LOGOUT</button>
      </nav>

      <main className="p-6 md:p-10 max-w-7xl mx-auto space-y-10">
        
        {/* STATISTIK */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Total Pengguna" count={stats.users} color="bg-blue-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
          <StatCard title="Operator Kota" count={stats.cities} color="bg-indigo-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} />
          <StatCard title="Data Bansos" count={stats.totalData} color="bg-emerald-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
        </div>

        {/* CONTAINER UTAMA */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden min-h-[600px]">
          
          {/* Tabs Navigation (UPDATED FOR RESPONSIVE) */}
          <div className="px-4 md:px-8 pt-4 md:pt-2 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-white sticky top-0 z-10 gap-4 md:gap-0">
            <div className="flex space-x-4 md:space-x-10 w-full md:w-auto overflow-x-auto no-scrollbar">
              <button onClick={() => setActiveTab('users')} className={`whitespace-nowrap pb-4 md:py-6 text-xs md:text-sm font-bold tracking-wide transition-all border-b-[3px] ${activeTab === 'users' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>MANAJEMEN PENGGUNA</button>
              <button onClick={() => setActiveTab('data')} className={`whitespace-nowrap pb-4 md:py-6 text-xs md:text-sm font-bold tracking-wide transition-all border-b-[3px] ${activeTab === 'data' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>MONITORING DATA (ALL)</button>
            </div>
            {activeTab === 'users' && (
              <div className="w-full md:w-auto pb-4 md:pb-0">
                <button onClick={() => setIsFormOpen(true)} className="w-full md:w-auto bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-gray-900/20 flex items-center justify-center gap-2 transition-all transform hover:scale-105">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                  TAMBAH USER
                </button>
              </div>
            )}
          </div>

          <div className="p-0">
            
            {/* --- TAB 1: MANAJEMEN PENGGUNA --- */}
            {activeTab === 'users' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-bold tracking-widest border-b border-gray-100">
                    <tr>
                      <th className="px-8 py-5">User ID / Email</th>
                      <th className="px-8 py-5">Role</th>
                      <th className="px-8 py-5">Wilayah</th>
                      <th className="px-8 py-5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="px-8 py-5">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs border border-gray-200">
                                {u.email ? u.email.substring(0,2).toUpperCase() : 'ID'}
                              </div>
                              <div className="text-sm font-bold text-gray-900">{u.email || 'No Email'} <br/><span className="text-xs text-gray-400 font-mono font-normal">{u.id}</span></div>
                           </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border ${u.role === 'superadmin' ? 'bg-gray-900 text-white border-gray-900' : u.role === 'bidang' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                            {u.role || 'Operator'}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-sm font-medium text-gray-600">{u.kabupaten_kota || '-'}</td>
                        <td className="px-8 py-5 text-right">
                          {u.role !== 'superadmin' && (
                            <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:text-red-700 font-bold text-xs border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors" title="Hapus User & Data">
                               HAPUS USER
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* --- TAB 2: MONITORING SEMUA DATA --- */}
            {activeTab === 'data' && (
              <div>
                
                {/* --- FITUR BARU: DROPDOWN FILTER --- */}
                <div className="px-8 py-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Filter Program:</span>
                  <div className="relative">
                    <select 
                      value={filterProgram} 
                      onChange={(e) => setFilterProgram(e.target.value)}
                      className="appearance-none bg-white border border-gray-300 hover:border-gray-400 px-4 py-2 pr-8 rounded-lg text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer shadow-sm"
                    >
                      {uniquePrograms.map((prog, idx) => (
                        <option key={idx} value={prog}>{prog === 'Semua' ? 'Semua Program' : prog}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-2.5 pointer-events-none text-gray-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-bold tracking-widest border-b border-gray-100">
                      <tr>
                        <th className="px-8 py-5 w-1/4">Identitas</th>
                        <th className="px-8 py-5">Bantuan</th>
                        <th className="px-8 py-5">Status Pengajuan</th>
                        <th className="px-8 py-5">Keaktifan</th>
                        <th className="px-8 py-5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredData.length > 0 ? (
                        filteredData.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                            <td className="px-8 py-5 align-middle">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-indigo-200">
                                  {getInitials(item.nama_lengkap)}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-gray-900 leading-none">{item.nama_lengkap}</div>
                                  <div className="text-xs text-gray-400 font-mono mt-1.5">{item.nik}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-5 align-middle">
                              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                {item.jenis_bantuan}
                              </span>
                              <div className="mt-1 text-xs text-gray-400">{item.alamat?.substring(0, 20)}...</div>
                            </td>
                            <td className="px-8 py-5 align-middle">
                              {getStatusBadge(item.status)}
                            </td>
                            <td className="px-8 py-5 align-middle">
                              {getActiveBadge(item.is_active)} 
                            </td>
                            <td className="px-8 py-5 text-right align-middle">
                              <button 
                                onClick={() => handleDeleteBansos(item.id)} 
                                className="text-red-500 hover:text-red-700 text-xs font-bold"
                              >
                                Hapus Data
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                            <td colSpan="5" className="px-8 py-10 text-center text-gray-400 text-sm italic">
                                Tidak ada data untuk filter ini.
                            </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* --- MODAL TAMBAH USER --- */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up border border-gray-100">
            <div className="bg-gray-50 px-8 py-6 flex justify-between items-center border-b border-gray-100">
              <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">Tambah User Baru</h3>
              <button onClick={() => setIsFormOpen(false)} className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 shadow-sm border border-gray-100 transition-colors">✕</button>
            </div>
            <form onSubmit={handleCreateUser} className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                   <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Email Login</label>
                   <input required type="email" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 focus:bg-white focus:border-transparent transition-all outline-none" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="user@dinsos.jatim.go.id" />
                </div>
                <div className="col-span-2">
                   <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Password</label>
                   <input required type="password" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 focus:bg-white focus:border-transparent transition-all outline-none" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="Minimal 6 karakter" />
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Role Access</label>
                   <div className="relative">
                      <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-gray-900 outline-none appearance-none" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                        <option value="operator">Operator Kota</option>
                        <option value="bidang">Bidang Provinsi</option>
                        <option value="superadmin">Super Admin</option>
                      </select>
                      <div className="absolute right-4 top-3.5 pointer-events-none text-gray-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
                   </div>
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Wilayah Kota</label>
                   <input type="text" disabled={newUser.role !== 'operator'} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-gray-900 outline-none" value={newUser.kota} onChange={e => setNewUser({...newUser, kota: e.target.value})} placeholder={newUser.role !== 'operator' ? '-' : 'Contoh: Surabaya'} />
                </div>
              </div>
              <div className="pt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-900 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Batal</button>
                <button disabled={creating} type="submit" className="px-6 py-3 text-sm font-bold text-white bg-gray-900 rounded-xl hover:bg-black shadow-lg hover:shadow-xl transition-all disabled:opacity-70">{creating ? 'Memproses...' : 'Buat User Baru'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}