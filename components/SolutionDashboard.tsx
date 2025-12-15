
import React, { useState } from 'react';
import { StaffingSolution } from '../types';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { CheckCircle2, Users, Clock, CalendarDays, Download } from 'lucide-react';

interface SolutionDashboardProps {
  solution: StaffingSolution;
}

const SolutionDashboard: React.FC<SolutionDashboardProps> = ({ solution }) => {
  const [view, setView] = useState<'overview' | 'roster'>('overview');

  const mixData = [
    { name: 'Full Time', value: solution.weeklyStats.mix.ft, color: '#3b82f6' },
    { name: 'Part Time', value: solution.weeklyStats.mix.pt, color: '#10b981' },
    { name: 'Weekend Only', value: solution.weeklyStats.mix.weekend, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      
      {/* Sub-Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setView('overview')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'overview' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Overview & Stats
          </button>
          <button
            onClick={() => setView('roster')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'roster' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Detailed Roster
          </button>
        </div>
        <div className="text-sm text-slate-500">
           Total Headcount: <strong>{solution.weeklyStats.totalHeadcount}</strong>
        </div>
      </div>

      {view === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">Total Hours</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {solution.roster.reduce((acc, r) => acc + r.totalHours, 0).toLocaleString()} <span className="text-sm font-normal text-slate-400">hrs/wk</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <Clock className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">Efficiency</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {solution.weeklyStats.blendedUtilization.toFixed(1)}% <span className="text-sm font-normal text-slate-400">utilization</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
               <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-50 rounded-lg">
                  <CalendarDays className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">Staffing Mix</span>
              </div>
              <div className="text-sm text-slate-700 mt-1">
                <span className="font-semibold">{solution.weeklyStats.mix.ft}</span> FT, {' '}
                <span className="font-semibold">{solution.weeklyStats.mix.pt}</span> PT, {' '}
                <span className="font-semibold">{solution.weeklyStats.mix.weekend}</span> Wknd
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Strategy Text */}
            <div className="md:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Optimization Strategy</h3>
              <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap font-sans">{solution.strategySummary}</p>
              
              <h4 className="font-medium text-slate-800 mt-6 mb-3">Key Recommendations</h4>
              <ul className="space-y-2">
                {solution.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            {/* Mix Chart */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
              <h3 className="text-sm font-semibold text-slate-800 mb-2 w-full text-left">Headcount Mix</h3>
              <div className="w-full h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mixData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {mixData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: '12px' }}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'roster' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 sticky left-0 bg-slate-50 z-20">Associate Name</th>
                  <th className="px-4 py-3 sticky left-[120px] bg-slate-50 z-20 shadow-r">Role</th>
                  {days.map(d => (
                    <th key={d} className="px-2 py-3 text-center min-w-[100px]">{d}</th>
                  ))}
                  <th className="px-4 py-3 text-right">Hrs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {solution.roster.map((person) => (
                  <tr key={person.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2 font-medium text-slate-800 sticky left-0 bg-white z-10 whitespace-nowrap">
                      {person.name}
                    </td>
                    <td className="px-4 py-2 sticky left-[120px] bg-white z-10 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                        person.role === 'Full Time' ? 'bg-blue-100 text-blue-700' :
                        person.role === 'Part Time' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {person.role}
                      </span>
                    </td>
                    {days.map(d => (
                      <td key={d} className="px-2 py-2 text-center">
                        {/* @ts-ignore */}
                        <div className={`py-1 px-1 rounded ${
                           // @ts-ignore
                          person.schedule[d] === 'OFF' 
                            ? 'bg-slate-100 text-slate-400' 
                            : 'bg-indigo-50 text-indigo-700 font-medium'
                        }`}>
                           {/* @ts-ignore */}
                          {person.schedule[d]}
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-slate-700">
                      {person.totalHours}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SolutionDashboard;
