// ==========================================
// File: utils/superAdminHelpers.test.js
// ==========================================
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import { saveAs } from 'file-saver';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

import { 
  hitungStatistikDasbor, 
  formatPayloadUserBaru, 
  filterDataMonitoring, 
  formatPayloadLog,
  cekAksesAdmin,
  formatDataExport,
  formatPayloadEditUser,
  formatPayloadNonaktifUser,
  siapkanPayloadEmail,
  siapkanPayloadEmailReset,
  getActionDetails
} from './superAdminHelpers';

import { KOORDINAT_JATIM, hitungStatistikPerWilayah } from './mapHelpers';
import LoginPage from '../app/page';
import SuperAdminPage from '../app/super-admin/page';
import UpdatePasswordPage from '../app/update-password/page';
import UserManagement from '../app/super-admin/components/UserManagement';
import BansosMonitoring from '../app/super-admin/components/BansosMonitoring';
import ActivityLogs from '../app/super-admin/components/ActivityLogs';
import { POST as createUserPost } from '../app/api/admin/create-user/route';
import { DELETE as deleteUserDelete } from '../app/api/admin/delete-user/route';
import { POST as resetPasswordPost } from '../app/api/admin/reset-password/route';

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
  remove: jest.fn()
};

global.window.L = {
  map: jest.fn().mockReturnValue(mockMap),
  tileLayer: jest.fn().mockReturnValue(mockTileLayer),
  circleMarker: jest.fn().mockReturnValue(mockCircleMarker),
  CircleMarker: class {}
};

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

// Mock Supabase admin client for API routes
const mockCreateUser = jest.fn();
const mockDeleteUser = jest.fn();
const mockUpdateUserById = jest.fn();
const mockRemoveStorage = jest.fn();
const mockFrom = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockImplementation(() => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
        updateUserById: mockUpdateUserById
      }
    },
    storage: {
      from: jest.fn().mockImplementation(() => ({
        remove: mockRemoveStorage
      }))
    },
    from: mockFrom
  }))
}));

// Mock Nodemailer
const mockNodemailerSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: mockNodemailerSendMail
  }))
}));

