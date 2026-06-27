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

    // CATATAN: Langkah penghapusan file di storage dan data pengajuan sengaja dinonaktifkan
    // agar data bansos dan dokumen foto warga tetap tersimpan di sistem demi kebutuhan pelaporan/historis.

    // 2. COBA HAPUS DARI AUTHENTICATION (Login)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (authError && !authError.message?.includes('User not found')) {
      console.error("❌ Gagal menghapus auth user:", authError.message)
      throw authError
    }

    // 3. [PENTING] PAKSA HAPUS DARI TABEL PROFILES (DB)
    // Langkah ini wajib ada untuk membersihkan profil operator.
    // PENTING: Supabase database foreign key 'user_id' di tabel 'pengajuan_bantuan' 
    // harus diatur ke 'ON DELETE SET NULL' agar data bansos tidak ikut terhapus secara cascade.
    const { error: dbError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id)

    // Kita abaikan error jika auth user tidak ketemu, yang penting DB bersih.
    if (dbError) throw dbError

    return NextResponse.json({ 
      message: `Akun berhasil dihapus. Data pengajuan dan dokumen foto tetap dipertahankan.`, 
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