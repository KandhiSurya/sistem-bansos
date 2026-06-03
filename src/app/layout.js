import './globals.css'
// 👇 IMPORT TOASTER 👇
import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: 'Sistem Profiling Bansos - Dinsos Jatim',
  description: 'Sistem Pendataan dan Validasi Bantuan Sosial Provinsi Jawa Timur',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="bg-gray-50 text-gray-900 font-sans antialiased">
        {children}
        
        {/* 👇 MESIN POP-UP GLOBAL 👇 */}
        <Toaster 
          position="center-top" 
          reverseOrder={false}
          toastOptions={{
            // Styling bawaan biar elegan
            duration: 4000,
            style: {
              background: '#ffffff',
              color: '#1f2937',
              fontWeight: '600',
              fontSize: '14px',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              border: '1px solid #f3f4f6',
              padding: '16px 20px',
            },
            // Gaya khusus untuk aksi SUKSES
            success: {
              iconTheme: { primary: '#10b981', secondary: '#ffffff' },
              style: { borderLeft: '4px solid #10b981' }
            },
            // Gaya khusus untuk aksi ERROR/GAGAL
            error: {
              iconTheme: { primary: '#f43f5e', secondary: '#ffffff' },
              style: { borderLeft: '4px solid #f43f5e' }
            },
          }} 
        />
      </body>
    </html>
  )
} 