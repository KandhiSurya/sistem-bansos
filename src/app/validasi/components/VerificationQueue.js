'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { read, utils } from 'xlsx'
import { supabase } from '@/lib/supabaseClient'
import { KOORDINAT_JATIM, hitungStatistikPerWilayah } from '@/utils/mapHelpers'
import { getDirectImageUrl } from '@/utils/imageHelpers'


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

export default function VerificationQueue({
  dataBansos,
  activeTab,
  fetchRealtimeData,
  catatLog,
  currentUserEmail,
  userProfile,
  setActiveTab,
  exportExcelTrigger,
  setExportExcelTrigger
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterProgram, setFilterProgram] = useState('Semua')
  const [filterWaktu, setFilterWaktu] = useState('')
  const [filterWilayah, setFilterWilayah] = useState('Semua')
  const [filterKeaktifan, setFilterKeaktifan] = useState('Semua')
  const [filterPendapatan, setFilterPendapatan] = useState('Semua')
  const [selectedItem, setSelectedItem] = useState(null)
  const [assignedProgram, setAssignedProgram] = useState('')

  // Local Confirm Dialog
  const [customAlert, setCustomAlert] = useState({ isOpen: false, title: '', message: '', type: 'confirm', danger: false, confirmLabel: 'OK', onConfirm: null })

  // GIS Leaflet States
  const [leafletLoaded, setLeafletLoaded] = useState(false)
  const [mapInstance, setMapInstance] = useState(null)
  const mapRef = useRef(null)

  const uniquePrograms = useMemo(() => {
    return ['Semua', ...new Set(dataBansos.map(item => item.jenis_bantuan))]
  }, [dataBansos])

  const uniqueWilayah = useMemo(() => {
    return ['Semua', ...new Set(dataBansos.map(item => item.kabupaten_kota).filter(Boolean))]
  }, [dataBansos])

  const filteredData = useMemo(() => {
    return dataBansos.filter(item => {
      if (activeTab === 'Pending' && item.status !== 'Menunggu Validasi') return false;
      if (activeTab !== 'Pending' && item.status !== 'Disetujui') return false;
      if (filterProgram !== 'Semua' && item.jenis_bantuan !== filterProgram) return false;
      if (filterWilayah !== 'Semua' && item.kabupaten_kota !== filterWilayah) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!((item.nama_lengkap && item.nama_lengkap.toLowerCase().includes(term)) || (item.nik && item.nik.includes(term)) || (item.kabupaten_kota && item.kabupaten_kota.toLowerCase().includes(term)))) return false;
      }
      if (filterWaktu) {
        const itemLocalDate = new Date(item.created_at);
        const year = itemLocalDate.getFullYear();
        const month = String(itemLocalDate.getMonth() + 1).padStart(2, '0');
        const day = String(itemLocalDate.getDate()).padStart(2, '0');
        const itemDateString = `${year}-${month}-${day}`;
        if (itemDateString !== filterWaktu) return false;
      }
      if (activeTab !== 'Pending') {
        if (filterKeaktifan !== 'Semua') {
          const itemActive = item.status_penerima || 'Aktif';
          if (itemActive !== filterKeaktifan) return false;
        }
        if (filterPendapatan !== 'Semua') {
          if (item.pendapatan !== filterPendapatan) return false;
        }
      }
      return true;
    });
  }, [dataBansos, activeTab, searchTerm, filterProgram, filterWaktu, filterWilayah, filterKeaktifan, filterPendapatan]);

  const dataForMap = useMemo(() => {
    return dataBansos.filter(item => {
      if (activeTab === 'Pending' && item.status !== 'Menunggu Validasi') return false;
      if (activeTab !== 'Pending' && item.status !== 'Disetujui') return false;
      if (filterProgram !== 'Semua' && item.jenis_bantuan !== filterProgram) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!((item.nama_lengkap && item.nama_lengkap.toLowerCase().includes(term)) || (item.nik && item.nik.includes(term)) || (item.kabupaten_kota && item.kabupaten_kota.toLowerCase().includes(term)))) return false;
      }
      if (filterWaktu) {
        const itemLocalDate = new Date(item.created_at);
        const year = itemLocalDate.getFullYear();
        const month = String(itemLocalDate.getMonth() + 1).padStart(2, '0');
        const day = String(itemLocalDate.getDate()).padStart(2, '0');
        const itemDateString = `${year}-${month}-${day}`;
        if (itemDateString !== filterWaktu) return false;
      }
      if (activeTab !== 'Pending') {
        if (filterKeaktifan !== 'Semua') {
          const itemActive = item.status_penerima || 'Aktif';
          if (itemActive !== filterKeaktifan) return false;
        }
        if (filterPendapatan !== 'Semua') {
          if (item.pendapatan !== filterPendapatan) return false;
        }
      }
      return true;
    });
  }, [dataBansos, activeTab, searchTerm, filterProgram, filterWaktu, filterKeaktifan, filterPendapatan]);

  const handleExportExcel = useCallback(async () => {
    if (filteredData.length === 0) { toast.error("Tidak ada data untuk diexport dengan filter saat ini!"); return }
    toast.success("Mempersiapkan Laporan Excel...")
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Laporan Validasi')
    worksheet.columns = [
      { header: 'No', key: 'no', width: 5 }, { header: 'Tanggal Input', key: 'tanggal', width: 15 }, { header: 'NIK', key: 'nik', width: 20 }, 
      { header: 'Nama Lengkap', key: 'nama', width: 25 }, { header: 'Agama', key: 'agama', width: 15 }, { header: 'Status Pernikahan', key: 'status_pernikahan', width: 20 },
      { header: 'Pendidikan Terakhir', key: 'pendidikan_terakhir', width: 20 }, { header: 'Program', key: 'bantuan', width: 18 }, { header: 'Kabupaten/Kota', key: 'kota', width: 20 },
      { header: 'Alamat', key: 'alamat', width: 40 }, { header: 'Status Validasi', key: 'status', width: 18 }, { header: 'Keaktifan', key: 'aktif', width: 15 }, 
      { header: 'Catatan Tambahan', key: 'catatan_tambahan', width: 30 }, { header: 'Catatan', key: 'catatan', width: 30 }, { header: 'Link Foto KTP', key: 'ktp', width: 25 }, 
      { header: 'Link Foto Diri', key: 'diri', width: 25 }, { header: 'Link Foto Rumah', key: 'rumah', width: 25 }, { header: 'Link Foto Pekerjaan', key: 'pekerjaan', width: 25 }
    ]
    worksheet.getRow(1).font = { bold: true }; worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

    filteredData.forEach((item, index) => {
      worksheet.addRow({
        no: index + 1, tanggal: new Date(item.created_at).toLocaleDateString('id-ID'), nik: item.nik, nama: item.nama_lengkap, 
        agama: item.agama || '-', status_pernikahan: item.status_pernikahan || '-', pendidikan_terakhir: item.pendidikan_terakhir || '-',
        bantuan: item.jenis_bantuan, kota: item.kabupaten_kota || '-', alamat: item.alamat, status: item.status, aktif: item.status_penerima || 'Aktif', 
        catatan_tambahan: item.catatan_tambahan || '-', catatan: item.alasan_penolakan || '-',
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
  }, [filteredData, activeTab, filterProgram]);

  useEffect(() => {
    if (exportExcelTrigger) {
      handleExportExcel();
      setExportExcelTrigger(false);
    }
  }, [exportExcelTrigger, setExportExcelTrigger, handleExportExcel]);

  const executeEditStatus = async (item, newStatus, alasan = null, newProgram = null) => {
    const toastId = toast.loading("Memperbarui status...")
    try {
      const updateData = { status: newStatus, alasan_penolakan: alasan }
      if (newProgram) updateData.jenis_bantuan = newProgram 

      const { error } = await supabase.from('pengajuan_bantuan').update(updateData).eq('id', item.id)
      if (error) throw error
      
      const { data: operatorProfile } = await supabase.from('profiles').select('email').eq('id', item.user_id).single()
      if (operatorProfile?.email) {
        await fetch('/api/bidang/notify-operator', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ 
            email_operator: operatorProfile.email, 
            nama_pemohon: item.nama_lengkap, 
            jenis_bantuan: newProgram || item.jenis_bantuan, 
            status_verifikasi: newStatus, 
            catatan: alasan || '-' 
          }) 
        })
      }
      toast.success("Status diperbarui dan notifikasi terkirim!", { id: toastId })
      
      await catatLog("Validasi Data", `Mengubah status pengajuan atas nama ${item.nama_lengkap} (NIK: ${item.nik}) menjadi ${newStatus}.${newProgram ? ' Program: ' + newProgram : ''}${alasan ? ' Catatan: ' + alasan : ''}`)
      
      await fetchRealtimeData() 
      if (selectedItem) setSelectedItem(null) 
    } catch (err) { 
      toast.error("Gagal memproses data: " + err.message, { id: toastId }) 
    }
  }

  const executeToggleStatus = async (item, newStatus, alasan = null) => {
      const toastId = toast.loading("Mengubah status keaktifan...");
      try {
          const updateData = { 
            status_penerima: newStatus,
            alasan_nonaktif: newStatus === 'Nonaktif' ? alasan : null
          };
          const { error } = await supabase.from('pengajuan_bantuan').update(updateData).eq('id', item.id);
          if(error) throw error;
          toast.success(`Berhasil di-${newStatus.toLowerCase()}kan!`, { id: toastId }); 
          await catatLog("Ubah Status Aktif", `Mengubah status keaktifan penerima bansos NIK ${item.nik} menjadi ${newStatus}.${alasan ? ' Alasan: ' + alasan : ''}`)
          await fetchRealtimeData();
      } catch (error) { 
        toast.error("Gagal mengubah status: " + error.message, { id: toastId }); 
      }
  }

  const executeDeleteBansos = async (item) => {
    const toastId = toast.loading("Menghapus data dan berkas...");
    try {
      const filesToDelete = []
      const extractPath = (url) => {
        if (!url) return null
        const cleanUrl = url.split('?')[0]
        const marker = '/dokumen_bansos/'
        const index = cleanUrl.indexOf(marker)
        if (index !== -1) {
          return cleanUrl.substring(index + marker.length)
        }
        return cleanUrl.split('/').pop()
      }
      if (item.foto_ktp) filesToDelete.push(extractPath(item.foto_ktp)); 
      if (item.foto_diri) filesToDelete.push(extractPath(item.foto_diri))
      if (item.foto_pekerjaan) filesToDelete.push(extractPath(item.foto_pekerjaan)); 
      if (item.foto_rumah) filesToDelete.push(extractPath(item.foto_rumah))

      if (filesToDelete.length > 0) await supabase.storage.from('dokumen_bansos').remove(filesToDelete)
      const { error: deleteError } = await supabase.from('pengajuan_bantuan').delete().eq('id', item.id)
      if (deleteError) throw deleteError

      toast.success("Data berhasil dihapus bersih.", { id: toastId })
      await catatLog("Hapus Data Bansos", `Menghapus permanen pengajuan NIK: ${item.nik} atas nama ${item.nama_lengkap}`)
      await fetchRealtimeData()
    } catch (error) { 
      toast.error("Gagal hapus data: " + error.message, { id: toastId }) 
    }
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
        <tr><td><span class="label">Agama / Status Pernikahan</span><span class="value">${item.agama || '-'} / ${item.status_pernikahan || '-'}</span></td><td><span class="label">Pendidikan Terakhir</span><span class="value">${item.pendidikan_terakhir || '-'}</span></td></tr>
        <tr><td><span class="label">Jumlah Tanggungan</span><span class="value">${item.tanggungan !== null ? item.tanggungan + ' Orang' : '-'}</span></td><td><span class="label">Alamat Domisili</span><span class="value" style="font-weight: 500;">${item.alamat}</span></td></tr>
        <tr><td colspan="2"><span class="label">Catatan Tambahan</span><span class="value" style="font-weight: 500;">${item.catatan_tambahan || '-'}</span></td></tr>
      </table>
      <div class="images-section avoid-break">
        <h3>LAMPIRAN DOKUMEN FOTO</h3>
        <div class="images-flex">
          <div class="img-card avoid-break"><p>FOTO KTP</p><img src="${getDirectImageUrl(item.foto_ktp) || ''}" onerror="this.style.display='none'" /></div>
          <div class="img-card avoid-break"><p>FOTO DIRI</p><img src="${getDirectImageUrl(item.foto_diri) || ''}" onerror="this.style.display='none'" /></div>
          <div class="img-card avoid-break"><p>FOTO RUMAH</p><img src="${getDirectImageUrl(item.foto_rumah) || ''}" onerror="this.style.display='none'" /></div>
          <div class="img-card avoid-break"><p>FOTO PEKERJAAN</p><img src="${getDirectImageUrl(item.foto_pekerjaan) || ''}" onerror="this.style.display='none'" /></div>
        </div>
      </div>
      <script>window.onload = function() { setTimeout(function() { window.print(); }, 1500); }</script>
    </body>
    </html>
    `)
    printWindow.document.close()
  }

  // Load Leaflet css and js
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        setTimeout(() => setLeafletLoaded(true), 0);
      };
      document.head.appendChild(script);
    } else {
      setTimeout(() => setLeafletLoaded(true), 0);
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!leafletLoaded || typeof window === 'undefined') return;

    const container = document.getElementById('map-container-val');
    if (!container || container._leaflet_id) return;

    const L = window.L;
    if (!L) return;

    const map = L.map('map-container-val', { zoomControl: true }).setView([-7.6, 112.6], 8);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    if (typeof map.on === 'function') {
      map.on('popupclose', () => {
        setTimeout(() => {
          if (!map._popup || !map.hasLayer(map._popup)) {
            setFilterWilayah('Semua');
          }
        }, 50);
      });
    }

    mapRef.current = map;
    setMapInstance(map);

    return () => {
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
  }, [leafletLoaded, activeTab]);

  // Render Marker
  useEffect(() => {
    if (!mapInstance || !mapRef.current || !dataForMap || typeof window === 'undefined') return;

    const L = window.L;
    if (!L) return;

    mapInstance.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) {
        mapInstance.removeLayer(layer);
      }
    });

    const statsByCity = hitungStatistikPerWilayah(dataForMap);

    Object.keys(KOORDINAT_JATIM).forEach(city => {
      const coords = KOORDINAT_JATIM[city];
      const stats = statsByCity[city] || { total: 0, disetujui: 0, pending: 0, revisi: 0 };

      if (stats.total === 0) return;

      const radius = Math.min(30, Math.max(8, 8 + (stats.total * 0.8)));
      
      let color = '#1e3a8a'; // Navy (Low)
      if (stats.total > 15) color = '#dc2626'; // Merah (High)
      else if (stats.total > 5) color = '#f59e0b'; // Amber (Medium)

      const marker = L.circleMarker(coords, {
        radius: radius,
        fillColor: color,
        color: '#ffffff',
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.6
      }).addTo(mapInstance);

      // Sinkronisasi filter ketika marker diklik
      marker.on('click', () => {
        setFilterWilayah(city);
        toast.success(`Menyaring data: ${city}`);
      });

      const popupContent = `
        <div style="font-family: Arial, sans-serif; padding: 6px; width: 180px;">
          <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #1e3a8a; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">${city}</h4>
          <div style="font-size: 11px; margin-bottom: 4px; color: #475569;">Total Pengajuan: <strong style="color: #0f172a;">${stats.total}</strong></div>
          <div style="font-size: 10px; margin-bottom: 2px; color: #10b981;">✔ Disetujui: <strong>${stats.disetujui}</strong></div>
          <div style="font-size: 10px; margin-bottom: 2px; color: #f59e0b;">⏳ Menunggu: <strong>${stats.pending}</strong></div>
          <div style="font-size: 10px; color: #ef4444;">❌ Revisi: <strong>${stats.revisi}</strong></div>
          <div style="font-size: 9px; margin-top: 6px; color: #1e3a8a; font-weight: bold; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 4px; cursor: pointer;">Klik untuk memfilter tabel</div>
        </div>
      `;
      marker.bindPopup(popupContent);
    });
  }, [mapInstance, dataForMap]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-fadeIn">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4">
         <div className="flex gap-3 items-center flex-wrap">
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Program:</span>
               <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)} className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer">
                 {uniquePrograms.map((prog, idx) => <option key={idx} value={prog}>{prog === 'Semua' ? 'Semua Program' : prog}</option>)}
               </select>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tanggal:</span>
               <input 
                 type="date" 
                 value={filterWaktu} 
                 onChange={(e) => setFilterWaktu(e.target.value)} 
                 className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer" 
               />
               {filterWaktu && (
                 <button 
                   type="button"
                   onClick={() => setFilterWaktu('')} 
                   className="text-xs font-bold text-slate-400 hover:text-slate-600 px-1 focus:outline-none"
                   title="Reset Tanggal"
                 >
                   &times;
                 </button>
               )}
            </div>
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Wilayah:</span>
               <select value={filterWilayah} onChange={(e) => setFilterWilayah(e.target.value)} className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer">
                 {uniqueWilayah.map((wil, idx) => <option key={idx} value={wil}>{wil === 'Semua' ? 'Semua Wilayah' : wil}</option>)}
               </select>
            </div>
            {activeTab === 'Riwayat' && (
              <>
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Keaktifan:</span>
                   <select value={filterKeaktifan} onChange={(e) => setFilterKeaktifan(e.target.value)} className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer">
                     <option value="Semua">Semua Keaktifan</option>
                     <option value="Aktif">Aktif</option>
                     <option value="Nonaktif">Non-Aktif</option>
                   </select>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pendapatan:</span>
                   <select value={filterPendapatan} onChange={(e) => setFilterPendapatan(e.target.value)} className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer">
                     <option value="Semua">Semua Pendapatan</option>
                     <option value="< Rp 500.000">&lt; Rp 500.000</option>
                     <option value="Rp 500.000 - Rp 1.000.000">Rp 500.000 - Rp 1.000.000</option>
                     <option value="Rp 1.000.000 - Rp 2.000.000">Rp 1.000.000 - Rp 2.000.000</option>
                     <option value="> Rp 2.000.000">&gt; Rp 2.000.000</option>
                   </select>
                </div>
              </>
            )}
         </div>
          <div className="relative w-full md:w-56">
            <input type="text" placeholder="Cari NIK / Nama..." className="pl-3 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:border-blue-900 outline-none w-full transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
      </div>

      {/* Peta Sebaran Real-time */}
      {activeTab === 'Riwayat' && (
        <div className="p-6 bg-white border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-900 animate-pulse"></span>
              Peta Sebaran Calon Penerima Bansos Jawa Timur
            </p>
            {/* Legenda Peta Sebaran Bantuan Sosial */}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Sebaran Bantuan Sosial:</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1e3a8a] border border-white shadow-sm"></span>
                <span className="text-[10px] font-bold text-slate-600">Rendah (≤ 5)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] border border-white shadow-sm"></span>
                <span className="text-[10px] font-bold text-slate-600">Sedang (6 - 15)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] border border-white shadow-sm"></span>
                <span className="text-[10px] font-bold text-slate-600">Tinggi (&gt; 15)</span>
              </div>
            </div>
          </div>
          <div id="map-container-val" className="h-[320px] w-full rounded-xl border border-slate-200 shadow-inner z-10" style={{ minHeight: '320px' }}></div>
        </div>
      )}

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
                        <div className="flex flex-col gap-1">
                          <button onClick={() => {
                                  if ((item.status_penerima || 'Aktif') === 'Aktif') {
                                    setCustomAlert({
                                        isOpen: true,
                                        title: 'Nonaktifkan Penerima Bantuan?',
                                        message: 'Harap berikan alasan penonaktifan/graduasi warga ini:',
                                        type: 'prompt',
                                        confirmLabel: 'OK',
                                        onConfirm: (alasan) => {
                                            if (!alasan || alasan.trim() === '') {
                                                toast.error('Alasan penonaktifan wajib diisi!');
                                                return;
                                            }
                                            setCustomAlert({ isOpen: false });
                                            executeToggleStatus(item, 'Nonaktif', alasan.trim());
                                        }
                                    });
                                  } else {
                                    setCustomAlert({
                                        isOpen: true,
                                        title: 'Aktifkan Kembali?',
                                        message: 'Apakah Anda yakin ingin mengaktifkan kembali penerima bantuan ini?',
                                        type: 'confirm',
                                        confirmLabel: 'OK',
                                        onConfirm: () => {
                                            setCustomAlert({ isOpen: false });
                                            executeToggleStatus(item, 'Aktif', null);
                                        }
                                    });
                                  }
                              }} className="group flex items-center gap-2 focus:outline-none">
                              <div className={`w-9 h-5 flex items-center rounded-full p-1 duration-300 ease-in-out ${ (item.status_penerima || 'Aktif') === 'Aktif' ? 'bg-blue-900' : 'bg-slate-300' }`}><div className={`bg-white w-3 h-3 rounded-full shadow-sm transform duration-300 ease-in-out ${ (item.status_penerima || 'Aktif') === 'Aktif' ? 'translate-x-4' : '' }`}></div></div>
                              <span className="text-[10px] font-bold uppercase text-slate-500">{(item.status_penerima || 'Aktif')}</span>
                          </button>
                          {item.status_penerima === 'Nonaktif' && item.alasan_nonaktif && (
                            <span className="text-[10px] text-rose-600 font-medium italic truncate max-w-[120px]" title={item.alasan_nonaktif}>
                              &quot;{item.alasan_nonaktif}&quot;
                            </span>
                          )}
                        </div>
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

      {/* --- MODAL DETAIL REVIEW --- */}
      {selectedItem && (
        <div className="fixed inset-0 z-[40] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
           <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
              <div className="px-6 py-4 flex justify-between items-center border-b border-slate-100 shrink-0">
                 <div><h3 className="text-lg font-extrabold text-slate-800">Verifikasi Berkas Calon Penerima</h3></div>
                 <div className="flex items-center gap-2">
                   <button onClick={() => handlePrint(selectedItem)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-bold text-xs border border-slate-300 transition-colors">Cetak PDF</button>
                   <button onClick={() => setSelectedItem(null)} className="w-8 h-8 text-slate-400 text-xl">&times;</button>
                 </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Identitas Kependudukan</p>
                      <p className="text-xl font-bold text-slate-800">{selectedItem.nama_lengkap}</p>
                      <p className="text-sm font-mono text-slate-500 mt-1">NIK: {selectedItem.nik} <span className="mx-1 text-slate-300">|</span> KK: {selectedItem.no_kk || '-'}</p>
                      <div className="mt-3 text-xs text-slate-600 space-y-1">
                        <div><strong>Agama:</strong> {selectedItem.agama || '-'}</div>
                        <div><strong>Status Pernikahan:</strong> {selectedItem.status_pernikahan || '-'}</div>
                        <div><strong>Pendidikan Terakhir:</strong> {selectedItem.pendidikan_terakhir || '-'}</div>
                      </div>
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
                    <div className="col-span-2"><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Catatan Tambahan</p><p className="text-sm text-slate-700 leading-snug font-medium">{selectedItem.catatan_tambahan || '-'}</p></div>
                    {selectedItem.status_penerima === 'Nonaktif' && (
                      <div className="col-span-2"><p className="text-[11px] font-bold text-rose-500 uppercase tracking-wider mb-1">Alasan Penonaktifan (Graduasi)</p><p className="text-sm text-rose-700 leading-snug font-bold italic">&quot;{selectedItem.alasan_nonaktif || '-'}&quot;</p></div>
                    )}
                 </div>

                 <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Berkas Pendukung Lapangan</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       {[{title: 'KTP', src: selectedItem.foto_ktp}, {title: 'Diri', src: selectedItem.foto_diri}, {title: 'Rumah', src: selectedItem.foto_rumah}, {title: 'Pekerjaan', src: selectedItem.foto_pekerjaan}].map((foto, idx) => (
                          <div key={idx} onClick={() => foto.src && window.open(foto.src, '_blank')} className="group relative h-32 bg-slate-50 rounded-lg overflow-hidden border border-slate-200 cursor-pointer">
                             {foto.src ? <img src={getDirectImageUrl(foto.src)} alt={foto.title} className="w-full h-full object-cover transition-all group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-slate-400 text-xs">{foto.title} Kosong</div>}
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
                            confirmLabel: 'Kirim Penolakan', 
                            onConfirm: (alasan) => { 
                                if(!alasan || alasan.trim() === "") { toast.error("Alasan wajib diisi!"); return false; } 
                                setCustomAlert(prev => ({ ...prev, isOpen: false })); 
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
                            confirmLabel: 'Ya, Setujui', 
                            onConfirm: () => { 
                                setCustomAlert(prev => ({ ...prev, isOpen: false })); 
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
                    }} className="px-4 py-2 text-xs font-bold text-white bg-blue-900 rounded-xl">{customAlert.confirmLabel || 'OK'}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}
