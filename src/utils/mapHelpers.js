// ==========================================
// File: utils/mapHelpers.js
// ==========================================

// Daftar koordinat pusat (Latitude, Longitude) untuk 38 Kabupaten/Kota di Jawa Timur
export const KOORDINAT_JATIM = {
  "Kabupaten Bangkalan": [-7.025, 112.75],
  "Kabupaten Banyuwangi": [-8.219, 114.369],
  "Kabupaten Blitar": [-8.13, 112.25],
  "Kabupaten Bojonegoro": [-7.15, 111.88],
  "Kabupaten Bondowoso": [-7.91, 113.82],
  "Kabupaten Gresik": [-7.15, 112.65],
  "Kabupaten Jember": [-8.18, 113.68],
  "Kabupaten Jombang": [-7.55, 112.23],
  "Kabupaten Kediri": [-7.83, 112.15],
  "Kabupaten Lamongan": [-7.12, 112.41],
  "Kabupaten Lumajang": [-8.13, 113.22],
  "Kabupaten Madiun": [-7.62, 111.65],
  "Kabupaten Magetan": [-7.65, 111.32],
  "Kabupaten Malang": [-8.15, 112.65],
  "Kabupaten Mojokerto": [-7.55, 112.5],
  "Kabupaten Nganjuk": [-7.6, 111.9],
  "Kabupaten Ngawi": [-7.4, 111.44],
  "Kabupaten Pacitan": [-8.12, 111.16],
  "Kabupaten Pamekasan": [-7.15, 113.48],
  "Kabupaten Pasuruan": [-7.7, 112.8],
  "Kabupaten Ponorogo": [-7.95, 111.48],
  "Kabupaten Probolinggo": [-7.85, 113.35],
  "Kabupaten Sampang": [-7.05, 113.25],
  "Kabupaten Sidoarjo": [-7.45, 112.7],
  "Kabupaten Situbondo": [-7.72, 114.0],
  "Kabupaten Sumenep": [-7.0, 113.86],
  "Kabupaten Trenggalek": [-8.15, 111.62],
  "Kabupaten Tuban": [-6.9, 112.05],
  "Kabupaten Tulungagung": [-8.1, 111.9],
  "Kota Batu": [-7.87, 112.52],
  "Kota Blitar": [-8.1, 112.17],
  "Kota Kediri": [-7.82, 112.02],
  "Kota Madiun": [-7.63, 111.52],
  "Kota Malang": [-7.98, 112.62],
  "Kota Mojokerto": [-7.47, 112.43],
  "Kota Pasuruan": [-7.64, 112.91],
  "Kota Probolinggo": [-7.76, 113.21],
  "Kota Surabaya": [-7.26, 112.75]
};

// Mengagregasikan total dan status pengajuan bansos per kabupaten/kota
export const hitungStatistikPerWilayah = (dataBansos = []) => {
  const stats = {};
  
  // Inisialisasi setiap kota dengan nilai nol
  Object.keys(KOORDINAT_JATIM).forEach(city => {
    stats[city] = { total: 0, disetujui: 0, pending: 0, revisi: 0 };
  });

  // Iterasi data bansos dan hitung
  dataBansos.forEach(item => {
    const city = item.kabupaten_kota;
    if (!city || !stats[city]) return;

    stats[city].total += 1;
    if (item.status === 'Disetujui') {
      stats[city].disetujui += 1;
    } else if (item.status === 'Menunggu Validasi') {
      stats[city].pending += 1;
    } else if (item.status === 'Perlu Revisi') {
      stats[city].revisi += 1;
    }
  });

  return stats;
};
