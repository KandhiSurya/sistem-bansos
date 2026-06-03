'use client'
import toast from 'react-hot-toast'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts'
import { read, utils } from 'xlsx'

const DINSOS_NAVY = '#1e3a8a'; 
const DINSOS_RED = '#dc2626';  

const StatCard = ({ title, count, icon, colorClass }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between transition-all hover:border-slate-300 group">
    <div><p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">{title}</p><h3 className="text-2xl font-black text-slate-800">{count}</h3></div>
    <div className={`p-3 rounded-lg text-white ${colorClass} transition-transform duration-300 group-hover:scale-110`}>{icon}</div>
  </div>
)

const getInitials = (name) => {
  if (!name) return '?'
  return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().substring(0, 2)
}

export default function InputDataPage() {
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState(null)
  const [currentUserEmail, setCurrentUserEmail] = useState('') 
  const [activeTab, setActiveTab] = useState('form')
  
  const [formData, setFormData] = useState({ nik: '', no_kk: '', nama: '', alamat: '', pekerjaan: '', pendapatan: '< Rp 500.000', tanggungan: '' })
  const [files, setFiles] = useState({ ktp: null, diri: null, kerja: null, rumah: null })
  const [uploading, setUploading] = useState(false)
  const [editId, setEditId] = useState(null) 
  const [oldUrls, setOldUrls] = useState({ ktp: '', diri: '', kerja: '', rumah: '' })
  
  const [historyData, setHistoryData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [isImporting, setIsImporting] = useState(false)

  const initData = async () => {
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
        total: history.length, pending: history.filter(d => d.status === 'Menunggu Validasi').length,
        approved: history.filter(d => d.status === 'Disetujui').length, rejected: history.filter(d => d.status === 'Perlu Revisi').length
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    initData()
    const channel = supabase.channel('operator-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'pengajuan_bantuan' }, () => {
         initData(); toast('Status pengajuan diperbarui!', { icon: '🔔' })
    }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [router])

  useEffect(() => {
    if (searchTerm) {
      setFilteredData(historyData.filter(d => d.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) || d.nik.includes(searchTerm)))
    } else { setFilteredData(historyData) }
  }, [historyData, searchTerm])

  const catatLog = async (aksi, keterangan) => {
     try { await supabase.from('log_aktivitas').insert([{ email_pengguna: currentUserEmail, role: 'Operator', aksi: aksi, keterangan: keterangan }])
     } catch (error) {}
  }

  const pieData = [{ name: 'Menunggu', value: stats.pending }, { name: 'Disetujui', value: stats.approved }, { name: 'Ditolak', value: stats.rejected }]
  const PIE_COLORS = ['#f59e0b', '#10b981', DINSOS_RED] 

  const barData = useMemo(() => {
    const counts = { PKH: 0, KIP: 0, FAKMIS: 0, 'Belum Ditentukan': 0 }
    historyData.forEach(item => { if(counts[item.jenis_bantuan] !== undefined) counts[item.jenis_bantuan]++ })
    return Object.keys(counts).map(key => ({ name: key, Total: counts[key] }))
  }, [historyData])

  const handleFileChange = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.size > 2 * 1024 * 1024) { toast.error("Maksimal ukuran file 2MB."); e.target.value = null; return }
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
    setFormData({ nik: item.nik, no_kk: item.no_kk || '', nama: item.nama_lengkap, alamat: item.alamat, pekerjaan: item.pekerjaan || '', pendapatan: item.pendapatan || '< Rp 500.000', tanggungan: item.tanggungan || '' })
    setOldUrls({ ktp: item.foto_ktp, diri: item.foto_diri, kerja: item.foto_pekerjaan, rumah: item.foto_rumah })
    setEditId(item.id); setActiveTab('form')
    if(selectedItem) setSelectedItem(null)
    toast(`MODE REVISI AKTIF\nCatatan: ${item.alasan_penolakan}`, { icon: '📝', duration: 5000 })
  }

  const cancelEdit = () => {
    setEditId(null); setFormData({ nik: '', no_kk: '', nama: '', alamat: '', pekerjaan: '', pendapatan: '< Rp 500.000', tanggungan: '' })
    setFiles({ ktp: null, diri: null, kerja: null, rumah: null }); setOldUrls({ ktp: '', diri: '', kerja: '', rumah: '' })
    document.getElementById('form-input').reset()
  }

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!userProfile?.id || !userProfile?.kabupaten_kota) { toast.error("Error: Identitas Akun tidak lengkap."); return }

    setIsImporting(true)
    const loadingToast = toast.loading("Membaca file Excel...")

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const data = new Uint8Array(event.target.result)
        const workbook = read(data, { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = utils.sheet_to_json(worksheet)

        if (jsonData.length === 0) { toast.error("File Excel kosong!", { id: loadingToast }); setIsImporting(false); return }

        toast.loading(`Mengimpor ${jsonData.length} data...`, { id: loadingToast })

        const formattedData = jsonData.map((row) => ({
          nik: String(row.nik), no_kk: row.no_kk ? String(row.no_kk) : null, nama_lengkap: row.nama_lengkap, alamat: row.alamat, 
          pekerjaan: row.pekerjaan || '-', pendapatan: row.pendapatan || '< Rp 500.000', tanggungan: row.tanggungan ? parseInt(row.tanggungan) : 0,
          jenis_bantuan: 'Belum Ditentukan', status: 'Menunggu Validasi', alasan_penolakan: null, user_id: userProfile.id, kabupaten_kota: userProfile.kabupaten_kota
        }))

        const { error } = await supabase.from('pengajuan_bantuan').insert(formattedData)
        if (error) throw error

        toast.success(`${jsonData.length} data berhasil diimpor!`, { id: loadingToast })
        await catatLog("Import Excel", `Mengimpor data bansos warga secara massal sebanyak ${jsonData.length} data.`)
        await initData() 
      }
      reader.readAsArrayBuffer(file)
    } catch (error) { toast.error("Gagal mengimpor: " + error.message, { id: loadingToast })
    } finally { setIsImporting(false); e.target.value = null }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!editId && (!files.ktp || !files.diri || !files.kerja || !files.rumah)) { toast.error("Mohon lengkapi semua dokumen foto!"); return }
    if (!userProfile?.id || !userProfile?.kabupaten_kota) { toast.error("Error: Identitas Akun tidak lengkap."); return }

    const { data: cekNik } = await supabase.from('pengajuan_bantuan').select('id, nama_lengkap').eq('nik', formData.nik).maybeSingle() 
    if (cekNik) {
      if (!editId) { toast.error(`Gagal: NIK ${formData.nik} sudah terdaftar atas nama ${cekNik.nama_lengkap}.`); return }
      if (editId && cekNik.id !== editId) { toast.error(`Gagal: NIK ${formData.nik} sudah dipakai data lain.`); return }
    }

    setUploading(true)
    const toastId = toast.loading("Mengunggah dokumen dan memproses data...")

    try {
      const urlKtp = files.ktp ? await uploadImage(files.ktp, 'ktp') : oldUrls.ktp
      const urlDiri = files.diri ? await uploadImage(files.diri, 'diri') : oldUrls.diri
      const urlKerja = files.kerja ? await uploadImage(files.kerja, 'kerja') : oldUrls.kerja
      const urlRumah = files.rumah ? await uploadImage(files.rumah, 'rumah') : oldUrls.rumah

      const payload = {
        nik: formData.nik, no_kk: formData.no_kk, nama_lengkap: formData.nama, alamat: formData.alamat,
        pekerjaan: formData.pekerjaan, pendapatan: formData.pendapatan, tanggungan: parseInt(formData.tanggungan),
        foto_ktp: urlKtp, foto_diri: urlDiri, foto_pekerjaan: urlKerja, foto_rumah: urlRumah, 
        status: 'Menunggu Validasi',         // <--- Reset masuk antrian
        alasan_penolakan: null,              // <--- Hapus history ditolak
        jenis_bantuan: 'Belum Ditentukan' ,   // <--- Reset agar dinilai ulang
        created_at: new Date().toISOString()
      }


      if (editId) {
        // 👇 TAMBAHAN .select() UNTUK MENCEGAH SILENT FAILURE RLS
        const { data: updatedData, error } = await supabase.from('pengajuan_bantuan')
          .update(payload)
          .eq('id', editId)
          .select() 

        if (error) throw error
        
        // Jika database mengembalikan 0 data, berarti RLS memblokir aksi UPDATE
        if (!updatedData || updatedData.length === 0) {
            throw new Error("Akses Ditolak Database. Pastikan tabel memiliki kebijakan (RLS Policy) UPDATE untuk Operator.")
        }

        toast.success("Data berhasil direvisi dan kembali masuk antrian!", { id: toastId })
        await catatLog("Revisi Data Warga", `Merevisi data pengajuan atas nama ${formData.nama} (NIK: ${formData.nik})`)
      } else {
        payload.user_id = userProfile.id; 
        payload.kabupaten_kota = userProfile.kabupaten_kota;
        const { error } = await supabase.from('pengajuan_bantuan').insert([payload])
        if (error) throw error
        toast.success("Data baru berhasil dikirim!", { id: toastId })
        await catatLog("Input Data Warga", `Menambahkan data pengajuan baru atas nama ${formData.nama} (NIK: ${formData.nik})`)
      }

      try { await fetch('/api/operator/notify-bidang', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nama_pemohon: formData.nama, jenis_bantuan: 'Menunggu Ketetapan', kota_operator: userProfile.kabupaten_kota }) }) } catch (e) {}
      await initData(); cancelEdit(); setActiveTab('history')
    } catch (error) { toast.error("Gagal: " + error.message, { id: toastId }) 
    } finally { setUploading(false) }
  }

  // 👇 VERSI HANDLEPRINT DENGAN ANTI-POTONG GAMBAR
  const handlePrint = (item) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    printWindow.document.write(`
    <html>
    <head>
      <title>Bukti Pengajuan - ${item.nama_lengkap}</title>
      <style>
        @media print { 
          @page { size: A4; margin: 15mm; } 
          body { -webkit-print-color-adjust: exact; color-adjust: exact; } 
          .avoid-break { page-break-inside: avoid; break-inside: avoid; }
        } 
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: auto; color: #111; } 
        h1 { font-size: 20px; margin-bottom: 5px; text-transform: uppercase; color: #000; border-bottom: 2px solid #000; padding-bottom: 10px; } 
        .meta { font-size: 11px; color: #555; margin-bottom: 20px; font-family: monospace; } 
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .info-table td { padding: 10px 10px 10px 0; vertical-align: top; border-bottom: 1px dashed #e2e8f0; width: 50%; }
        .label { font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px; }
        .value { font-size: 14px; font-weight: bold; color: #0f172a; }
        .status-box { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: ${item.status === 'Disetujui' ? '#dcfce7' : item.status === 'Perlu Revisi' ? '#fee2e2' : '#fef3c7'}; color: ${item.status === 'Disetujui' ? '#166534' : item.status === 'Perlu Revisi' ? '#991b1b' : '#92400e'}; border: 1px solid ${item.status === 'Disetujui' ? '#166534' : item.status === 'Perlu Revisi' ? '#991b1b' : '#92400e'}; } 
        .active-badge { font-size: 10px; font-weight: bold; padding: 3px 6px; border-radius: 3px; margin-left: 5px; background: ${item.status_penerima === 'Nonaktif' ? '#f1f5f9' : '#e0e7ff'}; color: ${item.status_penerima === 'Nonaktif' ? '#64748b' : '#4338ca'}; text-transform: uppercase; } 
        .images-section { margin-top: 25px; }
        .images-section h3 { font-size: 13px; background: #f8fafc; padding: 8px 12px; border-left: 4px solid #1e3a8a; margin-bottom: 15px; color: #0f172a;} 
        .images-flex { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 15px; } 
        .img-card { width: calc(50% - 10px); border: 1px solid #cbd5e1; padding: 6px; background: #fff; box-sizing: border-box; } 
        .img-card p { font-size: 10px; text-align: center; margin: 0 0 6px 0; font-weight: bold; background: #f1f5f9; padding: 5px; text-transform: uppercase; color: #334155;} 
        img { width: 100%; height: 180px; object-fit: cover; display: block; border-radius: 4px; }
      </style>
    </head>
    <body>
      <h1>Bukti Pengajuan Bansos</h1>
      <p class="meta">ID DATA: ${item.id} | DICETAK: ${new Date().toLocaleDateString('id-ID')}</p>
      
      <table class="info-table">
        <tr><td><span class="label">Nama Lengkap</span><span class="value">${item.nama_lengkap}</span></td><td><span class="label">Jenis Bantuan</span><span class="value" style="color: #1e3a8a;">${item.jenis_bantuan}</span></td></tr>
        <tr><td><span class="label">NIK / KK</span><span class="value">${item.nik} / ${item.no_kk || '-'}</span></td><td><span class="label">Kota/Kabupaten</span><span class="value">${item.kabupaten_kota || '-'}</span></td></tr>
        <tr><td><span class="label">Pekerjaan & Pendapatan</span><span class="value">${item.pekerjaan || '-'} (${item.pendapatan || '-'})</span></td><td><span class="label">Status Validasi</span><span class="value" style="border:none; padding:0;"><span class="status-box">${item.status}</span></span></td></tr>
        <tr><td><span class="label">Jumlah Tanggungan</span><span class="value">${item.tanggungan !== null ? item.tanggungan + ' Orang' : '-'}</span></td><td><span class="label">Alamat Domisili</span><span class="value" style="font-weight: 500;">${item.alamat}</span></td></tr>
      </table>

      <div class="images-section avoid-break">
        <h3>LAMPIRAN DOKUMEN FOTO</h3>
        <div class="images-flex">
          <div class="img-card avoid-break"><p>FOTO KTP</p><img src="${item.foto_ktp || ''}" onerror="this.style.display='none'" /></div>
          <div class="img-card avoid-break"><p>FOTO DIRI</p><img src="${item.foto_diri || ''}" onerror="this.style.display='none'" /></div>
          <div class="img-card avoid-break"><p>FOTO RUMAH</p><img src="${item.foto_rumah || ''}" onerror="this.style.display='none'" /></div>
          <div class="img-card avoid-break"><p>FOTO PEKERJAAN</p><img src="${item.foto_pekerjaan || ''}" onerror="this.style.display='none'" /></div>
        </div>
      </div>
      <script>window.onload = function() { setTimeout(function() { window.print(); }, 1500); }</script>
    </body>
    </html>
    `)
    printWindow.document.close()
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      
      {/* SIDEBAR */}
      {/* SIDEBAR MODERN OPERATOR (MINI-COLLAPSE) */}
      <aside className={`bg-white border-r border-slate-200 flex flex-col shrink-0 z-20 transition-all duration-300 ease-in-out print:hidden ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        
        {/* HEADER SIDEBAR */}
        <div className={`h-[72px] px-5 flex items-center border-b border-slate-100 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
          {isSidebarOpen ? (
            <>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">D</div>
                <div className="truncate">
                  <h1 className="text-[13px] font-black text-slate-900 tracking-wider leading-tight">DINSOS JATIM</h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Operator Kota</p>
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
          
          {/* Tombol Input (Diubah jadi 'form') */}
          <button onClick={() => setActiveTab('form')} className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4 py-3 justify-start' : 'justify-center py-3 px-0'} rounded-xl text-sm font-bold transition-all ${activeTab === 'form' ? 'bg-blue-50 text-blue-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} title="Input Data">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            {isSidebarOpen && <span className="truncate">Input Pengajuan</span>}
          </button>
          <button onClick={() => setActiveTab('history')} className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4 py-3 justify-start' : 'justify-center py-3 px-0'} rounded-xl text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-blue-50 text-blue-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} title="Riwayat Data">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {isSidebarOpen && <span className="truncate">Daftar Pengajuan</span>}
          </button>
          
        </nav>

        {/* FOOTER LOGOUT */}
        <div className="p-4 border-t border-slate-100">
          <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className={`w-full flex items-center ${isSidebarOpen ? 'justify-center gap-2 px-4' : 'justify-center px-0'} py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100`} title="Keluar Sistem">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            {isSidebarOpen && <span className="truncate">Keluar</span>}
          </button>
        </div>
      </aside>

      {/* KONTEN UTAMA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-extrabold text-slate-800">{activeTab === 'form' ? (editId ? 'Revisi Data Pengajuan' : 'Formulir Pengajuan Baru') : 'Riwayat Pengajuan Daerah'}</h2>
          <div className="flex items-center gap-3">
             <input type="file" accept=".xlsx, .xls, .csv" id="excel-upload" className="hidden" onChange={handleExcelUpload} disabled={isImporting} />
             <label htmlFor="excel-upload" className={`inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm cursor-pointer transition-colors ${isImporting ? 'opacity-70 pointer-events-none' : ''}`}>
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
               {isImporting ? 'Memproses...' : 'Import Excel'}
             </label>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <StatCard title="Total Input" count={stats.total} colorClass="bg-blue-900" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>} />
            <StatCard title="Menunggu Validasi" count={stats.pending} colorClass="bg-amber-500" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
            <StatCard title="Telah Disetujui" count={stats.approved} colorClass="bg-emerald-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
            <StatCard title="Perlu Revisi" count={stats.rejected} colorClass="bg-rose-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
             <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
               <h3 className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Status Pengajuan Anda</h3>
               <div className="flex-1 min-h-[240px] w-full">
                  <ResponsiveContainer width="100%" height={240} minHeight={240}>
                     <PieChart margin={{ top: 20, right: 0, bottom: 20, left: 0 }}>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                           {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} /> )}
                        </Pie>
                        <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                        <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{fontSize: '11.5px', fontWeight: 'bold', color: '#64748b', paddingTop: '15px'}} />
                     </PieChart>
                  </ResponsiveContainer>
               </div>
             </div>
             <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
               <h3 className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Distribusi Program di Wilayah Anda</h3>
               <div className="flex-1 min-h-[240px]">
                  <ResponsiveContainer width="100%" height={240} minHeight={240}>
                     <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                        <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                        <Bar dataKey="Total" fill={DINSOS_NAVY} radius={[4, 4, 0, 0]} barSize={32} />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
             </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            
            {activeTab === 'form' && (
              <div className="p-6 md:p-10">
                <form id="form-input" onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
                  {editId && (
                    <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl flex items-start gap-4 shadow-sm">
                      <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                      <div><h3 className="text-sm font-bold text-amber-900">Mode Revisi Data Aktif</h3><p className="text-xs text-amber-700 mt-1">Silakan perbaiki isian form. Kosongkan input file jika foto lama tidak diganti.</p></div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-1"><h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Data Diri</h3><p className="text-xs text-slate-500 mt-1">Informasi dasar sesuai KTP & KK.</p></div>
                    <div className="md:col-span-2 space-y-5 bg-slate-50 p-6 rounded-xl border border-slate-200">
                      <div className="grid grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">NIK (16 Digit)</label>
                          <input required type="text" maxLength="16" className="w-full px-4 py-3 border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-900 text-sm outline-none" value={formData.nik} onChange={e => setFormData({...formData, nik: e.target.value.replace(/\D/g, '')})} placeholder="0000..." />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">No. KK (16 Digit)</label>
                          <input required type="text" maxLength="16" className="w-full px-4 py-3 border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-900 text-sm outline-none" value={formData.no_kk} onChange={e => setFormData({...formData, no_kk: e.target.value.replace(/\D/g, '')})} placeholder="0000..." />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nama Lengkap</label>
                          <input required type="text" className="w-full px-4 py-3 border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-900 text-sm outline-none" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} placeholder="Sesuai KTP" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Alamat Domisili</label>
                        <textarea required rows="2" className="w-full px-4 py-3 border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-900 text-sm outline-none" value={formData.alamat} onChange={e => setFormData({...formData, alamat: e.target.value})} placeholder="Jalan, RT/RW, Kelurahan..."></textarea>
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-200" />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-1"><h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Profil Sosial Ekonomi</h3><p className="text-xs text-slate-500 mt-1">Kriteria penentuan kelayakan.</p></div>
                    <div className="md:col-span-2 space-y-5 bg-slate-50 p-6 rounded-xl border border-slate-200">
                      <div className="grid grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Pekerjaan Utama</label>
                          <input required type="text" className="w-full px-4 py-3 border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-900 text-sm outline-none" value={formData.pekerjaan} onChange={e => setFormData({...formData, pekerjaan: e.target.value})} placeholder="Cth: Buruh Harian" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Jumlah Tanggungan</label>
                          <input required type="number" min="0" className="w-full px-4 py-3 border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-900 text-sm outline-none" value={formData.tanggungan} onChange={e => setFormData({...formData, tanggungan: e.target.value})} placeholder="Jumlah anggota keluarga" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Pendapatan Rata-Rata / Bulan</label>
                          <select className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-900 text-sm bg-white outline-none" value={formData.pendapatan} onChange={e => setFormData({...formData, pendapatan: e.target.value})}>
                            <option value="< Rp 500.000">&lt; Rp 500.000</option>
                            <option value="Rp 500.000 - Rp 1.000.000">Rp 500.000 - Rp 1.000.000</option>
                            <option value="Rp 1.000.000 - Rp 2.000.000">Rp 1.000.000 - Rp 2.000.000</option>
                            <option value="> Rp 2.000.000">&gt; Rp 2.000.000</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-200" />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-1"><h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Dokumen Bukti</h3><p className="text-xs text-slate-500 mt-1">Unggah foto kondisi terbaru (Max 2MB/foto).</p></div>
                    <div className="md:col-span-2 bg-slate-50 p-6 rounded-xl border border-slate-200">
                      <div className="grid grid-cols-2 gap-4">
                        {['ktp', 'diri', 'kerja', 'rumah'].map((type) => (
                          <div key={type} className="bg-white p-4 rounded-xl border border-slate-200">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">{type === 'ktp' ? 'Foto E-KTP' : type === 'diri' ? 'Foto Diri' : type === 'kerja' ? 'Foto Pekerjaan' : 'Foto Rumah'}</label>
                            <input required={!editId} type="file" accept="image/png, image/jpeg, image/jpg" onChange={(e) => handleFileChange(e, type)} className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-900 hover:file:bg-blue-100 transition cursor-pointer"/>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    {editId && <button type="button" onClick={cancelEdit} className="px-6 py-2.5 text-sm font-bold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition">Batal Revisi</button>}
                    <button disabled={uploading} type="submit" className={`px-6 py-2.5 rounded-lg text-white font-bold text-sm transition ${editId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-900 hover:bg-blue-800'} disabled:opacity-70 flex items-center gap-2`}>
                      {uploading ? 'Memproses...' : editId ? 'Kirim Revisi Data' : 'Kirim Pengajuan Baru'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center gap-4">
                   <div className="relative w-full md:w-64">
                     <input type="text" placeholder="Cari NIK / Nama..." className="pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:border-blue-900 outline-none w-full transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                     <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                   </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200">
                      <tr><th className="px-6 py-4">Identitas</th><th className="px-6 py-4">Program</th><th className="px-6 py-4">Status & Catatan</th><th className="px-6 py-4 text-right">Aksi</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredData.length > 0 ? filteredData.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4 align-middle">
                            <div className="flex items-center gap-3">
                               <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs border border-slate-200">{getInitials(item.nama_lengkap)}</div>
                               <div><div className="text-sm font-bold text-slate-800">{item.nama_lengkap}</div><div className="text-[11px] text-slate-500 font-mono mt-0.5">{item.nik}</div></div>
                            </div>
                          </td>
                          <td className="px-6 py-4 align-middle"><span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">{item.jenis_bantuan}</span></td>
                          <td className="px-6 py-4 align-middle">
                            {item.status === 'Menunggu Validasi' ? ( <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Menunggu</span>
                            ) : item.status === 'Disetujui' ? ( <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Disetujui</span>
                            ) : ( <div><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Perlu Revisi</span>{item.alasan_penolakan && <p className="text-[10px] text-rose-600 mt-1.5 font-medium italic">"{item.alasan_penolakan}"</p>}</div> )}
                          </td>
                          <td className="px-6 py-4 text-right align-middle">
                             <div className="flex justify-end gap-2">
                                {item.status === 'Perlu Revisi' && ( <button onClick={() => handleEdit(item)} className="px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-bold transition-colors">Revisi Data</button> )}
                                <button onClick={() => setSelectedItem(item)} className="px-3 py-1.5 rounded-md border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">Detail</button>
                             </div>
                          </td>
                        </tr>
                      )) : <tr><td colSpan="4" className="px-6 py-10 text-center text-slate-400 text-sm">Belum ada data pengajuan.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL DETAIL DATA */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
           <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
              <div className="px-6 py-4 flex justify-between items-center border-b border-slate-100 shrink-0">
                 <div><h3 className="text-lg font-extrabold text-slate-800">Detail Pengajuan Saya</h3><p className="text-xs text-slate-500 font-mono mt-1">ID: {selectedItem.id}</p></div>
                 <div className="flex items-center gap-2"><button onClick={() => handlePrint(selectedItem)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-bold transition">🖨️ Cetak Bukti</button><button onClick={() => setSelectedItem(null)} className="w-8 h-8 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-100 hover:text-slate-800 transition">&times;</button></div>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nama Lengkap & NIK</p><p className="text-xl font-bold text-slate-800">{selectedItem.nama_lengkap}</p><p className="text-sm font-mono text-slate-500 mt-1">NIK: {selectedItem.nik} <span className="mx-2 text-slate-300">|</span> KK: {selectedItem.no_kk || '-'}</p></div>
                    
                    <div className="row-span-2"><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Profil Sosial Ekonomi</p>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-1 space-y-2">
                        <div className="flex justify-between border-b border-slate-200 pb-2"><span className="text-xs text-slate-500">Pekerjaan</span><span className="text-xs font-bold text-slate-800">{selectedItem.pekerjaan || '-'}</span></div>
                        <div className="flex justify-between border-b border-slate-200 pb-2"><span className="text-xs text-slate-500">Pendapatan</span><span className="text-xs font-bold text-slate-800">{selectedItem.pendapatan || '-'}</span></div>
                        <div className="flex justify-between"><span className="text-xs text-slate-500">Tanggungan</span><span className="text-xs font-bold text-slate-800">{selectedItem.tanggungan !== null ? `${selectedItem.tanggungan} Orang` : '-'}</span></div>
                      </div>
                    </div>

                    <div><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Program Bantuan</p><p className="text-sm font-bold text-blue-900 uppercase inline-block border border-blue-200 bg-blue-50 px-2 py-0.5 rounded mt-1">{selectedItem.jenis_bantuan}</p></div>
                    <div><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status Saat Ini</p><p className={`text-sm font-bold mt-1 inline-flex items-center gap-2 ${selectedItem.status === 'Disetujui' ? 'text-emerald-600' : selectedItem.status === 'Perlu Revisi' ? 'text-rose-600' : 'text-amber-600'}`}>{selectedItem.status}</p></div>
                    
                    <div className="col-span-2"><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Alamat Domisili</p><p className="text-sm text-slate-700 leading-snug">{selectedItem.alamat}</p></div>
                 </div>
                 <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Bukti Lampiran (Klik untuk perbesar)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       {[{title: 'KTP', src: selectedItem.foto_ktp}, {title: 'Diri', src: selectedItem.foto_diri}, {title: 'Rumah', src: selectedItem.foto_rumah}, {title: 'Pekerjaan', src: selectedItem.foto_pekerjaan}].map((foto, idx) => (
                          <div key={idx} onClick={() => foto.src && window.open(foto.src, '_blank')} className="group relative h-32 bg-slate-50 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:shadow-md transition-all">
                             {foto.src ? <img src={foto.src} alt={foto.title} className="w-full h-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase text-slate-400">{foto.title} Kosong</div>}
                             <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><span className="text-white text-[10px] font-bold uppercase tracking-wider">Buka Dokumen</span></div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
              {selectedItem.status === 'Perlu Revisi' && (
                 <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-end shrink-0"><button onClick={() => handleEdit(selectedItem)} className="px-4 py-2 rounded-lg bg-blue-900 text-white font-bold text-xs hover:bg-blue-800 transition">Revisi Data Sekarang</button></div>
              )}
           </div>
        </div>
      )}

    </div>
  )
} 