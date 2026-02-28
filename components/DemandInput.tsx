
import React, { useRef } from 'react';
import { DemandData, DayOfWeek } from '../types';
import { BarChart3, Copy, Upload, FileText, Download } from 'lucide-react';

interface DemandInputProps {
  demand: DemandData[];
  onChange: (d: DemandData[]) => void;
}

const DemandInput: React.FC<DemandInputProps> = ({ demand, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCellChange = (dayIndex: number, hourIndex: number, value: string) => {
    const numValue = parseInt(value) || 0;
    const newDemand = [...demand];
    const newHours = [...newDemand[dayIndex].hours];
    newHours[hourIndex] = numValue;
    newDemand[dayIndex] = {
      ...newDemand[dayIndex],
      hours: newHours
    };
    onChange(newDemand);
  };

  const copyMondayToAll = () => {
    const mondayData = demand[0].hours;
    const newDemand = demand.map((d, i) => {
      if (i === 0) return d; // Skip monday
      
      return {
        ...d,
        hours: [...mondayData]
      };
    });
    onChange(newDemand);
  };

  const getSampleData = () => {
    const WEEKDAY_HOURS = [
      5, 5, 5, 5, 5, 5, // 0-5
      20, 20, 50, 50, 50, 20, // 6-11
      20, 20, 20, 20, 30, 40, // 12-17
      50, 50, 80, 80, 30, 10 // 18-23
    ];
    
    const SAT_HOURS = [
      6, 6, 6, 6, 6, 6, // 0-5
      24, 24, 60, 60, 60, 24, // 6-11
      24, 24, 24, 24, 36, 48, // 12-17
      60, 60, 96, 96, 36, 12 // 18-23
    ];

    const SUN_HOURS = [
      7, 7, 7, 7, 7, 7, // 0-5
      29, 29, 72, 72, 72, 29, // 6-11
      29, 29, 29, 29, 43, 58, // 12-17
      72, 72, 115, 115, 43, 14 // 18-23
    ];

    const createDay = (day: DayOfWeek, hours: number[]): DemandData => ({
      day,
      hours: [...hours]
    });

    return [
      createDay('Mon', WEEKDAY_HOURS),
      createDay('Tue', WEEKDAY_HOURS),
      createDay('Wed', WEEKDAY_HOURS),
      createDay('Thu', WEEKDAY_HOURS),
      createDay('Fri', WEEKDAY_HOURS),
      createDay('Sat', SAT_HOURS),
      createDay('Sun', SUN_HOURS),
    ];
  };

  const loadSampleTemplate = () => {
    onChange(getSampleData());
  };

  const downloadCsvTemplate = () => {
    const sampleData = getSampleData();
    const headers = ['Day', ...Array.from({ length: 24 }, (_, i) => `${i}:00`)].join(',');
    const rows = sampleData.map(d => [d.day, ...d.hours].join(','));
    const csvContent = [headers, ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'demand_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const calculateDailyTotal = (d: DemandData) => {
    return d.hours.reduce((sum, val) => sum + val, 0);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').map(line => line.trim()).filter(line => line);
      
      if (lines.length < 2) return;

      const newDemand: DemandData[] = [];
      const daysMap: Record<string, DayOfWeek> = {
        'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu', 'fri': 'Fri', 'sat': 'Sat', 'sun': 'Sun'
      };

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length < 25) continue;

        const dayStr = parts[0].toLowerCase().substring(0, 3);
        const day = daysMap[dayStr];
        if (!day) continue;

        const hours = parts.slice(1, 25).map(val => parseInt(val) || 0);
        newDemand.push({ day, hours });
      }

      // Ensure all 7 days are present in order
      const orderedDays: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const finalDemand = orderedDays.map(d => {
        const existing = newDemand.find(nd => nd.day === d);
        return existing || { day: d, hours: new Array(24).fill(0) };
      });

      onChange(finalDemand);
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Calculate max value for heatmap coloring
  const maxDemand = Math.max(...demand.flatMap(d => d.hours));

  const getHeatmapColor = (value: number) => {
    if (value === 0) return 'bg-slate-50';
    const intensity = Math.max(0.1, value / (maxDemand || 1));
    // Use indigo color scale
    return `rgba(79, 70, 229, ${intensity * 0.8})`;
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-800">24-Hour Demand Heatmap</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button 
            onClick={loadSampleTemplate}
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md transition-colors font-medium border border-emerald-200"
          >
            <FileText className="w-3 h-3" />
            Sample Template
          </button>
          <button 
            onClick={copyMondayToAll}
            title="Copies Monday's data to all days."
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-md transition-colors font-medium border border-yellow-200"
          >
            <Copy className="w-3 h-3" />
            Copy Mon to All
          </button>
          <button 
            onClick={downloadCsvTemplate}
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors font-medium border border-slate-300"
          >
            <Download className="w-3 h-3" />
            CSV Template Format
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-colors font-medium border border-indigo-200"
          >
            <Upload className="w-3 h-3" />
            Upload CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
            <tr>
              <th className="px-3 py-3 w-16 sticky left-0 bg-slate-50 z-20 border-r border-slate-200">Day</th>
              {Array.from({ length: 24 }).map((_, i) => (
                <th key={i} className="px-1 py-3 text-center min-w-[36px]">
                  {i}
                </th>
              ))}
              <th className="px-3 py-3 text-right sticky right-0 bg-slate-50 z-20 border-l border-slate-200">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {demand.map((dayData, index) => (
              <tr key={dayData.day} className="group">
                <td className="px-3 py-2 font-medium text-slate-700 sticky left-0 bg-white z-10 border-r border-slate-200">
                  {dayData.day}
                </td>
                {dayData.hours.map((val, hourIndex) => (
                  <td key={hourIndex} className="p-0.5">
                    <input
                      type="number"
                      className="w-full h-8 text-center text-[10px] rounded outline-none transition-all focus:ring-2 focus:ring-indigo-500 focus:z-10 relative"
                      style={{ 
                        backgroundColor: val > 0 ? getHeatmapColor(val) : undefined,
                        color: val > (maxDemand * 0.5) ? 'white' : 'inherit'
                      }}
                      value={val || ''}
                      placeholder="0"
                      onChange={(e) => handleCellChange(index, hourIndex, e.target.value)}
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-semibold text-indigo-600 sticky right-0 bg-white z-10 border-l border-slate-200">
                  {calculateDailyTotal(dayData).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-xs text-slate-400 italic flex justify-between">
        <span>* Inputs are in Volume Units (e.g., Orders) for each hour.</span>
        <span>Upload CSV format: Day,0:00,1:00...23:00</span>
      </div>
    </div>
  );
};

export default DemandInput;