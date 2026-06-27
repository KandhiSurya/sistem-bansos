// ==========================================
// File: utils/bidangHelpers.test.js
// ==========================================
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import nodemailer from 'nodemailer';

import {
  cariDataBidang,
  prosesVerifikasi,
  toggleStatusKeaktifan,
  hitungStatistikProvinsi,
  prosesNonAktifData,
  pisahkanDataArsip,
  filterAntreanProgram
} from './bidangHelpers';

import LoginPage from '../app/page';
import ValidasiPage from '../app/validasi/page';
import VerificationQueue from '../app/validasi/components/VerificationQueue';
import { POST as notifyOperatorPost } from '../app/api/bidang/notify-operator/route';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Leaflet on window
const mockCircleMarker = {
  addTo: jest.fn().mockReturnThis(),
  bindPopup: jest.fn()
};
const mockTileLayer = {
  addTo: jest.fn()
};
const mockMap = {
  setView: jest.fn().mockReturnThis(),
  eachLayer: jest.fn(),
  remove: jest.fn(),
  on: jest.fn()
};

global.window.L = {
  map: jest.fn().mockReturnValue(mockMap),
  tileLayer: jest.fn().mockReturnValue(mockTileLayer),
  circleMarker: jest.fn().mockReturnValue(mockCircleMarker),
  CircleMarker: class {}
};

// Mock Nodemailer
const mockNodemailerSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: mockNodemailerSendMail
  }))
}));

// Mock xlsx library
jest.mock('xlsx', () => ({
  read: jest.fn().mockReturnValue({
    SheetNames: ['Sheet1'],
    Sheets: { Sheet1: {} }
  }),
  utils: {
    sheet_to_json: jest.fn().mockReturnValue([
      {
        NIK: '3511111111119999',
        'No. KK': '3511111111118888',
        NAMA: 'Excel Bidang Warga, 3511111111119999',
        ALAMAT: 'Jl. Excel Bidang No. 9',
        KEC: 'Manyar',
        'DESA/KEL': 'Suci',
        Pekerjaan: 'PNS',
        Pendapatan: 'Rp 2.000.000',
        Tanggungan: 3,
        KAB: 'KAB. GRESIK'
      }
    ])
  }
}));