describe('Modul Super Admin (User Stories)', () => {

  describe('SA-01: Dashboard & RBAC', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('bisa hitung total user dan data bansos dengan benar', () => {
      const mockUsers = [{ role: 'operator' }, { role: 'bidang' }, { role: 'operator' }];
      const mockBansos = [{}, {}, {}, {}];
      const stats = hitungStatistikDasbor(mockUsers, mockBansos);

      expect(stats.users).toBe(3); 
      expect(stats.totalData).toBe(4); 
      expect(stats.cities).toBe(2); 
    });

    it('memvalidasi hak akses khusus Super Admin (RBAC)', () => {
      expect(cekAksesAdmin('superadmin')).toBe(true);
      expect(cekAksesAdmin('operator')).toBe(false);
      expect(cekAksesAdmin('bidang')).toBe(false);
    });

    // Login Page Tests
    it('menampilkan halaman login dengan input email dan kata sandi', () => {
      render(<LoginPage />);
      expect(screen.getByPlaceholderText(/contoh: admin@dinsos.jatimprov.go.id/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Masuk ke Sistem/i })).toBeInTheDocument();
    });

    it('mengubah visibilitas kata sandi saat ikon mata diklik', () => {
      render(<LoginPage />);
      const passwordInput = screen.getByPlaceholderText(/••••••••/i);
      const toggleButton = screen.getByTitle(/Lihat password/i);

      expect(passwordInput.type).toBe('password');

      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe('text');

      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe('password');
    });

    it('menampilkan modal lupa kata sandi dan mengirim email pemulihan', async () => {
      supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null });

      render(<LoginPage />);
      const forgotLink = screen.getByText(/Lupa Kata Sandi\?/i);
      fireEvent.click(forgotLink);

      expect(screen.getByText(/Masukkan alamat email yang terdaftar/i)).toBeInTheDocument();

      const emailInput = screen.getByPlaceholderText(/contoh: nama@dinsos.jatim.go.id/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      const submitBtn = screen.getByText(/Kirim Link Pemulihan/i);
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', expect.any(Object));
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Link pemulihan kata sandi telah dikirim'), expect.any(Object));
      });
    });

    it('mengarahkan ke dasbor superadmin saat login sebagai superadmin', async () => {
      supabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: { id: 'sa-id' } },
        error: null
      });
      
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { role: 'superadmin' },
          error: null
        })
      });

      render(<LoginPage />);
      fireEvent.change(screen.getByPlaceholderText(/contoh: admin@dinsos.jatimprov.go.id/i), { target: { value: 'admin@dinsos.jatimprov.go.id' } });
      fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'password123' } });

      fireEvent.click(screen.getByRole('button', { name: /Masuk ke Sistem/i }));

      await waitFor(() => {
        expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/super-admin');
      });
    });
    it('menampilkan pemberitahuan error ketika login gagal', async () => {
      supabase.auth.signInWithPassword.mockRejectedValueOnce(new Error('Invalid password'));

      render(<LoginPage />);
      fireEvent.change(screen.getByPlaceholderText(/contoh: admin@dinsos.jatimprov.go.id/i), { target: { value: 'wrong@example.com' } });
      fireEvent.change(screen.getByPlaceholderText(/••••••••/i), { target: { value: 'wrongpass' } });

      fireEvent.click(screen.getByRole('button', { name: /Masuk ke Sistem/i }));

      await waitFor(() => {
        expect(screen.getByText(/Login gagal. Periksa kembali email dan kata sandi Anda./i)).toBeInTheDocument();
      });
    });

    it('mengarahkan ke beranda dan keluar sesi saat tombol keluar diklik', async () => {
      // Mock Supabase
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: { id: 'sa-id', email: 'admin@dinsos.jatimprov.go.id' } },
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
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            then: (resolve) => resolve({ data: [], error: null })
          };
        }),
        single: jest.fn().mockResolvedValue({
          data: { role: 'superadmin' },
          error: null
        }),
        then: (resolve) => resolve({ data: [], error: null })
      });

      supabase.auth.signOut.mockResolvedValueOnce({ error: null });

      render(<SuperAdminPage />);

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

  describe('SA-02: Manajemen User (Generate, Edit, Nonaktif, Email, API)', () => {
    const mockUsers = [
      { id: 'user-1', email: 'operator-1@dinsos.go.id', role: 'operator', kabupaten_kota: 'Kabupaten Kediri' },
      { id: 'user-2', email: 'bidang-1@dinsos.go.id', role: 'bidang', kabupaten_kota: null },
      { id: 'admin-id', email: 'admin@dinsos.go.id', role: 'superadmin', kabupaten_kota: null }
    ];

    const defaultProps = {
      users: mockUsers,
      currentUserEmail: 'admin@dinsos.go.id',
      fetchData: jest.fn(),
      isFormOpen: false,
      setIsFormOpen: jest.fn(),
      catatLog: jest.fn()
    };

    const originalEnv = process.env;

    beforeAll(() => {
      global.originalFetch = global.fetch;
      global.fetch = jest.fn();
    });

    afterAll(() => {
      global.fetch = global.originalFetch;
    });

    beforeEach(() => {
      jest.clearAllMocks();
      process.env = {
        ...originalEnv,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        NEXT_PUBLIC_SUPABASE_URL: 'http://supabase.test',
        EMAIL_USER: 'admin@dinsos.go.id',
        EMAIL_PASS: 'password_secret'
      };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('berhasil generate payload user baru dengan prefix KK', () => {
      const payload = formatPayloadUserBaru('op_sby@test.com', 'Pass123', 'operator', 'Surabaya');
      expect(payload.email).toBe('op_sby@test.com');
      expect(payload.user_metadata.wilayah_id).toBe('KK-SUR'); 
    });

    it('bisa menggabungkan data saat edit user', () => {
      const dataLama = { id: 1, email: 'lama@test.com', role: 'operator' };
      const dataBaru = { email: 'baru@test.com' }; 
      const payloadEdit = formatPayloadEditUser(dataLama, dataBaru);

      expect(payloadEdit.id).toBe(1);
      expect(payloadEdit.email).toBe('baru@test.com'); 
      expect(payloadEdit.role).toBe('operator'); 
      expect(typeof payloadEdit.updated_at).toBe('string');
    });

    it('berhasil memformat payload untuk nonaktifkan user (Soft Delete)', () => {
      const payloadNonaktif = formatPayloadNonaktifUser(99);
      expect(payloadNonaktif.id).toBe(99);
      expect(payloadNonaktif.is_active).toBe(false);
    });

    it('menyiapkan template email yang sesuai untuk pendaftaran baru', () => {
      const emailObj = siapkanPayloadEmail('user@test.com', 'Rahasia123', 'Bidang');
      expect(emailObj.to).toBe('user@test.com');
      expect(emailObj.html).toContain('Rahasia123');
      expect(emailObj.html).toContain('Bidang');
    });

    it('menyiapkan template email yang sesuai untuk reset kata sandi', () => {
      const emailObj = siapkanPayloadEmailReset('operator@test.com', 'SandiBaru123');
      expect(emailObj.to).toBe('operator@test.com');
      expect(emailObj.html).toContain('SandiBaru123');
      expect(emailObj.subject).toContain('Reset Kata Sandi');
    });

    it('menampilkan baris tabel pengguna dengan benar di komponen UserManagement', () => {
      render(<UserManagement {...defaultProps} />);
      expect(screen.getByText('operator-1@dinsos.go.id')).toBeInTheDocument();
      expect(screen.getByText('bidang-1@dinsos.go.id')).toBeInTheDocument();
      expect(screen.getByText('admin@dinsos.go.id')).toBeInTheDocument();
    });

    it('mengecualikan tombol aksi (Reset/Hapus) untuk pengguna yang sedang masuk', () => {
      render(<UserManagement {...defaultProps} />);
      const resetButtons = screen.getAllByRole('button', { name: /Reset Password/i });
      expect(resetButtons).toHaveLength(2);
      const deleteButtons = screen.getAllByRole('button', { name: 'Hapus' });
      expect(deleteButtons).toHaveLength(2);
    });

    it('menangani proses reset password dengan sukses melalui API dan UI', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      render(<UserManagement {...defaultProps} />);
      const resetButtons = screen.getAllByRole('button', { name: /Reset Password/i });
      fireEvent.click(resetButtons[0]); 

      expect(screen.getByText('Reset Password Pengguna')).toBeInTheDocument();
      const passwordInput = screen.getByPlaceholderText(/Min\. 6 karakter/i);
      const generateBtn = screen.getByRole('button', { name: /Generate Acak/i });

      fireEvent.click(generateBtn);
      expect(passwordInput.value).not.toBe('');

      const submitBtn = screen.getByRole('button', { name: /Reset Password & Kirim Email/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/admin/reset-password', expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('operator-1@dinsos.go.id')
        }));
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Password berhasil direset'), expect.any(Object));
        expect(defaultProps.catatLog).toHaveBeenCalledWith('Reset Password', expect.any(String));
      });
    });

    it('menangani proses hapus pengguna dengan sukses melalui API dan UI', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      render(<UserManagement {...defaultProps} />);
      const deleteButtons = screen.getAllByRole('button', { name: 'Hapus' });
      fireEvent.click(deleteButtons[0]); 

      expect(screen.getByText('Hapus Akun Pengguna')).toBeInTheDocument();
      const confirmBtn = screen.getByRole('button', { name: 'Ya, Hapus Permanen' });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/admin/delete-user', expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ id: 'user-1' })
        }));
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('User terhapus'), expect.any(Object));
        expect(defaultProps.catatLog).toHaveBeenCalledWith('Hapus Akun', expect.any(String));
        expect(defaultProps.fetchData).toHaveBeenCalled();
      });
    });

    it('menampilkan modal formulir tambah pengguna dan berhasil submit', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const openProps = { ...defaultProps, isFormOpen: true };
      render(<UserManagement {...openProps} />);
      expect(screen.getByText('Tambah Operator/Bidang')).toBeInTheDocument();
      
      const emailInput = screen.getByPlaceholderText(/email@dinsos.jatim.go.id/i);
      const passwordInput = screen.getByPlaceholderText(/Min\. 6 karakter/i);
      const comboboxes = screen.getAllByRole('combobox');
      const roleSelect = comboboxes[0];
      const kotaSelect = comboboxes[1];

      fireEvent.change(emailInput, { target: { value: 'newoperator@dinsos.go.id' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(roleSelect, { target: { value: 'operator' } });
      fireEvent.change(kotaSelect, { target: { value: 'Kabupaten Kediri' } });

      const submitBtn = screen.getByRole('button', { name: /Simpan Akun/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/admin/create-user', expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'newoperator@dinsos.go.id',
            password: 'password123',
            role: 'operator',
            kota: 'Kabupaten Kediri'
          })
        }));
        expect(toast.success).toHaveBeenCalledWith('User berhasil dibuat!', expect.any(Object));
        expect(openProps.setIsFormOpen).toHaveBeenCalledWith(false);
        expect(openProps.fetchData).toHaveBeenCalled();
      });
    });

    it('API reset-password gagal jika input tidak lengkap', async () => {
      const req = new Request('http://localhost/api/admin/reset-password', {
        method: 'POST',
        body: JSON.stringify({ id: 'user-123', email: 'op@example.com' }) 
      });
      const res = await resetPasswordPost(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('API reset-password berhasil memperbarui kata sandi dan mengirim email', async () => {
      mockUpdateUserById.mockResolvedValueOnce({ data: { user: {} }, error: null });
      mockNodemailerSendMail.mockResolvedValueOnce(true);

      const req = new Request('http://localhost/api/admin/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          id: 'user-123',
          email: 'op@example.com',
          password: 'newSecretPassword123'
        })
      });
      const res = await resetPasswordPost(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('API create-user gagal jika SUPABASE_SERVICE_ROLE_KEY tidak ditemukan', async () => {
      const originalConsoleError = console.error;
      console.error = jest.fn();
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      const req = new Request('http://localhost/api/admin/create-user', {
        method: 'POST',
        body: JSON.stringify({ email: 'new@example.com' })
      });
      const res = await createUserPost(req);
      expect(res.status).toBe(500);
      console.error = originalConsoleError;
    });

    it('API delete-user gagal jika ID pengguna kosong', async () => {
      const req = new Request('http://localhost/api/admin/delete-user', {
        method: 'DELETE',
        body: JSON.stringify({})
      });
      const res = await deleteUserDelete(req);
      expect(res.status).toBe(400);
    });

    // UpdatePasswordPage Tests
    it('memeriksa sesi saat dimuat dan mengarahkan ke beranda jika sesi tidak valid', async () => {
      supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });

      render(<UpdatePasswordPage />);

      await waitFor(() => {
        expect(supabase.auth.getSession).toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Sesi tidak valid'));
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });

    it('menampilkan input halaman ubah kata sandi jika sesi valid', async () => {
      supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'test' } } } });

      render(<UpdatePasswordPage />);

      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('••••••••')[0]).toBeInTheDocument();
        expect(screen.getAllByPlaceholderText('••••••••')[1]).toBeInTheDocument();
      });
    });

    it('memvalidasi panjang kata sandi minimal 6 karakter', async () => {
      supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'test' } } } });

      render(<UpdatePasswordPage />);

      const passwordInput = screen.getAllByPlaceholderText('••••••••')[0];
      const confirmInput = screen.getAllByPlaceholderText('••••••••')[1];
      const submitBtn = screen.getByRole('button', { name: /Simpan Kata Sandi Baru/i });

      fireEvent.change(passwordInput, { target: { value: '12345' } });
      fireEvent.change(confirmInput, { target: { value: '12345' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Password minimal 6 karakter.');
      });
    });

    it('memvalidasi bahwa kata sandi dan konfirmasi kata sandi harus cocok', async () => {
      supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'test' } } } });

      render(<UpdatePasswordPage />);

      const passwordInput = screen.getAllByPlaceholderText('••••••••')[0];
      const confirmInput = screen.getAllByPlaceholderText('••••••••')[1];
      const submitBtn = screen.getByRole('button', { name: /Simpan Kata Sandi Baru/i });

      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmInput, { target: { value: 'differentpass' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Password dan konfirmasi password tidak cocok.');
      });
    });

    it('memperbarui kata sandi, keluar sesi, dan mengarahkan ke beranda jika berhasil', async () => {
      supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'test' } } } });
      supabase.auth.updateUser.mockResolvedValueOnce({ error: null });
      supabase.auth.signOut.mockResolvedValueOnce({ error: null });

      render(<UpdatePasswordPage />);

      const passwordInput = screen.getAllByPlaceholderText('••••••••')[0];
      const confirmInput = screen.getAllByPlaceholderText('••••••••')[1];
      const submitBtn = screen.getByRole('button', { name: /Simpan Kata Sandi Baru/i });

      fireEvent.change(passwordInput, { target: { value: 'secret123' } });
      fireEvent.change(confirmInput, { target: { value: 'secret123' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'secret123' });
        expect(supabase.auth.signOut).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Kata sandi berhasil diperbarui'), expect.any(Object));
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });

    it('menampilkan pesan error jika pembaruan kata sandi gagal', async () => {
      supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'test' } } } });
      supabase.auth.updateUser.mockResolvedValueOnce({ error: { message: 'Network Error' } });

      render(<UpdatePasswordPage />);

      const passwordInput = screen.getAllByPlaceholderText('••••••••')[0];
      const confirmInput = screen.getAllByPlaceholderText('••••••••')[1];
      const submitBtn = screen.getByRole('button', { name: /Simpan Kata Sandi Baru/i });

      fireEvent.change(passwordInput, { target: { value: 'secret123' } });
      fireEvent.change(confirmInput, { target: { value: 'secret123' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(supabase.auth.updateUser).toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith('Gagal memperbarui kata sandi: Network Error', expect.any(Object));
      });
    });
  });

  describe('SA-02 & SA-03: Ekspor Laporan & Monitoring (GIS Spasial Jatim)', () => {
    const allMockBansos = [
      {
        id: 'bansos-1',
        nik: '3501010101010001',
        no_kk: '3501010101010002',
        nama_lengkap: 'Joko Sidoarjo',
        jenis_bantuan: 'PKH',
        kabupaten_kota: 'Kabupaten Sidoarjo',
        status: 'Disetujui',
        status_penerima: 'Aktif',
        alamat: 'Jl Sidoarjo 123',
        pekerjaan: 'PNS',
        pendapatan: '> Rp 2.000.000',
        tanggungan: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'bansos-2',
        nik: '3501010101010003',
        no_kk: '3501010101010004',
        nama_lengkap: 'Mega Surabaya',
        jenis_bantuan: 'BPNT',
        kabupaten_kota: 'Kota Surabaya',
        status: 'Menunggu Validasi',
        status_penerima: 'Aktif',
        alamat: 'Jl Surabaya 123',
        pekerjaan: 'Wiraswasta',
        pendapatan: 'Rp 1.000.000 - Rp 2.000.000',
        tanggungan: 4,
        created_at: new Date().toISOString()
      }
    ];

    const defaultProps = {
      allBansos: allMockBansos,
      catatLog: jest.fn(),
      exportExcelTrigger: false,
      setExportExcelTrigger: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('memformat data mentah bansos menjadi format rapi untuk Excel/PDF', () => {
      const mentah = [
        { nik: '351500', nama: 'budi', jenis_bantuan: 'PKH', kabupaten_kota: 'Surabaya', status: 'Disetujui' }
      ];
      const hasilExport = formatDataExport(mentah);
      expect(hasilExport[0].No).toBe(1);
      expect(hasilExport[0].Nama_Penerima).toBe('BUDI'); 
    });

    it('filter tabel berfungsi sesuai pilihan program dan wilayah', () => {
      const mockData = [
        { id: 1, jenis_bantuan: 'PKH', kabupaten_kota: 'Surabaya' },
        { id: 2, jenis_bantuan: 'BLT', kabupaten_kota: 'Malang' },
        { id: 3, jenis_bantuan: 'PKH', kabupaten_kota: 'Sidoarjo' }
      ];
      const hasilFilter = filterDataMonitoring(mockData, 'PKH', 'Semua');
      expect(hasilFilter).toHaveLength(2);
    });

    it('menyediakan koordinat lengkap untuk seluruh 38 kota/kabupaten di Jawa Timur', () => {
      const totalWilayah = Object.keys(KOORDINAT_JATIM).length;
      expect(totalWilayah).toBe(38);
      expect(KOORDINAT_JATIM['Kota Surabaya']).toEqual([-7.26, 112.75]);
    });

    it('berhasil menghitung agregasi statistik bansos berdasarkan kabupaten/kota dengan akurat', () => {
      const mockDataBansos = [
        { kabupaten_kota: 'Kota Surabaya', status: 'Disetujui' },
        { kabupaten_kota: 'Kota Surabaya', status: 'Menunggu Validasi' },
        { kabupaten_kota: 'Kota Malang', status: 'Disetujui' },
        { kabupaten_kota: 'Kota Malang', status: 'Perlu Revisi' },
        { kabupaten_kota: 'Kota Surabaya', status: 'Disetujui' }
      ];
      const stats = hitungStatistikPerWilayah(mockDataBansos);
      expect(stats['Kota Surabaya'].total).toBe(3);
      expect(stats['Kota Surabaya'].disetujui).toBe(2);
    });

    it('menampilkan header tabel dan baris data dengan benar di komponen BansosMonitoring', () => {
      render(<BansosMonitoring {...defaultProps} />);
      expect(screen.getByText('Joko Sidoarjo')).toBeInTheDocument();
      expect(screen.getByText('Mega Surabaya')).toBeInTheDocument();
    });

    it('memfilter baris data berdasarkan pilihan program bantuan di BansosMonitoring', () => {
      render(<BansosMonitoring {...defaultProps} />);
      const programSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(programSelect, { target: { value: 'PKH' } });
      expect(screen.getByText('Joko Sidoarjo')).toBeInTheDocument();
      expect(screen.queryByText('Mega Surabaya')).not.toBeInTheDocument();
    });

    it('memfilter baris data berdasarkan input pencarian (Nama / NIK) di BansosMonitoring', () => {
      render(<BansosMonitoring {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText(/Cari NIK \/ Nama\.\.\./i);
      
      // Cari berdasarkan nama
      fireEvent.change(searchInput, { target: { value: 'Joko' } });
      expect(screen.getByText('Joko Sidoarjo')).toBeInTheDocument();
      expect(screen.queryByText('Mega Surabaya')).not.toBeInTheDocument();

      // Cari berdasarkan NIK
      fireEvent.change(searchInput, { target: { value: '3501010101010003' } });
      expect(screen.getByText('Mega Surabaya')).toBeInTheDocument();
      expect(screen.queryByText('Joko Sidoarjo')).not.toBeInTheDocument();
    });

    it('membuka modal detail pengajuan dan memanggil tampilan cetak', async () => {
      const mockPrintClose = jest.fn();
      const mockPrintWrite = jest.fn();
      const mockPrintWindow = {
        document: { write: mockPrintWrite, close: mockPrintClose }
      };
      jest.spyOn(window, 'open').mockReturnValue(mockPrintWindow);

      render(<BansosMonitoring {...defaultProps} />);
      const detailBtns = screen.getAllByRole('button', { name: /Detail Data/i });
      fireEvent.click(detailBtns[0]); 

      expect(screen.getByText('Detail Profiling Calon Penerima Bantuan')).toBeInTheDocument();
      const cetakBtn = screen.getByRole('button', { name: /Cetak PDF/i });
      fireEvent.click(cetakBtn);

      expect(window.open).toHaveBeenCalled();
      expect(mockPrintWrite).toHaveBeenCalledWith(expect.stringContaining('Joko Sidoarjo'));
    });

    it('memicu callback ekspor Excel saat trigger ekspor bernilai true', async () => {
      const triggerProps = { ...defaultProps, exportExcelTrigger: true };
      render(<BansosMonitoring {...triggerProps} />);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Mempersiapkan Laporan Excel'));
        expect(saveAs).toHaveBeenCalled();
      });
    });
  });

  describe('SA-04: Sistem Log', () => {
    const mockLogs = [
      {
        id: 'log-1',
        created_at: new Date().toISOString(),
        email_pengguna: 'superadmin@dinsos.go.id',
        role: 'Super Admin',
        aksi: 'Buat Akun Baru',
        keterangan: 'Membuat akun operator baru untuk email: op@dinsos.go.id'
      }
    ];

    const defaultProps = {
      logs: mockLogs,
      fetchData: jest.fn(),
      catatLog: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('bisa rekam log aktivitas beserta timestamp otomatis', () => {
      const logData = formatPayloadLog('admin@test.com', 'Super Admin', 'Export', 'User export data');
      expect(logData.email_pengguna).toBe('admin@test.com');
      expect(typeof logData.created_at).toBe('string');
    });

    it('bisa mengklasifikasikan aksi log dan mengembalikan tipe aksi serta warna yang tepat', () => {
      const detailBuat = getActionDetails('Buat Akun Baru');
      expect(detailBuat.type).toBe('create');
      expect(detailBuat.bgColor).toBe('bg-emerald-100');
    });

    it('menampilkan linimasa log aktivitas secara default di komponen ActivityLogs', () => {
      render(<ActivityLogs {...defaultProps} />);
      expect(screen.getByText('Buat Akun Baru')).toBeInTheDocument();
    });

    it('mengalihkan mode tampilan antara linimasa dan tabel', () => {
      render(<ActivityLogs {...defaultProps} />);
      const tableViewBtn = screen.getByRole('button', { name: /Tabel Log/i });
      fireEvent.click(tableViewBtn);
      expect(screen.getByText('Waktu & Tanggal')).toBeInTheDocument();
    });
  });

});