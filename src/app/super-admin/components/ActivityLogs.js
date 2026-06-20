'use client'
import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import toast from 'react-hot-toast'
import { getActionDetails } from '@/utils/superAdminHelpers'

const getLogBadgeColor = (role) => {
  if (role === 'Super Admin' || role?.toLowerCase() === 'superadmin') return 'bg-slate-950 text-white border-slate-950'
  if (role === 'Bidang') return 'bg-blue-50 text-blue-700 border-blue-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

const ACTION_ICONS = {
  create: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  delete: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  security: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m0 0a2 2 0 01-2 2m2-2h3m-3-3v3m-9 8h10M5 5h.01M5 9h.01M5 13h.01M5 17h.01" />
    </svg>
  ),
  validate: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  edit: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  export: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
    </svg>
  ),
  default: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
};

export default function ActivityLogs({
  logs,
  fetchData,
  catatLog
}) {
  const [filterLogRole, setFilterLogRole] = useState('Semua')
  const [searchLogTerm, setSearchLogTerm] = useState('')
  const [viewMode, setViewMode] = useState('timeline')

  // Local Confirmation Dialog
  const [customAlert, setCustomAlert] = useState({ isOpen: false, title: '', message: '', danger: true, confirmLabel: 'Hapus', onConfirm: null })

  // --- LOGIKA FILTER AUDIT LOG AKTIVITAS ---
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchRole = filterLogRole === 'Semua' || log.role?.toLowerCase() === filterLogRole.toLowerCase();
      
      const term = searchLogTerm.toLowerCase();
      const matchSearch = !searchLogTerm || 
        (log.email_pengguna && log.email_pengguna.toLowerCase().includes(term)) ||
        (log.aksi && log.aksi.toLowerCase().includes(term)) ||
        (log.keterangan && log.keterangan.toLowerCase().includes(term));

      return matchRole && matchSearch;
    });
  }, [logs, filterLogRole, searchLogTerm]);

  const executeClearLogs = async () => {
    const toastId = toast.loading("Membersihkan riwayat log...");
    try {
      const { error } = await supabase.from('log_aktivitas').delete().not('created_at', 'is', null);
      if (error) throw error;
      toast.success("Seluruh riwayat aktivitas dibersihkan!", { id: toastId });
      await catatLog("Bersihkan Log", "Super Admin membersihkan seluruh riwayat audit log aktivitas dari database.");
      await fetchData();
    } catch (error) { 
      toast.error("Gagal membersihkan log: " + error.message, { id: toastId }); 
    }
  }

  return (
    <div className="animate-fadeIn">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Peran Pengguna:</span>
            <select value={filterLogRole} onChange={(e) => setFilterLogRole(e.target.value)} className="bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-900 cursor-pointer">
              <option value="Semua">Semua Pengguna</option>
              <option value="Super Admin">Super Admin</option>
              <option value="Bidang">Bidang Provinsi</option>
              <option value="Operator">Operator Kota/Daerah</option>
            </select>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'timeline' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Linimasa
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              Tabel Log
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <input type="text" placeholder="Cari email / aksi log..." className="pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:border-blue-900 outline-none w-full transition-all" value={searchLogTerm} onChange={(e) => setSearchLogTerm(e.target.value)} />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <button 
            onClick={() => {
              setCustomAlert({
                isOpen: true, 
                title: 'Bersihkan Log Aktivitas', 
                message: 'Yakin ingin menghapus seluruh riwayat log audit aktivitas sistem dari database?', 
                danger: true, 
                confirmLabel: 'Ya, Bersihkan Log',
                onConfirm: () => { 
                  setCustomAlert(prev => ({ ...prev, isOpen: false }))
                  executeClearLogs(); 
                }
              })
            }} 
            className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors border border-rose-200 whitespace-nowrap"
          >
            Bersihkan Log
          </button>
        </div>
      </div>

      {viewMode === 'timeline' ? (
        <div className="p-8 bg-slate-50/30">
          <div className="relative border-l-2 border-slate-200 ml-4 md:ml-6 space-y-8 pb-4">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => {
                const actionDetails = getActionDetails(log.aksi);
                const iconElement = ACTION_ICONS[actionDetails.type] || ACTION_ICONS.default;
                return (
                  <div key={log.id} className="relative pl-8 md:pl-10 group transition-all">
                    {/* Bullet Icon Line Connect */}
                    <div className={`absolute -left-[17px] top-1.5 w-8 h-8 rounded-full border-4 border-white ${actionDetails.bgColor} ${actionDetails.textColor} flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-110 z-10`}>
                      {iconElement}
                    </div>
                    
                    {/* Audit Card */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wide">
                            {log.aksi}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${getLogBadgeColor(log.role)}`}>
                            {log.role || 'User'}
                          </span>
                        </div>
                        <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {new Date(log.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          <span className="text-slate-300">|</span>
                          {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' })} WIB
                        </div>
                      </div>
                      
                      <p className="text-xs font-semibold text-slate-700 leading-relaxed mb-3">
                        {log.keterangan}
                      </p>
                      
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        <span>Aktor: <span className="text-slate-700 font-black">{log.email_pengguna}</span></span>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="pl-6 text-slate-400 text-sm italic py-10">Belum ada rekaman aktivitas audit log.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Waktu & Tanggal</th>
                <th className="px-6 py-4">Informasi Aktor</th>
                <th className="px-6 py-4">Kategori Aksi</th>
                <th className="px-6 py-4 w-5/12">Keterangan Aktivitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 align-middle whitespace-nowrap">
                    <div className="text-[12px] font-bold text-slate-800">{new Date(log.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' })} WIB</div>
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <div className="text-[12px] font-bold text-slate-800">{log.email_pengguna}</div>
                    <div className="mt-1"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${getLogBadgeColor(log.role)}`}>{log.role || 'User'}</span></div>
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <span className="text-[11px] font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md">{log.aksi}</span>
                  </td>
                  <td className="px-6 py-4 align-middle text-[12px] text-slate-600 leading-relaxed font-medium">{log.keterangan}</td>
                </tr>
              )) : <tr><td colSpan="4" className="px-6 py-10 text-center text-slate-400 text-sm italic">Belum ada rekaman aktivitas audit log.</td></tr>}
            </tbody>
          </table>
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
    </div>
  )
}
