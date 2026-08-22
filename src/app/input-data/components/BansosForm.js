'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import imageCompression from 'browser-image-compression'
import { supabase } from '@/lib/supabaseClient'

export default function BansosForm({
  userProfile,
  currentUserEmail,
  editId,
  cancelEdit,
  initData,
  catatLog,
  formData,
  setFormData,
  oldUrls,
  files,
  setFiles,
  setActiveTab
}) {
  const [uploading, setUploading] = useState(false)
  
  // NIK error states
  const [nikError, setNikError] = useState('')
  const [isCheckingNik, setIsCheckingNik] = useState(false)

  const handleFileChange = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]  
      setFiles(prev => ({ ...prev, [type]: file }))
    }
  }

  const compressImage = async (imageFile) => {
    if (!imageFile || !imageFile.type.startsWith('image/')) return imageFile;
    
    const options = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1280,
      useWebWorker: true
    };

    try {
      const compressedBlob = await imageCompression(imageFile, options);
      return new File([compressedBlob], imageFile.name, {
        type: compressedBlob.type,
        lastModified: Date.now(),
      });
    } catch (error) {
      console.error("Gagal mengompres gambar:", error);
      return imageFile;
    }
  };

  const uploadImage = async (file, path) => {
    if (!file) return null;
    const compressedFile = await compressImage(file);
    const fileName = `${path}-${Date.now()}.${compressedFile.name.split('.').pop()}`;
    
    const { error } = await supabase.storage
      .from('dokumen_bansos')
      .upload(fileName, compressedFile);
      
    if (error) throw error;
    
    const { data } = supabase.storage
      .from('dokumen_bansos')
      .getPublicUrl(fileName);
      
    return data.publicUrl;
  };

  const cekNikGanda = async (inputNik) => {
    if (inputNik.length !== 16) {
      setNikError('');
      return; 
    }

    setIsCheckingNik(true);
    setNikError('');

    let query = supabase
      .from('pengajuan_bantuan')
      .select('id, nik, jenis_bantuan, status')
      .eq('nik', inputNik);

    if (editId) {
      query = query.neq('id', editId);
    }

    const { data } = await query.maybeSingle();

    if (data) {
      setNikError(`⚠️ Ditolak: NIK ini sudah terdaftar pada antrean ${data.jenis_bantuan} (Status: ${data.status}).`);
    } else {
      setNikError(''); 
    }
    
    setIsCheckingNik(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!editId && (!files.ktp || !files.diri || !files.kerja || !files.rumah)) { 
      toast.error("Mohon lengkapi semua dokumen foto!"); 
      return 
    }
    if (!userProfile?.id || !userProfile?.kabupaten_kota) { 
      toast.error("Error: Identitas Akun tidak lengkap."); 
      return 
    }
    if (nikError) {
      toast.error("Harap perbaiki kesalahan NIK ganda sebelum mengirim.");
      return;
    }

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
        nik: formData.nik, 
        no_kk: formData.no_kk, 
        nama_lengkap: formData.nama, 
        alamat: formData.alamat,
        pekerjaan: formData.pekerjaan, 
        pendapatan: formData.pendapatan, 
        tanggungan: parseInt(formData.tanggungan),
        agama: formData.agama,
        status_pernikahan: formData.status_pernikahan,
        pendidikan_terakhir: formData.pendidikan_terakhir,
        catatan_tambahan: formData.catatan_tambahan || null,
        foto_ktp: urlKtp, 
        foto_diri: urlDiri, 
        foto_pekerjaan: urlKerja, 
        foto_rumah: urlRumah, 
        status: 'Menunggu Validasi',
        alasan_penolakan: null,
        jenis_bantuan: 'Belum Ditentukan',
        created_at: new Date().toISOString()
      }

      if (editId) {
        const { data: updatedData, error } = await supabase.from('pengajuan_bantuan')
          .update(payload)
          .eq('id', editId)
          .select() 

        if (error) throw error
        
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

      try { 
        await fetch('/api/operator/notify-bidang', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ 
            nama_pemohon: formData.nama, 
            jenis_bantuan: 'Menunggu Ketetapan', 
            kota_operator: userProfile.kabupaten_kota 
          }) 
        }) 
      } catch (e) {}

      await initData(); 
      cancelEdit(); 
      setActiveTab('history')
    } catch (error) { 
      toast.error("Gagal: " + error.message, { id: toastId }) 
    } finally { 
      setUploading(false) 
    }
  }

  return (
    <div className="p-6 md:p-10 animate-fadeIn">
      <form id="form-input" onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
        <div className="text-right text-xs text-slate-500 font-medium">
          Tanda <span className="text-rose-500 font-bold">*</span> wajib diisi
        </div>
        {editId && (
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl flex items-start gap-4 shadow-sm">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">Mode Revisi Data Aktif</h3>
              <p className="text-xs text-amber-700 mt-1">Silakan perbaiki isian form. Kosongkan input file jika foto lama tidak diganti.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Data Diri</h3>
            <p className="text-xs text-slate-500 mt-1">Informasi dasar sesuai KTP & KK.</p>
          </div>
          <div className="md:col-span-2 space-y-5 bg-slate-50 p-6 rounded-xl border border-slate-200">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  NIK (16 Digit) <span className="text-rose-500">*</span>
                </label>
                <input required type="text" maxLength="16" className="w-full px-4 py-3 border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-900 text-sm outline-none" value={formData.nik} onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setFormData({...formData, nik: val});
                  cekNikGanda(val);
                }} placeholder="0000..." />
                {nikError && <p className="text-rose-600 text-xs mt-1.5 font-semibold leading-relaxed">{nikError}</p>}
                {isCheckingNik && <p className="text-blue-900 text-[10px] mt-1.5 animate-pulse">Memeriksa NIK...</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  No. KK (16 Digit) <span className="text-rose-500">*</span>
                </label>
                <input required type="text" maxLength="16" className="w-full px-4 py-3 border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-900 text-sm outline-none" value={formData.no_kk} onChange={e => setFormData({...formData, no_kk: e.target.value.replace(/\D/g, '')})} placeholder="0000..." />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input required type="text" className="w-full px-4 py-3 border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-900 text-sm outline-none" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} placeholder="Sesuai KTP" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Agama <span className="text-rose-500">*</span>
                </label>
                <select required className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-900 text-sm bg-white outline-none" value={formData.agama || ''} onChange={e => setFormData({...formData, agama: e.target.value})}>
                  <option value="">Pilih Agama</option>
                  <option value="Islam">Islam</option>
                  <option value="Kristen Protestan">Kristen Protestan</option>
                  <option value="Kristen Katolik">Kristen Katolik</option>
                  <option value="Hindu">Hindu</option>
                  <option value="Buddha">Buddha</option>
                  <option value="Khonghucu">Khonghucu</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Status Pernikahan <span className="text-rose-500">*</span>
                </label>
                <select required className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-900 text-sm bg-white outline-none" value={formData.status_pernikahan || ''} onChange={e => setFormData({...formData, status_pernikahan: e.target.value})}>
                  <option value="">Pilih Status</option>
                  <option value="Belum Kawin">Belum Kawin</option>
                  <option value="Kawin">Kawin</option>
                  <option value="Cerai Hidup">Cerai Hidup</option>
                  <option value="Cerai Mati">Cerai Mati</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Pendidikan Terakhir <span className="text-rose-500">*</span>
                </label>
                <select required className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-900 text-sm bg-white outline-none" value={formData.pendidikan_terakhir || ''} onChange={e => setFormData({...formData, pendidikan_terakhir: e.target.value})}>
                  <option value="">Pilih Pendidikan</option>
                  <option value="Tidak Sekolah">Tidak Sekolah</option>
                  <option value="SD">SD</option>
                  <option value="SMP">SMP</option>
                  <option value="SMA/SMK">SMA/SMK</option>
                  <option value="Diploma (D1-D4)">Diploma (D1-D4)</option>
                  <option value="Sarjana (S1)">Sarjana (S1)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Alamat Domisili <span className="text-rose-500">*</span>
              </label>
              <textarea required rows="2" className="w-full px-4 py-3 border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-900 text-sm outline-none" value={formData.alamat} onChange={e => setFormData({...formData, alamat: e.target.value})} placeholder="Jalan, RT/RW, Kelurahan..."></textarea>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Catatan Tambahan (Opsional)</label>
              <textarea rows="2" className="w-full px-4 py-3 border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-900 text-sm outline-none" value={formData.catatan_tambahan || ''} onChange={e => setFormData({...formData, catatan_tambahan: e.target.value})} placeholder="Catatan medis, kondisi khusus, dll."></textarea>
            </div>
          </div>
        </div>

        <hr className="border-slate-200" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Profil Sosial Ekonomi</h3>
            <p className="text-xs text-slate-500 mt-1">Kriteria penentuan kelayakan.</p>
          </div>
          <div className="md:col-span-2 space-y-5 bg-slate-50 p-6 rounded-xl border border-slate-200">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Pekerjaan Utama <span className="text-rose-500">*</span>
                </label>
                <input required type="text" className="w-full px-4 py-3 border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-900 text-sm outline-none" value={formData.pekerjaan} onChange={e => setFormData({...formData, pekerjaan: e.target.value})} placeholder="Cth: Buruh Harian" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Jumlah Tanggungan <span className="text-rose-500">*</span>
                </label>
                <input required type="number" min="0" className="w-full px-4 py-3 border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-blue-900 text-sm outline-none" value={formData.tanggungan} onChange={e => setFormData({...formData, tanggungan: e.target.value})} placeholder="Jumlah anggota keluarga" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Pendapatan Rata-Rata / Bulan <span className="text-rose-500">*</span>
                </label>
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
          <div className="md:col-span-1">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Dokumen Bukti</h3>
            <p className="text-xs text-slate-500 mt-1">Unggah foto kondisi terbaru (Max 2MB/foto).</p>
          </div>
          <div className="md:col-span-2 bg-slate-50 p-6 rounded-xl border border-slate-200">
            <div className="grid grid-cols-2 gap-4">
              {['ktp', 'diri', 'kerja', 'rumah'].map((type) => (
                <div key={type} className="bg-white p-4 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                    {type === 'ktp' ? 'Foto E-KTP' : type === 'diri' ? 'Foto Diri' : type === 'kerja' ? 'Foto Pekerjaan' : 'Foto Rumah'}
                    {!editId && <span className="text-rose-500 font-bold ml-1">*</span>}
                  </label>
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
  )
}
