// ==========================================
// File: utils/superAdminHelpers.js
// ==========================================

// Fungsi untuk SA-01: Menghitung statistik dasbor
export const hitungStatistikDasbor = (users = [], bansosData = []) => {
  return {
    users: users.length,
    totalData: bansosData.length,
    cities: users.filter(u => u.role === 'operator').length
  };
};

// Fungsi untuk SA-02: Memformat payload user baru sebelum dikirim ke API/Supabase
export const formatPayloadUserBaru = (email, password, role, kota) => {
  // Menggunakan identifier fungsional 'KK' untuk wilayah aktor Kabupaten/Kota
  const wilayah_id = role === 'operator' && kota ? `KK-${kota.toUpperCase().substring(0, 3)}` : null;
  
  return {
    email,
    password,
    user_metadata: { role, wilayah_id }
  };
};

// Fungsi untuk SA-03: Memfilter data bansos berdasarkan pilihan dropdown
export const filterDataMonitoring = (dataBansos = [], filterProgram, filterWilayah) => {
  return dataBansos.filter(item => {
    const matchProgram = filterProgram === 'Semua' || item.jenis_bantuan === filterProgram;
    const matchWilayah = filterWilayah === 'Semua' || item.kabupaten_kota === filterWilayah;
    return matchProgram && matchWilayah;
  });
};

// Fungsi untuk SA-04: Memformat payload untuk pencatatan log
export const formatPayloadLog = (email, role, aksi, keterangan) => {
  return {
    email_pengguna: email,
    role: role,
    aksi: aksi,
    keterangan: keterangan,
    created_at: new Date().toISOString()
  };
};