
import React, { useState, useMemo } from 'react';
import { StaffingSolution, DemandData, Constraints, TIME_BLOCKS, DayOfWeek } from '../types';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { CheckCircle2, Users, Clock, CalendarDays, BarChart2, Activity, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';

interface SolutionDashboardProps {
  solution: StaffingSolution;
  demand: DemandData[];
  constraints: Constraints;
}

const SolutionDashboard: React.FC<SolutionDashboardProps> = ({ solution, demand, constraints }) => {
  const [view, setView] = useState<'overview' | 'roster' | 'heatmap'>('overview');
  const isOrTools = solution.solverMethod === 'ortools';
  const themeColor = isOrTools ? 'text-purple-600' : 'text-indigo-600';
  const themeBg = isOrTools ? 'bg-purple-50' : 'bg-indigo-50';
  const themeButton = isOrTools ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700';

  const mixData = [
    { name: 'Full Time', value: solution.weeklyStats.mix.ft, color: isOrTools ? '#9333ea' : '#3b82f6' },
    { name: 'Part Time', value: solution.weeklyStats.mix.pt, color: '#10b981' },
    { name: 'Weekend Only', value: solution.weeklyStats.mix.weekend, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const days: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Calculate Heatmap Data
  const heatmapData = useMemo(() => {
    // 1. Initialize Supply Matrix
    const supply: Record<string, Record<string, number>> = {};
    days.forEach(d => {
      supply[d] = {};
      TIME_BLOCKS.forEach(b => supply[d][b] = 0);
    });

    // 2. Populate Supply from Roster
    solution.roster.forEach(associate => {
      days.forEach(day => {
        const scheduleStr = associate.schedule[day];
        if (scheduleStr === 'OFF') return;

        // Parse start hour from "HH:00-HH:00"
        const startHour = parseInt(scheduleStr.split(':')[0]);
        // Map start hour to block index: (Start - 6) / 4
        let blockIndex = -1;
        if (startHour >= 6) blockIndex = (startHour - 6) / 4;
        else if (startHour === 2) blockIndex = 5; // 02:00 is index 5
        
        if (blockIndex >= 0 && blockIndex < 6) {
          // Add capacity to the starting block
          supply[day][TIME_BLOCKS[blockIndex]] += 1;
          
          // FT/WW: 8h = 2 blocks. PT: 4h = 1 block.
          // Note: The previous algorithm hardcoded PT=4h, FT=8h.
          // The ORTools one respects the duration in `generatePatterns` but we simplify here for display
          // assuming standard durations.
          if (associate.role !== 'Part Time') {
             const nextBlockIndex = (blockIndex + 1) % 6;
             supply[day][TIME_BLOCKS[nextBlockIndex]] += 1;
          }
        }
      });
    });

    // 3. Calculate Utilization (Now in Hours)
    const data: Record<string, Record<string, { percent: number; reqHours: number; availHours: number }>> = {};
    
    days.forEach((day, dayIdx) => {
      data[day] = {};
      const dayDemand = demand[dayIdx];
      
      TIME_BLOCKS.forEach(block => {
        const volume = dayDemand.blocks[block]; // Orders
        const heads = supply[day][block]; // Headcount
        
        // Convert Volume to Required Hours
        const reqHours = constraints.avgProductivity > 0 ? volume / constraints.avgProductivity : 0;
        
        // Calculate Available Hours (Headcount * 4hr block)
        const availHours = heads * 4; 
        
        let percent = 0;
        if (reqHours === 0) percent = 0;
        else if (availHours === 0) percent = 999; // Infinite/Error
        else percent = Math.round((reqHours / availHours) * 100);

        data[day][block] = { percent, reqHours, availHours };
      });
    });

    return data;
  }, [solution, demand, constraints]);

  // Updated Thresholds: 85-110% is Optimal
  const getHeatmapColor = (util: number) => {
    if (util === 999) return 'bg-red-600 text-white'; // Uncovered
    if (util > 110) return 'bg-red-500 text-white'; // Understaffed (>110%)
    if (util >= 85) return 'bg-emerald-500 text-white'; // Optimal (85-110%)
    if (util >= 70) return 'bg-blue-400 text-white'; // Safe/Relaxed (70-84%)
    if (util > 0) return 'bg-blue-200 text-slate-700'; // Overstaffed (<70%)
    return 'bg-slate-100 text-slate-400'; // No volume
  };

  const totalWeeklyHours = solution.roster.reduce((acc, r) => acc + r.totalHours, 0);
  const requiredHours = solution.weeklyStats.totalVolume / constraints.avgProductivity;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      
      {/* Sub-Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setView('overview')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'overview' ? themeButton : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Overview & Stats
          </button>
          <button
            onClick={() => setView('heatmap')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'heatmap' ? themeButton : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Utilization Heatmap
          </button>
          <button
            onClick={() => setView('roster')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'roster' ? themeButton : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Detailed Roster
          </button>
        </div>
        <div className="flex items-center gap-3">
           {isOrTools && (
               <span className="px-2 py-1 rounded-md bg-purple-100 text-purple-700 text-xs font-bold flex items-center gap-1 border border-purple-200">
                  <Sparkles className="w-3 h-3" /> Pattern Solver Active
               </span>
           )}
           <div className="text-sm text-slate-500">
              Total Headcount: <strong>{solution.weeklyStats.totalHeadcount}</strong>
           </div>
        </div>
      </div>

      {view === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm ${isOrTools ? 'border-purple-100' : ''}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">Total Hours</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {totalWeeklyHours.toLocaleString()} <span className="text-sm font-normal text-slate-400">hrs/wk</span>
              </div>
            </div>

            <div className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm ${isOrTools ? 'border-purple-100' : ''}`}>
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

            <div className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm ${isOrTools ? 'border-purple-100' : ''}`}>
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
            <div className={`md:col-span-2 bg-white p-6 rounded-xl border shadow-sm ${isOrTools ? 'border-purple-200' : 'border-slate-200'}`}>
              <h3 className={`text-lg font-semibold mb-3 ${isOrTools ? 'text-purple-800' : 'text-slate-800'}`}>Optimization Strategy</h3>
              <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap font-sans">{solution.strategySummary}</p>
              
              <h4 className="font-medium text-slate-800 mt-6 mb-3">Key Recommendations</h4>
              <ul className="space-y-2">
                {solution.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isOrTools ? 'text-purple-500' : 'text-emerald-500'}`} />
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

      {view === 'heatmap' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          
          <div className="flex flex-col gap-4 mb-6">
             <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                   <BarChart2 className={`w-5 h-5 ${themeColor}`} />
                   <h3 className="text-lg font-semibold text-slate-800">Intra-Day Utilization Heatmap</h3>
                </div>
                <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 inline-block w-fit">
                    Cell Format: <strong>% Utilization (Required Hours / Available Hours)</strong>
                </div>
             </div>

             {/* Deep Dive Section */}
             <div className={`${themeBg} rounded-lg p-4 border border-slate-100`}>
                {/* Row 1: Hours Analysis & Scenarios (2 Columns) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 1. Hours Analysis */}
                    <div className="space-y-3">
                       <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                         <Clock className={`w-4 h-4 ${themeColor}`} /> Labor Hours Analysis
                       </h4>
                       <div className="space-y-2 text-sm bg-white p-3 rounded border border-slate-100 h-full">
                         <div className="flex justify-between items-center">
                           <span className="text-slate-500 text-xs uppercase font-medium">Demand Required</span>
                           <span className="font-semibold text-slate-800">{Math.round(requiredHours).toLocaleString()} hrs</span>
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-slate-500 text-xs uppercase font-medium">Roster Available</span>
                           <span className="font-semibold text-slate-800">{totalWeeklyHours.toLocaleString()} hrs</span>
                         </div>
                         <div className="h-px bg-slate-100 my-1"></div>
                         <div className="flex justify-between items-center">
                           <span className="text-slate-500 text-xs uppercase font-medium">Net Utilization</span>
                           <span className={`font-bold ${solution.weeklyStats.blendedUtilization > 110 ? 'text-red-600' : 'text-emerald-600'}`}>
                             {solution.weeklyStats.blendedUtilization.toFixed(1)}%
                           </span>
                         </div>
                       </div>
                    </div>

                    {/* 2. Scenario Planning Guide */}
                    <div className="space-y-3">
                       <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                         <Activity className="w-4 h-4 text-emerald-600" /> Scenario Planning Guide
                       </h4>
                       <div className="space-y-2 text-xs h-full">
                         <div className="bg-white p-2.5 rounded border border-slate-100 flex items-start gap-2 h-[48%]">
                            <TrendingUp className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-slate-700 block">Stretched Roster (Lower Cost)</span>
                              <span className="text-slate-500">Increase <strong>Target Utilization</strong> input to &gt;110% to force leaner staffing.</span>
                            </div>
                         </div>
                         <div className="bg-white p-2.5 rounded border border-slate-100 flex items-start gap-2 h-[48%]">
                            <TrendingDown className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-slate-700 block">Safe Roster (Buffer)</span>
                              <span className="text-slate-500">Decrease <strong>Target Utilization</strong> input to &lt;85% to build in safety stock.</span>
                            </div>
                         </div>
                       </div>
                    </div>
                </div>
             </div>
          </div>
          
          <div className="flex justify-end gap-4 mb-4 text-xs font-medium text-slate-600 flex-wrap border-t border-slate-100 pt-4">
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded"></div> Optimal (85-110%)</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-400 rounded"></div> Relaxed (70-84%)</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-200 rounded"></div> Low (&lt;70%)</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded"></div> Understaffed (&gt;110%)</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-3 bg-slate-50 border border-slate-200 text-slate-500 font-medium">Day</th>
                  {TIME_BLOCKS.map(block => (
                    <th key={block} className="p-3 bg-slate-50 border border-slate-200 text-center text-slate-500 font-medium min-w-[120px]">
                      {block}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map(day => (
                  <tr key={day}>
                    <td className="p-3 border border-slate-200 font-semibold text-slate-700 bg-slate-50">{day}</td>
                    {TIME_BLOCKS.map(block => {
                      const { percent, reqHours, availHours } = heatmapData[day][block];
                      return (
                        <td key={`${day}-${block}`} className={`p-2 border border-white text-center transition-colors ${getHeatmapColor(percent)}`}>
                           <div className="flex flex-col items-center justify-center h-full">
                                <span className="font-bold text-sm leading-tight">{percent === 999 ? 'GAP' : `${percent}%`}</span>
                                <span className="text-[10px] opacity-80 font-medium whitespace-nowrap leading-tight">({Math.round(reqHours)} / {availHours})</span>
                           </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-4 italic">
            * Utilization = Required Hours (Demand/Prod) / Available Roster Hours.
          </p>
        </div>
      )}

      {view === 'roster' && (
        <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isOrTools ? 'border-purple-200' : 'border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className={`text-slate-500 font-medium border-b border-slate-200 ${isOrTools ? 'bg-purple-50' : 'bg-slate-50'}`}>
                <tr>
                  <th className={`px-4 py-3 sticky left-0 z-20 ${isOrTools ? 'bg-purple-50' : 'bg-slate-50'}`}>Associate Name</th>
                  <th className={`px-4 py-3 sticky left-[120px] z-20 shadow-r ${isOrTools ? 'bg-purple-50' : 'bg-slate-50'}`}>Role</th>
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
                        person.role === 'Full Time' ? (isOrTools ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700') :
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
                            : (isOrTools ? 'bg-purple-50 text-purple-700 font-medium' : 'bg-indigo-50 text-indigo-700 font-medium')
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