describe('Modul Bidang Provinsi (User Stories)', () => {

  describe('BD-01 & BD-03: Fitur Pencarian & Klasifikasi Program', () => {
    const queueData = [
      {
        id: 'bansos-id-1',
        nik: '3511111111111111',
        nama_lengkap: 'Joko Widodo',
        jenis_bantuan: 'Belum Ditentukan',
        kabupaten_kota: 'Surabaya',
        status: 'Menunggu Validasi',
        status_penerima: 'Aktif',
        alamat: 'Jl. Surabaya No. 1',
        pekerjaan: 'Driver',
        pendapatan: 'Rp 500.000 - Rp 1.000.000',
        tanggungan: 2,
        foto_ktp: 'http://test.com/ktp1.jpg',
        user_id: 'user-op-1'
      },
      {
        id: 'bansos-id-2',
        nik: '3522222222222222',
        nama_lengkap: 'Prabowo Subianto',
        jenis_bantuan: 'PKH',
        kabupaten_kota: 'Sidoarjo',
        status: 'Disetujui',
        status_penerima: 'Aktif',
        alamat: 'Jl. Sidoarjo No. 2'
      }
    ];

    const defaultProps = {
      dataBansos: queueData,
      activeTab: 'Pending',
      fetchRealtimeData: jest.fn(),
      catatLog: jest.fn(),
      currentUserEmail: 'bidang@jatimprov.go.id',
      exportExcelTrigger: false,
      setExportExcelTrigger: jest.fn()
    };

    beforeAll(() => {
      global.originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          json: () => Promise.resolve({ success: true }),
        })
      );
    });

    afterAll(() => {
      global.fetch = global.originalFetch;
    });

    beforeEach(() => {
      jest.clearAllMocks();
      supabase.from.mockReset();
      supabase.from.mockReturnValue(global.supabaseMockChain);
    });

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

    it('memfilter antrean berdasarkan jenis program dengan benar', () => {
      const mockAntrean = [
        { nama: 'Siti', jenis_bantuan: 'PKH' },
        { nama: 'Budi', jenis_bantuan: 'KIP' },
        { nama: 'Andi', jenis_bantuan: 'PKH' }
      ];

      const hasilPKH = filterAntreanProgram(mockAntrean, 'PKH');
      expect(hasilPKH).toHaveLength(2);
      expect(hasilPKH[0].nama).toBe('Siti');

      const hasilSemua = filterAntreanProgram(mockAntrean, 'Semua');
      expect(hasilSemua).toHaveLength(3);
    });

    it('menampilkan antrean pending warga dengan benar di tab pending', () => {
      render(<VerificationQueue {...defaultProps} />);
      expect(screen.getByText('Joko Widodo')).toBeInTheDocument();
      expect(screen.queryByText('Prabowo Subianto')).not.toBeInTheDocument();
    });

    it('memfilter baris antrean berdasarkan pilihan program bantuan', () => {
      const manyProps = {
        ...defaultProps,
        dataBansos: [
          ...queueData,
          { id: '3', nama_lengkap: 'Mega', jenis_bantuan: 'KIP', status: 'Menunggu Validasi' }
        ]
      };
      render(<VerificationQueue {...manyProps} />);
      
      expect(screen.getByText('Joko Widodo')).toBeInTheDocument();
      expect(screen.getByText('Mega')).toBeInTheDocument();

      const programSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(programSelect, { target: { value: 'KIP' } });

      expect(screen.queryByText('Joko Widodo')).not.toBeInTheDocument();
      expect(screen.getByText('Mega')).toBeInTheDocument();
    });
  });

  describe('BD-02: Verifikasi Data & Notifikasi Operator', () => {
    const queueData = [
      {
        id: 'bansos-id-1',
        nik: '3511111111111111',
        nama_lengkap: 'Joko Widodo',
        jenis_bantuan: 'Belum Ditentukan',
        kabupaten_kota: 'Surabaya',
        status: 'Menunggu Validasi',
        status_penerima: 'Aktif',
        alamat: 'Jl. Surabaya No. 1',
        pekerjaan: 'Driver',
        pendapatan: 'Rp 500.000 - Rp 1.000.000',
        tanggungan: 2,
        foto_ktp: 'http://test.com/ktp1.jpg',
        user_id: 'user-op-1'
      }
    ];

    const defaultProps = {
      dataBansos: queueData,
      activeTab: 'Pending',
      fetchRealtimeData: jest.fn(),
      catatLog: jest.fn(),
      currentUserEmail: 'bidang@jatimprov.go.id',
      exportExcelTrigger: false,
      setExportExcelTrigger: jest.fn()
    };

    beforeAll(() => {
      global.originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          json: () => Promise.resolve({ success: true }),
        })
      );
    });

    afterAll(() => {
      global.fetch = global.originalFetch;
    });

    beforeEach(() => {
      jest.clearAllMocks();
      supabase.from.mockReset();
      supabase.from.mockReturnValue(global.supabaseMockChain);
      process.env.EMAIL_USER = 'admin@dinsos.go.id';
      process.env.EMAIL_PASS = 'password_secret';
    });

    it('status update jadi disetujui dan notif email kepanggil', async () => {
      const mockPayload = { id: 'BANSOS-01', nama_lengkap: 'Yoga', status: 'Menunggu Validasi' };
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

    it('menyetujui pengajuan warga dengan menetapkan program bantuan tertentu', async () => {
      const mockUpdateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      };
      const mockProfileQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { email: 'op-email@example.com' }, error: null })
      };

      supabase.from
        .mockReturnValueOnce(mockUpdateQuery)
        .mockReturnValueOnce(mockProfileQuery);

      render(<VerificationQueue {...defaultProps} />);
      
      const reviewBtn = screen.getByRole('button', { name: /Review Data/i });
      fireEvent.click(reviewBtn);

      const programSelect = screen.getAllByRole('combobox')[2];
      fireEvent.change(programSelect, { target: { value: 'PKH' } });

      const approveBtn = screen.getByRole('button', { name: /Setujui Pengajuan/i });
      fireEvent.click(approveBtn);

      const okBtn = screen.getByRole('button', { name: 'Ya, Setujui' });
      fireEvent.click(okBtn);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('pengajuan_bantuan');
        expect(mockUpdateQuery.update).toHaveBeenCalledWith({ status: 'Disetujui', alasan_penolakan: null, jenis_bantuan: 'PKH' });
        expect(global.fetch).toHaveBeenCalledWith('/api/bidang/notify-operator', expect.any(Object));
        expect(defaultProps.catatLog).toHaveBeenCalledWith('Validasi Data', expect.stringContaining('Disetujui'));
      });
    });

    it('menolak/revisi pengajuan warga dengan mencantumkan alasan penolakan', async () => {
      const mockUpdateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      };
      const mockProfileQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { email: 'op-email@example.com' }, error: null })
      };

      supabase.from
        .mockReturnValueOnce(mockUpdateQuery)
        .mockReturnValueOnce(mockProfileQuery);

      render(<VerificationQueue {...defaultProps} />);
      
      const reviewBtn = screen.getByRole('button', { name: /Review Data/i });
      fireEvent.click(reviewBtn);

      const rejectBtn = screen.getByRole('button', { name: /Tolak \(Revisi\)/i });
      fireEvent.click(rejectBtn);

      const promptArea = screen.getByPlaceholderText(/Ketik alasan\.\.\./i);
      fireEvent.change(promptArea, { target: { value: 'Foto kurang jelas' } });

      const confirmBtn = screen.getByRole('button', { name: 'Kirim Penolakan' });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('pengajuan_bantuan');
        expect(mockUpdateQuery.update).toHaveBeenCalledWith({ status: 'Perlu Revisi', alasan_penolakan: 'Foto kurang jelas' });
        expect(global.fetch).toHaveBeenCalledWith('/api/bidang/notify-operator', expect.any(Object));
      });
    });

    it('gagal mengirim jika email operator tidak ditemukan di body request', async () => {
      const req = new Request('http://localhost/api/bidang/notify-operator', {
        method: 'POST',
        body: JSON.stringify({ nama_pemohon: 'Wawan', status_verifikasi: 'Disetujui' })
      });

      const res = await notifyOperatorPost(req);
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('Email operator tidak ditemukan');
    });

    it('mengirimkan notifikasi email persetujuan dengan sukses ke operator', async () => {
      mockNodemailerSendMail.mockResolvedValueOnce(true);

      const req = new Request('http://localhost/api/bidang/notify-operator', {
        method: 'POST',
        body: JSON.stringify({
          email_operator: 'op-daerah@dinsos.go.id',
          nama_pemohon: 'Rini Astuti',
          jenis_bantuan: 'PKH',
          status_verifikasi: 'Disetujui',
          catatan: '-'
        })
      });

      const res = await notifyOperatorPost(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe('Notifikasi ke operator terkirim!');

      expect(mockNodemailerSendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'op-daerah@dinsos.go.id',
        subject: expect.stringContaining('Rini Astuti - TELAH DISETUJUI')
      }));
    });

    it('mengirimkan notifikasi email revisi lengkap dengan alasan penolakan', async () => {
      mockNodemailerSendMail.mockResolvedValueOnce(true);

      const req = new Request('http://localhost/api/bidang/notify-operator', {
        method: 'POST',
        body: JSON.stringify({
          email_operator: 'op-daerah@dinsos.go.id',
          nama_pemohon: 'Rini Astuti',
          jenis_bantuan: 'PKH',
          status_verifikasi: 'Perlu Revisi',
          catatan: 'Foto KTP tidak terbaca jelas'
        })
      });

      const res = await notifyOperatorPost(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);

      expect(mockNodemailerSendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'op-daerah@dinsos.go.id',
        subject: expect.stringContaining('Rini Astuti - PERLU DIREVISI'),
        html: expect.stringContaining('Foto KTP tidak terbaca jelas')
      }));
    });
  });

  describe('BD-04 & BD-05: Status Keaktifan & Isolasi Data Arsip', () => {
    const queueData = [
      {
        id: 'bansos-id-2',
        nik: '3522222222222222',
        nama_lengkap: 'Prabowo Subianto',
        jenis_bantuan: 'PKH',
        kabupaten_kota: 'Sidoarjo',
        status: 'Disetujui',
        status_penerima: 'Aktif',
        alamat: 'Jl. Sidoarjo No. 2'
      },
      {
        id: 'bansos-id-3',
        nik: '3533333333333333',
        nama_lengkap: 'Megawati Soekarnoputri',
        jenis_bantuan: 'PKH',
        kabupaten_kota: 'Kediri',
        status: 'Perlu Revisi',
        status_penerima: 'Aktif',
        alamat: 'Jl. Kediri No. 3'
      }
    ];

    const defaultProps = {
      dataBansos: queueData,
      activeTab: 'Verified',
      fetchRealtimeData: jest.fn(),
      catatLog: jest.fn(),
      currentUserEmail: 'bidang@jatimprov.go.id',
      exportExcelTrigger: false,
      setExportExcelTrigger: jest.fn()
    };

    beforeAll(() => {
      global.originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          json: () => Promise.resolve({ success: true }),
        })
      );
    });

    afterAll(() => {
      global.fetch = global.originalFetch;
    });

    beforeEach(() => {
      jest.clearAllMocks();
      supabase.from.mockReset();
      supabase.from.mockReturnValue(global.supabaseMockChain);
    });

    it('tombol arsip berhasil toggle status string penerima', () => {
      const mockData = [
        { id: 1, nama_lengkap: 'Ahmad', status_penerima: 'Aktif' },
        { id: 2, nama_lengkap: 'Budi', status_penerima: 'Nonaktif' }
      ];

      const hasilToggle1 = toggleStatusKeaktifan(mockData, 1);
      expect(hasilToggle1[0].status_penerima).toBe('Nonaktif');
      expect(hasilToggle1[1].status_penerima).toBe('Nonaktif'); 

      const hasilToggle2 = toggleStatusKeaktifan(hasilToggle1, 2);
      expect(hasilToggle2[1].status_penerima).toBe('Aktif');
    });

    it('menambahkan alasan non-aktif dan mengubah status_penerima menjadi Nonaktif', () => {
      const wargaLama = { id: 99, nama_lengkap: 'Joko', status_penerima: 'Aktif' };
      const wargaNonAktif = prosesNonAktifData(wargaLama, 'Meninggal Dunia');

      expect(wargaNonAktif.id).toBe(99);
      expect(wargaNonAktif.status_penerima).toBe('Nonaktif');
      expect(wargaNonAktif.alasan_nonaktif).toBe('Meninggal Dunia');
      expect(typeof wargaNonAktif.updated_at).toBe('string');
    });

    it('memisahkan data aktif dan non-aktif ke dalam dua array yang berbeda', () => {
      const mockSemuaData = [
        { id: 1, status_penerima: 'Aktif' },
        { id: 2, status_penerima: 'Nonaktif' }, 
        { id: 3, status_penerima: undefined }, 
        { id: 4, status_penerima: 'Nonaktif' }  
      ];

      const hasilPemisahan = pisahkanDataArsip(mockSemuaData);

      expect(hasilPemisahan.dataAktif).toHaveLength(2);
      expect(hasilPemisahan.dataArsip).toHaveLength(2);
      expect(hasilPemisahan.dataArsip[0].id).toBe(2);
    });

    it('menampilkan daftar warga terverifikasi di tab non-pending (hanya yang disetujui)', () => {
      render(<VerificationQueue {...defaultProps} activeTab="Verified" />);
      expect(screen.getByText('Prabowo Subianto')).toBeInTheDocument();
      expect(screen.queryByText('Megawati Soekarnoputri')).not.toBeInTheDocument();
    });

    it('mengubah status keaktifan warga yang disetujui di tab terverifikasi', async () => {
      const mockUpdateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      };
      supabase.from.mockReturnValue(mockUpdateQuery);

      render(<VerificationQueue {...defaultProps} activeTab="Verified" />);
      
      const toggleBtn = screen.getByRole('button', { name: /Aktif/i });
      fireEvent.click(toggleBtn);

      expect(screen.getByText('Nonaktifkan Penerima Bantuan\?')).toBeInTheDocument();
      
      const promptInput = screen.getByPlaceholderText('Ketik alasan...');
      fireEvent.change(promptInput, { target: { value: 'Graduasi Mandiri' } });
      
      const okBtn = screen.getByRole('button', { name: 'OK' });
      fireEvent.click(okBtn);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('pengajuan_bantuan');
        expect(mockUpdateQuery.update).toHaveBeenCalledWith({ status_penerima: 'Nonaktif', alasan_nonaktif: 'Graduasi Mandiri' });
        expect(defaultProps.fetchRealtimeData).toHaveBeenCalled();
      });
    });
  });

  describe('BD-06: Dasbor Provinsi', () => {
    it('akumulasi total semua data se-provinsi kehitung bener', () => {
      const mockSemuaData = [
        { status: 'Menunggu Validasi' },
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

  describe('BD-07: Otentikasi (Login & Logout)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('mengarahkan ke dasbor validasi saat login sebagai bidang', async () => {
      supabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: { id: 'bidang-id' } },
        error: null
      });
      
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { role: 'bidang' },
          error: null
        })
      });

      render(<LoginPage />);
      fireEvent.change(screen.getByPlaceholderText(/contoh: admin@dinsos.jatimprov.go.id/i), { target: { value: 'bidang@example.com' } });
      fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'password123' } });

      fireEvent.click(screen.getByRole('button', { name: /Masuk ke Sistem/i }));

      await waitFor(() => {
        expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/validasi');
      });
    });

    it('mengarahkan ke beranda dan keluar sesi saat tombol keluar diklik', async () => {
      // Mock Supabase
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: { id: 'bidang-id', email: 'bidang@jatimprov.go.id' } },
        error: null
      });

      supabase.channel = jest.fn().mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn()
      });
      supabase.removeChannel = jest.fn();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockImplementation(() => {
          return {
            then: (resolve) => resolve({ data: [], error: null })
          };
        }),
        single: jest.fn().mockResolvedValue({
          data: { role: 'bidang' },
          error: null
        }),
        then: (resolve) => resolve({ data: [], error: null })
      });

      supabase.auth.signOut.mockResolvedValueOnce({ error: null });

      render(<ValidasiPage />);

      // Tunggu hingga loading spinner selesai dan komponen utama di-render
      await waitFor(() => {
        expect(screen.getByText(/DINSOS JATIM/i)).toBeInTheDocument();
      });

      const logoutBtn = screen.getByTitle(/Keluar Sistem/i);
      fireEvent.click(logoutBtn);

      const confirmBtn = screen.getByRole('button', { name: /Ya, Keluar/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(supabase.auth.signOut).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });
  });



});