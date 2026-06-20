import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function DELETE(request) {
  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'User ID wajib ada' }, { status: 400 })
    }

    // 1. Init Supabase Admin (Kunci Dewa)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 2. AMBIL DAFTAR FILE SEBELUM DATA DIHAPUS
    const { data: listBansos } = await supabaseAdmin
      .from('pengajuan_bantuan')
      .select('foto_ktp, foto_diri, foto_pekerjaan, foto_rumah')
      .eq('user_id', id)

    // 3. KUMPULKAN NAMA FILE UNTUK DIHAPUS
    let filesToDelete = []
    
    if (listBansos && listBansos.length > 0) {
      listBansos.forEach(row => {
        const extractPath = (url) => {
          if (!url) return null
          const cleanUrl = url.split('?')[0]
          const marker = '/dokumen_bansos/'
          const index = cleanUrl.indexOf(marker)
          if (index !== -1) {
            return cleanUrl.substring(index + marker.length)
          }
          const parts = cleanUrl.split('/')
          return parts[parts.length - 1]
        }
        if (row.foto_ktp) filesToDelete.push(extractPath(row.foto_ktp))
        if (row.foto_diri) filesToDelete.push(extractPath(row.foto_diri))
        if (row.foto_pekerjaan) filesToDelete.push(extractPath(row.foto_pekerjaan))
        if (row.foto_rumah) filesToDelete.push(extractPath(row.foto_rumah))
      })
    }

    // 4. EKSEKUSI HAPUS FILE DI STORAGE
    if (filesToDelete.length > 0) {
      await supabaseAdmin.storage.from('dokumen_bansos').remove(filesToDelete)
    }

    // 5. COBA HAPUS DARI AUTHENTICATION (Login)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (authError && !authError.message?.includes('User not found')) {
      console.error("❌ Gagal menghapus auth user:", authError.message)
      throw authError
    }

    // 6. [PENTING] PAKSA HAPUS DARI TABEL PROFILES (DB)
    // Langkah ini wajib ada untuk membersihkan "User Hantu" 
    // yang auth-nya sudah hilang tapi datanya masih nyangkut di tabel.
    const { error: dbError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id)

    // Kita abaikan error jika auth user tidak ketemu, yang penting DB bersih.
    if (dbError) throw dbError

    return NextResponse.json({ 
      message: `User dan data berhasil dimusnahkan.`, 
    })

  } catch (error) {
    console.error('Gagal hapus user:', error)
    // Tetap return sukses jika errornya cuma masalah "User not found" biar UI bersih
    if (error.message?.includes('User not found')) {
         return NextResponse.json({ message: 'User hantu dibersihkan.' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
} 