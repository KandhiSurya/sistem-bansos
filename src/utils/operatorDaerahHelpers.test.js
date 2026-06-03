import { 
  formatPayloadPengajuan, 
  filterRiwayatLokal, 
  hitungStatistikLokal 
} from './operatorDaerahHelpers';

describe('Modul Operator Daerah Utils', () => {

  describe('KK-01: Form Pengajuan', () => {
    it('berhasil format payload insert dengan url foto dan id KK', () => {
      const mockUrls = {
        ktp: 'https://storage.supabase.com/ktp.jpg',
        diri: 'https://storage.supabase.com/diri.jpg',
        rumah: 'https://storage.supabase.com/rumah.jpg',
        pekerjaan: 'https://storage.supabase.com/kerja.jpg'
      };

      const payload = formatPayloadPengajuan('3578012345678901', 'Yoga Atmadja', 'Surabaya', mockUrls);

      expect(payload.nik).toBe('3578012345678901');
      expect(payload.nama_lengkap).toBe('Yoga Atmadja');
      expect(payload.wilayah_id).toBe('KK-SUR'); 
      expect(payload.foto_ktp).toBe('https://storage.supabase.com/ktp.jpg');
      expect(payload.foto_pekerjaan).toBe('https://storage.supabase.com/kerja.jpg');
      expect(payload.status).toBe('Menunggu');
    });
  });

  describe('KK-02: Riwayat Pengajuan', () => {
    it('tabel cuma nampilin data dari wilayah operator yang login', () => {
      const mockSemuaData = [
        { id: 1, nama_lengkap: 'Budi', wilayah_id: 'KK-SUR' },
        { id: 2, nama_lengkap: 'Siti', wilayah_id: 'KK-SDA' }, 
        { id: 3, nama_lengkap: 'Andi', wilayah_id: 'KK-SUR' },
      ];

      const idOperatorAktif = 'KK-SUR';
      const hasilFilter = filterRiwayatLokal(mockSemuaData, idOperatorAktif);

      expect(hasilFilter).toHaveLength(2);
      expect(hasilFilter[0].nama_lengkap).toBe('Budi');
      expect(hasilFilter[1].nama_lengkap).toBe('Andi');
      
      const adaWilayahLain = hasilFilter.some(item => item.wilayah_id !== 'KK-SUR');
      expect(adaWilayahLain).toBe(false);
    });
  });

  describe('KK-03: Statistik Dasbor', () => {
    it('kalkulasi total data menunggu dan disetujui akurat', () => {
      const mockDataLokal = [
        { status: 'Menunggu' },
        { status: 'Menunggu' },
        { status: 'Disetujui' },
        { status: 'Perlu Revisi' },
        { status: 'Disetujui' }
      ];

      const stats = hitungStatistikLokal(mockDataLokal);

      expect(stats.total).toBe(5);
      expect(stats.menunggu).toBe(2);
      expect(stats.disetujui).toBe(2);
      expect(stats.revisi).toBe(1);
    });
  });

});