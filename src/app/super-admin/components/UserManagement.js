'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { getInitials } from '@/utils/mapHelpers' // we can write getInitials locally or import it

const DAFTAR_KOTA_JATIM = [
  "Kabupaten Bangkalan", "Kabupaten Banyuwangi", "Kabupaten Blitar", "Kabupaten Bojonegoro",
  "Kabupaten Bondowoso", "Kabupaten Gresik", "Kabupaten Jember", "Kabupaten Jombang",
  "Kabupaten Kediri", "Kabupaten Lamongan", "Kabupaten Lumajang", "Kabupaten Madiun",
  "Kabupaten Magetan", "Kabupaten Malang", "Kabupaten Mojokerto", "Kabupaten Nganjuk",
  "Kabupaten Ngawi", "Kabupaten Pacitan", "Kabupaten Pamekasan", "Kabupaten Pasuruan",
  "Kabupaten Ponorogo", "Kabupaten Probolinggo", "Kabupaten Sampang", "Kabupaten Sidoarjo",
  "Kabupaten Situbondo", "Kabupaten Sumenep", "Kabupaten Trenggalek", "Kabupaten Tuban",
  "Kabupaten Tulungagung", "Kota Batu", "Kota Blitar", "Kota Kediri", "Kota Madiun",
  "Kota Malang", "Kota Mojokerto", "Kota Pasuruan", "Kota Probolinggo", "Kota Surabaya"
];

