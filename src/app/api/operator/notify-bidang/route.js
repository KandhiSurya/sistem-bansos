import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request) {
  try {
    const body = await request.json()
    const { nama_pemohon, jenis_bantuan, kota_operator } = body

    // Setup Supabase Admin
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Cari semua email dengan role 'bidang'
    const { data: bidangUsers, error } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .ilike('role', 'bidang')
      .not('email', 'is', null)

    if (error) throw error

    // Hentikan jika tidak ada akun Bidang
    if (!bidangUsers || bidangUsers.length === 0) {
      console.log("⚠️ Tidak ada akun Bidang yang valid.")
      return NextResponse.json({ success: true, message: 'Tidak ada target penerima.' })
    }

    const emailList = bidangUsers.map(u => u.email).join(',')

    // Setup Pengirim (dengan Fix TLS)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: { rejectUnauthorized: false }
    })

    // Konten Email
    const mailOptions = {
      from: `"Sistem Bansos Jatim" <${process.env.EMAIL_USER}>`,
      to: emailList, 
      subject: `🚨 [Validasi Baru] Pengajuan Bansos: ${jenis_bantuan} dari ${kota_operator}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #4f46e5;">Pengajuan Bantuan Baru</h2>
          <p>Halo Tim Bidang Provinsi,</p>
          <p>Ada pengajuan data profil sosial baru yang diinput oleh operator dan <b>menunggu validasi</b> Anda.</p>
          <ul>
            <li><b>Nama Pemohon:</b> ${nama_pemohon}</li>
            <li><b>Jenis Program:</b> ${jenis_bantuan}</li>
            <li><b>Asal Kota/Kab:</b> ${kota_operator}</li>
          </ul>
          <p>Silakan login ke sistem untuk melakukan pengecekan data.</p>
        </div>
      `
    }

    await transporter.sendMail(mailOptions)
    console.log("✅ Sukses kirim email ke:", emailList)
    return NextResponse.json({ success: true, message: 'Terkirim!' })

  } catch (error) {
    console.error('❌ Gagal kirim email:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
} 