import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request) {
  try {
    const body = await request.json()
    // Data yang akan dikirim dari Dashboard Bidang nanti
    const { email_operator, nama_pemohon, jenis_bantuan, status_verifikasi, catatan } = body

    if (!email_operator) {
      return NextResponse.json({ success: false, error: 'Email operator tidak ditemukan.' }, { status: 400 })
    }

    // Setup Nodemailer dengan Fix TLS seperti sebelumnya
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

    // Tentukan warna dan pesan berdasarkan status
    const isApproved = status_verifikasi === 'Disetujui'
    const statusColor = isApproved ? '#10b981' : '#e11d48' // Hijau atau Merah
    const statusText = isApproved ? 'TELAH DISETUJUI' : 'PERLU DIREVISI'
    const pesanTambahan = isApproved 
      ? 'Data pengajuan telah divalidasi dan memenuhi syarat untuk dilanjutkan ke tahap berikutnya.'
      : 'Terdapat kekurangan atau ketidaksesuaian pada data/dokumen yang diajukan. Mohon segera lakukan revisi.'

    // Konten Email
    const mailOptions = {
      from: `"Sistem Bansos Dinsos" <${process.env.EMAIL_USER}>`,
      to: email_operator, 
      subject: `[Update Status] Pengajuan Bansos ${nama_pemohon} - ${statusText}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #eaeaea; border-radius: 10px;">
          <h2 style="color: ${statusColor}; border-bottom: 2px solid ${statusColor}; padding-bottom: 10px;">
            Status Pengajuan: ${statusText}
          </h2>
          <p>Halo Tim Operator,</p>
          <p>Berikut adalah hasil verifikasi dari Bidang Provinsi untuk data pengajuan bantuan sosial yang Anda kirimkan:</p>
          
          <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid ${statusColor};">
            <p style="margin: 5px 0;"><b>Nama Pemohon:</b> ${nama_pemohon}</p>
            <p style="margin: 5px 0;"><b>Jenis Bantuan:</b> ${jenis_bantuan}</p>
            <p style="margin: 5px 0;"><b>Status Akhir:</b> <span style="color: ${statusColor}; font-weight: bold;">${status_verifikasi}</span></p>
            ${!isApproved ? `<p style="margin: 10px 0 5px 0; color: #e11d48;"><b>Catatan Revisi:</b><br/><i>"${catatan}"</i></p>` : ''}
          </div>
          
          <p>${pesanTambahan}</p>
          <p>Silakan login ke panel Operator Anda untuk melihat detail lengkap di tab Riwayat Pengajuan.</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
          <p style="font-size: 12px; color: #888;">Email ini dihasilkan otomatis oleh Sistem Informasi Profiling Data Bansos.</p>
        </div>
      `
    }

    await transporter.sendMail(mailOptions)
    console.log("📧 Notifikasi hasil verifikasi berhasil dikirim ke Operator:", email_operator)

    return NextResponse.json({ success: true, message: 'Notifikasi ke operator terkirim!' })

  } catch (error) {
    console.error('❌ Gagal kirim notifikasi ke operator:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}   