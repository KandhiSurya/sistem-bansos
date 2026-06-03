import {
  cariDataBidang,
  prosesVerifikasi,
  toggleStatusKeaktifan,
  hitungStatistikProvinsi
} from './bidangHelpers';

describe('Modul Bidang Provinsi Utils', () => {

  describe('BD-01 & BD-03: Fitur Pencarian', () => {
    it('live search bisa deteksi nama lengkap atau NIK', () => {
      const mockData = [
        { id: 1, nama_lengkap: 'Bapak Ahmad', nik: '35780001' },
        { id: 2, nama_lengkap: 'Ibu Budi', nik: '35780002' },
        { id: 3, nama_lengkap: 'Ahmad Santoso', nik: '35120003' }
      ];

      const hasilNama = cariDataBidang(mockData, 'ahmad');
      expect(hasilNama).toHaveLength(2); 

      const hasilNik = cariDataBidang(mockData, '80002');
      expect(hasilNik).toHaveLength(1);
      expect(hasilNik[0].nama_lengkap).toBe('Ibu Budi');
    });
  });

  describe('BD-02: Verifikasi Data', () => {
    it('status update jadi disetujui dan notif email kepanggil', async () => {
      const mockPayload = { id: 'BANSOS-01', nama_lengkap: 'Yoga', status: 'Menunggu' };
      const mockLayananEmail = jest.fn().mockResolvedValue(true);

      const hasil = await prosesVerifikasi(mockPayload, 'Disetujui', mockLayananEmail);

      expect(hasil.status).toBe('Disetujui');
      expect(hasil.updated_at).toBeDefined();
      
      expect(mockLayananEmail).toHaveBeenCalledTimes(1);
      expect(mockLayananEmail).toHaveBeenCalledWith(
        'BANSOS-01', 
        expect.stringContaining('disetujui')
      );
    });
  });

  describe('BD-04 & BD-05: Status Keaktifan', () => {
    it('tombol arsip berhasil toggle status boolean penerima', () => {
      const mockData = [
        { id: 1, nama_lengkap: 'Ahmad', status_penerima: true },
        { id: 2, nama_lengkap: 'Budi', status_penerima: false }
      ];

      const hasilToggle1 = toggleStatusKeaktifan(mockData, 1);
      expect(hasilToggle1[0].status_penerima).toBe(false);
      expect(hasilToggle1[1].status_penerima).toBe(false); 

      const hasilToggle2 = toggleStatusKeaktifan(hasilToggle1, 2);
      expect(hasilToggle2[1].status_penerima).toBe(true);
    });
  });

  describe('BD-06: Dasbor Provinsi', () => {
    it('akumulasi total semua data se-provinsi kehitung bener', () => {
      const mockSemuaData = [
        { status: 'Menunggu' },
        { status: 'Disetujui' },
        { status: 'Disetujui' },
        { status: 'Perlu Revisi' },
        { status: 'Ditolak' } 
      ];

      const stats = hitungStatistikProvinsi(mockSemuaData);

      expect(stats.total).toBe(5);
      expect(stats.menunggu).toBe(1);
      expect(stats.disetujui).toBe(2);
      expect(stats.ditolakAtauRevisi).toBe(2); 
    });
  });

});