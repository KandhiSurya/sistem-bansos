import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request) {
  console.log("🔥 API RESET PASSWORD DIPANGGIL") 

  try {
    // 1. Cek Kunci Rahasia
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!serviceRoleKey) {
      console.error("❌ ERROR: Service Role Key tidak ditemukan di .env.local")
      return NextResponse.json({ success: false, error: "Server Error: Kunci rahasia belum disetting." }, { status: 500 })
    }

    // 2. Setup Supabase Admin
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 3. Baca Body Request
    const body = await request.json()
    const { id, email, password } = body
    
    if (!id || !email || !password) {
      return NextResponse.json({ success: false, error: "Data tidak lengkap: id, email, dan password wajib ada." }, { status: 400 })
    }

    console.log("📦 Reset password untuk:", email)

    // 4. Update Password User di Auth Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      { password: password }
    )

    if (authError) {
      console.error("❌ Gagal mereset auth password:", authError.message)
      throw authError
    }

    console.log("✅ Auth password berhasil diperbarui untuk ID:", id)

    // 5. Kirim Email Notifikasi ke Gmail
    console.log("⏳ Sedang mengirim email notifikasi ke:", email)
    
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS  
        },
        tls: {
          rejectUnauthorized: false
        }
      })

      const mailOptions = {
        from: `"Sistem Bansos Dinsos" <${process.env.EMAIL_USER}>`,
        to: email, 
        subject: 'Pemberitahuan: Reset Kata Sandi Akun Sistem Bansos',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eaeaea; border-radius: 10px;">
              <h2 style="color: #dc2626; text-align: center;">Kata Sandi Anda Telah Direset</h2>
              <p>Halo,</p>
              <p>Kata sandi untuk akun Anda pada Sistem Informasi Profiling Data Bansos Dinas Sosial Jawa Timur telah direset oleh Super Admin.</p>
              <p>Berikut adalah kredensial login terbaru Anda:</p>
              <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #dc2626;">
                <p style="margin: 5px 0;"><b>Email Login:</b> ${email}</p>
                <p style="margin: 5px 0;"><b>Kata Sandi Baru:</b> ${password}</p>
              </div>
              <p style="color: #e11d48; font-size: 13px;"><i>*PENTING: Harap segera login menggunakan kata sandi baru Anda dan ubah demi keamanan jika diperlukan.</i></p>
          </div>
        `
      }

      await transporter.sendMail(mailOptions)
      console.log("📧 Email berhasil terkirim!")
      
    } catch (emailError) {
      console.error("⚠️ Peringatan: Password berhasil diubah di database, namun gagal mengirim email:", emailError.message)
    }
    
    return NextResponse.json({ success: true, message: 'Kata sandi berhasil direset dan email notifikasi terkirim!' })

  } catch (error) {
    console.error('❌ CRITICAL ERROR RESET PASSWORD:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
