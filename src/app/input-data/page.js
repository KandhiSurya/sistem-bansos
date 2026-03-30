'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts'

// --- KOMPONEN KARTU STATISTIK ---
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

const getInitials = (name) => {
  if (!name) return '?'
  return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().substring(0, 2)
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
  const [editId, setEditId] = useState(null) 
  const [oldUrls, setOldUrls] = useState({ ktp: '', diri: '', kerja: '', rumah: '' })
  
  // State Data & Stats
  const [historyData, setHistoryData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })

  useEffect(() => {
    const initData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setUserProfile(profile)

      if (profile?.role !== 'operator') { router.push('/'); return }

      const { data: history, error } = await supabase
        .from('pengajuan_bantuan')
        .select('*')
        .eq('user_id', user.id) 
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

    const channel = supabase.channel('operator-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pengajuan_bantuan' }, () => initData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router])

  // Pencarian Data
  useEffect(() => {
    if (searchTerm) {
      setFilteredData(historyData.filter(d => 
        d.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) || d.nik.includes(searchTerm)
      ))
    } else {
      setFilteredData(historyData)
    }
  }, [historyData, searchTerm])

  // --- DATA UNTUK GRAFIK ---
  const pieData = [
    { name: 'Menunggu', value: stats.pending },
    { name: 'Disetujui', value: stats.approved },
    { name: 'Ditolak', value: stats.rejected }
  ]
  const PIE_COLORS = ['#f59e0b', '#10b981', '#f43f5e'] 

  const barData = useMemo(() => {
    const counts = { PKH: 0, KIP: 0, FAKMIS: 0 }
    historyData.forEach(item => { if(counts[item.jenis_bantuan] !== undefined) counts[item.jenis_bantuan]++ })
    return Object.keys(counts).map(key => ({ name: key, Total: counts[key] }))
  }, [historyData])

  // --- FUNGSI FORM & UPLOAD ---
  const handleFileChange = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.size > 2 * 1024 * 1024) { alert("Maksimal 2MB."); e.target.value = null; return }
      setFiles({ ...files, [type]: file })
    }
  }

  const uploadImage = async (file, path) => {
    if (!file) return null
    const fileName = `${path}-${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('dokumen_bansos').upload(fileName, file)
    if (error) throw error
    const { data } = supabase.storage.from('dokumen_bansos').getPublicUrl(fileName)
    return data.publicUrl
  }

  const handleEdit = (item) => {
    setFormData({ nik: item.nik, nama: item.nama_lengkap, alamat: item.alamat, bantuan: item.jenis_bantuan })
    setOldUrls({ ktp: item.foto_ktp, diri: item.foto_diri, kerja: item.foto_pekerjaan, rumah: item.foto_rumah })
    setEditId(item.id) 
    setActiveTab('form')
    if(selectedItem) setSelectedItem(null)
    alert(`MODE REVISI AKTIF\nCatatan Bidang: ${item.alasan_penolakan}`)
  }

  const cancelEdit = () => {
    setEditId(null)
    setFormData({ nik: '', nama: '', alamat: '', bantuan: 'PKH' })
    setFiles({ ktp: null, diri: null, kerja: null, rumah: null })
    setOldUrls({ ktp: '', diri: '', kerja: '', rumah: '' })
    document.getElementById('form-input').reset()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!editId && (!files.ktp || !files.diri || !files.kerja || !files.rumah)) { 
      alert("Mohon lengkapi semua dokumen foto!"); return 
    }
    if (!userProfile?.id || !userProfile?.kabupaten_kota) {
      alert("Error: Identitas Akun tidak lengkap."); return
    }

    const { data: cekNik } = await supabase.from('pengajuan_bantuan').select('id, nama_lengkap').eq('nik', formData.nik).maybeSingle() 
    if (cekNik) {
      if (!editId) { alert(`Gagal: NIK ${formData.nik} sudah terdaftar atas nama ${cekNik.nama_lengkap}.`); return }
      if (editId && cekNik.id !== editId) { alert(`Gagal: NIK ${formData.nik} sudah dipakai data lain.`); return }
    }

    setUploading(true)
    try {
      const urlKtp = files.ktp ? await uploadImage(files.ktp, 'ktp') : oldUrls.ktp
      const urlDiri = files.diri ? await uploadImage(files.diri, 'diri') : oldUrls.diri
      const urlKerja = files.kerja ? await uploadImage(files.kerja, 'kerja') : oldUrls.kerja
      const urlRumah = files.rumah ? await uploadImage(files.rumah, 'rumah') : oldUrls.rumah

      const payload = {
        nik: formData.nik, nama_lengkap: formData.nama, alamat: formData.alamat, jenis_bantuan: formData.bantuan,
        foto_ktp: urlKtp, foto_diri: urlDiri, foto_pekerjaan: urlKerja, foto_rumah: urlRumah, 
        status: 'Menunggu Validasi', alasan_penolakan: null 
      }

      if (editId) {
        const { error } = await supabase.from('pengajuan_bantuan').update(payload).eq('id', editId)
        if (error) throw error
        alert("Data berhasil direvisi!")
      } else {
        payload.user_id = userProfile.id; payload.kabupaten_kota = userProfile.kabupaten_kota
        const { error } = await supabase.from('pengajuan_bantuan').insert([payload])
        if (error) throw error
        alert("Data baru berhasil dikirim!")
      }

      try {
        await fetch('/api/operator/notify-bidang', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nama_pemohon: formData.nama, jenis_bantuan: formData.bantuan, kota_operator: userProfile.kabupaten_kota })
        })
      } catch (e) { console.error(e) }
      
      cancelEdit(); setActiveTab('history')
    } catch (error) { alert("Gagal memproses data: " + error.message) 
    } finally { setUploading(false) }
  }

  // --- FUNGSI CETAK LAPORAN ---
  const handlePrint = (item) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    printWindow.document.write(`
      <html>
        <head>
          <title>Bukti Pengajuan - ${item.nama_lengkap}</title>
          <style>
            @media print { @page { size: A4; margin: 2cm; } body { -webkit-print-color-adjust: exact; } }
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: auto; }
            h1 { font-size: 22px; margin-bottom: 5px; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 15px; }
            .meta { font-size: 12px; color: #555; margin-bottom: 30px; font-family: monospace; }
            .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
            .field { margin-bottom: 12px; } .label { font-size: 10px; font-weight: bold; color: #666; text-transform: uppercase; }
            .value { font-size: 14px; font-weight: bold; border-bottom: 1px dashed #eee; padding-bottom: 3px; }
            .status-box { display: inline-block; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; background: #f3f4f6; border: 1px solid #d1d5db; }
            .images-section h3 { font-size: 14px; background: #f3f4f6; padding: 8px 12px; border-left: 4px solid #4f46e5; margin-bottom: 15px; }
            .images-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            .img-card { border: 1px solid #ddd; padding: 5px; page-break-inside: avoid; }
            .img-card p { font-size: 10px; text-align: center; font-weight: bold; background: #eee; padding: 3px; margin: 0 0 5px 0; }
            img { width: 100%; height: 200px; object-fit: cover; display: block; }
          </style>
        </head>
        <body>
          <h1>Bukti Registrasi Pengajuan Bansos</h1><p class="meta">ID: ${item.id} | TANGGAL: ${new Date().toLocaleDateString('id-ID')}</p>
          <div class="grid-info">
            <div class="col">
              <div class="field"><div class="label">Nama Lengkap</div><div class="value">${item.nama_lengkap}</div></div>
              <div class="field"><div class="label">NIK</div><div class="value">${item.nik}</div></div>
              <div class="field"><div class="label">Alamat</div><div class="value">${item.alamat}</div></div>
            </div>
            <div class="col">
              <div class="field"><div class="label">Jenis Bantuan</div><div class="value" style="color: #4f46e5;">${item.jenis_bantuan}</div></div>
              <div class="field"><div class="label">Kota/Kabupaten</div><div class="value">${item.kabupaten_kota || '-'}</div></div>
              <div class="field"><div class="label">Status Saat Ini</div><div class="value" style="border:none; padding:0;"><span class="status-box">${item.status}</span></div></div>
            </div>
          </div>
          <div class="images-section">
             <h3>LAMPIRAN DOKUMEN</h3>
             <div class="images-grid">
                <div class="img-card"><p>KTP</p><img src="${item.foto_ktp || ''}" onerror="this.style.display='none'" /></div>
                <div class="img-card"><p>DIRI</p><img src="${item.foto_diri || ''}" onerror="this.style.display='none'" /></div>
                <div class="img-card"><p>RUMAH</p><img src="${item.foto_rumah || ''}" onerror="this.style.display='none'" /></div>
                <div class="img-card"><p>PEKERJAAN</p><img src="${item.foto_pekerjaan || ''}" onerror="this.style.display='none'" /></div>
             </div>
          </div>
          <script>window.onload = function() { setTimeout(function() { window.print(); }, 1500); }</script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-10 h-10 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-gray-800 pb-20">
      
      {/* NAVBAR */}
      <nav className="bg-gray-900 sticky top-0 z-30 px-6 md:px-10 py-4 flex justify-between items-center shadow-xl shadow-gray-200/20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-sm border border-gray-600 shadow-inner">OP</div>
          <div><h1 className="text-lg font-bold text-white leading-tight tracking-tight">Operator {userProfile?.kabupaten_kota || 'Kota'}</h1><p className="text-xs text-gray-400 font-medium">Panel Pengajuan</p></div>
        </div>
        <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="text-xs font-bold text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-5 py-2.5 rounded-lg transition-all">LOGOUT</button>
      </nav>

      <main className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        
        {/* STATISTIK */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard title="Total Input" count={stats.total} color="bg-indigo-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>} />
          <StatCard title="Menunggu Validasi" count={stats.pending} color="bg-amber-500" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
          <StatCard title="Telah Disetujui" count={stats.approved} color="bg-emerald-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
          <StatCard title="Perlu Revisi" count={stats.rejected} color="bg-rose-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
        </div>

        {/* GRAFIK ANALISIS (SEKARANG DI LUAR TAB) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col items-center">
              <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4 border-b border-gray-100 pb-2 w-full text-center">Status Pengajuan Anda</h3>
              <div className="w-full h-48">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                          {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} /> )}
                       </Pie>
                       <RechartsTooltip formatter={(value) => [`${value} Data`, 'Total']} />
                       <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                 </ResponsiveContainer>
              </div>
           </div>
           <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Distribusi Program di Wilayah Anda</h3>
              <div className="w-full h-48">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                       <XAxis dataKey="name" tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                       <YAxis tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                       <RechartsTooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                       <Bar dataKey="Total" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </div>

        {/* TABS CONTAINER */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden mt-8">
          <div className="px-8 border-b border-gray-100 flex space-x-10 bg-gray-50/50">
            <button onClick={() => { setActiveTab('form'); if(editId) cancelEdit(); }} className={`py-6 text-sm font-bold tracking-wide transition-all border-b-[3px] ${activeTab === 'form' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>INPUT DATA BARU</button>
            <button onClick={() => setActiveTab('history')} className={`py-6 text-sm font-bold tracking-wide transition-all border-b-[3px] ${activeTab === 'history' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>RIWAYAT PENGAJUAN</button>
          </div>

          <div className="p-6 md:p-10">
            
            {/* --- TAB: FORM INPUT --- */}
            {activeTab === 'form' && (
              <form id="form-input" onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
                {editId && (
                  <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-start gap-4 shadow-sm">
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                    <div><h3 className="text-sm font-bold text-amber-900">Mode Revisi Data Aktif</h3><p className="text-xs text-amber-700 mt-1">Silakan perbaiki isian form di bawah ini. Kosongkan input file jika foto lama tidak perlu diganti.</p></div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-1"><h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Data Diri</h3><p className="text-xs text-gray-500 mt-1">Informasi dasar sesuai KTP.</p></div>
                  <div className="md:col-span-2 space-y-5 bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-inner">
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">NIK (16 Digit)</label>
                        <input required type="text" maxLength="16" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-600 text-sm transition font-medium outline-none" value={formData.nik} onChange={e => setFormData({...formData, nik: e.target.value.replace(/\D/g, '')})} placeholder="0000..." />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nama Lengkap</label>
                        <input required type="text" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-600 text-sm transition font-medium outline-none" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} placeholder="Sesuai KTP" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Alamat Domisili</label>
                      <textarea required rows="2" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-600 text-sm transition font-medium outline-none" value={formData.alamat} onChange={e => setFormData({...formData, alamat: e.target.value})} placeholder="Jalan, RT/RW, Kelurahan..."></textarea>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Jenis Bantuan</label>
                      <select className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-600 text-sm bg-white font-medium outline-none" value={formData.bantuan} onChange={e => setFormData({...formData, bantuan: e.target.value})}>
                        <option value="PKH">PKH (Program Keluarga Harapan)</option>
                        <option value="KIP">KIP (Kewirausahaan Inklusif Produktif)</option>
                        <option value="FAKMIS">FAKMIS (Fakir Miskin)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <hr className="border-gray-100" />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-1"><h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Dokumen Bukti</h3><p className="text-xs text-gray-500 mt-1">Unggah foto kondisi terbaru (Max 2MB/foto).</p></div>
                  <div className="md:col-span-2 bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-inner">
                    <div className="grid grid-cols-2 gap-4">
                      {['ktp', 'diri', 'kerja', 'rumah'].map((type) => (
                        <div key={type} className="bg-white p-4 rounded-xl border border-gray-200">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">{type === 'ktp' ? 'Foto E-KTP' : type === 'diri' ? 'Foto Diri' : type === 'kerja' ? 'Foto Pekerjaan' : 'Foto Rumah'}</label>
                          <input required={!editId} type="file" accept="image/png, image/jpeg, image/jpg" onChange={(e) => handleFileChange(e, type)} className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 transition cursor-pointer"/>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  {editId && <button type="button" onClick={cancelEdit} className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-800 transition">Batal Revisi</button>}
                  <button disabled={uploading} type="submit" className={`px-8 py-3 rounded-xl text-white font-bold text-sm transition shadow-lg ${editId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'} disabled:opacity-50 flex items-center gap-2`}>
                    {uploading ? 'Memproses...' : editId ? 'Kirim Revisi Data' : 'Kirim Pengajuan'}
                  </button>
                </div>
              </form>
            )}

            {/* --- TAB: RIWAYAT SAJA (KARENA GRAFIK UDAH DIPINDAH) --- */}
            {activeTab === 'history' && (
              <div className="animate-fade-in-up space-y-8">
                
                {/* Header Tabel & Search */}
                <div className="flex flex-col md:flex-row justify-between gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                   <h3 className="text-sm font-bold text-gray-900 flex items-center">Data Pengajuan Terbaru</h3>
                   <div className="relative">
                     <input type="text" placeholder="Cari NIK / Nama..." className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none w-full md:w-64 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                     <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                   </div>
                </div>

                {/* Tabel Data Operator */}
                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50/80 text-gray-400 uppercase text-[10px] font-bold tracking-widest border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-4">Identitas</th>
                        <th className="px-6 py-4">Program</th>
                        <th className="px-6 py-4">Status & Catatan</th>
                        <th className="px-6 py-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                      {filteredData.length > 0 ? filteredData.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition group">
                          <td className="px-6 py-4 align-middle">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-100">{getInitials(item.nama_lengkap)}</div>
                               <div>
                                  <div className="text-sm font-bold text-gray-900">{item.nama_lengkap}</div>
                                  <div className="text-xs text-gray-400 font-mono mt-1">{item.nik}</div>
                               </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200 uppercase">{item.jenis_bantuan}</span>
                          </td>
                          <td className="px-6 py-4 align-middle">
                            {item.status === 'Menunggu Validasi' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Menunggu</span>
                            ) : item.status === 'Disetujui' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Disetujui</span>
                            ) : (
                                <div>
                                   <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Perlu Revisi</span>
                                   {item.alasan_penolakan && <p className="text-[10px] text-rose-600 mt-2 font-medium italic">"{item.alasan_penolakan}"</p>}
                                </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right align-middle">
                             <div className="flex justify-end gap-2">
                                {item.status === 'Perlu Revisi' && (
                                   <button onClick={() => handleEdit(item)} className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white text-xs font-bold transition-colors">Revisi Data</button>
                                )}
                                <button onClick={() => setSelectedItem(item)} className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-900 hover:text-white transition-colors">Detail</button>
                             </div>
                          </td>
                        </tr>
                      )) : <tr><td colSpan="4" className="px-6 py-10 text-center text-gray-400 text-sm">Belum ada data pengajuan.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* --- MODAL DETAIL --- */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm">
           <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-fade-in-up border border-gray-100 shadow-2xl">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-5 flex justify-between items-center z-10">
                 <div>
                    <h3 className="text-xl font-extrabold text-gray-900">Detail Pengajuan Saya</h3>
                    <p className="text-xs text-gray-500 font-mono mt-1">ID: {selectedItem.id}</p>
                 </div>
                 <div className="flex gap-3">
                    <button onClick={() => handlePrint(selectedItem)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-2 transition">🖨️ Cetak Bukti</button>
                    <button onClick={() => setSelectedItem(null)} className="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-200 transition">✕</button>
                 </div>
              </div>
              <div className="p-8 space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nama Lengkap</p><p className="text-lg font-bold text-gray-900">{selectedItem.nama_lengkap}</p></div>
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">NIK</p><p className="text-lg font-mono font-medium text-gray-900">{selectedItem.nik}</p></div>
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Jenis Bantuan</p><p className="text-sm font-bold text-gray-900 bg-white inline-block px-3 py-1 rounded border border-gray-200 mt-1">{selectedItem.jenis_bantuan}</p></div>
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status Saat Ini</p>
                        <p className={`text-sm font-bold mt-1 inline-flex items-center gap-2 ${selectedItem.status === 'Disetujui' ? 'text-emerald-600' : selectedItem.status === 'Perlu Revisi' ? 'text-rose-600' : 'text-amber-600'}`}>
                            {selectedItem.status}
                        </p>
                    </div>
                    <div className="col-span-2"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Alamat</p><p className="text-sm font-medium text-gray-700 mt-1 leading-relaxed">{selectedItem.alamat}</p></div>
                 </div>

                 <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-4 border-l-4 border-indigo-500 pl-3">Bukti Lampiran (Klik untuk perbesar)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       {[{title: 'KTP', src: selectedItem.foto_ktp}, {title: 'Diri', src: selectedItem.foto_diri}, {title: 'Rumah', src: selectedItem.foto_rumah}, {title: 'Pekerjaan', src: selectedItem.foto_pekerjaan}].map((foto, idx) => (
                          <div key={idx} onClick={() => foto.src && window.open(foto.src, '_blank')} className="group relative aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:shadow-lg transition-all">
                             {foto.src ? <img src={foto.src} alt={foto.title} className="w-full h-full object-cover transition duration-500 group-hover:scale-110" /> : <div className="flex items-center justify-center h-full text-xs text-gray-400">No Image</div>}
                             <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3"><span className="text-white text-xs font-bold">🔍 Buka {foto.title}</span></div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
              
              {selectedItem.status === 'Perlu Revisi' && (
                 <div className="sticky bottom-0 bg-white border-t border-gray-100 px-8 py-5 flex justify-end z-10">
                    <button onClick={() => handleEdit(selectedItem)} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition">Revisi Data Sekarang</button>
                 </div>
              )}
           </div>
        </div>
      )}

    </div>
  )
}