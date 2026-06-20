// ==========================================
// File: utils/operatorDaerahHelpers.js
// ==========================================

// KK-01: Memformat payload untuk insert ke Supabase beserta URL gambar
export const formatPayloadPengajuan = (nik, namaLengkap, kota, urlsDokumen, profilTambahan = {}) => {
  // Menggunakan identifier fungsional 'KK'
  const wilayah_id = `KK-${kota.toUpperCase().substring(0, 3)}`;
  
  return {
    nik: nik,
    nama_lengkap: namaLengkap,
    wilayah_id: wilayah_id,
    foto_ktp: urlsDokumen.ktp || null,
    foto_diri: urlsDokumen.diri || null,
    foto_rumah: urlsDokumen.rumah || null,
    foto_pekerjaan: urlsDokumen.pekerjaan || null,
    status: 'Menunggu',
    created_at: new Date().toISOString(),
    agama: profilTambahan.agama || null,
    status_pernikahan: profilTambahan.status_pernikahan || null,
    pendidikan_terakhir: profilTambahan.pendidikan_terakhir || null,
    catatan_tambahan: profilTambahan.catatan_tambahan || null
  };
};

// KK-02: Memfilter riwayat pengajuan khusus untuk wilayah operator yang sedang login
export const filterRiwayatLokal = (semuaPengajuan = [], wilayahOperatorAktif) => {
  return semuaPengajuan.filter(item => item.wilayah_id === wilayahOperatorAktif);
};

// KK-03: Menghitung agregasi data untuk dasbor lokal
export const hitungStatistikLokal = (dataLokal = []) => {
  return dataLokal.reduce((acc, curr) => {
    acc.total += 1;
    if (curr.status === 'Menunggu') acc.menunggu += 1;
    if (curr.status === 'Disetujui') acc.disetujui += 1;
    if (curr.status === 'Perlu Revisi') acc.revisi += 1;
    return acc;
  }, { total: 0, menunggu: 0, disetujui: 0, revisi: 0 });
};

// --- TAMBAHAN VALIDASI & REVISI (PXP) ---

// KK-01: Validasi NIK wajib 16 digit angka
export const validasiNIK = (nik) => {
  const regex = /^[0-9]{16}$/;
  return regex.test(nik);
};

// KK-01: Validasi No. KK wajib 16 digit angka
export const validasiNoKK = (noKK) => {
  const regex = /^[0-9]{16}$/;
  return regex.test(noKK);
};

// KK-01: Validasi gambar (Maks 2MB, ekstensi jpg/jpeg/png)
export const validasiFileGambar = (namaFile, ukuranBytes) => {
  const ekstensiValid = ['jpg', 'jpeg', 'png'];
  const ekstensi = namaFile.split('.').pop().toLowerCase();
  const validEkstensi = ekstensiValid.includes(ekstensi);
  
  const ukuranMaksimal = 2 * 1024 * 1024; // 2MB dalam Bytes
  const validUkuran = ukuranBytes <= ukuranMaksimal;

  return validEkstensi && validUkuran;
};

// KK-02: Pengecekan apakah data boleh diedit/direvisi operator
export const cekBisaRevisi = (status) => {
  return status === 'Perlu Revisi' || status === 'Menunggu';
};

// KK-02: Memformat payload saat operator menyimpan hasil revisi
export const formatPayloadRevisi = (dataLama, dataBaru) => {
  return {
    ...dataLama,
    ...dataBaru,
    status: 'Menunggu', // Dikembalikan ke Menunggu agar diperiksa ulang Bidang
    updated_at: new Date().toISOString()
  };
};