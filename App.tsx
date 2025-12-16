import React, { useState } from 'react';
import { INITIAL_CONSTRAINTS, INITIAL_DEMAND, Constraints, DemandData, StaffingSolution } from './types';
import DemandInput from './components/DemandInput';
import ConstraintsForm from './components/ConstraintsForm';
import SolutionDashboard from './components/SolutionDashboard';
import { generateAlgorithmicStaffingPlan } from './services/staffingAlgorithm';
import { Layers, Zap, Loader2, Calculator, BrainCircuit } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'input' | 'results'>('input');
  const [demand, setDemand] = useState<DemandData[]>(INITIAL_DEMAND);
  const [constraints, setConstraints] = useState<Constraints>(INITIAL_CONSTRAINTS);
  const [isLoading, setIsLoading] = useState(false);
  const [solution, setSolution] = useState<StaffingSolution | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async () => {
    setIsLoading(true);
    setError(null);
    setSolution(null);
    
    // Simulate processing delay for better UX
    setTimeout(() => {
      try {
        const result = generateAlgorithmicStaffingPlan(demand, constraints);
        setSolution(result);
        setActiveTab('results');
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred during optimization.");
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">StaffOptima</h1>
          </div>
          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('input')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === 'input' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Model Inputs
            </button>
            <button
              onClick={() => solution && setActiveTab('results')}
              disabled={!solution}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === 'results' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 disabled:opacity-50'
              }`}
            >
              Results
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                {error}
            </div>
        )}

        {activeTab === 'input' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Left Column: Inputs & Generator Action */}
            <div className="lg:col-span-2 space-y-6">
              <DemandInput 
                demand={demand} 
                onChange={setDemand} 
                weekendSpike={constraints.weekendSpike} 
              />

              {/* Action Box - Moved Here */}
              <div className="p-6 rounded-xl shadow-lg transition-colors bg-slate-800 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    Generate Optimized Roster
                  </h3>
                  <p className="text-white/80 text-sm">
                    Instantly solve for 24/7 coverage with strict 48h/24h contract rules.
                  </p>
                </div>
                <button
                  onClick={handleOptimize}
                  disabled={isLoading}
                  className="shrink-0 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-md"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Computing...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-5 h-5" />
                      Run Optimization
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column: Constraints & Info */}
            <div className="space-y-6">
              <ConstraintsForm constraints={constraints} onChange={setConstraints} />
              
              {/* Algorithm Info */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-indigo-500" />
                  Optimization Engine
                </h3>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-start gap-3">
                    <Calculator className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Deterministic Solver</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Uses a strict constraint-satisfaction algorithm to ensure 100% adherence to labor laws (48h/24h contracts) and Sunday coverage rotations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'results' && solution && (
          <SolutionDashboard 
            solution={solution} 
            demand={demand}
            constraints={constraints}
          />
        )}
      </main>
    </div>
  );
}