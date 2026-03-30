'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
// Import Recharts untuk visualisasi data
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts'

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

// --- 2. HELPER UI ---
const getInitials = (name) => {
  if (!name) return '?'
  return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().substring(0, 2)
}

export default function ValidasiPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dataBansos, setDataBansos] = useState([])
  const [filteredData, setFilteredData] = useState([])
  
  // State Statistik
  const [stats, setStats] = useState({
    total: 0, perluValidasi: 0, disetujui: 0, ditolak: 0,
    pkh: 0, kip: 0, fakmis: 0 
  })

  // State Search & Filter
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('Pending') 
  const [filterProgram, setFilterProgram] = useState('Semua')
  
  // State Modal Detail
  const [selectedItem, setSelectedItem] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'bidang') { router.push('/'); return }

      fetchRealtimeData()
    }

    fetchData()

    const channel = supabase.channel('validasi-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pengajuan_bantuan' }, () => fetchRealtimeData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router])

  const fetchRealtimeData = async () => {
    const { data, error } = await supabase
      .from('pengajuan_bantuan')
      .select('*')
      .order('created_at', { ascending: false })

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
  }

  // --- LOGIKA FILTERING ---
  useEffect(() => {
    let result = dataBansos
    
    if (activeTab === 'Pending') {
      result = result.filter(d => d.status === 'Menunggu Validasi')
    } else {
      result = result.filter(d => d.status !== 'Menunggu Validasi')
    }

    if (filterProgram !== 'Semua') {
      result = result.filter(d => d.jenis_bantuan === filterProgram)
    }

    if (searchTerm) {
      result = result.filter(d => 
        d.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.nik.includes(searchTerm) ||
        (d.kabupaten_kota && d.kabupaten_kota.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }
    setFilteredData(result)
  }, [dataBansos, activeTab, searchTerm, filterProgram]) 

  const uniquePrograms = ['Semua', ...new Set(dataBansos.map(item => item.jenis_bantuan))]

  // --- DATA UNTUK GRAFIK (DIHITUNG OTOMATIS) ---
  const pieData = [
    { name: 'PKH', value: stats.pkh },
    { name: 'KIP', value: stats.kip },
    { name: 'FAKMIS', value: stats.fakmis }
  ]
  const PIE_COLORS = ['#4f46e5', '#06b6d4', '#a855f7'] 

  const barData = useMemo(() => {
    const cityCounts = {}
    dataBansos.forEach(item => {
      const city = item.kabupaten_kota || 'Belum Diatur'
      cityCounts[city] = (cityCounts[city] || 0) + 1
    })
    return Object.keys(cityCounts).map(city => ({
      name: city,
      Total: cityCounts[city]
    })).sort((a, b) => b.Total - a.Total) 
  }, [dataBansos])

  // --- FUNGSI UPDATE STATUS & KIRIM EMAIL ---
  const handleEditStatus = async (item, newStatus, alasan = null) => {
    if(!confirm(`Ubah status pengajuan ${item.nama_lengkap} menjadi ${newStatus}?`)) return
    
    try {
      // 1. Update Database
      const { error } = await supabase
        .from('pengajuan_bantuan')
        .update({ status: newStatus, alasan_penolakan: alasan })
        .eq('id', item.id)
      
      if (error) throw error

      // 2. Cari Email Operator Pembuat Data Ini
      const { data: operatorProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', item.user_id)
        .single()

      const emailOperator = operatorProfile?.email

      // 3. Panggil API Notifikasi Email
      if (emailOperator) {
        console.log("Mengirim email ke operator:", emailOperator)
        await fetch('/api/bidang/notify-operator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email_operator: emailOperator,
            nama_pemohon: item.nama_lengkap,
            jenis_bantuan: item.jenis_bantuan,
            status_verifikasi: newStatus,
            catatan: alasan || '-'
          })
        })
      } else {
        console.warn("Operator tidak memiliki email yang terdaftar.")
      }

      alert("Status berhasil diperbarui dan notifikasi telah dikirim ke Operator!")
      if (selectedItem) setSelectedItem(null) 
      
    } catch (err) {
      alert("Gagal memproses data: " + err.message)
    }
  }

  // --- FUNGSI UPDATE AKTIF/NONAKTIF ---
  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Aktif' ? 'Nonaktif' : 'Aktif'
    const msg = newStatus === 'Nonaktif' 
      ? "⚠️ PERINGATAN: Anda akan MENONAKTIFKAN penerima ini.\n\nArtinya: Bantuan untuk orang ini akan DIHENTIKAN sementara.\nLanjutkan?" 
      : "✅ MENGAKTIFKAN KEMBALI?\n\nPenerima ini akan kembali terdaftar sebagai penerima bantuan aktif.";
      
    if(!confirm(msg)) return;

    try {
        const { error } = await supabase
            .from('pengajuan_bantuan')
            .update({ status_penerima: newStatus })
            .eq('id', id)

        if(error) throw error;
    } catch (error) {
        alert("Gagal mengubah status: " + error.message)
    }
  }

  // --- FUNGSI CETAK LAPORAN ---
  const handlePrint = (item) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Laporan Validasi - ${item.nama_lengkap}</title>
          <style>
            @media print {
               @page { size: A4; margin: 2cm; }
               body { -webkit-print-color-adjust: exact; }
            }
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: auto; }
            h1 { font-size: 22px; margin-bottom: 5px; text-transform: uppercase; color: #111; border-bottom: 2px solid #000; padding-bottom: 15px; }
            .meta { font-size: 12px; color: #555; margin-bottom: 30px; font-family: monospace; }
            
            .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
            .field { margin-bottom: 12px; }
            .label { font-size: 10px; font-weight: bold; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
            .value { font-size: 14px; font-weight: bold; color: #000; border-bottom: 1px dashed #eee; padding-bottom: 3px; }
            
            .status-box { 
               display: inline-block; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; 
               background: ${item.status === 'Disetujui' ? '#dcfce7' : '#fee2e2'}; 
               color: ${item.status === 'Disetujui' ? '#166534' : '#991b1b'};
               border: 1px solid ${item.status === 'Disetujui' ? '#166534' : '#991b1b'};
            }
            
            .active-badge {
                font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 3px; margin-left: 5px;
                background: ${item.status_penerima === 'Nonaktif' ? '#f3f4f6' : '#e0e7ff'};
                color: ${item.status_penerima === 'Nonaktif' ? '#9ca3af' : '#4338ca'};
                text-transform: uppercase;
            }

            .images-section h3 { font-size: 14px; background: #f3f4f6; padding: 8px 12px; border-left: 4px solid #4f46e5; margin-bottom: 15px; }
            .images-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            .img-card { border: 1px solid #ddd; padding: 5px; page-break-inside: avoid; }
            .img-card p { font-size: 10px; text-align: center; margin: 0 0 5px 0; font-weight: bold; background: #eee; padding: 3px; }
            img { width: 100%; height: 200px; object-fit: cover; display: block; }
          </style>
        </head>
        <body>
          <h1>Detail Verifikasi Bantuan Sosial</h1>
          <p class="meta">ID DATA: ${item.id} | DICETAK: ${new Date().toLocaleDateString('id-ID')}</p>
          
          <div class="grid-info">
            <div class="col">
              <div class="field"><div class="label">Nama Lengkap</div><div class="value">${item.nama_lengkap}</div></div>
              <div class="field"><div class="label">NIK</div><div class="value">${item.nik}</div></div>
              <div class="field"><div class="label">Alamat Domisili</div><div class="value">${item.alamat}</div></div>
            </div>
            <div class="col">
              <div class="field"><div class="label">Jenis Bantuan</div><div class="value" style="color: #4f46e5;">${item.jenis_bantuan}</div></div>
              <div class="field"><div class="label">Kota/Kabupaten</div><div class="value">${item.kabupaten_kota || '-'}</div></div>
              <div class="field">
                <div class="label">Status Penerima</div>
                <div class="value" style="border:none; padding:0;">
                    <span class="status-box">${item.status}</span>
                    <span class="active-badge">${item.status_penerima || 'Aktif'}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="images-section">
             <h3>LAMPIRAN DOKUMEN FOTO</h3>
             <div class="images-grid">
                <div class="img-card"><p>FOTO KTP</p><img src="${item.foto_ktp || ''}" onerror="this.style.display='none'" /></div>
                <div class="img-card"><p>FOTO DIRI</p><img src="${item.foto_diri || ''}" onerror="this.style.display='none'" /></div>
                <div class="img-card"><p>FOTO RUMAH</p><img src="${item.foto_rumah || ''}" onerror="this.style.display='none'" /></div>
                <div class="img-card"><p>FOTO PEKERJAAN</p><img src="${item.foto_pekerjaan || ''}" onerror="this.style.display='none'" /></div>
             </div>
          </div>

          <script>
             window.onload = function() {
                setTimeout(function() { window.print(); }, 1500); 
             }
          </script>
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
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm border border-gray-600 shadow-inner">V</div>
          <div><h1 className="text-lg font-bold text-white leading-tight tracking-tight">Bidang Provinsi</h1><p className="text-xs text-gray-400 font-medium">Dashboard Analytics</p></div>
        </div>
        <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="text-xs font-bold text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-5 py-2.5 rounded-lg transition-all">LOGOUT</button>
      </nav>

      <main className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        
        {/* STATISTIK UTAMA */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard title="Total Masuk" count={stats.total} color="bg-blue-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
          <StatCard title="Perlu Validasi" count={stats.perluValidasi} color="bg-amber-500" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <StatCard title="Disetujui" count={stats.disetujui} color="bg-emerald-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <StatCard title="Ditolak" count={stats.ditolak} color="bg-rose-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        </div>

        {/* --- VISUALISASI GRAFIK ANALYTICS --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Pie Chart: Sebaran Program */}
           <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col items-center">
              <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4 w-full border-b border-gray-100 pb-2">Distribusi Program</h3>
              <div className="w-full h-48">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                          {pieData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                       </Pie>
                       <RechartsTooltip formatter={(value) => [`${value} Orang`, 'Total']} />
                       <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                 </ResponsiveContainer>
              </div>
           </div>

           {/* Bar Chart: Sebaran per Kota/Kabupaten */}
           <div className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Profil Pengajuan per Kabupaten/Kota</h3>
              <div className="w-full h-48">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                       <XAxis dataKey="name" tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                       <YAxis tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                       <RechartsTooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                       <Bar dataKey="Total" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </div>

        {/* MAIN TABLE */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden min-h-[600px]">
          <div className="px-8 pt-2 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center bg-white sticky top-0 z-10 gap-4">
            <div className="flex space-x-10 w-full md:w-auto">
              <button onClick={() => setActiveTab('Pending')} className={`py-6 text-sm font-bold tracking-wide transition-all border-b-[3px] ${activeTab === 'Pending' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                MENUNGGU VALIDASI <span className="ml-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] align-top">{stats.perluValidasi}</span>
              </button>
              <button onClick={() => setActiveTab('Arsip')} className={`py-6 text-sm font-bold tracking-wide transition-all border-b-[3px] ${activeTab === 'Arsip' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                ARSIP DATA PENERIMA
              </button>
            </div>
            
            <div className="pb-2 md:pb-0 w-full md:w-auto flex gap-3 items-center">
               <div className="relative">
                    <select 
                      value={filterProgram} 
                      onChange={(e) => setFilterProgram(e.target.value)}
                      className="appearance-none bg-gray-50 border border-gray-200 hover:border-gray-400 px-4 py-2.5 pr-8 rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all cursor-pointer"
                    >
                      {uniquePrograms.map((prog, idx) => (
                        <option key={idx} value={prog}>{prog === 'Semua' ? 'Semua Program' : prog}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-3 pointer-events-none text-gray-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
               </div>

               <div className="relative flex-1">
                 <input type="text" placeholder="Cari NIK / Nama..." className="pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 outline-none w-full md:w-64 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                 <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
               </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-bold tracking-widest border-b border-gray-100">
                <tr>
                  <th className="px-8 py-5 w-1/4">Identitas Pemohon</th>
                  <th className="px-8 py-5">Jenis Bantuan</th>
                  <th className="px-8 py-5">Status Validasi</th>
                  <th className="px-8 py-5">Status Keaktifan</th>
                  <th className="px-8 py-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredData.length > 0 ? (
                    filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="px-8 py-5 align-middle">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-indigo-200">{getInitials(item.nama_lengkap)}</div>
                            <div>
                            <div className="text-sm font-bold text-gray-900 leading-none">{item.nama_lengkap}</div>
                            <div className="text-xs text-gray-400 font-mono mt-1.5">{item.nik}</div>
                            <div className="text-[10px] text-gray-400 mt-1">{new Date(item.created_at).toLocaleDateString('id-ID')}</div>
                            </div>
                        </div>
                        </td>
                        <td className="px-8 py-5 align-middle">
                            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200 uppercase tracking-wide">{item.jenis_bantuan}</span>
                            <div className="mt-1 text-xs text-gray-500 font-medium">{item.kabupaten_kota || '-'}</div>
                        </td>
                        <td className="px-8 py-5 align-middle">
                        {item.status === 'Menunggu Validasi' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Menunggu Validasi</span>
                        ) : item.status === 'Disetujui' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Disetujui</span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Perlu Revisi</span>
                        )}
                        </td>
                        
                        <td className="px-8 py-5 align-middle">
                            {item.status === 'Disetujui' ? (
                            <button 
                                onClick={() => handleToggleStatus(item.id, item.status_penerima || 'Aktif')}
                                className="group flex items-center gap-3 focus:outline-none"
                                title={item.status_penerima === 'Nonaktif' ? 'Klik untuk Mengaktifkan' : 'Klik untuk Mematikan'}
                            >
                                <div className={`w-11 h-6 flex items-center rounded-full p-1 duration-300 ease-in-out ${ (item.status_penerima || 'Aktif') === 'Aktif' ? 'bg-indigo-500' : 'bg-gray-300' }`}>
                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${ (item.status_penerima || 'Aktif') === 'Aktif' ? 'translate-x-5' : '' }`}></div>
                                </div>
                                <span className={`text-xs font-bold uppercase transition-colors ${(item.status_penerima || 'Aktif') === 'Aktif' ? 'text-indigo-600' : 'text-gray-400'}`}>
                                    {(item.status_penerima || 'Aktif') === 'Aktif' ? 'Aktif' : 'Nonaktif'}
                                </span>
                            </button>
                            ) : (
                            <span className="text-gray-300 text-xs italic opacity-50">Menunggu Persetujuan</span>
                            )}
                        </td>
                        
                        <td className="px-8 py-5 text-right align-middle">
                            <div className="flex justify-end gap-2">
                            {item.status === 'Menunggu Validasi' ? (
                                <>
                                <button onClick={() => handleEditStatus(item, 'Disetujui')} className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all border border-emerald-100 shadow-sm" title="Setujui">✓</button>
                                <button onClick={() => {
                                    const alasan = prompt("Masukkan alasan penolakan:")
                                    if(alasan) handleEditStatus(item, 'Perlu Revisi', alasan)
                                }} className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all border border-rose-100 shadow-sm" title="Tolak">✕</button>
                                </>
                            ) : null}
                            <button onClick={() => setSelectedItem(item)} className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-900 hover:text-white transition-colors">Lihat Detail</button>
                            </div>
                        </td>
                    </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan="5" className="px-8 py-10 text-center text-gray-400 text-sm italic">
                            Tidak ada data yang cocok dengan filter atau pencarian.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* --- MODAL DETAIL LENGKAP --- */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm">
           <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-fade-in-up border border-gray-100 shadow-2xl">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-5 flex justify-between items-center z-10">
                 <div>
                    <h3 className="text-xl font-extrabold text-gray-900">Detail Pengajuan</h3>
                    <p className="text-xs text-gray-500 font-mono mt-1">ID: {selectedItem.id}</p>
                 </div>
                 <div className="flex gap-3">
                    <button onClick={() => handlePrint(selectedItem)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-2 transition">
                       🖨️ Cetak Data
                    </button>
                    <button onClick={() => setSelectedItem(null)} className="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-200 transition">✕</button>
                 </div>
              </div>
              <div className="p-8 space-y-8">
                 {/* Info Dasar */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nama Lengkap</p><p className="text-lg font-bold text-gray-900">{selectedItem.nama_lengkap}</p></div>
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">NIK</p><p className="text-lg font-mono font-medium text-gray-900">{selectedItem.nik}</p></div>
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Jenis Bantuan</p><p className="text-sm font-bold text-gray-900 bg-white inline-block px-3 py-1 rounded border border-gray-200 mt-1">{selectedItem.jenis_bantuan}</p></div>
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status Penerima</p>
                        <p className={`text-sm font-bold mt-1 inline-flex items-center gap-2 ${selectedItem.status_penerima === 'Nonaktif' ? 'text-gray-400' : 'text-indigo-600'}`}>
                            <span className={`w-2 h-2 rounded-full ${selectedItem.status_penerima === 'Nonaktif' ? 'bg-gray-400' : 'bg-indigo-600'}`}></span>
                            {selectedItem.status_penerima || 'Aktif'}
                        </p>
                    </div>
                    <div className="col-span-2"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Alamat</p><p className="text-sm font-medium text-gray-700 mt-1 leading-relaxed">{selectedItem.alamat}</p></div>
                 </div>

                 {/* Galeri Foto (KLIK UNTUK BUKA) */}
                 <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-4 border-l-4 border-indigo-500 pl-3">Bukti Lampiran (Klik untuk perbesar)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       {[{title: 'KTP', src: selectedItem.foto_ktp}, {title: 'Diri', src: selectedItem.foto_diri}, {title: 'Rumah', src: selectedItem.foto_rumah}, {title: 'Pekerjaan', src: selectedItem.foto_pekerjaan}].map((foto, idx) => (
                          <div 
                             key={idx} 
                             onClick={() => foto.src && window.open(foto.src, '_blank')}
                             className="group relative aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:shadow-lg transition-all"
                          >
                             {foto.src ? (
                                <img src={foto.src} alt={foto.title} className="w-full h-full object-cover transition duration-500 group-hover:scale-110" />
                             ) : (
                                <div className="flex items-center justify-center h-full text-xs text-gray-400">No Image</div>
                             )}
                             <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                <span className="text-white text-xs font-bold">🔍 Buka {foto.title}</span>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
              
              {/* Footer Actions */}
              {selectedItem.status === 'Menunggu Validasi' && (
                 <div className="sticky bottom-0 bg-white border-t border-gray-100 px-8 py-5 flex justify-end gap-3 z-10">
                    <button onClick={() => {
                       const alasan = prompt("Masukkan alasan penolakan:")
                       if(alasan) handleEditStatus(selectedItem, 'Perlu Revisi', alasan)
                    }} className="px-6 py-2.5 rounded-xl border border-rose-200 text-rose-600 font-bold text-sm hover:bg-rose-50 transition">Tolak Pengajuan</button>
                    <button onClick={() => handleEditStatus(selectedItem, 'Disetujui')} className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition">Setujui Sekarang</button>
                 </div>
              )}
           </div>
        </div>
      )}

    </div>
  )
} 