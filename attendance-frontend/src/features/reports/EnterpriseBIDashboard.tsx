import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBISummary, getBITrends, getBITeams, getBIExceptions } from '@/api/reports'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import { Users, CheckCircle, AlertTriangle, Clock, Filter, AlertCircle } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function EnterpriseBIDashboard() {
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [filters, setFilters] = useState({ from_date: fromDate, to_date: toDate })

  const summaryQuery = useQuery({
    queryKey: ['bi', 'summary', filters],
    queryFn: () => getBISummary(filters),
  })

  const trendsQuery = useQuery({
    queryKey: ['bi', 'trends', filters],
    queryFn: () => getBITrends(filters),
  })

  const teamsQuery = useQuery({
    queryKey: ['bi', 'teams', filters],
    queryFn: () => getBITeams(filters),
  })
  
  const exceptionsQuery = useQuery({
    queryKey: ['bi', 'exceptions', filters],
    queryFn: () => getBIExceptions({...filters, page_size: 10}),
  })

  const applyFilters = () => setFilters({ from_date: fromDate, to_date: toDate })

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Date,Expected,Present,Absent,Rate%\n"
      + (trendsQuery.data || []).map((e: any) => `${e.date},${e.expected},${e.present},${e.absent},${e.rate}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_export_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  const kpis = summaryQuery.data?.kpis || {}
  const trends = trendsQuery.data || []
  const teams = teamsQuery.data || []
  const exceptions = exceptionsQuery.data?.items || []

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Organization Intelligence</h1>
          <p className="mt-1 text-sm text-gray-500">Comprehensive overview of workforce attendance and punctuality.</p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <Button onClick={applyFilters}>
            <Filter className="h-4 w-4 mr-2" />
            Apply
          </Button>
          <Button variant="secondary" onClick={handleExport} disabled={!trends.length}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-sm font-medium">Organization Attendance</span>
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-4">
            <span className="text-4xl font-bold text-gray-900">{kpis.attendance_rate || 0}%</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">Overall compliance rate</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-sm font-medium">Active Workforce</span>
            <Users className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-4">
            <span className="text-4xl font-bold text-gray-900">{kpis.active_employees || 0}</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">Evaluated employees</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-sm font-medium">Average Daily Hours</span>
            <Clock className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="mt-4">
            <span className="text-4xl font-bold text-gray-900">{kpis.average_worked_hours || 0}</span>
            <span className="text-sm font-medium text-gray-500 ml-1">hrs</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">Per expected working day</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-sm font-medium">Missing Records</span>
            <AlertTriangle className={`h-5 w-5 ${kpis.open_sessions > 0 ? 'text-rose-500' : 'text-gray-400'}`} />
          </div>
          <div className="mt-4">
            <span className="text-4xl font-bold text-gray-900">{kpis.open_sessions || 0}</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">Sessions missing checkout</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Attendance Trends</h2>
          {summaryQuery.isLoading ? <div className="h-72 flex items-center justify-center text-gray-400">Loading analytics...</div> : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'MMM d')} tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelFormatter={(l) => format(new Date(l as string), 'MMM d, yyyy')}
                  />
                  <Area type="monotone" dataKey="rate" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" name="Attendance Rate %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Exceptions Panel */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 bg-gray-50/30">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <AlertCircle className="h-5 w-5 text-rose-500 mr-2" />
              Data Quality Exceptions
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-0 max-h-[320px]">
            {exceptionsQuery.isLoading ? <div className="p-6 text-center text-sm text-gray-400">Loading anomalies...</div> : exceptions.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No anomalies detected in the selected period.</div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {exceptions.map((ex: any) => (
                  <li key={ex.id} className="p-4 hover:bg-rose-50/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{ex.employee?.full_name}</p>
                        <p className="text-xs text-rose-600 font-medium mt-0.5">{ex.type}</p>
                      </div>
                      <span className="text-xs text-gray-400 font-medium">{format(new Date(ex.date), 'MMM d')}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Team Intelligence */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Team Performance Intelligence</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/50 text-xs uppercase text-gray-400 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-semibold">Team</th>
                <th className="px-6 py-4 font-semibold text-right">Size</th>
                <th className="px-6 py-4 font-semibold text-right">Expected Days</th>
                <th className="px-6 py-4 font-semibold text-right">Present Days</th>
                <th className="px-6 py-4 font-semibold text-right">Avg Hours</th>
                <th className="px-6 py-4 font-semibold text-right">Attendance Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {teamsQuery.isLoading ? <tr><td colSpan={6} className="text-center p-8 text-gray-400">Loading teams...</td></tr> : teams.length === 0 ? <tr><td colSpan={6} className="text-center p-8 text-gray-400">No teams found.</td></tr> : teams.map((team: any) => (
                <tr key={team.team.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{team.team.name}</td>
                  <td className="px-6 py-4 text-right tabular-nums">{team.size}</td>
                  <td className="px-6 py-4 text-right tabular-nums">{team.expected_days}</td>
                  <td className="px-6 py-4 text-right tabular-nums">{team.present_days}</td>
                  <td className="px-6 py-4 text-right tabular-nums">{team.average_worked_hours}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                      team.attendance_rate >= 90 ? 'bg-emerald-100 text-emerald-700' :
                      team.attendance_rate >= 75 ? 'bg-amber-100 text-amber-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {team.attendance_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
