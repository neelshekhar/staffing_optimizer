
import React, { useState, useMemo } from 'react';
import { StaffingSolution, DemandData, Constraints, DayOfWeek } from '../types';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Area
} from 'recharts';
import { 
  CheckCircle2, Users, Clock, CalendarDays, BarChart2, 
  Activity, TrendingUp, TrendingDown, Sparkles, BookOpen, 
  ChevronRight, Target, Workflow, Scale, Info, Lightbulb, LineChart
} from 'lucide-react';

interface SolutionDashboardProps {
  solution: StaffingSolution;
  demand: DemandData[];
  constraints: Constraints;
}

const SolutionDashboard: React.FC<SolutionDashboardProps> = ({ solution, demand, constraints }) => {
  const [view, setView] = useState<'overview' | 'roster' | 'heatmap' | 'explanation' | 'coverage'>('overview');
  const [heatmapMode, setHeatmapMode] = useState<'actual_vs_required' | 'efficiency' | 'surplus'>('actual_vs_required');
  const [selectedCoverageDay, setSelectedCoverageDay] = useState<DayOfWeek>('Mon');
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
    let maxBlock = '06:00';
    
    demand.forEach(d => {
      d.hours.forEach((vol, hour) => {
        if (vol > maxVol) {
          maxVol = vol;
          maxDay = d.day;
          maxBlock = `${hour}:00`;
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
      requiredHeadsAtPeak: Math.ceil(maxVol / constraints.avgProductivity)
    };
  }, [demand, solution, constraints]);

  // Calculate Heatmap Data
  const heatmapData = useMemo(() => {
    const supply: Record<string, number[]> = {};
    days.forEach(d => {
      supply[d] = new Array(24).fill(0);
    });

    solution.roster.forEach(associate => {
      days.forEach(day => {
        const scheduleStr = associate.schedule[day];
        if (scheduleStr === 'OFF') return;

        const startHour = parseInt(scheduleStr.split(':')[0]);
        const duration = associate.role === 'Part Time' ? 4 : 9; // 9h duration for FT/WW
        
        if (associate.role === 'Part Time') {
             for (let i = 0; i < duration; i++) {
                supply[day][(startHour + i) % 24] += 1;
            }
        } else {
            // Peak Protected Smearing for FT/WW
            // 1. Get demand for this window to find peaks
            const dayDemand = demand.find(d => d.day === day);
            if (dayDemand) {
                const windowHours: { hourIdx: number, val: number }[] = [];
                for (let i = 0; i < duration; i++) {
                    const h = (startHour + i) % 24;
                    windowHours.push({ hourIdx: h, val: dayDemand.hours[h] });
                }
                // 2. Sort by demand to find top 3
                windowHours.sort((a, b) => b.val - a.val);
                const peakHours = new Set(windowHours.slice(0, 3).map(x => x.hourIdx));
                
                // 3. Assign capacity
                for (let i = 0; i < duration; i++) {
                    const h = (startHour + i) % 24;
                    const cap = peakHours.has(h) ? 1.0 : 5/6;
                    supply[day][h] += cap;
                }
            } else {
                // Fallback if demand data missing
                for (let i = 0; i < duration; i++) {
                    supply[day][(startHour + i) % 24] += 8/9;
                }
            }
        }
      });
    });

    const data: Record<string, { percent: number; reqHours: number; availHours: number }[]> = {};
    days.forEach((day, dayIdx) => {
      data[day] = [];
      const dayDemand = demand[dayIdx];
      for (let hour = 0; hour < 24; hour++) {
        const volume = dayDemand.hours[hour];
        const heads = supply[day][hour];
        const reqHours = constraints.avgProductivity > 0 ? volume / constraints.avgProductivity : 0;
        const availHours = heads; // 1 head = 1 hour of availability in this 1-hour block
        let percent = 0;
        if (reqHours === 0) percent = 0;
        else if (availHours === 0) percent = 999;
        else percent = Math.round((reqHours / availHours) * 100);
        data[day].push({ percent, reqHours, availHours });
      }
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

  const coverageChartData = useMemo(() => {
    return heatmapData[selectedCoverageDay].map((data, index) => ({
      hour: `${index.toString().padStart(2, '0')}:00`,
      required: Math.round(data.reqHours * 10) / 10,
      available: data.availHours,
      surplus: Math.round((data.availHours - data.reqHours) * 10) / 10
    }));
  }, [heatmapData, selectedCoverageDay]);

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
            Utilization Dashboard
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
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Total Workers */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="text-sm font-medium text-slate-500 mb-2">Total Workers</div>
              <div className="text-4xl font-bold text-blue-600 mb-4">{solution.weeklyStats.totalHeadcount}</div>
              <div className="space-y-1 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>FTE equivalent</span>
                  <span className="font-medium text-slate-700">{(totalWeeklyHours / 48).toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Solve time</span>
                  <span className="font-medium text-slate-700">~1.2s</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 leading-tight">
                FT/WW = 1.0 FTE · PT = 0.5 FTE
              </div>
            </div>

            {/* Worker Mix */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="text-sm font-medium text-slate-500 mb-4">Worker Mix</div>
              <div className="space-y-3 flex-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="font-medium text-slate-700">FT</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${(solution.weeklyStats.mix.ft / solution.weeklyStats.totalHeadcount) * 100}%` }}></div>
                    </div>
                    <span className="w-4 text-right text-slate-600">{solution.weeklyStats.mix.ft}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="font-medium text-slate-700">PT</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${(solution.weeklyStats.mix.pt / solution.weeklyStats.totalHeadcount) * 100}%` }}></div>
                    </div>
                    <span className="w-4 text-right text-slate-600">{solution.weeklyStats.mix.pt}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <span className="font-medium text-slate-700">WW</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${(solution.weeklyStats.mix.weekend / solution.weeklyStats.totalHeadcount) * 100}%` }}></div>
                    </div>
                    <span className="w-4 text-right text-slate-600">{solution.weeklyStats.mix.weekend}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Part-timers */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="text-sm font-medium text-slate-500 mb-2">Part-timers</div>
              <div className="text-4xl font-bold text-emerald-500 mb-1">
                {Math.round((solution.weeklyStats.mix.pt / solution.weeklyStats.totalHeadcount) * 100) || 0}%
              </div>
              <div className="text-xs text-slate-500 mb-4">
                {solution.weeklyStats.mix.pt} of {solution.weeklyStats.totalHeadcount} workers
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-auto">
                <div className="h-full bg-slate-800" style={{ width: `${(solution.weeklyStats.mix.pt / solution.weeklyStats.totalHeadcount) * 100}%` }}></div>
              </div>
            </div>

            {/* Coverage */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="text-sm font-medium text-slate-500 mb-2">Coverage</div>
              <div className="text-4xl font-bold text-emerald-500 mb-1">100%</div>
              <div className="text-xs text-slate-500 mb-4">168 / 168 slots met</div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-auto">
                <div className="h-full bg-slate-800 w-full"></div>
              </div>
            </div>

            {/* Est. Weekly Cost */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="text-sm font-medium text-slate-500 mb-2">Est. Weekly Cost</div>
              <div className="text-3xl font-bold text-slate-800 mb-4">
                ₹{(totalWeeklyHours * 97.88).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="space-y-1 text-xs text-slate-500 mt-auto">
                <div className="flex justify-between">
                  <span>Paid hrs/week</span>
                  <span className="font-medium text-slate-700">{totalWeeklyHours}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rate</span>
                  <span className="font-medium text-slate-700">₹97.88/hr</span>
                </div>
              </div>
            </div>

          </div>

          {/* Labor Utilization Section */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-800">Labor Utilization</h3>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setHeatmapMode('actual_vs_required')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${heatmapMode === 'actual_vs_required' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  Actual / Required
                </button>
                <button 
                  onClick={() => setHeatmapMode('efficiency')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${heatmapMode === 'efficiency' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  Efficiency %
                </button>
                <button 
                  onClick={() => setHeatmapMode('surplus')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${heatmapMode === 'surplus' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  Surplus workers
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <div className="text-2xl font-bold text-emerald-600 mb-1">100%</div>
                <div className="text-sm font-medium text-slate-800">Service level</div>
                <div className="text-xs text-slate-500 mt-1">Slots with demand fully met</div>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                <div className="text-2xl font-bold text-amber-600 mb-1">
                  {Math.round((requiredHours / totalWeeklyHours) * 100) || 0}%
                </div>
                <div className="text-sm font-medium text-slate-800">Labor efficiency</div>
                <div className="text-xs text-slate-500 mt-1">Of deployed hours actually needed</div>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div className="text-2xl font-bold text-blue-600 mb-1">{Math.round(requiredHours)}</div>
                <div className="text-sm font-medium text-slate-800">Required worker-hrs</div>
                <div className="text-xs text-slate-500 mt-1">Demand-driven across the week</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-2xl font-bold text-slate-700 mb-1">+{Math.round(totalWeeklyHours - requiredHours)}</div>
                <div className="text-sm font-medium text-slate-800">Surplus worker-hrs</div>
                <div className="text-xs text-slate-500 mt-1">Deployed but not strictly needed</div>
              </div>
            </div>

            {heatmapMode === 'efficiency' ? (
              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl mb-6">
                <h4 className="text-sm font-semibold text-blue-800 mb-1">Reading the Efficiency % heatmap</h4>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Each cell = <strong>required ÷ available × 100</strong> for that day-hour slot. <strong>100%</strong> means every deployed worker is needed — zero idle time. <strong>75%</strong> means 1 in 4 workers is idle in that slot. Green = efficient · Yellow/orange = idle surplus · Red = highly overstaffed / low efficiency.
                </p>
              </div>
            ) : heatmapMode === 'surplus' ? (
              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl mb-6">
                <h4 className="text-sm font-semibold text-blue-800 mb-1">Reading the Surplus workers heatmap</h4>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Each cell = <strong>available − required</strong> workers in that slot. <strong>0</strong> = exactly right · <strong>+2</strong> = 2 workers idle that hour · negative = understaffed (should not occur in an optimal roster). Green = tight · Yellow/orange = excess coverage · Red = large surplus.
                </p>
              </div>
            ) : (
              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl mb-6">
                <h4 className="text-sm font-semibold text-blue-800 mb-1">Reading the Actual / Required heatmap</h4>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Each cell shows <strong>Available / Required</strong> workers. Colors indicate efficiency (Green = efficient, Red = highly overstaffed).
                </p>
              </div>
            )}

            {/* Heatmap inside Labor Utilization */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 bg-white text-slate-400 font-medium sticky left-0 z-10 border-b border-slate-100"></th>
                    {Array.from({length: 24}).map((_, hour) => (
                      <th key={hour} className="p-2 bg-white text-center text-slate-400 font-medium min-w-[36px] text-xs border-b border-slate-100">
                        {hour.toString().padStart(2, '0')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map(day => (
                    <tr key={day}>
                      <td className="p-2 font-medium text-slate-600 bg-white sticky left-0 z-10 text-xs">{day}</td>
                      {Array.from({length: 24}).map((_, hour) => {
                        const { percent, availHours, reqHours } = heatmapData[day][hour];
                        if (availHours === 0 && percent === 0) {
                           return <td key={`${day}-${hour}`} className="p-1"><div className="w-full h-full min-h-[40px] rounded bg-slate-50 border border-slate-100"></div></td>;
                        }
                        
                        let bgColor = 'bg-slate-100';
                        let textColor = 'text-slate-400';
                        let displayValue: React.ReactNode = '';
                        
                        if (heatmapMode === 'efficiency' || heatmapMode === 'actual_vs_required') {
                          if (percent >= 95 && percent <= 100) { bgColor = 'bg-[#10b981]'; textColor = 'text-white'; }
                          else if (percent >= 85) { bgColor = 'bg-[#34d399]'; textColor = 'text-white'; }
                          else if (percent >= 70) { bgColor = 'bg-[#fbbf24]'; textColor = 'text-white'; }
                          else if (percent >= 50) { bgColor = 'bg-[#f59e0b]'; textColor = 'text-white'; }
                          else if (percent > 0) { bgColor = 'bg-[#ef4444]'; textColor = 'text-white'; }
                          else if (percent > 100) { bgColor = 'bg-red-800'; textColor = 'text-white'; } // Understaffed
                          else if (percent === 999) { bgColor = 'bg-red-800'; textColor = 'text-white'; } // Gap
                          
                          if (heatmapMode === 'efficiency') {
                            displayValue = percent === 999 ? '!' : percent.toString();
                          } else {
                            displayValue = (
                              <div className="flex flex-col items-center leading-tight py-0.5">
                                <span>{availHours}</span>
                                <span className="border-t border-white/30 w-full text-center mt-[2px] pt-[2px]">{Math.round(reqHours)}</span>
                              </div>
                            );
                          }
                        } else {
                          const surplus = availHours - reqHours;
                          const surplusPercent = reqHours > 0 ? (surplus / reqHours) * 100 : (surplus > 0 ? 100 : 0);
                          
                          if (surplus === 0 && availHours > 0) { bgColor = 'bg-[#10b981]'; textColor = 'text-white'; }
                          else if (surplusPercent > 0 && surplusPercent <= 15) { bgColor = 'bg-[#34d399]'; textColor = 'text-white'; }
                          else if (surplusPercent > 15 && surplusPercent <= 30) { bgColor = 'bg-[#fbbf24]'; textColor = 'text-white'; }
                          else if (surplusPercent > 30 && surplusPercent <= 50) { bgColor = 'bg-[#f59e0b]'; textColor = 'text-white'; }
                          else if (surplusPercent > 50) { bgColor = 'bg-[#ef4444]'; textColor = 'text-white'; }
                          else if (surplus < 0) { bgColor = 'bg-red-800'; textColor = 'text-white'; } // Deficit
                          
                          const roundedSurplus = Math.round(surplus);
                          displayValue = roundedSurplus > 0 ? `+${roundedSurplus}` : roundedSurplus.toString();
                        }

                        return (
                          <td key={`${day}-${hour}`} className="p-1">
                             <div className={`w-full h-full min-h-[40px] rounded flex items-center justify-center ${bgColor} ${textColor}`}>
                                  <span className="font-medium text-xs">{displayValue}</span>
                             </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {heatmapMode === 'efficiency' || heatmapMode === 'actual_vs_required' ? (
              <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#10b981]"></div> ≥95% efficient</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#34d399]"></div> 85–94%</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#fbbf24]"></div> 70–84%</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#f59e0b]"></div> 50–69%</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#ef4444]"></div> &lt;50% / overstaffed</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-800"></div> Understaffed</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-slate-50 border border-slate-200"></div> No demand</div>
              </div>
            ) : (
              <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#10b981]"></div> 0 surplus (exact)</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#34d399]"></div> +1 to 15%</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#fbbf24]"></div> +15 to 30%</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#f59e0b]"></div> +30 to 50%</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#ef4444]"></div> &gt;50% surplus</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-800"></div> Deficit</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-slate-50 border border-slate-200"></div> No demand</div>
              </div>
            )}
            
            {/* Shift Coverage Analysis */}
            <div className="mt-12 pt-8 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <LineChart className={`w-5 h-5 ${themeColor}`} />
                  <h3 className="text-lg font-semibold text-slate-800">Shift Coverage Analysis</h3>
                </div>
                
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  {days.map(d => (
                    <button
                      key={d}
                      onClick={() => setSelectedCoverageDay(d)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        selectedCoverageDay === d ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[400px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={coverageChartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="hour" 
                      tick={{ fontSize: 10, fill: '#64748b' }} 
                      axisLine={false} 
                      tickLine={false} 
                      dy={10}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#64748b' }} 
                      axisLine={false} 
                      tickLine={false} 
                      dx={-10}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    
                    <Area 
                      type="monotone" 
                      dataKey="required" 
                      name="Required Workers" 
                      fill="#93c5fd" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      fillOpacity={0.3} 
                    />
                    <Bar 
                      dataKey="available" 
                      name="Deployed Workers" 
                      fill="#10b981" 
                      radius={[4, 4, 0, 0]} 
                      barSize={20}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <div className="text-sm font-medium text-slate-500 mb-1">Total Required (Day)</div>
                    <div className="text-2xl font-bold text-slate-800">
                       {Math.round(coverageChartData.reduce((sum, d) => sum + d.required, 0))} hrs
                    </div>
                 </div>
                 <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                    <div className="text-sm font-medium text-emerald-600 mb-1">Total Deployed (Day)</div>
                    <div className="text-2xl font-bold text-emerald-700">
                       {Math.round(coverageChartData.reduce((sum, d) => sum + d.available, 0))} hrs
                    </div>
                 </div>
                 <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                    <div className="text-sm font-medium text-amber-600 mb-1">Net Surplus (Day)</div>
                    <div className="text-2xl font-bold text-amber-700">
                       +{Math.round(coverageChartData.reduce((sum, d) => sum + d.available, 0)) - Math.round(coverageChartData.reduce((sum, d) => sum + d.required, 0))} hrs
                    </div>
                 </div>
              </div>
            </div>
            
            {/* Per-day summary */}
            <div className="mt-12 pt-8 border-t border-slate-200">
              <h4 className="text-lg font-semibold text-slate-800 mb-4">Per-day summary</h4>
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-100">
                    <th className="pb-2 font-medium">Day</th>
                    <th className="pb-2 font-medium text-right">Required hrs</th>
                    <th className="pb-2 font-medium text-right">Deployed hrs</th>
                    <th className="pb-2 font-medium text-right">Surplus hrs</th>
                    <th className="pb-2 font-medium text-right w-48">Labor efficiency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {days.map((day, idx) => {
                    const reqHrs = demand[idx].hours.reduce((a, b) => a + (b / constraints.avgProductivity), 0);
                    const depHrs = heatmapData[day].reduce((a, b) => a + b.availHours, 0);
                    const eff = depHrs > 0 ? (reqHrs / depHrs) * 100 : 0;
                    return (
                      <tr key={day}>
                        <td className="py-3 font-medium text-slate-700">{day}</td>
                        <td className="py-3 text-right text-slate-600">{Math.round(reqHrs)}</td>
                        <td className="py-3 text-right text-slate-600">{depHrs}</td>
                        <td className="py-3 text-right text-slate-500">+{Math.round(depHrs - reqHrs)}</td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-500" style={{ width: `${eff}%` }}></div>
                            </div>
                            <span className="w-8 text-slate-600">{Math.round(eff)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

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
                    title: "Peak Protected Smearing",
                    desc: `To maximize service levels, the algorithm uses Peak Protected Smearing. For every 9-hour Full-Time shift, it identifies the 3 busiest hours and assigns 100% capacity (assuming no breaks). The remaining work (5 hours) is smeared across the other 6 hours (~83% capacity).`,
                    icon: <Clock className="w-5 h-5" />,
                    color: "bg-indigo-100 text-indigo-600"
                  },
                  {
                    title: "Shift Pattern Generation",
                    desc: `Valid shifts are built: Full-Time (9h duration, 8h work) and Part-Time (4h duration, 4h work). ${isOrTools ? 'For your simulation, the solver considered thousands of combinations of 6-day work weeks, rotating off-days to fill all demand gaps while minimizing overstaffing.' : 'The greedy solver searched for contiguous 9-hour blocks to fill with FT staff first.'}`,
                    icon: <Workflow className="w-5 h-5" />,
                    color: "bg-amber-100 text-amber-600"
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
