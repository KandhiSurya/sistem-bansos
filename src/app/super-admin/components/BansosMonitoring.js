'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import toast from 'react-hot-toast'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { KOORDINAT_JATIM, hitungStatistikPerWilayah } from '@/utils/mapHelpers'
import { getDirectImageUrl } from '@/utils/imageHelpers'


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

export default function BansosMonitoring({
  allBansos,
  catatLog,
  exportExcelTrigger,
  setExportExcelTrigger
}) {
  // States Filter Monitoring Data
  const [filterProgram, setFilterProgram] = useState('Semua')
  const [filterWaktu, setFilterWaktu] = useState('Semua')
  const [filterWilayah, setFilterWilayah] = useState('Semua')
  const [searchTerm, setSearchTerm] = useState('')

  // Detail Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedDetailItem, setSelectedDetailItem] = useState(null)

  // GIS Peta States
  const [leafletLoaded, setLeafletLoaded] = useState(false)
  const [mapInstance, setMapInstance] = useState(null)

  const uniquePrograms = useMemo(() => {
    return ['Semua', ...new Set(allBansos.map(item => item.jenis_bantuan))]
  }, [allBansos])

  const uniqueWilayah = useMemo(() => {
    return ['Semua', ...new Set(allBansos.map(item => item.kabupaten_kota).filter(Boolean))]
  }, [allBansos])

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

      let matchSearch = true;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        matchSearch = (item.nama_lengkap && item.nama_lengkap.toLowerCase().includes(term)) || 
                      (item.nik && item.nik.includes(term)) ||
                      (item.kabupaten_kota && item.kabupaten_kota.toLowerCase().includes(term));
      }

      return matchProgram && matchWaktu && matchWilayah && matchSearch;
    });
  }, [allBansos, filterProgram, filterWaktu, filterWilayah, searchTerm]);

  // --- LOGIKA FILTER DATA KHUSUS PETA (agar marker kota lain tidak hilang saat terfilter) ---
  const dataForMap = useMemo(() => {
    return allBansos.filter(item => {
      const matchProgram = filterProgram === 'Semua' || item.jenis_bantuan === filterProgram;
      
      let matchWaktu = true;
      if (filterWaktu !== 'Semua') {
        const itemDate = new Date(item.created_at); const now = new Date();
        if (filterWaktu === '7 Hari Terakhir') { const past7 = new Date(); past7.setDate(now.getDate() - 7); matchWaktu = itemDate >= past7;
        } else if (filterWaktu === 'Bulan Ini') { matchWaktu = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        } else if (filterWaktu === 'Bulan Lalu') { let lastMonth = now.getMonth() - 1; let year = now.getFullYear(); if (lastMonth < 0) { lastMonth = 11; year -= 1; } matchWaktu = itemDate.getMonth() === lastMonth && itemDate.getFullYear() === year;
        } else if (filterWaktu === 'Tahun Ini') { matchWaktu = itemDate.getFullYear() === now.getFullYear(); }
      }

      let matchSearch = true;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        matchSearch = (item.nama_lengkap && item.nama_lengkap.toLowerCase().includes(term)) || 
                      (item.nik && item.nik.includes(term)) ||
                      (item.kabupaten_kota && item.kabupaten_kota.toLowerCase().includes(term));
      }

      return matchProgram && matchWaktu && matchSearch;
    });
  }, [allBansos, filterProgram, filterWaktu, searchTerm]);

  // Export Excel Functionality
  const handleExportExcel = useCallback(async () => {
    if (filteredData.length === 0) { toast.error("Tidak ada data untuk diexport!"); return }
    toast.success("Mempersiapkan Laporan Excel...")
    
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Data Bansos')
    worksheet.columns = [
      { header: 'No', key: 'no', width: 5 }, { header: 'Tanggal Input', key: 'tanggal', width: 15 }, { header: 'NIK', key: 'nik', width: 20 },
      { header: 'Nama Lengkap', key: 'nama', width: 25 }, { header: 'Agama', key: 'agama', width: 15 }, { header: 'Status Pernikahan', key: 'status_pernikahan', width: 20 },
      { header: 'Pendidikan Terakhir', key: 'pendidikan_terakhir', width: 20 }, { header: 'Program Bantuan', key: 'bantuan', width: 18 }, { header: 'Kabupaten/Kota', key: 'kota', width: 20 },
      { header: 'Alamat Lengkap', key: 'alamat', width: 40 }, { header: 'Status Validasi', key: 'status', width: 18 }, { header: 'Status Keaktifan', key: 'aktif', width: 15 }, 
      { header: 'Catatan Tambahan', key: 'catatan_tambahan', width: 30 }, { header: 'Catatan Revisi', key: 'catatan', width: 30 }
    ]
    worksheet.getRow(1).font = { bold: true }; worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    filteredData.forEach((item, index) => {
      worksheet.addRow({
        no: index + 1, tanggal: new Date(item.created_at).toLocaleDateString('id-ID'), nik: item.nik, nama: item.nama_lengkap, 
        agama: item.agama || '-', status_pernikahan: item.status_pernikahan || '-', pendidikan_terakhir: item.pendidikan_terakhir || '-',
        bantuan: item.jenis_bantuan, kota: item.kabupaten_kota || '-', alamat: item.alamat, status: item.status, aktif: item.status_penerima || 'Aktif', 
        catatan_tambahan: item.catatan_tambahan || '-', catatan: item.alasan_penolakan || '-'
      })
    })
    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), `Rekap_Bansos_SuperAdmin_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`)
    
    await catatLog("Export Excel", `Mendownload rekap data bantuan sosial tingkat provinsi`)
  }, [filteredData, catatLog])

  // Listen to export trigger from parent header button
  useEffect(() => {
    if (exportExcelTrigger) {
      handleExportExcel();
      setExportExcelTrigger(false);
    }
  }, [exportExcelTrigger, setExportExcelTrigger, handleExportExcel]);

  // Load Leaflet dynamically
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

    const container = document.getElementById('map-container-sa');
    if (!container || container._leaflet_id) return;

    const L = window.L;
    if (!L) return;

    const map = L.map('map-container-sa', { zoomControl: true }).setView([-7.6, 112.6], 8);
    
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

    setTimeout(() => setMapInstance(map), 0);

    return () => {
      map.remove();
      setTimeout(() => setMapInstance(null), 0);
    };
  }, [leafletLoaded]);

  // Render Marker
  useEffect(() => {
    if (!mapInstance || !dataForMap || typeof window === 'undefined') return;

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

  return (
    <div className="animate-fadeIn">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap lg:flex-nowrap justify-between items-center gap-3">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Program:</span>
            <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)} className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer">
              {uniquePrograms.map((prog, idx) => <option key={idx} value={prog}>{prog === 'Semua' ? 'Semua Program' : prog}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Wilayah:</span>
            <select value={filterWilayah} onChange={(e) => setFilterWilayah(e.target.value)} className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer">
              {uniqueWilayah.map((wil, idx) => <option key={idx} value={wil}>{wil === 'Semua' ? 'Semua Wilayah' : wil}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Waktu:</span>
            <select value={filterWaktu} onChange={(e) => setFilterWaktu(e.target.value)} className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer">
              <option value="Semua">Semua Waktu</option>
              <option value="7 Hari Terakhir">7 Hari Terakhir</option>
              <option value="Bulan Ini">Bulan Ini</option>
              <option value="Bulan Lalu">Bulan Lalu</option>
              <option value="Tahun Ini">Tahun Ini</option>
            </select>
          </div>
          {filterWilayah !== 'Semua' && (
            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide animate-fadeIn">
              <span>Wilayah: {filterWilayah}</span>
              <button onClick={() => setFilterWilayah('Semua')} className="hover:text-blue-900 font-extrabold ml-1 leading-none text-xs" title="Hapus filter wilayah">&times;</button>
            </div>
          )}
        </div>

        <div className="relative w-full md:w-56 shrink-0">
          <input type="text" placeholder="Cari NIK / Nama..." className="pl-3 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:border-blue-900 outline-none w-full transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {/* Peta Sebaran Real-time */}
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
        <div id="map-container-sa" className="h-[320px] w-full rounded-xl border border-slate-200 shadow-inner z-10" style={{ minHeight: '320px' }}></div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Identitas Penerima</th>
              <th className="px-6 py-4">Bantuan & Wilayah</th>
              <th className="px-6 py-4">Status Pengajuan</th>
              <th className="px-6 py-4">Keaktifan</th>
              <th className="px-6 py-4 text-right">Aksi Data</th>
            </tr>
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
                    <button 
                      onClick={() => { 
                        setSelectedDetailItem(item); 
                        setIsDetailModalOpen(true); 
                      }} 
                      className="text-blue-700 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md border border-blue-100 transition-colors"
                    >
                      Detail Data
                    </button>
                  </td>
                </tr>
              ))
            ) : ( 
              <tr>
                <td colSpan="5" className="px-6 py-10 text-center text-slate-400 text-sm italic">Tidak ada data untuk filter ini.</td>
              </tr> 
            )}
          </tbody>
        </table>
      </div>

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
                    <div className="mt-3 text-xs text-slate-600 space-y-1">
                      <div><strong>Agama:</strong> {selectedDetailItem.agama || '-'}</div>
                      <div><strong>Status Pernikahan:</strong> {selectedDetailItem.status_pernikahan || '-'}</div>
                      <div><strong>Pendidikan Terakhir:</strong> {selectedDetailItem.pendidikan_terakhir || '-'}</div>
                    </div>
                 </div>
                 
                 <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Profil Kelayakan Ekonomi</p>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-1 space-y-2">
                      <div className="flex justify-between border-b border-slate-200 pb-1.5"><span className="text-xs text-slate-500">Pekerjaan Utama</span><span className="text-xs font-bold text-slate-800">{selectedDetailItem.pekerjaan || '-'}</span></div>
                      <div className="flex justify-between border-b border-slate-200 pb-1.5"><span className="text-xs text-slate-500">Pendapatan Bulanan</span><span className="text-xs font-bold text-slate-800">{selectedDetailItem.pendapatan || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-xs text-slate-500">Jumlah Tanggungan</span><span className="text-xs font-bold text-slate-800">{selectedDetailItem.tanggungan !== null ? `${selectedDetailItem.tanggungan} Orang` : '-'}</span></div>
                    </div>
                 </div>

                 <div>
                   <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status Penilaian & Validasi</p>
                   <div className="flex items-center gap-2 mt-1.5">
                     {getStatusBadge(selectedDetailItem.status)}
                     {getActiveBadge(selectedDetailItem.status_penerima)}
                   </div>
                 </div>
                 <div><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Program & Lokasi Wilayah</p><p className="text-sm font-bold text-blue-900 uppercase mt-1.5">{selectedDetailItem.jenis_bantuan} <span className="text-slate-400 font-normal ml-1">({selectedDetailItem.kabupaten_kota || 'Belum diatur'})</span></p></div>
                 <div className="col-span-2"><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Alamat Lengkap</p><p className="text-sm text-slate-700 leading-snug font-medium">{selectedDetailItem.alamat || '-'}</p></div>
                 <div className="col-span-2"><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Catatan Tambahan</p><p className="text-sm text-slate-700 leading-snug font-medium">{selectedDetailItem.catatan_tambahan || '-'}</p></div>
                 {selectedDetailItem.status_penerima === 'Nonaktif' && (
                    <div className="col-span-2"><p className="text-[11px] font-bold text-rose-500 uppercase tracking-wider mb-1">Alasan Penonaktifan (Graduasi)</p><p className="text-sm text-rose-700 leading-snug font-bold italic">&quot;{selectedDetailItem.alasan_nonaktif || '-'}&quot;</p></div>
                  )}
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Galeri Lampiran Bukti Dokumen</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['foto_ktp', 'foto_diri', 'foto_rumah', 'foto_pekerjaan'].map((fotoKey, idx) => (
                    selectedDetailItem[fotoKey] ? (
                      <div key={idx} className="relative h-32 rounded-lg overflow-hidden group cursor-pointer border border-slate-200 shadow-sm" onClick={() => window.open(selectedDetailItem[fotoKey], '_blank')}>
                        <img src={getDirectImageUrl(selectedDetailItem[fotoKey])} alt={fotoKey} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
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
    </div>
  )
}
