// ==========================================
// File: utils/operatorDaerahHelpers.js
// ==========================================

// KK-01: Memformat payload untuk insert ke Supabase beserta URL gambar
export const formatPayloadPengajuan = (nik, namaLengkap, kota, urlsDokumen) => {
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
    created_at: new Date().toISOString()
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