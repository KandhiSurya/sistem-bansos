'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { read, utils } from 'xlsx'
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
  setImportExcelTrigger
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterProgram, setFilterProgram] = useState('Semua')
  const [filterStatus, setFilterStatus] = useState('Semua')
  const [filterWaktu, setFilterWaktu] = useState('')
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



  useEffect(() => {
    let data = historyData;
    if (filterProgram !== 'Semua') {
      data = data.filter(d => d.jenis_bantuan === filterProgram);
    }
    if (filterStatus !== 'Semua') {
      data = data.filter(d => d.status === filterStatus);
    }
    if (filterWaktu) {
      data = data.filter(d => {
        const itemLocalDate = new Date(d.created_at);
        const year = itemLocalDate.getFullYear();
        const month = String(itemLocalDate.getMonth() + 1).padStart(2, '0');
        const day = String(itemLocalDate.getDate()).padStart(2, '0');
        const itemDateString = `${year}-${month}-${day}`;
        return itemDateString === filterWaktu;
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

            const getRowValue = (row, possibleKeys) => {
              if (!row) return null;
              const rowKeys = Object.keys(row);
              const matchedKey = rowKeys.find(key => {
                const normKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                return possibleKeys.some(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normKey);
              });
              return matchedKey ? row[matchedKey] : null;
            };

            // Filter baris kosong atau baris yang tidak memiliki NIK dan Nama Lengkap
            validRows = rowsData.filter(row => {
              const hasName = getRowValue(row, ['NAMA', 'nama_lengkap', 'Nama Lengkap'])
              const hasNik = getRowValue(row, ['NIK', 'nik'])
              return hasName && hasNik
            })
          } else {
            // Fallback ke utils.sheet_to_json untuk data mock testing
            const jsonData = utils.sheet_to_json(worksheet || {})
            const getRowValue = (row, possibleKeys) => {
              if (!row) return null;
              const rowKeys = Object.keys(row);
              const matchedKey = rowKeys.find(key => {
                const normKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                return possibleKeys.some(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normKey);
              });
              return matchedKey ? row[matchedKey] : null;
            };
            validRows = jsonData.filter(row => {
              const hasName = getRowValue(row, ['NAMA', 'nama_lengkap', 'Nama Lengkap'])
              const hasNik = getRowValue(row, ['NIK', 'nik'])
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

          const parseStructuredNotes = (notesStr, existingRow) => {
            if (!notesStr || !notesStr.includes('No. KK:')) {
              return { ...existingRow, catatan_tambahan: notesStr };
            }

            const result = { ...existingRow };
            const pairs = notesStr.split(';').map(p => p.trim());
            const parsedData = {};

            pairs.forEach(pair => {
              const parts = pair.split(':');
              if (parts.length >= 2) {
                const key = parts[0].trim().toLowerCase();
                const val = parts.slice(1).join(':').trim();
                parsedData[key] = val;
              }
            });

            // 1. No. KK
            if (parsedData['no. kk'] && (!result.no_kk || result.no_kk === '-')) {
              result.no_kk = parsedData['no. kk'].replace(/\D/g, '').substring(0, 16);
            }

            // 2. Pekerjaan
            if (!result.pekerjaan || result.pekerjaan === '-' || result.pekerjaan === '') {
              const pekSuami = parsedData['pekerjaan suami'];
              const pekIstri = parsedData['pekerjaan istri'];
              const pekerjaan = parsedData['pekerjaan'];
              if (pekerjaan && pekerjaan !== '-') {
                result.pekerjaan = pekerjaan;
              } else if (pekSuami && pekSuami !== '-') {
                result.pekerjaan = pekSuami;
              } else if (pekIstri && pekIstri !== '-') {
                result.pekerjaan = pekIstri;
              }
            }

            // 3. Tanggungan
            if (!result.tanggungan || result.tanggungan === 0) {
              const tanggunganStr = parsedData['jumlah tanggungan'] || parsedData['tanggungan'];
              if (tanggunganStr) {
                const num = parseInt(tanggunganStr.replace(/\D/g, ''));
                if (!isNaN(num)) {
                  result.tanggungan = num;
                }
              }
            }

            // 4. Pendapatan
            if (!result.pendapatan || result.pendapatan === '< Rp 500.000' || result.pendapatan === '') {
              const penStr = parsedData['penghasilan suami/istri per bulan'] || parsedData['penghasilan'] || parsedData['pendapatan'];
              if (penStr) {
                const num = parseInt(penStr.replace(/\D/g, ''));
                if (!isNaN(num)) {
                  if (num < 500000) {
                    result.pendapatan = '< Rp 500.000';
                  } else if (num >= 500000 && num <= 1000000) {
                    result.pendapatan = 'Rp 500.000 - Rp 1.000.000';
                  } else if (num > 1000000 && num <= 2000000) {
                    result.pendapatan = 'Rp 1.000.000 - Rp 2.000.000';
                  } else {
                    result.pendapatan = '> Rp 2.000.000';
                  }
                }
              }
            }

            // Set catatan_tambahan to the actual human notes if present in the parsed keys
            const humanNotes = parsedData['catatan tambahan'] || parsedData['catatan'] || parsedData['catatan_tambahan'];
            if (humanNotes && !humanNotes.includes('No. KK:') && !humanNotes.includes('TTL:')) {
              result.catatan_tambahan = humanNotes;
            } else {
              result.catatan_tambahan = null;
            }

            return result;
          }

          const invalidRows = []
          const normalizeKabKota = (str) => {
            if (!str) return ''
            return String(str)
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '')
              .replace(/^(kabupaten|kota|kabkota|kab|kot)/, '')
              .replace(/(kabupaten|kota|kabkota|kab|kot)$/, '')
          }

          const formattedData = []
          validRows.forEach((row, index) => {
            const getRowValue = (row, possibleKeys) => {
              if (!row) return null;
              const rowKeys = Object.keys(row);
              const matchedKey = rowKeys.find(key => {
                const normKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                return possibleKeys.some(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normKey);
              });
              return matchedKey ? row[matchedKey] : null;
            };

            const nikVal = getRowValue(row, ['NIK', 'nik']) || '';
            let namaVal = getRowValue(row, ['NAMA', 'nama_lengkap', 'Nama Lengkap']) || '';
            
            // Pisahkan NIK dari Nama jika tergabung dengan koma (contoh: "ABD DJALAL, 3507...")
            if (typeof namaVal === 'string' && namaVal.includes(',')) {
              namaVal = namaVal.split(',')[0].trim();
            }

            const kabKotaRowVal = getRowValue(row, ['kabupaten_kota', 'Kabupaten/Kota', 'Kabupaten', 'Kota', 'Wilayah', 'kabupaten', 'kota', 'wilayah', 'Nama Kota', 'Nama Kabupaten']);
            let isRowValid = true;
            if (kabKotaRowVal) {
              const rowNorm = normalizeKabKota(kabKotaRowVal)
              const profileNorm = normalizeKabKota(userProfile.kabupaten_kota)
              if (rowNorm !== profileNorm) {
                isRowValid = false;
                invalidRows.push({
                  index: index + 2, // Baris ke-2 dst. karena header baris ke-1
                  nik: String(nikVal).trim(),
                  nama: String(namaVal).trim(),
                  wilayah: String(kabKotaRowVal).trim()
                })
              }
            }

            if (isRowValid) {
              const noKkVal = getRowValue(row, ['no_kk', 'No. KK', 'No KK', 'KK', 'Nomor KK', 'Nomor Kartu Keluarga']);
              
              let alamatVal = getRowValue(row, ['ALAMAT', 'alamat', 'Alamat', 'Alamat Domisili']) || '-';
              const desaVal = getRowValue(row, ['DESA/KEL', 'Desa/Kel', 'Desa', 'Kelurahan']) || '';
              const kecVal = getRowValue(row, ['KEC', 'Kec', 'Kecamatan']) || '';
              if (desaVal || kecVal) {
                const parts = [alamatVal];
                if (desaVal) parts.push(`Kel/Desa. ${desaVal}`);
                if (kecVal) parts.push(`Kec. ${kecVal}`);
                alamatVal = parts.join(', ');
              }
              
              const pekerjaanVal = getRowValue(row, ['pekerjaan', 'Pekerjaan']) || '-';
              const pendapatanVal = getRowValue(row, ['pendapatan', 'Pendapatan']) || '< Rp 500.000';
              const tanggunganVal = getRowValue(row, ['tanggungan', 'Tanggungan']) || 0;
              const agamaVal = getRowValue(row, ['agama', 'Agama']);
              const statusPernikahanVal = getRowValue(row, ['status_pernikahan', 'Status Pernikahan']);
              const pendidikanTerakhirVal = getRowValue(row, ['pendidikan_terakhir', 'Pendidikan Terakhir', 'Pendidikan']);
              const catatanTambahanVal = getRowValue(row, ['catatan_tambahan', 'Catatan Tambahan', 'Catatan']);
              
              const jenisBantuanVal = getRowValue(row, ['jenis_bantuan', 'Program', 'Jenis Bantuan']) || 'Belum Ditentukan';
              const statusVal = getRowValue(row, ['status', 'Status Validasi', 'Status']) || 'Menunggu Validasi';
              const alasanPenolakanVal = getRowValue(row, ['alasan_penolakan', 'Catatan Penolakan', 'Catatan', 'Alasan Penolakan']) || null;
              const statusPenerimaVal = getRowValue(row, ['status_penerima', 'Keaktifan', 'Status Penerima']) || 'Aktif';
              
              const fotoKtpVal = getRowValue(row, ['foto_ktp', 'Link Foto KTP', 'Foto KTP', 'KTP']) || null;
              const fotoDiriVal = getRowValue(row, ['foto_diri', 'Link Foto Diri', 'Foto Diri', 'Diri']) || null;
              const fotoRumahVal = getRowValue(row, ['foto_rumah', 'Link Foto Rumah', 'Foto Rumah', 'Rumah']) || null;
              const fotoPekerjaanVal = getRowValue(row, ['foto_pekerjaan', 'Link Foto Pekerjaan', 'Foto Pekerjaan', 'Pekerjaan']) || null;

              const rawRowObj = {
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
              };

              const parsedRowObj = parseStructuredNotes(rawRowObj.catatan_tambahan, rawRowObj);
              formattedData.push(parsedRowObj);
            }
          })

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
            let message = `Impor selesai! ${finalDataToInsert.length} data berhasil diimpor!`
            if (invalidRows.length > 0 || totalSkipped > 0) {
              message += ` Catatan:`
              if (invalidRows.length > 0) {
                message += ` ${invalidRows.length} data dilewati karena wilayah tidak sesuai.`
              }
              if (totalSkipped > 0) {
                message += ` ${totalSkipped} data dilewati karena NIK duplikat/sudah terdaftar.`
              }
            }

            toast.success(message, { id: loadingToast, duration: 8000 })
            await catatLog(
              "Import Excel", 
              `Mengimpor data bansos warga secara massal sebanyak ${finalDataToInsert.length} data (${invalidRows.length} dilewati salah wilayah, ${totalSkipped} dilewati duplikat).`
            )
          } else {
            let errorMsg = `Gagal impor: Terdapat ${invalidRows.length} data dengan kabupaten/kota yang tidak sesuai dengan wilayah Anda (${userProfile.kabupaten_kota}).`
            if (totalSkipped > 0) {
              errorMsg += ` Sisa data dilewati karena duplikat/sudah terdaftar.`
            }
            toast.error(errorMsg, { id: loadingToast, duration: 8000 })
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
                 <div className="flex items-center gap-2"><button onClick={() => setSelectedItem(null)} className="w-8 h-8 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-100 hover:text-slate-800 transition">&times;</button></div>
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
