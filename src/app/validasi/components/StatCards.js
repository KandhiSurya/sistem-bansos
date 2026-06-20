'use client'
import { useMemo } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts'

const DINSOS_NAVY = '#1e3a8a'; 
const DINSOS_RED = '#dc2626';  

const StatCard = ({ title, count, icon, colorClass }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between transition-all hover:border-slate-300 group">
    <div>
      <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-2xl font-black text-slate-800">{count}</h3>
    </div>
    <div className={`p-3 rounded-lg text-white ${colorClass} transition-transform duration-300 group-hover:scale-110`}>
      {icon}
    </div>
  </div>
)

export default function StatCards({ stats, dataBansos }) {
  const pieData = useMemo(() => [
    { name: 'PKH', value: stats.pkh }, 
    { name: 'KIP', value: stats.kip }, 
    { name: 'FAKMIS', value: stats.fakmis }
  ], [stats])

  const PIE_COLORS = [DINSOS_NAVY, DINSOS_RED, '#f59e0b'] 

  const barData = useMemo(() => {
    const cityCounts = {}
    dataBansos.forEach(item => { 
      cityCounts[item.kabupaten_kota || 'Belum Diatur'] = (cityCounts[item.kabupaten_kota || 'Belum Diatur'] || 0) + 1 
    })
    return Object.keys(cityCounts).map(city => ({ name: city, Total: cityCounts[city] })).sort((a, b) => b.Total - a.Total) 
  }, [dataBansos])

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard title="Total Masuk" count={stats.total} colorClass="bg-blue-900" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
        <StatCard title="Perlu Validasi" count={stats.perluValidasi} colorClass="bg-amber-500" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <StatCard title="Disetujui" count={stats.disetujui} colorClass="bg-emerald-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <StatCard title="Ditolak / Revisi" count={stats.ditolak} colorClass="bg-rose-600" icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
      </div>

      {/* CHARTS CONTAINER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
         <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
           <h3 className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Distribusi Program</h3>
           <div className="flex-1 min-h-[240px] w-full">
              <ResponsiveContainer width="100%" height={240} minHeight={240}>
                 <PieChart margin={{ top: 20, right: 0, bottom: 20, left: 0 }}>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                       {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} /> )}
                    </Pie>
                    <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                    <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{fontSize: '11.5px', fontWeight: 'bold', color: '#64748b', paddingTop: '15px'}} />
                 </PieChart>
              </ResponsiveContainer>
           </div>
         </div>
         <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
           <h3 className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Profil Pengajuan per Kabupaten/Kota</h3>
           <div className="flex-1 min-h-[240px]">
              <ResponsiveContainer width="100%" height={240} minHeight={240}>
                 <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} allowDecimals={false} />
                    <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="Total" fill={DINSOS_NAVY} radius={[4, 4, 0, 0]} barSize={32} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
         </div>
      </div>
    </div>
  )
}
