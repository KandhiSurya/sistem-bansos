import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request) {
  console.log("🔥 API CREATE USER DIPANGGIL") 

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
    const { email, password, role, kota } = body
    
    console.log("📦 Data diterima:", { email, role, kota })

    // 4. Buat User Auth
    const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    })

    if (authError) {
      console.error("❌ Gagal Auth:", authError.message)
      throw authError
    }

    const user = data?.user
    console.log("✅ User Auth berhasil dibuat. ID:", user?.id)

    // 5. Update Profile (Termasuk mengupdate email agar tidak "No Email")
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        email: email, // Memastikan email terisi di tabel profiles
        role: role, 
        kabupaten_kota: role === 'operator' ? kota : null
      })
      .eq('id', user.id)

    if (profileError) {
      console.error("❌ Gagal Update Profile:", profileError.message)
      throw profileError
    }

    console.log("✅ Profile berhasil diupdate!")

    // 6. Kirim Email Notifikasi ke Gmail (DENGAN FIX TLS/SSL)
    console.log("⏳ Sedang mengirim email notifikasi ke:", email)
    
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS  
        },
        // --- FIX ERROR SERTIFIKAT ---
        tls: {
          rejectUnauthorized: false
        }
      })

      const mailOptions = {
        from: `"Sistem Bansos Dinsos" <${process.env.EMAIL_USER}>`,
        to: email, 
        subject: 'Selamat Datang! Akun Sistem Bansos Anda Telah Aktif',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eaeaea; border-radius: 10px;">
              <h2 style="color: #4f46e5; text-align: center;">Selamat Datang di Sistem Bansos!</h2>
              <p>Halo,</p>
              <p>Akun Anda telah berhasil didaftarkan oleh Super Admin ke dalam Sistem Informasi Profiling Data Bansos.</p>
              <p>Berikut adalah kredensial login Anda:</p>
              <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #4f46e5;">
                <p style="margin: 5px 0;"><b>Email Login:</b> ${email}</p>
                <p style="margin: 5px 0;"><b>Password:</b> ${password}</p>
                <p style="margin: 5px 0;"><b>Role Akses:</b> <span style="text-transform: uppercase;">${role}</span></p>
                <p style="margin: 5px 0;"><b>Wilayah Tugas:</b> ${kota || 'Provinsi Jawa Timur'}</p>
              </div>
              <p style="color: #e11d48; font-size: 13px;"><i>*PENTING: Harap segera login dan simpan password ini dengan baik demi keamanan data.</i></p>
          </div>
        `
      }

      await transporter.sendMail(mailOptions)
      console.log("📧 Email berhasil terkirim!")
      
    } catch (emailError) {
      console.error("⚠️ Peringatan: User dibuat, tapi gagal mengirim email:", emailError.message)
    }
    
    return NextResponse.json({ success: true, message: 'User berhasil dibuat dan Email terkirim!' })

  } catch (error) {
    console.error('❌ CRITICAL ERROR:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
} 