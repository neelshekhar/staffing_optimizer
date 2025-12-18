
import React, { useState, useMemo } from 'react';
import { StaffingSolution, DemandData, Constraints, TIME_BLOCKS, DayOfWeek } from '../types';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  CheckCircle2, Users, Clock, CalendarDays, BarChart2, 
  Activity, TrendingUp, TrendingDown, Sparkles, BookOpen, 
  ChevronRight, Target, Workflow, Scale, Info, Lightbulb
} from 'lucide-react';

interface SolutionDashboardProps {
  solution: StaffingSolution;
  demand: DemandData[];
  constraints: Constraints;
}

const SolutionDashboard: React.FC<SolutionDashboardProps> = ({ solution, demand, constraints }) => {
  const [view, setView] = useState<'overview' | 'roster' | 'heatmap' | 'explanation'>('overview');
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

  // Calculate Peak Demand for Logic Tab
  const simulationFacts = useMemo(() => {
    let maxVol = 0;
    let maxDay = 'Mon';
    let maxBlock = '06:00-10:00';
    
    demand.forEach(d => {
      Object.entries(d.blocks).forEach(([block, vol]) => {
        if (vol > maxVol) {
          maxVol = vol;
          maxDay = d.day;
          maxBlock = block;
        }
      });
    });

    const ftCount = solution.weeklyStats.mix.ft;
    const ptLimit = Math.ceil(ftCount * (constraints.partTimeCap / 100));
    const wkLimit = Math.ceil(ftCount * (constraints.weekendCap / 100));

    return {
      maxVol,
      maxDay,
      maxBlock,
      ptLimit,
      wkLimit,
      requiredHeadsAtPeak: Math.ceil(maxVol / (constraints.avgProductivity * 4 * (constraints.targetUtilization / 100)))
    };
  }, [demand, solution, constraints]);

  // Calculate Heatmap Data
  const heatmapData = useMemo(() => {
    const supply: Record<string, Record<string, number>> = {};
    days.forEach(d => {
      supply[d] = {};
      TIME_BLOCKS.forEach(b => supply[d][b] = 0);
    });

    solution.roster.forEach(associate => {
      days.forEach(day => {
        const scheduleStr = associate.schedule[day];
        if (scheduleStr === 'OFF') return;

        const startHour = parseInt(scheduleStr.split(':')[0]);
        let blockIndex = -1;
        if (startHour >= 6) blockIndex = (startHour - 6) / 4;
        else if (startHour === 2) blockIndex = 5; 
        
        if (blockIndex >= 0 && blockIndex < 6) {
          supply[day][TIME_BLOCKS[blockIndex]] += 1;
          if (associate.role !== 'Part Time') {
             const nextBlockIndex = (blockIndex + 1) % 6;
             supply[day][TIME_BLOCKS[nextBlockIndex]] += 1;
          }
        }
      });
    });

    const data: Record<string, Record<string, { percent: number; reqHours: number; availHours: number }>> = {};
    days.forEach((day, dayIdx) => {
      data[day] = {};
      const dayDemand = demand[dayIdx];
      TIME_BLOCKS.forEach(block => {
        const volume = dayDemand.blocks[block];
        const heads = supply[day][block];
        const reqHours = constraints.avgProductivity > 0 ? volume / constraints.avgProductivity : 0;
        const availHours = heads * 4; 
        let percent = 0;
        if (reqHours === 0) percent = 0;
        else if (availHours === 0) percent = 999;
        else percent = Math.round((reqHours / availHours) * 100);
        data[day][block] = { percent, reqHours, availHours };
      });
    });
    return data;
  }, [solution, demand, constraints]);

  const getHeatmapColor = (util: number) => {
    if (util === 999) return 'bg-red-600 text-white';
    if (util > 110) return 'bg-red-500 text-white';
    if (util >= 85) return 'bg-emerald-500 text-white';
    if (util >= 70) return 'bg-blue-400 text-white';
    if (util > 0) return 'bg-blue-200 text-slate-700';
    return 'bg-slate-100 text-slate-400';
  };

  const totalWeeklyHours = solution.roster.reduce((acc, r) => acc + r.totalHours, 0);
  const requiredHours = solution.weeklyStats.totalVolume / constraints.avgProductivity;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      
      {/* Sub-Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex gap-2 flex-wrap">
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
          <button
            onClick={() => setView('explanation')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              view === 'explanation' ? 'bg-amber-100 text-amber-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Staffing Logic
          </button>
        </div>
        <div className="hidden md:flex items-center gap-3">
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
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
              <h3 className="text-sm font-semibold text-slate-800 mb-4 w-full text-left">Headcount Mix</h3>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mixData}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {mixData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      align="center"
                      iconSize={10} 
                      wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    />
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
             <div className={`${themeBg} rounded-lg p-4 border border-slate-100`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <div className={`py-1 px-1 rounded ${
                          person.schedule[d] === 'OFF' 
                            ? 'bg-slate-100 text-slate-400' 
                            : (isOrTools ? 'bg-purple-50 text-purple-700 font-medium' : 'bg-indigo-50 text-indigo-700 font-medium')
                        }`}>
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

      {view === 'explanation' && (
        <div className="animate-in slide-in-from-right-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Main Methodology Column */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Methodology Header */}
              <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                   <Workflow className="w-6 h-6 text-amber-600" />
                   <h3 className="text-xl font-bold text-amber-900">
                     Algorithm Step-by-Step Breakdown
                   </h3>
                </div>
                <p className="text-amber-800 text-sm leading-relaxed mb-4">
                  The {isOrTools ? 'Pattern-Based Solver' : 'Deterministic Greedy Solver'} uses a multi-phase approach to transform raw volume into a compliant workforce roster. Below is the exact sequence of logic used for your current <strong>{solution.weeklyStats.totalHeadcount} associate</strong> roster.
                </p>
                <div className="flex gap-4 flex-wrap">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-white/50 px-3 py-1.5 rounded-lg border border-amber-100">
                    <Target className="w-3.5 h-3.5" /> Goal: Maximize Coverage
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-white/50 px-3 py-1.5 rounded-lg border border-amber-100">
                    <Scale className="w-3.5 h-3.5" /> Goal: Enforce Labor Laws
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-white/50 px-3 py-1.5 rounded-lg border border-amber-100">
                    <TrendingUp className="w-3.5 h-3.5" /> Efficiency Focus
                  </div>
                </div>
              </div>

              {/* Steps List */}
              <div className="space-y-4">
                {[
                  {
                    title: "Demand-to-Headcount Conversion",
                    desc: `Your input peaks on ${simulationFacts.maxDay} at ${simulationFacts.maxBlock} with ${simulationFacts.maxVol.toLocaleString()} units. At your ${constraints.avgProductivity} items/hr productivity, the algorithm calculated a requirement for ${simulationFacts.requiredHeadsAtPeak} heads at that specific moment.`,
                    icon: <BarChart2 className="w-5 h-5" />,
                    color: "bg-blue-100 text-blue-600"
                  },
                  {
                    title: "Shift Pattern Generation",
                    desc: `Valid shifts are built: Full-Time (8h work) and Part-Time (4h work). ${isOrTools ? 'For your simulation, the solver considered thousands of combinations of 6-day work weeks, rotating off-days to fill all demand gaps while minimizing overstaffing.' : 'The greedy solver searched for contiguous 8-hour blocks to fill with FT staff first.'}`,
                    icon: <Clock className="w-5 h-5" />,
                    color: "bg-indigo-100 text-indigo-600"
                  },
                  {
                    title: isOrTools ? "Weighted Pattern Selection" : "Greedy Unit Filling",
                    desc: isOrTools 
                      ? "The solver prioritized patterns that covered 'Unmet Demand' (Reward) while penalizing blocks that already had enough staff. This prevents 300%+ utilization spikes by spreading the workload across the week."
                      : "Demand units were filled starting with the highest consecutive demand peaks. Full-Time staff were assigned to the floor load, and Part-Time staff were 'mopped up' to fill the remaining 4-hour isolated gaps.",
                    icon: <Sparkles className="w-5 h-5" />,
                    color: "bg-purple-100 text-purple-600"
                  },
                  {
                    title: "Staffing Mix Math",
                    desc: `The solver calculated your max Part-Time cap as ${simulationFacts.ptLimit} associates (${constraints.partTimeCap}% of ${solution.weeklyStats.mix.ft} FT). Since you used ${solution.weeklyStats.mix.pt} PT staff, the solution is ${solution.weeklyStats.mix.pt <= simulationFacts.ptLimit ? 'within' : 'exceeding'} your preferred efficiency constraints.`,
                    icon: <Scale className="w-5 h-5" />,
                    color: "bg-emerald-100 text-emerald-600"
                  }
                ].map((step, i) => (
                  <div key={i} className="flex gap-4 p-5 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-shadow group">
                    <div className="flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step.color}`}>
                        {step.icon}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        Step {i + 1}: {step.title}
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                      </h4>
                      <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Logic Column */}
            <div className="space-y-6">
              
              {/* Simulation Insights */}
              <div className={`p-6 rounded-xl border shadow-sm ${isOrTools ? 'bg-purple-900 text-white border-purple-700' : 'bg-indigo-900 text-white border-indigo-700'}`}>
                <h3 className="font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider opacity-90">
                  <Lightbulb className="w-5 h-5 text-yellow-400" />
                  Simulation Insights
                </h3>
                <div className="space-y-4">
                  <div className="border-b border-white/10 pb-3">
                    <p className="text-[10px] uppercase opacity-60 font-bold mb-1">Peak Day Analysis</p>
                    <p className="text-sm">The hardest day to staff was <strong>{simulationFacts.maxDay}</strong>, driven by the <strong>{simulationFacts.maxBlock}</strong> window.</p>
                  </div>
                  <div className="border-b border-white/10 pb-3">
                    <p className="text-[10px] uppercase opacity-60 font-bold mb-1">Efficiency Decision</p>
                    <p className="text-sm">The solver deployed <strong>{solution.weeklyStats.mix.pt} Part-Time</strong> associates to fill spikes where a Full-Time shift would have caused {'>'}100% waste.</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase opacity-60 font-bold mb-1">Utilization Target</p>
                    <p className="text-sm">By aiming for <strong>{constraints.targetUtilization}%</strong>, the algorithm allowed for approximately <strong>{Math.round(totalWeeklyHours * (1 - (constraints.targetUtilization/100)))} hrs</strong> of indirect buffer time.</p>
                  </div>
                </div>
              </div>

              {/* How Mix is Assigned */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Role Assignment Logic
                </h3>
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-xs font-bold text-blue-700 uppercase">Full Time</h4>
                      <span className="text-[10px] bg-blue-100 px-1.5 py-0.5 rounded text-blue-600 font-bold">{solution.weeklyStats.mix.ft} Count</span>
                    </div>
                    <p className="text-xs text-blue-800">Assigned in 6-day blocks to cover the 'Base Load' that persists across the week.</p>
                  </div>
                  <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-xs font-bold text-emerald-700 uppercase">Part Time</h4>
                      <span className="text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-600 font-bold">{solution.weeklyStats.mix.pt} Count</span>
                    </div>
                    <p className="text-xs text-emerald-800">Deployed into isolated 4hr demand spikes to maintain your target utilization.</p>
                  </div>
                  <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-xs font-bold text-amber-700 uppercase">Weekend Warriors</h4>
                      <span className="text-[10px] bg-amber-100 px-1.5 py-0.5 rounded text-amber-600 font-bold">{solution.weeklyStats.mix.weekend} Count</span>
                    </div>
                    <p className="text-xs text-amber-800">Reserved for Fri-Sun peaks that cannot be covered by core staff due to 6-day limits.</p>
                  </div>
                </div>
              </div>

              {/* FAQ / Help */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2 mb-2">
                  <Info className="w-3.5 h-3.5" /> Pro Tip
                </h4>
                <p className="text-[10px] text-slate-500 leading-normal">
                  If you see "300% utilization" in the heatmap, it means demand is 3x your capacity for that block. Try lowering <strong>Productivity</strong> or increasing <strong>FT Staffing</strong> to solve this.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SolutionDashboard;
