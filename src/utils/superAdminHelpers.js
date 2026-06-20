// ==========================================
// File: utils/superAdminHelpers.js
// ==========================================

// --- FUNGSI LAMA (Tetap ada) ---
export const hitungStatistikDasbor = (users = [], bansosData = []) => {
  return {
    users: users.length,
    totalData: bansosData.length,
    cities: users.filter(u => u.role === 'operator').length
  };
};

export const formatPayloadUserBaru = (email, password, role, kota) => {
  const wilayah_id = role === 'operator' && kota ? `KK-${kota.toUpperCase().substring(0, 3)}` : null;
  return { email, password, user_metadata: { role, wilayah_id } };
};

export const filterDataMonitoring = (dataBansos = [], filterProgram, filterWilayah) => {
  return dataBansos.filter(item => {
    const matchProgram = filterProgram === 'Semua' || item.jenis_bantuan === filterProgram;
    const matchWilayah = filterWilayah === 'Semua' || item.kabupaten_kota === filterWilayah;
    return matchProgram && matchWilayah;
  });
};

export const formatPayloadLog = (email, role, aksi, keterangan) => {
  return {
    email_pengguna: email,
    role: role,
    aksi: aksi,
    keterangan: keterangan,
    created_at: new Date().toISOString()
  };
};

// --- FUNGSI BARU UNTUK TESTING ---

// SA-01: Validasi Hak Akses (RBAC)
export const cekAksesAdmin = (role) => {
  return role === 'superadmin';
};

// SA-02: Format Data untuk Export (Excel/PDF)
export const formatDataExport = (dataBansos = []) => {
  // Hanya mengambil kolom yang penting untuk laporan
  return dataBansos.map((item, index) => ({
    No: index + 1,
    NIK: item.nik,
    Nama_Penerima: (item.nama_lengkap || item.nama || '').toUpperCase(),
    Program: item.jenis_bantuan,
    Wilayah: item.kabupaten_kota,
    Status: item.status
  }));
};

// SA-03: Edit dan Nonaktifkan Akun
export const formatPayloadEditUser = (dataLama, dataBaru) => {
  return { ...dataLama, ...dataBaru, updated_at: new Date().toISOString() };
};

export const formatPayloadNonaktifUser = (userId) => {
  return { id: userId, is_active: false, updated_at: new Date().toISOString() };
};

// SA-03: Persiapan Payload Email Otomatis
export const siapkanPayloadEmail = (emailTujuan, passwordAwal, role) => {
  return {
    to: emailTujuan,
    subject: 'Informasi Akun SIP Bansos Dinsos Jatim',
    html: `Halo, akun Anda sebagai ${role} telah dibuat. Password sementara: ${passwordAwal}`
  };
};

export const siapkanPayloadEmailReset = (emailTujuan, passwordBaru) => {
  return {
    to: emailTujuan,
    subject: 'Pemberitahuan: Reset Kata Sandi Akun Sistem Bansos',
    html: `Halo, kata sandi untuk akun Anda telah direset oleh Super Admin. Kata sandi baru Anda: ${passwordBaru}`
  };
};  

// SA-04: Pengelompokan dan Kategori Aksi Audit Log
export const getActionDetails = (aksi) => {
  const normAksi = aksi?.toLowerCase() || '';
  if (normAksi.includes('buat') || normAksi.includes('akun baru')) {
    return { bgColor: 'bg-emerald-100', textColor: 'text-emerald-700', type: 'create' };
  }
  if (normAksi.includes('hapus akun') || normAksi.includes('hapus data') || normAksi.includes('bersihkan')) {
    return { bgColor: 'bg-rose-100', textColor: 'text-rose-700', type: 'delete' };
  }
  if (normAksi.includes('reset') || normAksi.includes('password') || normAksi.includes('ubah password')) {
    return { bgColor: 'bg-amber-100', textColor: 'text-amber-700', type: 'security' };
  }
  if (normAksi.includes('validasi') || normAksi.includes('setuju') || normAksi.includes('status aktif')) {
    return { bgColor: 'bg-teal-100', textColor: 'text-teal-700', type: 'validate' };
  }
  if (normAksi.includes('input') || normAksi.includes('revisi') || normAksi.includes('tambah')) {
    return { bgColor: 'bg-blue-100', textColor: 'text-blue-700', type: 'edit' };
  }
  if (normAksi.includes('export') || normAksi.includes('excel') || normAksi.includes('import') || normAksi.includes('download')) {
    return { bgColor: 'bg-indigo-100', textColor: 'text-indigo-700', type: 'export' };
  }
  return { bgColor: 'bg-slate-100', textColor: 'text-slate-700', type: 'default' };
};