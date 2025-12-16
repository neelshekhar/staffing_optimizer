
import React from 'react';
import { DemandData, TIME_BLOCKS, DayOfWeek, TimeBlock } from '../types';
import { BarChart3, Copy } from 'lucide-react';

interface DemandInputProps {
  demand: DemandData[];
  onChange: (d: DemandData[]) => void;
  weekendSpike: number;
}

const DemandInput: React.FC<DemandInputProps> = ({ demand, onChange, weekendSpike }) => {
  const handleCellChange = (dayIndex: number, block: TimeBlock, value: string) => {
    const numValue = parseInt(value) || 0;
    const newDemand = [...demand];
    newDemand[dayIndex] = {
      ...newDemand[dayIndex],
      blocks: {
        ...newDemand[dayIndex].blocks,
        [block]: numValue
      }
    };
    onChange(newDemand);
  };

  const copyMondayToAll = () => {
    const mondayData = demand[0].blocks;
    const newDemand = demand.map((d, i) => {
      if (i === 0) return d; // Skip monday
      
      let newBlocks = { ...mondayData };
      
      // Apply weekend spike if Saturday or Sunday
      if (d.day === 'Sat' || d.day === 'Sun') {
        const multiplier = 1 + (weekendSpike / 100);
        const spikedBlocks: any = {};
        for (const [key, val] of Object.entries(mondayData)) {
            spikedBlocks[key] = Math.round((val as number) * multiplier);
        }
        newBlocks = spikedBlocks;
      }

      return {
        ...d,
        blocks: newBlocks
      };
    });
    onChange(newDemand);
  };

  const calculateDailyTotal = (d: DemandData) => {
    return Object.values(d.blocks).reduce((sum, val) => sum + val, 0);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-800">24/7 Demand Input (4hr Blocks)</h2>
        </div>
        <button 
          onClick={copyMondayToAll}
          title={`Copies Monday's data to all days, applying a ${weekendSpike}% increase to Sat/Sun.`}
          className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-md transition-colors font-medium border border-yellow-200"
        >
          <Copy className="w-3 h-3" />
          Copy Mon to All (+{weekendSpike}% on Wknd)
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
            <tr>
              <th className="px-3 py-3 w-20 sticky left-0 bg-slate-50 z-10">Day</th>
              {TIME_BLOCKS.map(block => (
                <th key={block} className="px-2 py-3 text-center whitespace-nowrap min-w-[80px]">
                  {block}
                </th>
              ))}
              <th className="px-3 py-3 text-right sticky right-0 bg-slate-50 z-10">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {demand.map((dayData, index) => (
              <tr key={dayData.day} className="hover:bg-slate-50 transition-colors group">
                <td className="px-3 py-2 font-medium text-slate-700 sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                  {dayData.day}
                </td>
                {TIME_BLOCKS.map(block => (
                  <td key={block} className="px-2 py-2">
                    <input
                      type="number"
                      className="w-full px-2 py-1.5 text-center border border-slate-200 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-600"
                      value={dayData.blocks[block] || ''}
                      placeholder="0"
                      onChange={(e) => handleCellChange(index, block, e.target.value)}
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-semibold text-indigo-600 sticky right-0 bg-white group-hover:bg-slate-50 z-10">
                  {calculateDailyTotal(dayData).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-xs text-slate-400 italic flex justify-between">
        <span>* Inputs are in Volume Units (e.g., Orders) for each 4-hour window.</span>
        <span>Starts at 6:00 AM daily.</span>
      </div>
    </div>
  );
};

export default DemandInput;