'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

// --- KOMPONEN KARTU STATISTIK ---
const StatCard = ({ title, count, accentColor, icon, subtext }) => {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-start justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-gray-900">{count}</h3>
        <p className="text-gray-400 text-xs mt-2">{subtext}</p>
      </div>
      <div className={`p-3 rounded-lg ${colors[accentColor]}`}>
        {icon}
      </div>
    </div>
  )
}

export default function InputDataPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState(null)
  const [activeTab, setActiveTab] = useState('form')
  
  // State Form
  const [formData, setFormData] = useState({ nik: '', nama: '', alamat: '', bantuan: 'PKH' })
  const [files, setFiles] = useState({ ktp: null, diri: null, kerja: null, rumah: null })
  const [uploading, setUploading] = useState(false)
  
  // State Data & Stats
  const [historyData, setHistoryData] = useState([])
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })

  // --- 1. FETCH DATA (INIT) ---
  useEffect(() => {
    const initData = async () => {
      // Cek User Login
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      
      // Ambil Profil Operator
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setUserProfile(profile)

      // Cek Role
      if (profile?.role !== 'operator') { router.push('/'); return }

      // Ambil Data Riwayat
      const { data: history, error } = await supabase
        .from('pengajuan_bantuan')
        .select('*')
        .order('created_at', { ascending: false })
      
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
    }

    initData()

    // Realtime Listener
    const channel = supabase.channel('operator-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pengajuan_bantuan' }, () => initData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router])

  // --- 2. HANDLE FILE UPLOAD (VALIDASI) ---
  const handleFileChange = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      // Validasi Ukuran Max 2MB
      if (file.size > 2 * 1024 * 1024) {
        alert("Ukuran file terlalu besar! Maksimal 2MB.")
        e.target.value = null
        return
      }
      setFiles({ ...files, [type]: file })
    }
  }

  // Helper Upload ke Storage
  const uploadImage = async (file, path) => {
    if (!file) return null
    const fileExt = file.name.split('.').pop()
    const fileName = `${path}-${Date.now()}.${fileExt}`
    const { error } = await supabase.storage.from('dokumen_bansos').upload(fileName, file)
    if (error) throw error
    const { data } = supabase.storage.from('dokumen_bansos').getPublicUrl(fileName)
    return data.publicUrl
  }

  // --- 3. SUBMIT DATA ---
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validasi Kelengkapan File
    if (!files.ktp || !files.diri || !files.kerja || !files.rumah) { 
      alert("Mohon lengkapi semua dokumen foto!"); 
      return 
    }

    // Validasi Identitas Akun
    if (!userProfile?.id || !userProfile?.kabupaten_kota) {
      alert("Error: Identitas Akun tidak lengkap. Coba logout dan login ulang.")
      return
    }

    setUploading(true)
    try {
      // 1. Upload Foto dulu
      const urlKtp = await uploadImage(files.ktp, 'ktp')
      const urlDiri = await uploadImage(files.diri, 'diri')
      const urlKerja = await uploadImage(files.kerja, 'kerja')
      const urlRumah = await uploadImage(files.rumah, 'rumah')

      // 2. Simpan Data ke Database
      const { error } = await supabase.from('pengajuan_bantuan').insert([{
        user_id: userProfile.id,
        nik: formData.nik, 
        nama_lengkap: formData.nama, 
        alamat: formData.alamat, 
        jenis_bantuan: formData.bantuan,
        foto_ktp: urlKtp, 
        foto_diri: urlDiri, 
        foto_pekerjaan: urlKerja, 
        foto_rumah: urlRumah, 
        status: 'Menunggu Validasi',
        kabupaten_kota: userProfile.kabupaten_kota
      }])

      if (error) throw error

      // -----------------------------------------------------------------
      // PEMANGGILAN API NOTIFIKASI EMAIL KE BIDANG (UPDATE LANGKAH 4)
      try {
        console.log("Mencoba memanggil API pengiriman email...")
        const response = await fetch('/api/operator/notify-bidang', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nama_pemohon: formData.nama, 
            jenis_bantuan: formData.bantuan, 
            kota_operator: userProfile.kabupaten_kota
          })
        });
        
        const result = await response.json();
        console.log("Respon dari server email:", result);
      } catch (emailErr) {
        console.error("Gagal memanggil API:", emailErr);
      }
      // -----------------------------------------------------------------

      alert("Data berhasil dikirim ke Provinsi dan Notifikasi telah diteruskan ke Bidang!")
      
      // Reset Form
      setFormData({ nik: '', nama: '', alamat: '', bantuan: 'PKH' })
      setFiles({ ktp: null, diri: null, kerja: null, rumah: null })
      document.getElementById('form-input').reset()
      setActiveTab('history')

    } catch (error) { 
      console.error("Gagal Upload:", error)
      alert("Gagal mengirim data: " + error.message) 
    } finally { 
      setUploading(false) 
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500 animate-pulse font-medium">Memuat Halaman Input Data...</p></div>

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      
      {/* NAVBAR */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30 px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-indigo-200 shadow-md">OP</div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Operator {userProfile?.kabupaten_kota || 'Kota'}</h1>
            <p className="text-xs text-gray-400">Panel Input Data</p>
          </div>
        </div>
        <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="text-xs font-bold text-gray-500 hover:text-red-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-red-50 transition">LOGOUT</button>
      </nav>

      <main className="p-8 max-w-7xl mx-auto space-y-8">
        
        {/* STATISTIK */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard title="Total Input" count={stats.total} accentColor="indigo" subtext="Data terkirim" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>} />
          <StatCard title="Menunggu" count={stats.pending} accentColor="amber" subtext="Proses validasi" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
          <StatCard title="Disetujui" count={stats.approved} accentColor="emerald" subtext="Validasi sukses" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
          <StatCard title="Ditolak" count={stats.rejected} accentColor="rose" subtext="Perlu revisi" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
        </div>

        {/* CONTENT TABS */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="border-b border-gray-200 px-6 flex space-x-8 bg-gray-50/50">
            <button onClick={() => setActiveTab('form')} className={`py-4 text-sm font-bold transition-all border-b-[3px] ${activeTab === 'form' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>INPUT DATA BARU</button>
            <button onClick={() => setActiveTab('history')} className={`py-4 text-sm font-bold transition-all border-b-[3px] ${activeTab === 'history' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>RIWAYAT PENGAJUAN</button>
          </div>

          <div className="p-6 md:p-8">
            
            {/* TAB FORM */}
            {activeTab === 'form' && (
              <form id="form-input" onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
                {/* Section Data Diri */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-1">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Data Diri</h3>
                    <p className="text-xs text-gray-500 mt-1">Informasi dasar calon penerima bantuan sesuai KTP.</p>
                  </div>
                  <div className="md:col-span-2 space-y-5 bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">NIK (16 Digit)</label>
                        <input required type="text" maxLength="16" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm transition font-medium" value={formData.nik} 
                        onChange={e => {
                           const val = e.target.value.replace(/\D/g, '') // Validasi Angka Only
                           setFormData({...formData, nik: val})
                        }} 
                        placeholder="0000..." />
                        {formData.nik.length > 0 && formData.nik.length < 16 && <p className="text-[10px] text-red-500 mt-1">* Harus 16 digit</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Lengkap</label>
                        <input required type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm transition font-medium" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} placeholder="Sesuai KTP" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alamat Domisili</label>
                      <textarea required rows="2" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm transition font-medium" value={formData.alamat} onChange={e => setFormData({...formData, alamat: e.target.value})} placeholder="Jalan, RT/RW, Kelurahan..."></textarea>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Jenis Bantuan</label>
                      <div className="relative">
                        <select className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm bg-white font-medium appearance-none" value={formData.bantuan} onChange={e => setFormData({...formData, bantuan: e.target.value})}>
                          <option value="PKH">PKH (Program Keluarga Harapan)</option>
                          <option value="KIP">KIP (Kewirausahaan Inklusif Produktif)</option>
                          <option value="FAKMIS">FAKMIS (Fakir Miskin)</option>
                        </select>
                        <div className="absolute right-3 top-3 pointer-events-none text-gray-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-gray-200" />

                {/* Section Upload Foto */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-1">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Dokumen Bukti</h3>
                    <p className="text-xs text-gray-500 mt-1">Unggah foto kondisi terbaru (Max 2MB/foto).</p>
                  </div>
                  <div className="md:col-span-2 bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <div className="grid grid-cols-2 gap-4">
                      {['ktp', 'diri', 'kerja', 'rumah'].map((type) => (
                        <div key={type}>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">{type === 'ktp' ? 'Foto E-KTP' : type === 'diri' ? 'Foto Diri' : type === 'kerja' ? 'Foto Pekerjaan' : 'Foto Rumah'}</label>
                          <input required type="file" accept="image/png, image/jpeg, image/jpg" onChange={(e) => handleFileChange(e, type)} className="block w-full text-xs text-gray-500 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-white file:text-indigo-600 file:border-gray-200 file:border hover:file:bg-indigo-50 transition cursor-pointer"/>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button disabled={uploading} type="submit" className="px-8 py-3 rounded-xl bg-gray-900 text-white font-bold text-sm hover:bg-black transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {uploading ? (
                      <><svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Mengirim Data...</>
                    ) : (
                      'Kirim Pengajuan'
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* TAB HISTORY */}
            {activeTab === 'history' && (
              <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full">
                  <thead className="bg-white border-b-2 border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tanggal</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Identitas</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {historyData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition group">
                        <td className="px-6 py-4 text-xs text-gray-500 font-mono">{new Date(item.created_at).toLocaleDateString('id-ID')}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900 text-sm group-hover:text-indigo-600 transition">{item.nama_lengkap}</div>
                          <div className="text-xs text-gray-400 bg-gray-100 inline-block px-1 rounded mt-0.5">{item.nik}</div>
                          <div className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">{item.jenis_bantuan}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold capitalize ${item.status === 'Menunggu Validasi' ? 'bg-amber-50 text-amber-700 border border-amber-100' : item.status === 'Disetujui' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500 italic max-w-xs truncate">
                          {item.alasan_penolakan ? <span className="text-rose-600 font-medium">{item.alasan_penolakan}</span> : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {historyData.length === 0 && (
                  <div className="py-20 text-center text-gray-400 text-sm flex flex-col items-center">
                    <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    Belum ada data pengajuan.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
} 