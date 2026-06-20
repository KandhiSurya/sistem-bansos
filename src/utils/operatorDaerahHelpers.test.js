// ==========================================
// File: utils/operatorDaerahHelpers.test.js
// ==========================================
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import { read, utils } from 'xlsx';
import nodemailer from 'nodemailer';

import { 
  formatPayloadPengajuan, 
  filterRiwayatLokal, 
  hitungStatistikLokal,
  validasiNIK,
  validasiNoKK,
  validasiFileGambar,
  cekBisaRevisi,
  formatPayloadRevisi
} from './operatorDaerahHelpers';

import LoginPage from '../app/page';
import InputDataPage from '../app/input-data/page';
import BansosForm from '../app/input-data/components/BansosForm';
import BansosHistory from '../app/input-data/components/BansosHistory';
import { POST as notifyBidangPost } from '../app/api/operator/notify-bidang/route';

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

// Mock xlsx library
jest.mock('xlsx', () => ({
  read: jest.fn().mockReturnValue({
    SheetNames: ['Sheet1'],
    Sheets: { Sheet1: {} }
  }),
  utils: {
    sheet_to_json: jest.fn().mockReturnValue([
      {
        nik: '3512345678909999',
        no_kk: '3512345678908888',
        nama_lengkap: 'Excel Imported Warga',
        alamat: 'Jl. Excel Raya No. 9',
        pekerjaan: 'Swasta',
        pendapatan: 'Rp 1.000.000 - Rp 2.000.000',
        tanggungan: 1
      }
    ])
  }
}));

// Mock Supabase admin client for API routes
const mockRouteSupabaseFrom = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockImplementation(() => ({
    from: mockRouteSupabaseFrom
  }))
}));

// Mock Nodemailer for API routes
const mockNodemailerSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: mockNodemailerSendMail
  }))
}));

