import React from 'react';
import { Constraints } from '../types';
import { Settings, Activity, Users, CalendarDays } from 'lucide-react';

interface ConstraintsFormProps {
  constraints: Constraints;
  onChange: (c: Constraints) => void;
}

const ConstraintsForm: React.FC<ConstraintsFormProps> = ({ constraints, onChange }) => {
  const handleChange = (field: keyof Constraints, value: string | boolean) => {
    onChange({
      ...constraints,
      [field]: typeof value === 'boolean' ? value : parseFloat(value) || 0,
    });
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-semibold text-slate-800">Operational Constraints</h2>
        </div>
        <div className="text-[10px] text-slate-500 flex gap-3 items-center">
          <span>• No shift starts after Midnight</span>
          <span>• No shift ends before 5:00 AM</span>
          <label className="flex items-center gap-1.5 cursor-pointer ml-2">
            <input 
              type="checkbox" 
              checked={constraints.allowWeekendOffs}
              onChange={(e) => handleChange('allowWeekendOffs', e.target.checked)}
              className="w-3 h-3 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <span className="font-medium text-slate-700">Allow FT/PT Weekends Off</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
            <Activity className="w-3.5 h-3.5" />
            Avg Productivity (Orders/Hr)
          </label>
          <input
            type="number"
            value={constraints.avgProductivity}
            onChange={(e) => handleChange('avgProductivity', e.target.value)}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-sm"
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
            <Users className="w-3.5 h-3.5" />
            PT Cap (% of total staff)
          </label>
          <div className="relative">
            <input
              type="number"
              value={constraints.partTimeCap}
              onChange={(e) => handleChange('partTimeCap', e.target.value)}
              className="w-full pl-2.5 pr-7 py-1.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-sm"
            />
            <span className="absolute right-2.5 top-1.5 text-slate-400 text-xs">%</span>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            Wknd Cap (% of total staff)
          </label>
          <div className="relative">
            <input
              type="number"
              value={constraints.weekendCap}
              onChange={(e) => handleChange('weekendCap', e.target.value)}
              className="w-full pl-2.5 pr-7 py-1.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-sm"
            />
            <span className="absolute right-2.5 top-1.5 text-slate-400 text-xs">%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConstraintsForm;