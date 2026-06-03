'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import toast from 'react-hot-toast' 

// --- PALET WARNA UTAMA DINSOS JATIM ---
const DINSOS_NAVY = '#1e3a8a'; 
const DINSOS_RED = '#dc2626';  

// --- DAFTAR KOTA/KABUPATEN JATIM ---
const DAFTAR_KOTA_JATIM = [
  "Kabupaten Bangkalan", "Kabupaten Banyuwangi", "Kabupaten Blitar", "Kabupaten Bojonegoro",
  "Kabupaten Bondowoso", "Kabupaten Gresik", "Kabupaten Jember", "Kabupaten Jombang",
  "Kabupaten Kediri", "Kabupaten Lamongan", "Kabupaten Lumajang", "Kabupaten Madiun",
  "Kabupaten Magetan", "Kabupaten Malang", "Kabupaten Mojokerto", "Kabupaten Nganjuk",
  "Kabupaten Ngawi", "Kabupaten Pacitan", "Kabupaten Pamekasan", "Kabupaten Pasuruan",
  "Kabupaten Ponorogo", "Kabupaten Probolinggo", "Kabupaten Sampang", "Kabupaten Sidoarjo",
  "Kabupaten Situbondo", "Kabupaten Sumenep", "Kabupaten Trenggalek", "Kabupaten Tuban",
  "Kabupaten Tulungagung", "Kota Batu", "Kota Blitar", "Kota Kediri", "Kota Madiun",
  "Kota Malang", "Kota Mojokerto", "Kota Pasuruan", "Kota Probolinggo", "Kota Surabaya"
];  

// --- KOMPONEN KARTU STATISTIK PREMIUM ---
const StatCard = ({ title, count, icon, colorClass }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between transition-all hover:border-slate-300 shadow-sm group">
    <div>
      <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-2xl font-black text-slate-800">{count}</h3>
    </div>
    <div className={`p-3 rounded-lg text-white ${colorClass} transition-transform duration-300 group-hover:scale-110 shadow-md`}>
      {icon}
    </div>
  </div>
)

// --- ATRIBUT HELPER BADGE & INITIALS ---
const getInitials = (name) => {
  if (!name) return '?'
  return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().substring(0, 2)
}

const getStatusBadge = (status) => {
  switch (status) {
    case 'Disetujui': return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Disetujui</span>
    case 'Perlu Revisi': return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>Perlu Revisi</span>
    default: return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-1.5"></span>Menunggu</span>
  }
}