describe('Modul Operator Daerah (User Stories)', () => {

  describe('KK-01: Form Pengajuan & Validasi File', () => {
    const defaultProps = {
      userProfile: { id: 'op-123', kabupaten_kota: 'Sidoarjo' },
      currentUserEmail: 'op@sidoarjo.go.id',
      editId: null,
      cancelEdit: jest.fn(),
      initData: jest.fn(),
      catatLog: jest.fn(),
      formData: {
        nik: '',
        no_kk: '',
        nama: '',
        alamat: '',
        pekerjaan: '',
        pendapatan: '< Rp 500.000',
        tanggungan: '0',
        agama: '',
        status_pernikahan: '',
        pendidikan_terakhir: '',
        catatan_tambahan: '',
      },
      setFormData: jest.fn(),
      oldUrls: { ktp: '', diri: '', kerja: '', rumah: '' },
      files: { ktp: null, diri: null, kerja: null, rumah: null },
      setFiles: jest.fn(),
      setActiveTab: jest.fn(),
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
    });

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
      expect(payload.status).toBe('Menunggu');
    });

    it('validasi NIK & No. KK menolak input jika bukan 16 digit angka', () => {
      expect(validasiNIK('3578012345678901')).toBe(true); 
      expect(validasiNIK('35780123')).toBe(false); 
      expect(validasiNoKK('3515001122334455')).toBe(true); 
      expect(validasiNoKK('351500112233445A')).toBe(false); 
    });

    it('memvalidasi batas ukuran (2MB) dan format ekstensi file gambar', () => {
      expect(validasiFileGambar('ktp_yoga.jpg', 1500000)).toBe(true);
      expect(validasiFileGambar('rumah_yoga.png', 3145728)).toBe(false);
      expect(validasiFileGambar('berkas.pdf', 1000000)).toBe(false);
    });

    it('menampilkan kolom-kolom formulir dengan benar', () => {
      render(<BansosForm {...defaultProps} />);
      expect(screen.getByText(/NIK \(16 Digit\)/i)).toBeInTheDocument();
      expect(screen.getByText(/No. KK \(16 Digit\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Nama Lengkap/i)).toBeInTheDocument();
      expect(screen.getByText(/Alamat Domisili/i)).toBeInTheDocument();
    });

    it('memeriksa NIK ganda ketika input nilai NIK berubah', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 'existing-id', nik: '1234567890123456', jenis_bantuan: 'PKH', status: 'Disetujui' },
          error: null,
        }),
      };
      supabase.from.mockReturnValueOnce(mockQuery);

      render(<BansosForm {...defaultProps} />);

      const nikInput = screen.getAllByPlaceholderText('0000...')[0];
      fireEvent.change(nikInput, { target: { value: '1234567890123456' } });

      await waitFor(() => {
        expect(screen.getByText(/NIK ini sudah terdaftar/i)).toBeInTheDocument();
      });
    });

    it('menampilkan error saat submit jika dokumen foto belum lengkap', async () => {
      const { container } = render(<BansosForm {...defaultProps} />);
      const form = container.querySelector('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Mohon lengkapi semua dokumen foto!');
      });
    });

    it('mengirimkan data baru dengan sukses saat semua ketentuan terpenuhi', async () => {
      const propsWithFiles = {
        ...defaultProps,
        files: {
          ktp: new File([''], 'ktp.jpg', { type: 'image/jpeg' }),
          diri: new File([''], 'diri.jpg', { type: 'image/jpeg' }),
          kerja: new File([''], 'kerja.jpg', { type: 'image/jpeg' }),
          rumah: new File([''], 'rumah.jpg', { type: 'image/jpeg' }),
        },
        formData: {
          nik: '3512345678901234',
          no_kk: '3512345678904321',
          nama: 'Ahmad Subarjo',
          alamat: 'Jl. Merdeka No 1',
          pekerjaan: 'Buruh',
          pendapatan: '< Rp 500.000',
          tanggungan: '3',
          agama: 'Islam',
          status_pernikahan: 'Kawin',
          pendidikan_terakhir: 'SMA/SMK',
          catatan_tambahan: 'Tidak ada catatan tambahan',
        },
      };

      const mockCheckNikQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      const mockInsertQuery = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      supabase.from
        .mockReturnValueOnce(mockCheckNikQuery)
        .mockReturnValueOnce(mockInsertQuery);

      const { container } = render(<BansosForm {...propsWithFiles} />);

      const form = container.querySelector('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('pengajuan_bantuan');
        expect(toast.success).toHaveBeenCalledWith('Data baru berhasil dikirim!', expect.any(Object));
        expect(propsWithFiles.catatLog).toHaveBeenCalledWith('Input Data Warga', expect.stringContaining('Ahmad Subarjo'));
        expect(propsWithFiles.initData).toHaveBeenCalled();
        expect(propsWithFiles.cancelEdit).toHaveBeenCalled();
        expect(propsWithFiles.setActiveTab).toHaveBeenCalledWith('history');
        expect(global.fetch).toHaveBeenCalledWith('/api/operator/notify-bidang', expect.any(Object));
      });
    });

    describe('API Route & Integrasi Notifikasi - Hubungi Bidang', () => {
      beforeEach(() => {
        jest.clearAllMocks();
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test';
        process.env.EMAIL_USER = 'admin@dinsos.go.id';
        process.env.EMAIL_PASS = 'password_secret';
      });

      it('keluar lebih awal dengan pesan jika tidak ada pengguna bidang di database', async () => {
        const mockSelectChain = {
          select: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnThis(),
          not: jest.fn().mockResolvedValueOnce({
            data: [],
            error: null
          })
        };
        mockRouteSupabaseFrom.mockReturnValueOnce(mockSelectChain);

        const req = new Request('http://localhost/api/operator/notify-bidang', {
          method: 'POST',
          body: JSON.stringify({
            nama_pemohon: 'Siti Rahma',
            jenis_bantuan: 'FAKMIS',
            kota_operator: 'Kota Surabaya'
          })
        });

        const res = await notifyBidangPost(req);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.message).toBe('Tidak ada target penerima.');
        expect(mockNodemailerSendMail).not.toHaveBeenCalled();
      });

      it('mencari database untuk role bidang dan mengirim email notifikasi dengan sukses', async () => {
        const mockSelectChain = {
          select: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnThis(),
          not: jest.fn().mockResolvedValueOnce({
            data: [
              { email: 'bidang1@dinsos.go.id' },
              { email: 'bidang2@dinsos.go.id' }
            ],
            error: null
          })
        };
        mockRouteSupabaseFrom.mockReturnValueOnce(mockSelectChain);
        mockNodemailerSendMail.mockResolvedValueOnce(true);

        const req = new Request('http://localhost/api/operator/notify-bidang', {
          method: 'POST',
          body: JSON.stringify({
            nama_pemohon: 'Siti Rahma',
            jenis_bantuan: 'FAKMIS',
            kota_operator: 'Kota Surabaya'
          })
        });

        const res = await notifyBidangPost(req);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.message).toBe('Terkirim!');

        expect(mockNodemailerSendMail).toHaveBeenCalledWith(expect.objectContaining({
          to: 'bidang1@dinsos.go.id,bidang2@dinsos.go.id',
          subject: expect.stringContaining('[Validasi Baru] Pengajuan Bansos: FAKMIS dari Kota Surabaya')
        }));
      });
    });
  });

  describe('KK-02: Riwayat Pengajuan & Proses Revisi', () => {
    const historyMockData = [
      {
        id: 'bansos-1',
        nik: '3501010101010001',
        nama_lengkap: 'Warga Menunggu',
        jenis_bantuan: 'PKH',
        status: 'Menunggu Validasi',
        status_penerima: 'Aktif',
        alamat: 'Jl. Menunggu No. 1',
        pekerjaan: 'Buruh',
        pendapatan: '< Rp 500.000',
        tanggungan: 3,
        foto_ktp: 'http://test.com/ktp.jpg'
      },
      {
        id: 'bansos-2',
        nik: '3501010101010002',
        nama_lengkap: 'Warga Disetujui',
        jenis_bantuan: 'BPNT',
        status: 'Disetujui',
        status_penerima: 'Aktif',
        alamat: 'Jl. Disetujui No. 2'
      },
      {
        id: 'bansos-3',
        nik: '3501010101010003',
        nama_lengkap: 'Warga Butuh Revisi',
        jenis_bantuan: 'BLT',
        status: 'Perlu Revisi',
        status_penerima: 'Aktif',
        alasan_penolakan: 'Foto KTP kabur',
        alamat: 'Jl. Revisi No. 3'
      }
    ];

    const defaultProps = {
      historyData: historyMockData,
      userProfile: { id: 'op-123', kabupaten_kota: 'Kediri' },
      initData: jest.fn(),
      catatLog: jest.fn(),
      handleEdit: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('tabel cuma nampilin data dari wilayah operator yang login', () => {
      const mockSemuaData = [
        { id: 1, nama_lengkap: 'Budi', wilayah_id: 'KK-SUR' },
        { id: 2, nama_lengkap: 'Siti', wilayah_id: 'KK-SDA' }, 
        { id: 3, nama_lengkap: 'Andi', wilayah_id: 'KK-SUR' },
      ];

      const hasilFilter = filterRiwayatLokal(mockSemuaData, 'KK-SUR');

      expect(hasilFilter).toHaveLength(2);
      const adaWilayahLain = hasilFilter.some(item => item.wilayah_id !== 'KK-SUR');
      expect(adaWilayahLain).toBe(false);
    });

    it('sistem mengunci akses edit jika data sudah disetujui', () => {
      expect(cekBisaRevisi('Perlu Revisi')).toBe(true);
      expect(cekBisaRevisi('Menunggu')).toBe(true);
      expect(cekBisaRevisi('Disetujui')).toBe(false);
    });

    it('menggabungkan data revisi dan mengembalikan status ke Menunggu', () => {
      const dataLama = { id: 10, nik: '1234567890123456', status: 'Perlu Revisi' };
      const dataBaru = { foto_rumah: 'https://link.baru/rumah.jpg' };
      
      const payloadRevisi = formatPayloadRevisi(dataLama, dataBaru);

      expect(payloadRevisi.id).toBe(10);
      expect(payloadRevisi.nik).toBe('1234567890123456'); 
      expect(payloadRevisi.foto_rumah).toBe('https://link.baru/rumah.jpg'); 
      expect(payloadRevisi.status).toBe('Menunggu'); 
      expect(typeof payloadRevisi.updated_at).toBe('string');
    });

    it('menampilkan baris tabel riwayat dengan benar', () => {
      render(<BansosHistory {...defaultProps} />);
      expect(screen.getByText('Warga Menunggu')).toBeInTheDocument();
      expect(screen.getByText('Warga Disetujui')).toBeInTheDocument();
      expect(screen.getByText('Warga Butuh Revisi')).toBeInTheDocument();
    });

    it('memfilter baris tabel berdasarkan input pencarian (NIK/Nama)', () => {
      render(<BansosHistory {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText(/Cari NIK \/ Nama\.\.\./i);

      fireEvent.change(searchInput, { target: { value: 'Butuh' } });
      expect(screen.queryByText('Warga Menunggu')).not.toBeInTheDocument();
      expect(screen.getByText('Warga Butuh Revisi')).toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: '0001' } });
      expect(screen.getByText('Warga Menunggu')).toBeInTheDocument();
      expect(screen.queryByText('Warga Butuh Revisi')).not.toBeInTheDocument();
    });

    it('menampilkan tombol "Revisi Data" hanya untuk status "Perlu Revisi"', () => {
      render(<BansosHistory {...defaultProps} />);
      
      const revisiButtons = screen.getAllByRole('button', { name: /Revisi Data/i });
      expect(revisiButtons).toHaveLength(1);
      
      fireEvent.click(revisiButtons[0]);
      expect(defaultProps.handleEdit).toHaveBeenCalledWith(historyMockData[2]);
    });

    it('membuka modal detail saat tombol "Detail" diklik', () => {
      render(<BansosHistory {...defaultProps} />);
      const detailButtons = screen.getAllByRole('button', { name: 'Detail' });
      
      fireEvent.click(detailButtons[0]);
      
      expect(screen.getByText('Detail Pengajuan Saya')).toBeInTheDocument();
      expect(screen.getAllByText('Warga Menunggu').length).toBeGreaterThan(1);
      expect(screen.getByText('Jl. Menunggu No. 1')).toBeInTheDocument();
    });

    it('menangani unggahan Excel dengan sukses', async () => {
      supabase.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      render(<BansosHistory {...defaultProps} />);
      
      const fileInput = screen.getByLabelText(/Impor Masal Excel/i);
      const dummyFile = new File([''], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const mockFileReaderInstance = {
        readAsArrayBuffer: jest.fn().mockImplementation(function() {
          if (this.onload) {
            this.onload({ target: { result: new ArrayBuffer(0) } });
          }
        })
      };
      jest.spyOn(window, 'FileReader').mockImplementation(() => mockFileReaderInstance);

      fireEvent.change(fileInput, { target: { files: [dummyFile] } });

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('pengajuan_bantuan');
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('1 data berhasil diimpor!'), expect.any(Object));
        expect(defaultProps.catatLog).toHaveBeenCalledWith('Import Excel', expect.any(String));
        expect(defaultProps.initData).toHaveBeenCalled();
      });
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

  describe('KK-04: Otentikasi (Login & Logout)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('mengarahkan ke halaman input data saat login sebagai operator', async () => {
      supabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: { id: 'operator-id' } },
        error: null
      });
      
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { role: 'operator' },
          error: null
        })
      });

      render(<LoginPage />);
      fireEvent.change(screen.getByPlaceholderText(/contoh: admin@dinsos.jatimprov.go.id/i), { target: { value: 'operator@example.com' } });
      fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'password123' } });

      fireEvent.click(screen.getByRole('button', { name: /Masuk ke Sistem/i }));

      await waitFor(() => {
        expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/input-data');
      });
    });

    it('mengarahkan ke beranda dan keluar sesi saat tombol keluar diklik', async () => {
      // Mock Supabase
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: { id: 'operator-id', email: 'op@sidoarjo.go.id' } },
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
          data: { role: 'operator', kabupaten_kota: 'Kediri' },
          error: null
        }),
        then: (resolve) => resolve({ data: [], error: null })
      });

      supabase.auth.signOut.mockResolvedValueOnce({ error: null });

      render(<InputDataPage />);

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