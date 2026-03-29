import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// --- PERBAIKAN IMPORT (Sesuai Folder Kamu) ---
// Mengarah ke src/app/super-admin/page.js
import SuperAdminPage from '@/app/super-admin/page' 

// Mengarah ke src/lib/supabaseClient.js
import { supabase } from '@/lib/supabaseClient' 
import { useRouter } from 'next/navigation'

// --- 1. MOCKING DEPENDENCIES ---

// Mock Next.js Router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock Supabase Client
// Penting: Path di sini harus SAMA PERSIS dengan import di atas
jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
    storage: {
      from: jest.fn(() => ({
        remove: jest.fn(),
      })),
    },
  },
}))

// Mock Global Fetch (untuk API create/delete user)
global.fetch = jest.fn()

// Mock Window Alert & Confirm
window.alert = jest.fn()
window.confirm = jest.fn()

describe('PXP Development Flow - Super Admin Page', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    useRouter.mockReturnValue({ push: mockPush })
    
    // Default Mock: User Login & Superadmin
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
  })

  // --- HELPER UNTUK MOCK SUPABASE CHAINING ---
  const mockSupabaseChain = (role = 'superadmin', usersData = [], bansosData = []) => {
    supabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: { role }, error: null }), // Cek Role
            })),
            order: jest.fn().mockResolvedValue({ data: usersData, error: null }), // Get Users
          })),
        }
      }
      if (table === 'pengajuan_bantuan') {
        return {
          select: jest.fn(() => ({
            order: jest.fn().mockResolvedValue({ data: bansosData, error: null }), // Get Bansos
          })),
          delete: jest.fn(() => ({
             eq: jest.fn().mockResolvedValue({ error: null })
          }))
        }
      }
      return { select: jest.fn() }
    })
  }

  // --- TEST CASES (ITERASI PXP) ---

  // ITERASI 1: KEAMANAN
  describe('Iterasi 1: Security & Foundation', () => {
    it('Redirect jika user bukan superadmin', async () => {
      mockSupabaseChain('operator') 
      render(<SuperAdminPage />)
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/')
      })
    })

    it('Render halaman jika superadmin', async () => {
      mockSupabaseChain('superadmin')
      render(<SuperAdminPage />)
      await waitFor(() => {
        expect(screen.getByText('Super Admin')).toBeInTheDocument()
      })
    })
  })

  // ITERASI 2: VISUALISASI DATA
  describe('Iterasi 2: Data Visualization', () => {
    it('Menampilkan data user di tabel', async () => {
      const mockUsers = [
        { id: '1', email: 'test@admin.com', role: 'superadmin' }
      ]
      mockSupabaseChain('superadmin', mockUsers, [])
      render(<SuperAdminPage />)
      
      await waitFor(() => {
        expect(screen.getByText('test@admin.com')).toBeInTheDocument()
      })
    })
  })

  // ITERASI 3: HAPUS USER
  describe('Iterasi 3: Deletion Features', () => {
    it('Panggil API delete saat tombol diklik', async () => {
      const mockUsers = [{ id: '99', email: 'delete@me.com', role: 'operator' }]
      mockSupabaseChain('superadmin', mockUsers)
      
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
      window.confirm.mockReturnValue(true)

      render(<SuperAdminPage />)
      await waitFor(() => expect(screen.getByText('delete@me.com')).toBeInTheDocument())

      const deleteBtn = screen.getByText('HAPUS USER')
      fireEvent.click(deleteBtn)

      await waitFor(() => {
         expect(global.fetch).toHaveBeenCalledWith('/api/admin/delete-user', expect.any(Object))
      })
    })
  })

  // ITERASI 4: CREATE USER
  describe('Iterasi 4: Create User Feature', () => {
    it('Modal form bisa dibuka', async () => {
      mockSupabaseChain('superadmin')
      render(<SuperAdminPage />)
      
      await waitFor(() => expect(screen.getByText('TAMBAH USER')).toBeInTheDocument())
      fireEvent.click(screen.getByText('TAMBAH USER'))
      
      expect(screen.getByText('Tambah User Baru')).toBeInTheDocument()
    })
  })
})  