export default function UserManagement({
  users,
  currentUserEmail,
  fetchData,
  isFormOpen,
  setIsFormOpen,
  catatLog
}) {
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'operator', kota: '' })
  const [creating, setCreating] = useState(false)
  
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetUser, setResetUser] = useState({ id: '', email: '', password: '' })
  const [resetting, setResetting] = useState(false)

  // Local Confirmation Dialog state
  const [customAlert, setCustomAlert] = useState({ isOpen: false, title: '', message: '', danger: true, confirmLabel: 'Hapus', onConfirm: null })

  const getInitialsLocal = (name) => {
    if (!name) return '?'
    return name.match(/(\b\S)?/g).join("").match(/(^\S|\S$)?/g).join("").toUpperCase().substring(0, 2)
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setCreating(true)
    const toastId = toast.loading("Membuat akun baru...")
    try {
      const res = await fetch('/api/admin/create-user', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(newUser) 
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal membuat user')
      
      toast.success("User berhasil dibuat!", { id: toastId })
      await catatLog("Buat Akun Baru", `Membuat akun ${newUser.role} baru untuk email: ${newUser.email}`)
      setIsFormOpen(false)
      setNewUser({ email: '', password: '', role: 'operator', kota: '' })
      await fetchData()
    } catch (error) { 
      toast.error("Error: " + error.message, { id: toastId }) 
    } finally { 
      setCreating(false) 
    }
  }

  const executeDeleteUser = async (id, email) => {
    const toastId = toast.loading("Menghapus akun pengguna...")
    try {
      const res = await fetch('/api/admin/delete-user', { 
        method: 'DELETE', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ id }) 
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus user')
      
      toast.success("Sukses! User terhapus.", { id: toastId })
      await catatLog("Hapus Akun", `Menghapus akun pengguna secara permanen: ${email}`)
      await fetchData()
    } catch (error) {
      toast.error("Error: " + error.message, { id: toastId })
    }
  }

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault()
    if (!resetUser.password || resetUser.password.length < 6) {
      toast.error("Password minimal 6 karakter!")
      return
    }
    setResetting(true)
    const toastId = toast.loading("Mereset kata sandi...")
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resetUser.id,
          email: resetUser.email,
          password: resetUser.password
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mereset password')
      
      toast.success("Sukses! Password berhasil direset.", { id: toastId })
      await catatLog("Reset Password", `Mereset password pengguna secara manual: ${resetUser.email}`)
      setResetModalOpen(false)
      setResetUser({ id: '', email: '', password: '' })
    } catch (error) {
      toast.error("Error: " + error.message, { id: toastId })
    } finally {
      setResetting(false)
    }
  }

  const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    let pass = ""
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setResetUser(prev => ({ ...prev, password: pass }))
  }

  return (
    <div className="overflow-x-auto animate-fadeIn">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200">
          <tr>
            <th className="px-6 py-4">Informasi Akun</th>
            <th className="px-6 py-4">Role Akses</th>
            <th className="px-6 py-4">Wilayah Tugas</th>
            <th className="px-6 py-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs border border-slate-200">
                    {u.email ? u.email.substring(0,2).toUpperCase() : 'ID'}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">{u.email || 'No Email'}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{u.id}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${u.role === 'superadmin' ? 'bg-slate-800 text-white border-slate-800' : u.role === 'bidang' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {u.role || 'Operator'}
                </span>
              </td>
              <td className="px-6 py-4 text-sm font-medium text-slate-600">{u.kabupaten_kota || '-'}</td>
              <td className="px-6 py-4 text-right">
                {u.email !== currentUserEmail && (
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => {
                        setResetUser({ id: u.id, email: u.email, password: '' })
                        setResetModalOpen(true)
                      }} 
                      className="text-amber-600 hover:text-amber-800 font-bold text-xs hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-amber-200"
                    >
                      Reset Password
                    </button>
                    <button 
                      onClick={() => {
                        setCustomAlert({
                          isOpen: true, 
                          title: 'Hapus Akun Pengguna', 
                          message: `Yakin hapus akun ${u.email} secara permanen?`, 
                          danger: true, 
                          confirmLabel: 'Ya, Hapus Permanen',
                          onConfirm: () => { 
                            setCustomAlert(prev => ({ ...prev, isOpen: false }))
                            executeDeleteUser(u.id, u.email)
                          }
                        })
                      }} 
                      className="text-red-600 hover:text-red-800 font-bold text-xs hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-red-200"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* COMPONENT FORM TAMBAH AKUN USER */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 flex justify-between items-center border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-800">Tambah Operator/Bidang</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-800 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Login</label>
                <input required type="email" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-blue-900 focus:bg-white outline-none" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="email@dinsos.jatim.go.id" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password Sementara</label>
                <input required type="password" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-blue-900 focus:bg-white outline-none" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="Min. 6 karakter" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Role Akses</label>
                  <select 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:border-blue-900 outline-none cursor-pointer" 
                    value={newUser.role} 
                    onChange={e => setNewUser({...newUser, role: e.target.value, kota: e.target.value !== 'operator' ? '' : newUser.kota})}
                  >
                    <option value="operator">Operator Kota</option>
                    <option value="bidang">Bidang Provinsi</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Wilayah Tugas</label>
                  <select 
                    disabled={newUser.role !== 'operator'} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400 focus:border-blue-900 outline-none cursor-pointer" 
                    value={newUser.kota} 
                    onChange={e => setNewUser({...newUser, kota: e.target.value})}
                  >
                    <option value="">{newUser.role !== 'operator' ? '-' : 'Pilih Wilayah'}</option>
                    {DAFTAR_KOTA_JATIM.map((kota, idx) => (
                      <option key={idx} value={kota}>{kota}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Batal</button>
                <button disabled={creating} type="submit" className="px-4 py-2 text-xs font-bold text-white bg-blue-900 rounded-lg hover:bg-blue-800 disabled:opacity-70">{creating ? 'Menyimpan...' : 'Simpan Akun'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPONENT CUSTOM MODAL CONFIRMATION DIALOG */}
      {customAlert.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-rose-100 text-rose-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-lg font-extrabold text-slate-800 leading-tight">{customAlert.title}</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{customAlert.message}</p>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setCustomAlert({...customAlert, isOpen: false})} className="px-4 py-2 text-xs font-bold text-slate-500 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">Batal</button>
              <button 
                onClick={() => { 
                  customAlert.onConfirm() 
                }} 
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md rounded-xl transition-colors"
              >
                {customAlert.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPONENT MODAL RESET PASSWORD */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 flex justify-between items-center border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-800">Reset Password Pengguna</h3>
              <button onClick={() => { setResetModalOpen(false); setResetUser({ id: '', email: '', password: '' }); }} className="text-slate-400 hover:text-slate-800 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Pengguna</label>
                <input disabled type="email" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 outline-none cursor-not-allowed font-medium" value={resetUser.email} />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Password Baru</label>
                  <button type="button" onClick={generateRandomPassword} className="text-[10px] font-bold text-blue-700 hover:underline">Generate Acak</button>
                </div>
                <input required type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-blue-900 focus:bg-white outline-none font-mono font-bold" value={resetUser.password} onChange={e => setResetUser({...resetUser, password: e.target.value})} placeholder="Min. 6 karakter" />
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => { setResetModalOpen(false); setResetUser({ id: '', email: '', password: '' }); }} className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Batal</button>
                <button disabled={resetting} type="submit" className="px-4 py-2 text-xs font-bold text-white bg-blue-900 rounded-lg hover:bg-blue-800 disabled:opacity-70">{resetting ? 'Memproses...' : 'Reset Password & Kirim Email'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
