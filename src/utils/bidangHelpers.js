// ==========================================
// File: utils/bidangHelpers.js
// ==========================================

// BD-01 & BD-03: Pencarian real-time berdasarkan NIK atau Nama
export const cariDataBidang = (data = [], keyword = '') => {
  if (!keyword) return data;
  const lowerKeyword = keyword.toLowerCase();
  
  return data.filter(item =>
    (item.nama_lengkap && item.nama_lengkap.toLowerCase().includes(lowerKeyword)) ||
    (item.nik && item.nik.includes(keyword))
  );
};

// BD-02: Verifikasi status & trigger notifikasi email
export const prosesVerifikasi = async (payloadPengajuan, statusBaru, layananKirimEmail) => {
  const updatedPayload = {
    ...payloadPengajuan,
    status: statusBaru,
    updated_at: new Date().toISOString()
  };

  // Jika disetujui, panggil layanan API eksternal (email)
  if (statusBaru === 'Disetujui' && typeof layananKirimEmail === 'function') {
    await layananKirimEmail(payloadPengajuan.id, 'Selamat, pengajuan bantuan Anda telah diverifikasi dan disetujui oleh Provinsi.');
  }

  return updatedPayload;
};

// BD-04 & BD-05: Toggle keaktifan string ('Aktif'/'Nonaktif') tanpa alasan spesifik
export const toggleStatusKeaktifan = (dataArray = [], targetId) => {
  return dataArray.map(item =>
    item.id === targetId
      ? { ...item, status_penerima: (item.status_penerima || 'Aktif') === 'Aktif' ? 'Nonaktif' : 'Aktif' } 
      : item
  );
};

// BD-06: Agregasi dasbor tingkat provinsi
export const hitungStatistikProvinsi = (semuaData = []) => {
  return semuaData.reduce((acc, curr) => {
    acc.total += 1;
    if (curr.status === 'Menunggu Validasi') acc.menunggu += 1;
    if (curr.status === 'Disetujui') acc.disetujui += 1;
    if (curr.status === 'Ditolak' || curr.status === 'Perlu Revisi') acc.ditolakAtauRevisi += 1;
    return acc;
  }, { total: 0, menunggu: 0, disetujui: 0, ditolakAtauRevisi: 0 });
};

// --- TAMBAHAN UNTUK MENUTUPI CELAH USER STORY ---

// BD-04: Menonaktifkan warga beserta pencatatan alasannya
export const prosesNonAktifData = (payloadLama, alasan) => {
  return {
    ...payloadLama,
    status_penerima: 'Nonaktif',
    alasan_nonaktif: alasan,
    updated_at: new Date().toISOString()
  };
};

// BD-05: Memisahkan data aktif untuk layar utama dan data arsip
export const pisahkanDataArsip = (semuaData = []) => {
  return {
    dataAktif: semuaData.filter(item => (item.status_penerima || 'Aktif') !== 'Nonaktif'),
    dataArsip: semuaData.filter(item => item.status_penerima === 'Nonaktif')
  };
};

// BD-01: Filter antrean berdasarkan program bantuan (Klasifikasi Program)
export const filterAntreanProgram = (dataAntrean = [], programPilihan) => {
  if (programPilihan === 'Semua') return dataAntrean;
  return dataAntrean.filter(item => item.jenis_bantuan === programPilihan);
};