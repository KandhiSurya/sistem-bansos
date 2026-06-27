'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { read, utils } from 'xlsx'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { supabase } from '@/lib/supabaseClient'
import { getDirectImageUrl } from '@/utils/imageHelpers'


const getInitials = (name) => {
  if (!name) return '?'
  return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().substring(0, 2)
}

export default function BansosHistory({
  historyData,
  userProfile,
  initData,
  catatLog,
  handleEdit,
  importExcelTrigger,
  setImportExcelTrigger,
  exportExcelTrigger,
  setExportExcelTrigger
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterProgram, setFilterProgram] = useState('Semua')
  const [filterStatus, setFilterStatus] = useState('Semua')
  const [filterWaktu, setFilterWaktu] = useState('Semua')
  const [filteredData, setFilteredData] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [isImporting, setIsImporting] = useState(false)

  const fileInputRef = useRef(null)

  // Efek Pemicu Impor Excel
  useEffect(() => {
    if (importExcelTrigger && fileInputRef.current) {
      fileInputRef.current.click()
      setImportExcelTrigger(false)
    }
  }, [importExcelTrigger, setImportExcelTrigger])

  // Logika Ekspor Excel
  const handleExportExcel = useCallback(async () => {
    if (filteredData.length === 0) { 
      toast.error("Tidak ada data untuk diexport dengan filter saat ini!")
      return 
    }
    toast.success("Mempersiapkan Laporan Excel...")
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Laporan Pengajuan')
    worksheet.columns = [
      { header: 'No', key: 'no', width: 5 }, 
      { header: 'Tanggal Input', key: 'tanggal', width: 15 }, 
      { header: 'NIK', key: 'nik', width: 20 }, 
      { header: 'Nama Lengkap', key: 'nama', width: 25 }, 
      { header: 'Agama', key: 'agama', width: 15 }, 
      { header: 'Status Pernikahan', key: 'status_pernikahan', width: 20 },
      { header: 'Pendidikan Terakhir', key: 'pendidikan_terakhir', width: 20 }, 
      { header: 'Program', key: 'bantuan', width: 18 }, 
      { header: 'Kabupaten/Kota', key: 'kota', width: 20 },
      { header: 'Alamat', key: 'alamat', width: 40 }, 
      { header: 'Status Validasi', key: 'status', width: 18 }, 
      { header: 'Keaktifan', key: 'aktif', width: 15 }, 
      { header: 'Catatan Tambahan', key: 'catatan_tambahan', width: 30 }, 
      { header: 'Catatan Penolakan', key: 'catatan', width: 30 }, 
      { header: 'Link Foto KTP', key: 'ktp', width: 25 }, 
      { header: 'Link Foto Diri', key: 'diri', width: 25 }, 
      { header: 'Link Foto Rumah', key: 'rumah', width: 25 }, 
      { header: 'Link Foto Pekerjaan', key: 'pekerjaan', width: 25 }
    ]
    worksheet.getRow(1).font = { bold: true }; worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

    filteredData.forEach((item, index) => {
      worksheet.addRow({
        no: index + 1, 
        tanggal: new Date(item.created_at).toLocaleDateString('id-ID'), 
        nik: item.nik, 
        nama: item.nama_lengkap, 
        agama: item.agama || '-', 
        status_pernikahan: item.status_pernikahan || '-', 
        pendidikan_terakhir: item.pendidikan_terakhir || '-',
        bantuan: item.jenis_bantuan, 
        kota: item.kabupaten_kota || '-', 
        alamat: item.alamat, 
        status: item.status, 
        aktif: item.status_penerima || 'Aktif', 
        catatan_tambahan: item.catatan_tambahan || '-', 
        catatan: item.alasan_penolakan || '-',
        ktp: item.foto_ktp ? { text: 'Buka Foto KTP', hyperlink: item.foto_ktp } : 'Tidak Ada', 
        diri: item.foto_diri ? { text: 'Buka Foto Diri', hyperlink: item.foto_diri } : 'Tidak Ada',
        rumah: item.foto_rumah ? { text: 'Buka Foto Rumah', hyperlink: item.foto_rumah } : 'Tidak Ada', 
        pekerjaan: item.foto_pekerjaan ? { text: 'Buka Foto Pekerjaan', hyperlink: item.foto_pekerjaan } : 'Tidak Ada'
      })
    })

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            ['ktp','diri','rumah','pekerjaan'].forEach(k => { row.getCell(k).font = row.getCell(k).value?.hyperlink ? { color: { argb: 'FF0563C1' }, underline: true } : {} })
        }
    });
    const buffer = await workbook.xlsx.writeBuffer()
    const kabupatenKota = userProfile?.kabupaten_kota || 'Daerah'
    saveAs(new Blob([buffer]), `Laporan_Operator_${kabupatenKota.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`)
  }, [filteredData, userProfile])

  // Efek Pemicu Ekspor Excel
  useEffect(() => {
    if (exportExcelTrigger) {
      handleExportExcel()
      setExportExcelTrigger(false)
    }
  }, [exportExcelTrigger, setExportExcelTrigger, handleExportExcel])

  useEffect(() => {
    let data = historyData;
    if (filterProgram !== 'Semua') {
      data = data.filter(d => d.jenis_bantuan === filterProgram);
    }
    if (filterStatus !== 'Semua') {
      data = data.filter(d => d.status === filterStatus);
    }
    if (filterWaktu !== 'Semua') {
      const now = new Date();
      data = data.filter(d => {
        const itemDate = new Date(d.created_at);
        if (filterWaktu === '7 Hari Terakhir') {
          const past7 = new Date(); past7.setDate(now.getDate() - 7);
          return itemDate >= past7;
        } else if (filterWaktu === 'Bulan Ini') {
          return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        } else if (filterWaktu === 'Bulan Lalu') {
          let lastMonth = now.getMonth() - 1; let year = now.getFullYear();
          if (lastMonth < 0) { lastMonth = 11; year -= 1; }
          return itemDate.getMonth() === lastMonth && itemDate.getFullYear() === year;
        } else if (filterWaktu === 'Tahun Ini') {
          return itemDate.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(d => (d.nama_lengkap && d.nama_lengkap.toLowerCase().includes(term)) || (d.nik && d.nik.includes(term)));
    }
    setFilteredData(data)
  }, [historyData, searchTerm, filterProgram, filterStatus, filterWaktu])

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!userProfile?.id || !userProfile?.kabupaten_kota) { 
      toast.error("Error: Identitas Akun tidak lengkap."); 
      return 
    }

    setIsImporting(true)
    const loadingToast = toast.loading("Membaca file Excel...")

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target.result)
          const workbook = read(data, { type: 'array' })
          const worksheet = workbook.Sheets[workbook.SheetNames[0]]
          
          let validRows = []

          if (worksheet && worksheet['!ref']) {
            const range = utils.decode_range(worksheet['!ref'])
            const startRow = range.s.r + 1 // baris pertama setelah header
            const endRow = range.e.r
            
            // Baca nama kolom header dari baris 0
            const headers = []
            for (let col = range.s.c; col <= range.e.c; col++) {
              const cellRef = utils.encode_cell({ r: range.s.r, c: col })
              const cell = worksheet[cellRef]
              headers[col] = cell ? String(cell.v).trim() : ''
            }

            // Kumpulkan data baris demi baris, mengekstrak link jika ada
            const rowsData = []
            for (let r = startRow; r <= endRow; r++) {
              const rowObj = {}
              let hasData = false
              for (let c = range.s.c; c <= range.e.c; c++) {
                const cellRef = utils.encode_cell({ r: r, c: c })
                const cell = worksheet[cellRef]
                if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
                  hasData = true
                  const headerName = headers[c]
                  if (headerName) {
                    // Jika cell memiliki hyperlink, ambil URL targetnya
                    if (cell.l && cell.l.target) {
                      rowObj[headerName] = cell.l.target
                    } else {
                      rowObj[headerName] = cell.v
                    }
                  }
                }
              }
              if (hasData) {
                rowsData.push(rowObj)
              }
            }

            // Filter baris kosong atau baris yang tidak memiliki NIK dan Nama Lengkap
            validRows = rowsData.filter(row => {
              const hasName = row['NAMA'] || row['nama_lengkap'] || row['Nama Lengkap']
              const hasNik = row['NIK'] || row['nik']
              return hasName && hasNik
            })
          } else {
            // Fallback ke utils.sheet_to_json untuk data mock testing
            const jsonData = utils.sheet_to_json(worksheet || {})
            validRows = jsonData.filter(row => {
              const hasName = row['NAMA'] || row.nama_lengkap || row['Nama Lengkap']
              const hasNik = row['NIK'] || row.nik
              return hasName && hasNik
            })
          }

          if (validRows.length === 0) { 
            toast.error("Tidak ada data valid yang dapat diimpor! Pastikan kolom 'NAMA' (atau 'nama_lengkap') dan 'NIK' terisi.", { id: loadingToast }); 
            setIsImporting(false); 
            return 
          }

          toast.loading(`Mengimpor ${validRows.length} data...`, { id: loadingToast })

          const cleanUrl = (val) => {
            if (!val) return null
            const str = String(val).trim()
            if (str.startsWith('http://') || str.startsWith('https://')) {
              return str
            }
            return null
          }

          const invalidRows = []
          const normalizeKabKota = (str) => {
            if (!str) return ''
            return String(str)
              .replace(/^(kota|kabupaten|kab\.)\s+/i, '')
              .replace(/\s+/g, '')
              .toLowerCase()
          }

          const formattedData = validRows.map((row, index) => {
            const nikVal = row['NIK'] || row['nik'] || '';
            let namaVal = row['NAMA'] || row['nama_lengkap'] || row['Nama Lengkap'] || '';
            
            // Pisahkan NIK dari Nama jika tergabung dengan koma (contoh: "ABD DJALAL, 3507...")
            if (typeof namaVal === 'string' && namaVal.includes(',')) {
              namaVal = namaVal.split(',')[0].trim();
            }

            const kabKotaRowVal = row['kabupaten_kota'] || row['Kabupaten/Kota'] || row['Kabupaten'] || row['Kota'] || row['Wilayah'] || row['kabupaten'] || row['kota'] || row['wilayah'] || null;
            if (kabKotaRowVal) {
              const rowNorm = normalizeKabKota(kabKotaRowVal)
              const profileNorm = normalizeKabKota(userProfile.kabupaten_kota)
              if (rowNorm !== profileNorm) {
                invalidRows.push({
                  index: index + 2, // Baris ke-2 dst. karena header baris ke-1
                  nik: String(nikVal).trim(),
                  nama: String(namaVal).trim(),
                  wilayah: String(kabKotaRowVal).trim()
                })
              }
            }

            const noKkVal = row['no_kk'] || row['No. KK'] || row['No KK'] || null;
            
            let alamatVal = row['ALAMAT'] || row['alamat'] || row['Alamat'] || '-';
            const desaVal = row['DESA/KEL'] || '';
            const kecVal = row['KEC'] || '';
            if (desaVal || kecVal) {
              const parts = [alamatVal];
              if (desaVal) parts.push(`Kel/Desa. ${desaVal}`);
              if (kecVal) parts.push(`Kec. ${kecVal}`);
              alamatVal = parts.join(', ');
            }
            
            const pekerjaanVal = row['pekerjaan'] || row['Pekerjaan'] || '-';
            const pendapatanVal = row['pendapatan'] || row['Pendapatan'] || '< Rp 500.000';
            const tanggunganVal = row['tanggungan'] || row['Tanggungan'] || 0;
            const agamaVal = row['agama'] || row['Agama'] || null;
            const statusPernikahanVal = row['status_pernikahan'] || row['Status Pernikahan'] || null;
            const pendidikanTerakhirVal = row['pendidikan_terakhir'] || row['Pendidikan Terakhir'] || null;
            const catatanTambahanVal = row['catatan_tambahan'] || row['Catatan Tambahan'] || null;
            
            const jenisBantuanVal = row['jenis_bantuan'] || row['Program'] || 'Belum Ditentukan';
            const statusVal = row['status'] || row['Status Validasi'] || 'Menunggu Validasi';
            const alasanPenolakanVal = row['alasan_penolakan'] || row['Catatan Penolakan'] || row['Catatan'] || null;
            const statusPenerimaVal = row['status_penerima'] || row['Keaktifan'] || 'Aktif';
            
            const fotoKtpVal = row['foto_ktp'] || row['Link Foto KTP'] || null;
            const fotoDiriVal = row['foto_diri'] || row['Link Foto Diri'] || null;
            const fotoRumahVal = row['foto_rumah'] || row['Link Foto Rumah'] || null;
            const fotoPekerjaanVal = row['foto_pekerjaan'] || row['Link Foto Pekerjaan'] || null;

            return {
              nik: String(nikVal).replace(/['"]/g, '').trim().substring(0, 16), 
              no_kk: noKkVal ? String(noKkVal).replace(/['"]/g, '').trim().substring(0, 16) : null, 
              nama_lengkap: String(namaVal).trim(), 
              alamat: String(alamatVal).trim(), 
              pekerjaan: String(pekerjaanVal).trim(), 
              pendapatan: String(pendapatanVal).trim(), 
              tanggungan: parseInt(tanggunganVal) || 0,
              agama: agamaVal ? String(agamaVal).trim() : null,
              status_pernikahan: statusPernikahanVal ? String(statusPernikahanVal).trim() : null,
              pendidikan_terakhir: pendidikanTerakhirVal ? String(pendidikanTerakhirVal).trim() : null,
              catatan_tambahan: catatanTambahanVal ? String(catatanTambahanVal).trim() : null,
              jenis_bantuan: jenisBantuanVal, 
              status: statusVal, 
              alasan_penolakan: alasanPenolakanVal ? String(alasanPenolakanVal).trim() : null,
              status_penerima: statusPenerimaVal,
              foto_ktp: cleanUrl(fotoKtpVal),
              foto_diri: cleanUrl(fotoDiriVal),
              foto_rumah: cleanUrl(fotoRumahVal),
              foto_pekerjaan: cleanUrl(fotoPekerjaanVal),
              user_id: userProfile.id, 
              kabupaten_kota: userProfile.kabupaten_kota
            }
          })

          if (invalidRows.length > 0) {
            const firstInvalid = invalidRows[0]
            toast.error(
              `Gagal impor: Terdapat ${invalidRows.length} data dengan kabupaten/kota yang tidak sesuai dengan wilayah Anda (${userProfile.kabupaten_kota}). Baris ${firstInvalid.index} (Nama: ${firstInvalid.nama}) terdeteksi wilayah "${firstInvalid.wilayah}".`,
              { id: loadingToast, duration: 8000 }
            )
            setIsImporting(false)
            return
          }

          // 1. Hilangkan baris yang NIK-nya kembar di dalam file Excel itu sendiri (Deduplikasi Internal)
          const seenNiks = new Set()
          const uniqueExcelData = []
          let internalDuplicateCount = 0

          formattedData.forEach((row) => {
            if (seenNiks.has(row.nik)) {
              internalDuplicateCount++
            } else {
              seenNiks.add(row.nik)
              uniqueExcelData.push(row)
            }
          })

          // 2. Cek NIK mana saja yang sudah ada di database sebelum memasukkan data
          let databaseExistingNiks = new Set()
          const niksToCheck = uniqueExcelData.map(d => d.nik)
          
          if (niksToCheck.length > 0) {
            const { data: dbExisting, error: dbError } = await supabase
              .from('pengajuan_bantuan')
              .select('nik')
              .in('nik', niksToCheck)

            if (dbError) throw dbError

            if (dbExisting) {
              dbExisting.forEach(row => databaseExistingNiks.add(row.nik))
            }
          }

          // 3. Masukkan hanya data yang NIK-nya belum terdaftar
          const finalDataToInsert = uniqueExcelData.filter(row => !databaseExistingNiks.has(row.nik))
          const databaseDuplicateCount = uniqueExcelData.length - finalDataToInsert.length
          const totalSkipped = internalDuplicateCount + databaseDuplicateCount

          // 4. Lakukan insert jika ada data yang valid
          if (finalDataToInsert.length > 0) {
            const { error } = await supabase.from('pengajuan_bantuan').insert(finalDataToInsert)
            if (error) throw error

            // 5. Tampilkan notifikasi ringkas ke pengguna
            toast.success(
              `Impor selesai! ${finalDataToInsert.length} data berhasil diimpor!${
                totalSkipped > 0 ? ` ${totalSkipped} data dilewati karena NIK terdaftar/duplikat.` : ''
              }`,
              { id: loadingToast, duration: 6000 }
            )
            await catatLog(
              "Import Excel", 
              `Mengimpor data bansos warga secara massal sebanyak ${finalDataToInsert.length} data (dilewati ${totalSkipped} duplikat).`
            )
          } else {
            toast.error(
              `Gagal impor: Semua data (${totalSkipped} data) dilewati karena NIK sudah terdaftar atau duplikat.`,
              { id: loadingToast, duration: 6000 }
            )
          }

          await initData() 
        } catch (innerError) {
          toast.error("Gagal mengimpor: " + (innerError.message || innerError.details || JSON.stringify(innerError)), { id: loadingToast })
        } finally {
          setIsImporting(false)
        }
      }
      reader.readAsArrayBuffer(file)
    } catch (error) { 
      toast.error("Gagal mengimpor: " + error.message, { id: loadingToast })
      setIsImporting(false)
    } finally { 
      e.target.value = null 
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

  return (
    <div className="animate-fadeIn">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Program:</span>
            <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)} className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer">
              <option value="Semua">Semua Program</option>
              <option value="PKH">PKH</option>
              <option value="KIP">KIP</option>
              <option value="FAKMIS">FAKMIS</option>
              <option value="Belum Ditentukan">Belum Ditentukan</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status:</span>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer">
              <option value="Semua">Semua Status</option>
              <option value="Menunggu Validasi">Menunggu Validasi</option>
              <option value="Disetujui">Disetujui</option>
              <option value="Perlu Revisi">Perlu Revisi</option>
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
          <div className="relative w-40 sm:w-48 md:w-56">
            <input type="text" placeholder="Cari NIK / Nama..." className="pl-3 pr-4 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:border-blue-900 outline-none w-full transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {/* Hidden but kept for unit testing targeting "Impor Masal Excel" label */}
        <label className="hidden">
          <span>Impor Masal Excel</span>
          <input 
            type="file" 
            ref={fileInputRef} 
            accept=".xlsx, .xls" 
            onChange={handleExcelUpload} 
            disabled={isImporting} 
          />
        </label>
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
                  ) : ( <div><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Perlu Revisi</span>{item.alasan_penolakan && <p className="text-[10px] text-rose-600 mt-1.5 font-medium italic">&quot;{item.alasan_penolakan}&quot;</p>}</div> )}
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
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nama Lengkap & NIK</p>
                      <p className="text-xl font-bold text-slate-800">{selectedItem.nama_lengkap}</p>
                      <p className="text-sm font-mono text-slate-500 mt-1">NIK: {selectedItem.nik} <span className="mx-2 text-slate-300">|</span> KK: {selectedItem.no_kk || '-'}</p>
                      <div className="mt-3 text-xs text-slate-600 space-y-1">
                        <div><strong>Agama:</strong> {selectedItem.agama || '-'}</div>
                        <div><strong>Status Pernikahan:</strong> {selectedItem.status_pernikahan || '-'}</div>
                        <div><strong>Pendidikan Terakhir:</strong> {selectedItem.pendidikan_terakhir || '-'}</div>
                      </div>
                    </div>
                    
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
                    <div className="col-span-2"><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Catatan Tambahan</p><p className="text-sm text-slate-700 leading-snug font-medium">{selectedItem.catatan_tambahan || '-'}</p></div>
                 </div>
                 <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Bukti Lampiran (Klik untuk perbesar)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       {[{title: 'KTP', src: selectedItem.foto_ktp}, {title: 'Diri', src: selectedItem.foto_diri}, {title: 'Rumah', src: selectedItem.foto_rumah}, {title: 'Pekerjaan', src: selectedItem.foto_pekerjaan}].map((foto, idx) => (
                          <div key={idx} onClick={() => foto.src && window.open(foto.src, '_blank')} className="group relative h-32 bg-slate-50 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:shadow-md transition-all">
                             {foto.src ? <img src={getDirectImageUrl(foto.src)} alt={foto.title} className="w-full h-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase text-slate-400">{foto.title} Kosong</div>}
                             <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><span className="text-white text-[10px] font-bold uppercase tracking-wider">Buka Dokumen</span></div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
              {selectedItem.status === 'Perlu Revisi' && (
                 <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-end shrink-0"><button onClick={() => { setSelectedItem(null); handleEdit(selectedItem); }} className="px-4 py-2 rounded-lg bg-blue-900 text-white font-bold text-xs hover:bg-blue-800 transition">Revisi Data Sekarang</button></div>
              )}
           </div>
        </div>
      )}
    </div>
  )
}
