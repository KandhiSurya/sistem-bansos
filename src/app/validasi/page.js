'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import toast from 'react-hot-toast'

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

const getStatusBadge = (status) => {
  switch (status) {
    case 'Disetujui': return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span> Disetujui</span>
    case 'Perlu Revisi': return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span> Perlu Revisi</span>
    default: return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-1.5"></span> Menunggu</span>
  }
}

const getActiveBadge = (isActive) => {
    if (isActive === 'Aktif' || isActive === true || isActive === null || isActive === undefined) {
        return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Aktif</span>
    } else {
        return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300">Non-Aktif</span>
    }
}

export default function ValidasiPage() {
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [dataBansos, setDataBansos] = useState([])
  const [currentUserEmail, setCurrentUserEmail] = useState('') 
  
  const [stats, setStats] = useState({ total: 0, perluValidasi: 0, disetujui: 0, ditolak: 0, pkh: 0, kip: 0, fakmis: 0 })
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('Pending') 
  const [filterProgram, setFilterProgram] = useState('Semua')
  const [filterWaktu, setFilterWaktu] = useState('Semua') 
  const [selectedItem, setSelectedItem] = useState(null)
  
  const [assignedProgram, setAssignedProgram] = useState('')
  const [customAlert, setCustomAlert] = useState({ isOpen: false, title: '', message: '', type: 'confirm', danger: false, confirmLabel: 'OK', onConfirm: null })

  const fetchRealtimeData = async () => {
    const { data, error } = await supabase.from('pengajuan_bantuan').select('*').order('created_at', { ascending: false })
    if (!error && data) {
      setDataBansos(data)
      setStats({
        total: data.length, perluValidasi: data.filter(d => d.status === 'Menunggu Validasi').length,
        disetujui: data.filter(d => d.status === 'Disetujui').length, ditolak: data.filter(d => d.status === 'Perlu Revisi').length,
        pkh: data.filter(d => d.jenis_bantuan === 'PKH').length, kip: data.filter(d => d.jenis_bantuan === 'KIP').length, fakmis: data.filter(d => d.jenis_bantuan === 'FAKMIS').length
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      
      setCurrentUserEmail(user.email) 

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'bidang') { router.push('/'); return }
      fetchRealtimeData()
    }
    fetchData()
    const channel = supabase.channel('validasi-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'pengajuan_bantuan' }, () => { fetchRealtimeData(); toast('Pengajuan baru masuk dari Operator!', { icon: '🔔' }) }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [router])

  const catatLog = async (aksi, keterangan) => {
     try {
        await supabase.from('log_aktivitas').insert([{ 
           email_pengguna: currentUserEmail, role: 'Bidang', aksi: aksi, keterangan: keterangan 
        }])
     } catch (error) {}
  }

  const uniquePrograms = ['Semua', ...new Set(dataBansos.map(item => item.jenis_bantuan))]

  const filteredData = useMemo(() => {
    return dataBansos.filter(item => {
      if (activeTab === 'Pending' && item.status !== 'Menunggu Validasi') return false;
      if (activeTab !== 'Pending' && item.status === 'Menunggu Validasi') return false;
      if (filterProgram !== 'Semua' && item.jenis_bantuan !== filterProgram) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!((item.nama_lengkap && item.nama_lengkap.toLowerCase().includes(term)) || (item.nik && item.nik.includes(term)) || (item.kabupaten_kota && item.kabupaten_kota.toLowerCase().includes(term)))) return false;
      }
      if (filterWaktu !== 'Semua') {
        const itemDate = new Date(item.created_at); const now = new Date();
        if (filterWaktu === '7 Hari Terakhir') { const past7 = new Date(); past7.setDate(now.getDate() - 7); if (itemDate < past7) return false;
        } else if (filterWaktu === 'Bulan Ini') { if (itemDate.getMonth() !== now.getMonth() || itemDate.getFullYear() !== now.getFullYear()) return false;
        } else if (filterWaktu === 'Bulan Lalu') { let lastMonth = now.getMonth() - 1; let year = now.getFullYear(); if (lastMonth < 0) { lastMonth = 11; year -= 1; } if (itemDate.getMonth() !== lastMonth || itemDate.getFullYear() !== year) return false;
        } else if (filterWaktu === 'Tahun Ini') { if (itemDate.getFullYear() !== now.getFullYear()) return false; }
      }
      return true;
    });
  }, [dataBansos, activeTab, searchTerm, filterProgram, filterWaktu]);

  const pieData = [{ name: 'PKH', value: stats.pkh }, { name: 'KIP', value: stats.kip }, { name: 'FAKMIS', value: stats.fakmis }]
  const PIE_COLORS = [DINSOS_NAVY, DINSOS_RED, '#f59e0b'] 

  const barData = useMemo(() => {
    const cityCounts = {}
    dataBansos.forEach(item => { cityCounts[item.kabupaten_kota || 'Belum Diatur'] = (cityCounts[item.kabupaten_kota || 'Belum Diatur'] || 0) + 1 })
    return Object.keys(cityCounts).map(city => ({ name: city, Total: cityCounts[city] })).sort((a, b) => b.Total - a.Total) 
  }, [dataBansos])

  const handleExportExcel = async () => {
    if (filteredData.length === 0) { toast.error("Tidak ada data untuk diexport dengan filter saat ini!"); return }
    toast.success("Mempersiapkan Laporan Excel...")
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Laporan Validasi')
    worksheet.columns = [
      { header: 'No', key: 'no', width: 5 }, { header: 'Tanggal Input', key: 'tanggal', width: 15 }, { header: 'NIK', key: 'nik', width: 20 }, 
      { header: 'Nama Lengkap', key: 'nama', width: 25 }, { header: 'Program', key: 'bantuan', width: 18 }, { header: 'Kabupaten/Kota', key: 'kota', width: 20 },
      { header: 'Alamat', key: 'alamat', width: 40 }, { header: 'Status Validasi', key: 'status', width: 18 }, { header: 'Keaktifan', key: 'aktif', width: 15 }, 
      { header: 'Catatan', key: 'catatan', width: 30 }, { header: 'Link Foto KTP', key: 'ktp', width: 25 }, { header: 'Link Foto Diri', key: 'diri', width: 25 },
      { header: 'Link Foto Rumah', key: 'rumah', width: 25 }, { header: 'Link Foto Pekerjaan', key: 'pekerjaan', width: 25 }
    ]
    worksheet.getRow(1).font = { bold: true }; worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

    filteredData.forEach((item, index) => {
      worksheet.addRow({
        no: index + 1, tanggal: new Date(item.created_at).toLocaleDateString('id-ID'), nik: item.nik, nama: item.nama_lengkap, bantuan: item.jenis_bantuan,
        kota: item.kabupaten_kota || '-', alamat: item.alamat, status: item.status, aktif: item.status_penerima || 'Aktif', catatan: item.alasan_penolakan || '-',
        ktp: item.foto_ktp ? { text: 'Buka Foto KTP', hyperlink: item.foto_ktp } : 'Tidak Ada', diri: item.foto_diri ? { text: 'Buka Foto Diri', hyperlink: item.foto_diri } : 'Tidak Ada',
        rumah: item.foto_rumah ? { text: 'Buka Foto Rumah', hyperlink: item.foto_rumah } : 'Tidak Ada', pekerjaan: item.foto_pekerjaan ? { text: 'Buka Foto Pekerjaan', hyperlink: item.foto_pekerjaan } : 'Tidak Ada'
      })
    })

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            ['ktp','diri','rumah','pekerjaan'].forEach(k => { row.getCell(k).font = row.getCell(k).value?.hyperlink ? { color: { argb: 'FF0563C1' }, underline: true } : {} })
        }
    });
    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), `Laporan_Bidang_${activeTab}_${filterProgram}_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`)
  }

  const executeEditStatus = async (item, newStatus, alasan = null, newProgram = null) => {
    const toastId = toast.loading("Memperbarui status...")
    try {
      const updateData = { status: newStatus, alasan_penolakan: alasan }
      if (newProgram) updateData.jenis_bantuan = newProgram 

      const { error } = await supabase.from('pengajuan_bantuan').update(updateData).eq('id', item.id)
      if (error) throw error
      
      const { data: operatorProfile } = await supabase.from('profiles').select('email').eq('id', item.user_id).single()
      if (operatorProfile?.email) {
        await fetch('/api/bidang/notify-operator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email_operator: operatorProfile.email, nama_pemohon: item.nama_lengkap, jenis_bantuan: newProgram || item.jenis_bantuan, status_verifikasi: newStatus, catatan: alasan || '-' }) })
      }
      toast.success("Status diperbarui dan notifikasi terkirim!", { id: toastId })
      
      await catatLog("Validasi Data", `Mengubah status pengajuan atas nama ${item.nama_lengkap} (NIK: ${item.nik}) menjadi ${newStatus}.${newProgram ? ' Program: ' + newProgram : ''}${alasan ? ' Catatan: ' + alasan : ''}`)
      
      await fetchRealtimeData() 
      if (selectedItem) setSelectedItem(null) 
    } catch (err) { toast.error("Gagal memproses data: " + err.message, { id: toastId }) }
  }

  const executeToggleStatus = async (item, newStatus) => {
      const toastId = toast.loading("Mengubah status keaktifan...");
      try {
          const { error } = await supabase.from('pengajuan_bantuan').update({ status_penerima: newStatus }).eq('id', item.id);
          if(error) throw error;
          toast.success(`Berhasil di-${newStatus.toLowerCase()}kan!`, { id: toastId }); 
          await catatLog("Ubah Status Aktif", `Mengubah status keaktifan penerima bansos NIK ${item.nik} menjadi ${newStatus}.`)
          await fetchRealtimeData();
      } catch (error) { toast.error("Gagal mengubah status: " + error.message, { id: toastId }); }
  }

  const executeDeleteBansos = async (item) => {
    const toastId = toast.loading("Menghapus data dan berkas...");
    try {
      const filesToDelete = []
      const extractName = (url) => url ? url.split('/').pop() : null
      if (item.foto_ktp) filesToDelete.push(extractName(item.foto_ktp)); if (item.foto_diri) filesToDelete.push(extractName(item.foto_diri))
      if (item.foto_pekerjaan) filesToDelete.push(extractName(item.foto_pekerjaan)); if (item.foto_rumah) filesToDelete.push(extractName(item.foto_rumah))

      if (filesToDelete.length > 0) await supabase.storage.from('dokumen_bansos').remove(filesToDelete)
      const { error: deleteError } = await supabase.from('pengajuan_bantuan').delete().eq('id', item.id)
      if (deleteError) throw deleteError

      toast.success("Data berhasil dihapus bersih.", { id: toastId })
      await catatLog("Hapus Data Bansos", `Menghapus permanen pengajuan NIK: ${item.nik} atas nama ${item.nama_lengkap}`)
      await fetchRealtimeData()
    } catch (error) { toast.error("Gagal hapus data: " + error.message, { id: toastId }) }
  }

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
      
      {/* SIDEBAR */}
      {/* SIDEBAR MODERN VALIDASI (MINI-COLLAPSE) */}
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
          <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className={`w-full flex items-center ${isSidebarOpen ? 'justify-center gap-2 px-4' : 'justify-center px-0'} py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100`} title="Keluar Sistem">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            {isSidebarOpen && <span className="truncate">Keluar</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-extrabold text-slate-800">{activeTab === 'Pending' ? 'Menunggu Validasi Provinsi' : 'Arsip Keseluruhan Data'}</h2>
          <button onClick={handleExportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Unduh Rekap Excel</button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* STATS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <StatCard title="Total Masuk" count={stats.total} colorClass="bg-blue-900" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
            <StatCard title="Perlu Validasi" count={stats.perluValidasi} colorClass="bg-amber-500" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            <StatCard title="Disetujui" count={stats.disetujui} colorClass="bg-emerald-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            <StatCard title="Ditolak / Revisi" count={stats.ditolak} colorClass="bg-rose-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          </div>

          {/* CHARTS CONTAINER */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
             <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
               <h3 className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Distribusi Program</h3>
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
               <h3 className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Profil Pengajuan per Kabupaten/Kota</h3>
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

          {/* TABEL AREA */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4">
               <div className="flex gap-3 items-center">
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Program:</span>
                    <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)} className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer">{uniquePrograms.map((prog, idx) => <option key={idx} value={prog}>{prog === 'Semua' ? 'Semua Program' : prog}</option>)}</select>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Waktu:</span>
                    <select value={filterWaktu} onChange={(e) => setFilterWaktu(e.target.value)} className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer">
                        <option value="Semua">Semua Waktu</option><option value="7 Hari Terakhir">7 Hari Terakhir</option><option value="Bulan Ini">Bulan Ini</option><option value="Bulan Lalu">Bulan Lalu</option><option value="Tahun Ini">Tahun Ini</option>
                    </select>
                 </div>
               </div>
               <div className="relative w-full md:w-56">
                 <input type="text" placeholder="Cari NIK / Nama..." className="pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:border-blue-900 outline-none w-full transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
               </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200">
                  <tr><th className="px-6 py-4">Identitas Pemohon</th><th className="px-6 py-4">Bantuan & Wilayah</th><th className="px-6 py-4">Status Validasi</th><th className="px-6 py-4">Status Keaktifan</th><th className="px-6 py-4 text-right">Aksi Data</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.length > 0 ? (
                      filteredData.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 align-middle">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs border border-slate-200">{getInitials(item.nama_lengkap)}</div>
                                <div><div className="text-sm font-bold text-slate-800">{item.nama_lengkap}</div><div className="text-[11px] text-slate-500 font-mono mt-0.5">{item.nik}</div></div>
                            </div>
                          </td>
                          <td className="px-6 py-4 align-middle"><span className="text-[11px] font-black text-blue-900 uppercase">{item.jenis_bantuan}</span><div className="mt-0.5 text-[11px] font-medium text-slate-500">{item.kabupaten_kota || '-'}</div></td>
                          <td className="px-6 py-4 align-middle">{getStatusBadge(item.status)}</td>
                          <td className="px-6 py-4 align-middle">
                              {item.status === 'Disetujui' ? (
                              <button onClick={() => {
                                      const newStatus = (item.status_penerima || 'Aktif') === 'Aktif' ? 'Nonaktif' : 'Aktif';
                                      setCustomAlert({ isOpen: true, title: 'Ubah Keaktifan?', message: "Apakah Anda yakin ingin mengganti status keaktifan warga ini?", type: 'confirm', onConfirm: () => { setCustomAlert({ isOpen: false }); executeToggleStatus(item, newStatus); } })
                                  }} className="group flex items-center gap-2 focus:outline-none">
                                  <div className={`w-9 h-5 flex items-center rounded-full p-1 duration-300 ease-in-out ${ (item.status_penerima || 'Aktif') === 'Aktif' ? 'bg-blue-900' : 'bg-slate-300' }`}><div className={`bg-white w-3 h-3 rounded-full shadow-sm transform duration-300 ease-in-out ${ (item.status_penerima || 'Aktif') === 'Aktif' ? 'translate-x-4' : '' }`}></div></div>
                                  <span className="text-[10px] font-bold uppercase text-slate-500">{(item.status_penerima || 'Aktif')}</span>
                              </button>
                              ) : (<span className="text-slate-300 text-[11px] italic">Menunggu</span>)}
                          </td>
                          <td className="px-6 py-4 text-right align-middle">
                             <div className="flex justify-end gap-2">
                                <button onClick={() => { setSelectedItem(item); setAssignedProgram(item.jenis_bantuan === 'Belum Ditentukan' ? '' : item.jenis_bantuan); }} className="px-3 py-1.5 rounded-md border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">Review Data</button>
                                <button onClick={() => {
                                    setCustomAlert({
                                        isOpen: true, title: 'Hapus Berkas Pengajuan', message: `Yakin menghapus permanen data atas nama ${item.nama_lengkap}? Berkas gambar di storage cloud akan ikut dibersihkan.`, type: 'confirm', danger: true, confirmLabel: 'Ya, Hapus Bersih',
                                        onConfirm: () => { setCustomAlert({isOpen: false}); executeDeleteBansos(item); }
                                    })
                                }} className="text-red-600 text-[11px] font-bold bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors border border-transparent hover:border-red-200">Hapus</button>
                             </div>
                          </td>
                      </tr>
                      ))
                  ) : (<tr><td colSpan="5" className="px-6 py-10 text-center text-slate-400 text-sm italic">Tidak ada data.</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* --- MODAL DETAIL REVIEW --- */}
      {selectedItem && (
        <div className="fixed inset-0 z-[40] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
           <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
              <div className="px-6 py-4 flex justify-between items-center border-b border-slate-100 shrink-0">
                 <div><h3 className="text-lg font-extrabold text-slate-800">Verifikasi Berkas Calon Penerima</h3></div>
                 <button onClick={() => setSelectedItem(null)} className="w-8 h-8 text-slate-400 text-xl">&times;</button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Identitas Kependudukan</p>
                      <p className="text-xl font-bold text-slate-800">{selectedItem.nama_lengkap}</p>
                      <p className="text-sm font-mono text-slate-500 mt-1">NIK: {selectedItem.nik} <span className="mx-1 text-slate-300">|</span> KK: {selectedItem.no_kk || '-'}</p>
                    </div>
                    
                    <div className="row-span-2">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Profil Sosial Ekonomi</p>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-1 space-y-2">
                        <div className="flex justify-between border-b border-slate-200 pb-1.5"><span className="text-xs text-slate-500">Pekerjaan Utama</span><span className="text-xs font-bold text-slate-800">{selectedItem.pekerjaan || '-'}</span></div>
                        <div className="flex justify-between border-b border-slate-200 pb-1.5"><span className="text-xs text-slate-500">Pendapatan bulanan</span><span className="text-xs font-bold text-slate-800">{selectedItem.pendapatan || '-'}</span></div>
                        <div className="flex justify-between"><span className="text-xs text-slate-500">Jumlah Tanggungan</span><span className="text-xs font-bold text-slate-800">{selectedItem.tanggungan !== null ? `${selectedItem.tanggungan} Orang` : '-'}</span></div>
                      </div>
                    </div>
                    
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ketetapan Program Bantuan</p>
                        {selectedItem.status === 'Menunggu Validasi' ? (
                            <select value={assignedProgram} onChange={(e) => setAssignedProgram(e.target.value)} className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-blue-900 bg-blue-50 outline-none">
                                <option value="">-- Tentukan Program Bantuan --</option><option value="PKH">PKH</option><option value="KIP">KIP</option><option value="FAKMIS">FAKMIS</option>
                            </select>
                        ) : (<p className="text-sm font-bold text-blue-900 uppercase inline-block border border-blue-200 bg-blue-50 px-2 py-0.5 rounded mt-1">{selectedItem.jenis_bantuan}</p>)}
                    </div>
                    <div className="col-span-2"><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Alamat Lengkap Rumah</p><p className="text-sm text-slate-700 leading-snug">{selectedItem.alamat}</p></div>
                 </div>

                 <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Berkas Pendukung Lapangan</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       {[{title: 'KTP', src: selectedItem.foto_ktp}, {title: 'Diri', src: selectedItem.foto_diri}, {title: 'Rumah', src: selectedItem.foto_rumah}, {title: 'Pekerjaan', src: selectedItem.foto_pekerjaan}].map((foto, idx) => (
                          <div key={idx} onClick={() => foto.src && window.open(foto.src, '_blank')} className="group relative h-32 bg-slate-50 rounded-lg overflow-hidden border border-slate-200 cursor-pointer">
                             {foto.src ? <img src={foto.src} alt={foto.title} className="w-full h-full object-cover transition-all group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-slate-400 text-xs">{foto.title} Kosong</div>}
                             <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><span className="text-white text-[10px] font-bold uppercase">Lihat Ukuran Asli</span></div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
              
              {selectedItem.status === 'Menunggu Validasi' && (
                 <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-end gap-3 shrink-0">
                    <button onClick={() => {
                        setCustomAlert({
                            isOpen: true, 
                            title: 'Tolak & Revisi', 
                            message: "Berikan alasan mengapa berkas warga ini ditolak:", 
                            type: 'prompt', 
                            danger: true, 
                            confirmLabel: 'Kirim Penolakan', // <--- TEKS KEMBALI MUNCUL
                            onConfirm: (alasan) => { 
                                if(!alasan || alasan.trim() === "") { toast.error("Alasan wajib diisi!"); return false; } 
                                setCustomAlert(prev => ({ ...prev, isOpen: false })); // <--- MENUTUP POP-UP
                                executeEditStatus(selectedItem, 'Perlu Revisi', alasan, null); 
                            }
                        })
                    }} className="px-4 py-2 rounded-lg text-rose-600 font-bold text-xs border border-rose-200 hover:bg-rose-50 transition">Tolak (Revisi)</button>
                    
                    <button onClick={() => {
                        if (!assignedProgram) { toast.error("Wajib tentukan Program Bantuan terlebih dahulu!"); return; }
                        setCustomAlert({ 
                            isOpen: true, 
                            title: 'Setujui Pengajuan', 
                            message: `Warga dimasukkan ke program ${assignedProgram}. Lanjutkan?`, 
                            type: 'confirm', 
                            confirmLabel: 'Ya, Setujui', // <--- TEKS KEMBALI MUNCUL
                            onConfirm: () => { 
                                setCustomAlert(prev => ({ ...prev, isOpen: false })); // <--- MENUTUP POP-UP
                                executeEditStatus(selectedItem, 'Disetujui', null, assignedProgram); 
                            } 
                        })
                    }} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition">Setujui Pengajuan</button>
                 </div>
              )}
           </div> 
        </div>
      )}

      {/* CUSTOM ALERT COMPONENT */}
      {customAlert.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
                <h3 className="text-lg font-extrabold text-slate-800">{customAlert.title}</h3>
                <p className="text-sm text-slate-600 mt-2">{customAlert.message}</p>
                {customAlert.type === 'prompt' && <textarea id="custom-alert-prompt" rows="3" className="w-full mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Ketik alasan..."></textarea>}
                <div className="mt-5 flex justify-end gap-3">
                    <button onClick={() => setCustomAlert({isOpen:false})} className="px-4 py-2 text-xs font-bold text-slate-500 rounded-xl border border-slate-200">Batal</button>
                    <button onClick={() => {
                        if (customAlert.type === 'prompt') { const val = document.getElementById('custom-alert-prompt').value; customAlert.onConfirm(val); } else { customAlert.onConfirm(); }
                    }} className="px-4 py-2 text-xs font-bold text-white bg-blue-900 rounded-xl">{customAlert.confirmLabel}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
} 