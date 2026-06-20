'use client'
import { useMemo } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts'

const DINSOS_NAVY = '#1e3a8a'; 
const DINSOS_RED = '#dc2626';  

const StatCard = ({ title, count, icon, colorClass }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between transition-all hover:border-slate-300 shadow-sm group">
    <div>
      <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-2xl font-black text-slate-800">{count}</h3>
    </div>
    <div className={`p-3 rounded-lg text-white ${colorClass} transition-transform duration-300 group-hover:scale-110 shadow-md`}>
      {icon}
    </div>
  </div>
)

export default function StatCards({ stats, users = [], activeTab }) {
  const showDistribusi = activeTab !== 'data'
  const pieData = useMemo(() => {
    const roles = { operator: 0, bidang: 0, superadmin: 0 }
    users.forEach(u => { if (roles[u.role] !== undefined) roles[u.role]++ })
    return [
      { name: 'Operator', value: roles.operator }, 
      { name: 'Bidang', value: roles.bidang }, 
      { name: 'Admin', value: roles.superadmin }
    ]
  }, [users])

  const PIE_COLORS = [DINSOS_NAVY, DINSOS_RED, '#f59e0b']

  const barData = useMemo(() => {
    const cityCounts = {}
    users.filter(u => u.role === 'operator').forEach(u => { 
      const city = u.kabupaten_kota || 'Belum Diatur'; 
      cityCounts[city] = (cityCounts[city] || 0) + 1 
    })
    return Object.keys(cityCounts).map(city => ({ name: city, Total: cityCounts[city] })).sort((a,b) => b.Total - a.Total)
  }, [users])

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Baris Statistik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard 
          title="Total Pengguna" 
          count={stats.users} 
          colorClass="bg-blue-900" 
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} 
        />
        <StatCard 
          title="Operator Daerah" 
          count={stats.cities} 
          colorClass="bg-red-600" 
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011.001 1v5m-4.001 0h4.001" /></svg>} 
        />
        <StatCard 
          title="Total Pengajuan" 
          count={stats.totalData} 
          colorClass="bg-emerald-600" 
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} 
        />
      </div>

      {/* Baris Grafik Grafik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {showDistribusi && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
            <h3 className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Distribusi Akun</h3>
            <div className="flex-1 min-h-[240px] w-full">
              <ResponsiveContainer width="100%" height={240} minHeight={240}>
                <PieChart margin={{ top: 20, right: 0, bottom: 20, left: 0 }}>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} /> ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                  <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: '11.5px', fontWeight: 'bold', color: '#64748b', paddingTop: '15px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        <div className={`${showDistribusi ? 'md:col-span-2' : 'md:col-span-3'} bg-white border border-slate-200 rounded-xl p-5 flex flex-col`}>
          <h3 className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Sebaran Wilayah Operator</h3>
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