const getActiveBadge = (isActive) => {
    if (isActive === 'Aktif' || isActive === true || isActive === null || isActive === undefined) {
        return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>Aktif</span>
    } else {
        return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300">Non-Aktif</span>
    }
    
}
// Paste fungsi ini di sini (di bawah getActiveBadge)
const getLogBadgeColor = (role) => {
   if (role === 'Super Admin' || role?.toLowerCase() === 'superadmin') return 'bg-slate-950 text-white border-slate-950'
   if (role === 'Bidang') return 'bg-blue-50 text-blue-700 border-blue-200'
   return 'bg-amber-50 text-amber-700 border-amber-200'
}
export default function SuperAdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [printMode, setPrintMode] = useState('table')
  const [activeTab, setActiveTab] = useState('users') 
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  
  const [users, setUsers] = useState([])
  const [allBansos, setAllBansos] = useState([])
  const [logs, setLogs] = useState([]) 
  const [stats, setStats] = useState({ users: 0, totalData: 0, cities: 0 })

  // State Filter Monitoring Data
  const [filterProgram, setFilterProgram] = useState('Semua')
  const [filterWaktu, setFilterWaktu] = useState('Semua')
  const [filterWilayah, setFilterWilayah] = useState('Semua') 

  // State Filter Log Aktivitas (Mampu melacak seluruh user)
  const [filterLogRole, setFilterLogRole] = useState('Semua')
  const [searchLogTerm, setSearchLogTerm] = useState('')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'operator', kota: '' })
  const [creating, setCreating] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedDetailItem, setSelectedDetailItem] = useState(null)

  // State Komponen Custom Alert
  const [customAlert, setCustomAlert] = useState({ isOpen: false, title: '', message: '', danger: true, confirmLabel: 'Hapus', onConfirm: null })

  const fetchData = async () => {
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
    } catch (error) { toast.error("Gagal memuat data: " + error.message) } finally { setLoading(false) }
  }

  useEffect(() => { 
    fetchData() 
    const channel = supabase.channel('superadmin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'log_aktivitas' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pengajuan_bantuan' }, () => fetchData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router])

  const catatLog = async (aksi, keterangan) => {
     try {
        await supabase.from('log_aktivitas').insert([{ 
           email_pengguna: currentUserEmail, role: 'Super Admin', aksi: aksi, keterangan: keterangan 
        }])
     } catch (error) { console.error("Gagal mencatat log") }
  }

  const uniquePrograms = ['Semua', ...new Set(allBansos.map(item => item.jenis_bantuan))]
  const uniqueWilayah = ['Semua', ...new Set(allBansos.map(item => item.kabupaten_kota).filter(Boolean))]

  // --- LOGIKA FILTER MONITORING DATA ---
  const filteredData = useMemo(() => {
    return allBansos.filter(item => {
      const matchProgram = filterProgram === 'Semua' || item.jenis_bantuan === filterProgram;
      const matchWilayah = filterWilayah === 'Semua' || item.kabupaten_kota === filterWilayah;
      
      let matchWaktu = true;
      if (filterWaktu !== 'Semua') {
        const itemDate = new Date(item.created_at); const now = new Date();
        if (filterWaktu === '7 Hari Terakhir') { const past7 = new Date(); past7.setDate(now.getDate() - 7); matchWaktu = itemDate >= past7;
        } else if (filterWaktu === 'Bulan Ini') { matchWaktu = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        } else if (filterWaktu === 'Bulan Lalu') { let lastMonth = now.getMonth() - 1; let year = now.getFullYear(); if (lastMonth < 0) { lastMonth = 11; year -= 1; } matchWaktu = itemDate.getMonth() === lastMonth && itemDate.getFullYear() === year;
        } else if (filterWaktu === 'Tahun Ini') { matchWaktu = itemDate.getFullYear() === now.getFullYear(); }
      }
      return matchProgram && matchWaktu && matchWilayah;
    });
  }, [allBansos, filterProgram, filterWaktu, filterWilayah]);

  // --- LOGIKA FILTER AUDIT LOG AKTIVITAS ---
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchRole = filterLogRole === 'Semua' || log.role?.toLowerCase() === filterLogRole.toLowerCase();
      
      const term = searchLogTerm.toLowerCase();
      const matchSearch = !searchLogTerm || 
        (log.email_pengguna && log.email_pengguna.toLowerCase().includes(term)) ||
        (log.aksi && log.aksi.toLowerCase().includes(term)) ||
        (log.keterangan && log.keterangan.toLowerCase().includes(term));

      return matchRole && matchSearch;
    });
  }, [logs, filterLogRole, searchLogTerm]);

  const pieData = useMemo(() => {
    const roles = { operator: 0, bidang: 0, superadmin: 0 }
    users.forEach(u => { if (roles[u.role] !== undefined) roles[u.role]++ })
    return [{ name: 'Operator', value: roles.operator }, { name: 'Bidang', value: roles.bidang }, { name: 'Admin', value: roles.superadmin }]
  }, [users])
  const PIE_COLORS = [DINSOS_NAVY, DINSOS_RED, '#f59e0b']

  const barData = useMemo(() => {
    const cityCounts = {}
    users.filter(u => u.role === 'operator').forEach(u => { const city = u.kabupaten_kota || 'Belum Diatur'; cityCounts[city] = (cityCounts[city] || 0) + 1 })
    return Object.keys(cityCounts).map(city => ({ name: city, Total: cityCounts[city] })).sort((a,b) => b.Total - a.Total)
  }, [users])

  const handleExportExcel = async () => {
    if (filteredData.length === 0) { toast.error("Tidak ada data untuk diexport!"); return }
    toast.success("Mempersiapkan Laporan Excel...")
    
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Data Bansos')
    worksheet.columns = [
      { header: 'No', key: 'no', width: 5 }, { header: 'Tanggal Input', key: 'tanggal', width: 15 }, { header: 'NIK', key: 'nik', width: 20 },
      { header: 'Nama Lengkap', key: 'nama', width: 25 }, { header: 'Program Bantuan', key: 'bantuan', width: 18 }, { header: 'Kabupaten/Kota', key: 'kota', width: 20 },
      { header: 'Alamat Lengkap', key: 'alamat', width: 40 }, { header: 'Status Validasi', key: 'status', width: 18 }, { header: 'Status Keaktifan', key: 'aktif', width: 15 }, { header: 'Catatan Revisi', key: 'catatan', width: 30 }
    ]
    worksheet.getRow(1).font = { bold: true }; worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    filteredData.forEach((item, index) => {
      worksheet.addRow({
        no: index + 1, tanggal: new Date(item.created_at).toLocaleDateString('id-ID'), nik: item.nik, nama: item.nama_lengkap, bantuan: item.jenis_bantuan,
        kota: item.kabupaten_kota || '-', alamat: item.alamat, status: item.status, aktif: item.status_penerima || 'Aktif', catatan: item.alasan_penolakan || '-'
      })
    })
    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), `Rekap_Bansos_SuperAdmin_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`)
    
    await catatLog("Export Excel", `Mendownload rekap data bantuan sosial tingkat provinsi`)
  }

  const executeDeleteUser = async (id, email) => {
    const toastId = toast.loading("Menghapus akun pengguna...")
    try {
      const res = await fetch('/api/admin/delete-user', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal menghapus user')
      toast.success("Sukses! User terhapus.", { id: toastId })
      await catatLog("Hapus Akun", `Menghapus akun pengguna secara permanen: ${email}`)
      await fetchData()
    } catch (error) {
      toast.error("Error: " + error.message, { id: toastId })
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setCreating(true)
    const toastId = toast.loading("Membuat akun baru...")
    try {
      const res = await fetch('/api/admin/create-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser) })
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal membuat user')
      toast.success("User berhasil dibuat!", { id: toastId })
      await catatLog("Buat Akun Baru", `Membuat akun ${newUser.role} baru untuk email: ${newUser.email}`)
      setIsFormOpen(false); setNewUser({ email: '', password: '', role: 'operator', kota: '' }); await fetchData()
    } catch (error) { toast.error("Error: " + error.message, { id: toastId }) } finally { setCreating(false) }
  }

  const executeClearLogs = async () => {
    const toastId = toast.loading("Membersihkan riwayat log...");
    try {
      const { error } = await supabase.from('log_aktivitas').delete().not('created_at', 'is', null);
      if (error) throw error;
      toast.success("Seluruh riwayat aktivitas dibersihkan!", { id: toastId });
      await catatLog("Bersihkan Log", "Super Admin membersihkan seluruh riwayat audit log aktivitas dari database.");
      await fetchData();
    } catch (error) { toast.error("Gagal membersihkan log: " + error.message, { id: toastId }); }
  }

  // 👇 PROPOSIONAL LAYOUT PRINT PDF (ANTI-TERPOTONG HALAMAN)
  const handlePrint = (item) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    printWindow.document.write(`
    <html>
    <head>
      <title>Laporan Validasi - ${item.nama_lengkap}</title>
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
      <h1>Detail Verifikasi Bantuan Sosial</h1>
      <p class="meta">ID DATA: ${item.id} | DICETAK: ${new Date().toLocaleDateString('id-ID')}</p>
      
      <table class="info-table">
        <tr><td><span class="label">Nama Lengkap</span><span class="value">${item.nama_lengkap}</span></td><td><span class="label">Jenis Bantuan</span><span class="value" style="color: #1e3a8a;">${item.jenis_bantuan}</span></td></tr>
        <tr><td><span class="label">NIK / KK</span><span class="value">${item.nik} / ${item.no_kk || '-'}</span></td><td><span class="label">Kota/Kabupaten</span><span class="value">${item.kabupaten_kota || '-'}</span></td></tr>
        <tr><td><span class="label">Pekerjaan & Pendapatan</span><span class="value">${item.pekerjaan || '-'} (${item.pendapatan || '-'})</span></td><td><span class="label">Status Validasi</span><span class="value" style="border:none; padding:0;"><span class="status-box">${item.status}</span><span class="active-badge">${item.status_penerima || 'Aktif'}</span></span></td></tr>
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
      
      {/* SIDEBAR DASHBOARD */}
      {/* SIDEBAR */}
      {/* SIDEBAR MODERN DENGAN FITUR MINI-COLLAPSE */}
      <aside className={`bg-white border-r border-slate-200 flex flex-col shrink-0 z-20 transition-all duration-300 ease-in-out print:hidden ${printMode === 'single' ? 'hidden' : ''} ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        
        {/* HEADER SIDEBAR (Logo & Tombol Toggle) */}
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
                 {/* Ikon Panah Kiri (Tutup) */}
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
          <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className={`w-full flex items-center ${isSidebarOpen ? 'justify-center gap-2 px-4' : 'justify-center px-0'} py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100`} title="Keluar Sistem">
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
             {activeTab === 'data' && (<button onClick={handleExportExcel} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm">Export Excel</button>)}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Baris Statistik */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <StatCard title="Total Pengguna" count={stats.users} colorClass="bg-blue-900" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
            <StatCard title="Operator Daerah" count={stats.cities} colorClass="bg-red-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} />
            <StatCard title="Total Pengajuan" count={stats.totalData} colorClass="bg-emerald-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
          </div>

          {/* Baris Grafik Grafik */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
              <h3 className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Distribusi Akun</h3>
              <div className="flex-1 min-h-[240px] w-full">
                <ResponsiveContainer width="100%" height={240} minHeight={240}>
                  <PieChart margin={{ top: 20, right: 0, bottom: 20, left: 0 }}>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                      {pieData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} /> ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                    <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: '11.5px', fontWeight: 'bold', color: '#64748b', paddingTop: '15px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
              <h3 className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Sebaran Wilayah Operator</h3>
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

          {/* Konten Area Tabel */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            
            {/* TAB 1: MANAJEMEN PENGGUNA */}
            {activeTab === 'users' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200">
                    <tr><th className="px-6 py-4">Informasi Akun</th><th className="px-6 py-4">Role Akses</th><th className="px-6 py-4">Wilayah Tugas</th><th className="px-6 py-4 text-right">Aksi</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs border border-slate-200">{u.email ? u.email.substring(0,2).toUpperCase() : 'ID'}</div>
                            <div>
                              <div className="text-sm font-bold text-slate-800">{u.email || 'No Email'}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{u.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${u.role === 'superadmin' ? 'bg-slate-800 text-white border-slate-800' : u.role === 'bidang' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{u.role || 'Operator'}</span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-600">{u.kabupaten_kota || '-'}</td>
                        <td className="px-6 py-4 text-right">
                          {u.email !== currentUserEmail && (
                              <button onClick={() => {
                                  setCustomAlert({
                                      isOpen: true, title: 'Hapus Akun Pengguna', message: `Yakin hapus akun ${u.email} secara permanen?`, danger: true, confirmLabel: 'Ya, Hapus Permanen',
                                      onConfirm: () => { setCustomAlert({isOpen: false}); executeDeleteUser(u.id, u.email); }
                                  })
                              }} className="text-red-600 hover:text-red-800 font-bold text-xs hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-red-200">Hapus</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 2: MONITORING DATA BANSOS */}
            {activeTab === 'data' && (
              <div>
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Program:</span><select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)} className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer">{uniquePrograms.map((prog, idx) => <option key={idx} value={prog}>{prog === 'Semua' ? 'Semua Program' : prog}</option>)}</select></div>
                  <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Wilayah:</span><select value={filterWilayah} onChange={(e) => setFilterWilayah(e.target.value)} className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer">{uniqueWilayah.map((wil, idx) => <option key={idx} value={wil}>{wil === 'Semua' ? 'Semua Wilayah' : wil}</option>)}</select></div>
                  <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Waktu:</span><select value={filterWaktu} onChange={(e) => setFilterWaktu(e.target.value)} className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer"><option value="Semua">Semua Waktu</option><option value="7 Hari Terakhir">7 Hari Terakhir</option><option value="Bulan Ini">Bulan Ini</option><option value="Bulan Lalu">Bulan Lalu</option><option value="Tahun Ini">Tahun Ini</option></select></div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200">
                      <tr><th className="px-6 py-4">Identitas Penerima</th><th className="px-6 py-4">Bantuan & Wilayah</th><th className="px-6 py-4">Status Pengajuan</th><th className="px-6 py-4">Keaktifan</th><th className="px-6 py-4 text-right">Aksi Data</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredData.length > 0 ? (
                        filteredData.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 align-middle">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs border border-slate-200">{getInitials(item.nama_lengkap)}</div>
                                <div>
                                  <div className="text-sm font-bold text-slate-800">{item.nama_lengkap}</div>
                                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">{item.nik}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 align-middle"><span className="text-[11px] font-black text-blue-900 uppercase">{item.jenis_bantuan}</span><div className="mt-0.5 text-[11px] font-medium text-slate-500">{item.kabupaten_kota || '-'}</div></td>
                            <td className="px-6 py-4 align-middle">{getStatusBadge(item.status)}</td>
                            <td className="px-6 py-4 align-middle">{getActiveBadge(item.status_penerima)}</td>
                            <td className="px-6 py-4 text-right align-middle">
                              {/* Super admin hanya review, tidak ada tombol hapus warga */}
                              <button onClick={() => { setSelectedDetailItem(item); setIsDetailModalOpen(true); }} className="text-blue-700 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md border border-blue-100 transition-colors">Detail Data</button>
                            </td>
                          </tr>
                        ))
                      ) : ( <tr><td colSpan="5" className="px-6 py-10 text-center text-slate-400 text-sm italic">Tidak ada data untuk filter ini.</td></tr> )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: AUDIT riwayat LOGS ALL USERS */}
            {activeTab === 'logs' && (
              <div>
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Peran Pengguna:</span>
                    <select value={filterLogRole} onChange={(e) => setFilterLogRole(e.target.value)} className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer">
                      <option value="Semua">Semua Pengguna</option>
                      <option value="Super Admin">Super Admin</option>
                      <option value="Bidang">Bidang Provinsi</option>
                      <option value="Operator">Operator Kota/Daerah</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                       <input type="text" placeholder="Cari email / aksi log..." className="pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:border-blue-900 outline-none w-full transition-all" value={searchLogTerm} onChange={(e) => setSearchLogTerm(e.target.value)} />
                       <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <button onClick={() => {
                        setCustomAlert({
                            isOpen: true, title: 'Bersihkan Log Aktivitas', message: 'Yakin ingin menghapus seluruh riwayat log audit aktivitas sistem dari database?', danger: true, confirmLabel: 'Ya, Bersihkan Log',
                            onConfirm: () => { setCustomAlert({isOpen: false}); executeClearLogs(); }
                        })
                    }} className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors border border-rose-200 whitespace-nowrap">
                        Bersihkan Log
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200">
                      <tr><th className="px-6 py-4">Waktu & Tanggal</th><th className="px-6 py-4">Informasi Aktor</th><th className="px-6 py-4">Kategori Aksi</th><th className="px-6 py-4 w-5/12">Keterangan Aktivitas</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 align-middle whitespace-nowrap">
                            <div className="text-[12px] font-bold text-slate-800">{new Date(log.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' })} WIB</div>
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <div className="text-[12px] font-bold text-slate-800">{log.email_pengguna}</div>
                            <div className="mt-1"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${getLogBadgeColor(log.role)}`}>{log.role || 'User'}</span></div>
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <span className="text-[11px] font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md">{log.aksi}</span>
                          </td>
                          <td className="px-6 py-4 align-middle text-[12px] text-slate-600 leading-relaxed font-medium">{log.keterangan}</td>
                        </tr>
                      )) : <tr><td colSpan="4" className="px-6 py-10 text-center text-slate-400 text-sm italic">Belum ada rekaman aktivitas audit log.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* COMPONENT MODAL MONITORING DETAIL DATA WARGA LENGKAP */}
      {isDetailModalOpen && selectedDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 flex justify-between items-center border-b border-slate-100 shrink-0">
              <div><h2 className="text-lg font-extrabold text-slate-800">Detail Profiling Calon Penerima Bantuan</h2></div>
              <div className="flex items-center gap-2">
                <button onClick={() => handlePrint(selectedDetailItem)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-bold text-xs border border-slate-300 transition-colors">Cetak PDF</button>
                <button onClick={() => setIsDetailModalOpen(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full text-xl">&times;</button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Informasi Utama</p>
                    <p className="text-xl font-bold text-slate-800">{selectedDetailItem.nama_lengkap}</p>
                    <p className="text-sm font-mono text-slate-500 mt-1">NIK: {selectedDetailItem.nik} <span className="mx-2 text-slate-300">|</span> KK: {selectedDetailItem.no_kk || '-'}</p>
                 </div>
                 
                 <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Profil Kelayakan Ekonomi</p>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-1 space-y-2">
                      <div className="flex justify-between border-b border-slate-200 pb-1.5"><span className="text-xs text-slate-500">Pekerjaan Utama</span><span className="text-xs font-bold text-slate-800">{selectedDetailItem.pekerjaan || '-'}</span></div>
                      <div className="flex justify-between border-b border-slate-200 pb-1.5"><span className="text-xs text-slate-500">Pendapatan Bulanan</span><span className="text-xs font-bold text-slate-800">{selectedDetailItem.pendapatan || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-xs text-slate-500">Jumlah Tanggungan</span><span className="text-xs font-bold text-slate-800">{selectedDetailItem.tanggungan !== null ? `${selectedDetailItem.tanggungan} Orang` : '-'}</span></div>
                    </div>
                 </div>

                 <div><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status Penilaian & Validasi</p><div className="flex items-center gap-2 mt-1.5">{getStatusBadge(selectedDetailItem.status)}{getActiveBadge(selectedDetailItem.status_penerima)}</div></div>
                 <div><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Program & Lokasi Wilayah</p><p className="text-sm font-bold text-blue-900 uppercase mt-1.5">{selectedDetailItem.jenis_bantuan} <span className="text-slate-400 font-normal ml-1">({selectedDetailItem.kabupaten_kota || 'Belum diatur'})</span></p></div>
                 <div className="col-span-2"><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Alamat Lengkap</p><p className="text-sm text-slate-700 leading-snug font-medium">{selectedDetailItem.alamat || '-'}</p></div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Galeri Lampiran Bukti Dokumen</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['foto_ktp', 'foto_diri', 'foto_rumah', 'foto_pekerjaan'].map((fotoKey, idx) => (
                    selectedDetailItem[fotoKey] ? (
                      <div key={idx} className="relative h-32 rounded-lg overflow-hidden group cursor-pointer border border-slate-200 shadow-sm" onClick={() => window.open(selectedDetailItem[fotoKey], '_blank')}>
                        <img src={selectedDetailItem[fotoKey]} alt={fotoKey} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-[10px] font-bold uppercase tracking-wider">Buka Ukuran Asli</span>
                        </div>
                      </div>
                    ) : (
                      <div key={idx} className="h-32 rounded-lg bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-center">{fotoKey.replace('_', ' ')}<br/>(Kosong)</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPONENT FORM TAMBAH AKUN USER */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 flex justify-between items-center border-b border-slate-100">
                    <h3 className="text-base font-extrabold text-slate-800">Tambah Operator/Bidang</h3>
                    <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-800 text-xl leading-none">&times;</button>
                </div>
                <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Login</label>
                        <input required type="email" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-blue-900 focus:bg-white outline-none" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="email@dinsos.jatim.go.id" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password Sementara</label>
                        <input required type="password" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-blue-900 focus:bg-white outline-none" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="Min. 6 karakter" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Role Akses</label>
                            <select 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:border-blue-900 outline-none cursor-pointer" 
                                value={newUser.role} 
                                onChange={e => setNewUser({...newUser, role: e.target.value, kota: e.target.value !== 'operator' ? '' : newUser.kota})}
                            >
                                <option value="operator">Operator Kota</option>
                                <option value="bidang">Bidang Provinsi</option>
                                <option value="superadmin">Super Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Wilayah Tugas</label>
                            <select 
                                disabled={newUser.role !== 'operator'} 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400 focus:border-blue-900 outline-none cursor-pointer" 
                                value={newUser.kota} 
                                onChange={e => setNewUser({...newUser, kota: e.target.value})}
                            >
                                <option value="">{newUser.role !== 'operator' ? '-' : 'Pilih Wilayah'}</option>
                                {DAFTAR_KOTA_JATIM.map((kota, idx) => (
                                    <option key={idx} value={kota}>{kota}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-2">
                        <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Batal</button>
                        <button disabled={creating} type="submit" className="px-4 py-2 text-xs font-bold text-white bg-blue-900 rounded-lg hover:bg-blue-800 disabled:opacity-70">{creating ? 'Menyimpan...' : 'Simpan Akun'}</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* COMPONENT CUSTOM MODAL CONFIRMATION DIALOG */}
      {customAlert.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6">
                <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-rose-100 text-rose-600">
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <h3 className="text-lg font-extrabold text-slate-800 leading-tight">{customAlert.title}</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{customAlert.message}</p>
                <div className="mt-5 flex justify-end gap-3">
                    <button onClick={() => setCustomAlert({...customAlert, isOpen: false})} className="px-4 py-2 text-xs font-bold text-slate-500 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">Batal</button>
                    <button onClick={() => { customAlert.onConfirm(); }} className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md rounded-xl transition-colors">
                        {customAlert.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  )
} 