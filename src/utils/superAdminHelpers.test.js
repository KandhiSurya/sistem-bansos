import { 
  hitungStatistikDasbor, 
  formatPayloadUserBaru, 
  filterDataMonitoring, 
  formatPayloadLog 
} from './superAdminHelpers';

describe('Modul Super Admin Utils', () => {

  describe('SA-01: Dashboard', () => {
    it('bisa hitung total user dan data bansos dengan benar', () => {
      const mockUsers = [
        { role: 'operator' }, { role: 'bidang' }, { role: 'operator' }
      ];
      const mockBansos = [{}, {}, {}, {}];

      const stats = hitungStatistikDasbor(mockUsers, mockBansos);

      expect(stats.users).toBe(3); 
      expect(stats.totalData).toBe(4); 
      expect(stats.cities).toBe(2); 
    });
  });

  describe('SA-02: Manajemen User', () => {
    it('berhasil generate payload user baru dengan prefix KK untuk wilayah', () => {
      const payload = formatPayloadUserBaru('op_sby@test.com', 'SecurePass123', 'operator', 'Surabaya');

      expect(payload.email).toBe('op_sby@test.com');
      expect(payload.user_metadata.role).toBe('operator');
      expect(payload.user_metadata.wilayah_id).toBe('KK-SUR'); 
    });
  });

  describe('SA-03: Monitoring Data', () => {
    it('filter tabel berfungsi sesuai pilihan program dan wilayah', () => {
      const mockData = [
        { id: 1, jenis_bantuan: 'PKH', kabupaten_kota: 'Surabaya' },
        { id: 2, jenis_bantuan: 'BLT', kabupaten_kota: 'Malang' },
        { id: 3, jenis_bantuan: 'PKH', kabupaten_kota: 'Sidoarjo' }
      ];

      const hasilFilter = filterDataMonitoring(mockData, 'PKH', 'Semua');
      
      expect(hasilFilter).toHaveLength(2);
      expect(hasilFilter[0].kabupaten_kota).toBe('Surabaya');
      expect(hasilFilter[1].kabupaten_kota).toBe('Sidoarjo');
    });
  });

  describe('SA-04: Sistem Log', () => {
    it('bisa rekam log aktivitas beserta timestamp otomatis', () => {
      const logData = formatPayloadLog('superadmin@test.com', 'Super Admin', 'Export Laporan', 'User mengekspor laporan excel');

      expect(logData.email_pengguna).toBe('superadmin@test.com');
      expect(logData.aksi).toBe('Export Laporan');
      expect(logData.keterangan).toContain('mengekspor laporan');
      expect(typeof logData.created_at).toBe('string');
    });
  });

});