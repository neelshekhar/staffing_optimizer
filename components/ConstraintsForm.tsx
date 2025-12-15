import React from 'react';
import { Constraints } from '../types';
import { Settings, Activity, Percent, TrendingUp } from 'lucide-react';

interface ConstraintsFormProps {
  constraints: Constraints;
  onChange: (c: Constraints) => void;
}

const ConstraintsForm: React.FC<ConstraintsFormProps> = ({ constraints, onChange }) => {
  const handleChange = (field: keyof Constraints, value: string) => {
    onChange({
      ...constraints,
      [field]: parseFloat(value) || 0,
    });
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-semibold text-slate-800">Operational Constraints</h2>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
            <Activity className="w-4 h-4" />
            Avg Productivity (Units/Hr)
          </label>
          <input
            type="number"
            value={constraints.avgProductivity}
            onChange={(e) => handleChange('avgProductivity', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
          <p className="text-xs text-slate-400 mt-1">Expected throughput per associate</p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
            <Percent className="w-4 h-4" />
            Target Utilization (%)
          </label>
          <input
            type="number"
            value={constraints.targetUtilization}
            onChange={(e) => handleChange('targetUtilization', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
          <p className="text-xs text-slate-400 mt-1">Buffer for breaks/indirects</p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
            <TrendingUp className="w-4 h-4" />
            Weekend Demand Uplift (%)
          </label>
          <input
            type="number"
            value={constraints.weekendSpike}
            onChange={(e) => handleChange('weekendSpike', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
          <p className="text-xs text-slate-400 mt-1">Percentage increase applied to Sat/Sun when copying Monday</p>
        </div>
      </div>
    </div>
  );
};

export default ConstraintsForm;