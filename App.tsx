
import React, { useState } from 'react';
import { INITIAL_CONSTRAINTS, INITIAL_DEMAND, Constraints, DemandData, StaffingSolution } from './types';
import DemandInput from './components/DemandInput';
import ConstraintsForm from './components/ConstraintsForm';
import SolutionDashboard from './components/SolutionDashboard';
import { generateORToolsStaffingPlan } from './services/orToolsSolver';
import { Layers, Zap, Loader2, BrainCircuit, Shuffle } from 'lucide-react';

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
    
    // Yield to event loop so UI updates
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const result = await generateORToolsStaffingPlan(demand, constraints);
      setSolution(result);
      setActiveTab('results');
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during optimization.");
    } finally {
      setIsLoading(false);
    }
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
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                {error}
            </div>
        )}

        {activeTab === 'input' && (
          <div className="flex flex-col gap-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Top Row: Constraints & Info */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-3">
                <ConstraintsForm constraints={constraints} onChange={setConstraints} />
              </div>
              
              {/* Algorithm Info */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
                <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <BrainCircuit className="w-3.5 h-3.5 text-indigo-500" />
                  Methodology
                </h3>
                <div className="flex items-start gap-2">
                  <Shuffle className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-slate-900">
                      Highs WASM MILP
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      Mathematically optimal shift coverage.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Row: Demand Input (Full Width) */}
            <div className="w-full">
              <DemandInput 
                demand={demand} 
                onChange={setDemand} 
              />
            </div>

            {/* Action Box - Full Width */}
            <div className="lg:col-span-3 p-6 rounded-xl shadow-lg transition-colors bg-slate-800 text-white flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  Generate Optimized Roster
                </h3>
                <p className="text-slate-400 text-xs mt-2 italic">
                   Powered by WASM and MILP.
                   <br />
                   This solver uses a Mixed-Integer Linear Programming model executed in the browser via WebAssembly to guarantee mathematically optimal shift coverage.
                </p>
              </div>

              <button
                onClick={handleOptimize}
                disabled={isLoading}
                className={`shrink-0 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-md min-w-[200px] bg-purple-600 hover:bg-purple-700`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Computing...
                  </>
                ) : (
                  <>
                    <BrainCircuit className="w-5 h-5" />
                    Run Highs Solver
                  </>
                )}
              </button>
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

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-4 sm:px-6 lg:px-8 mt-auto shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-[10px] font-bold tracking-[0.2em] uppercase">staffing optimizer v2.5</span>
            <span className="hidden sm:inline w-px h-3 bg-slate-300"></span>
            <span className="text-slate-500 text-xs font-medium">with neelshekhar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-200"></div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div>
            <div className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-200"></div>
          </div>
        </div>
      </footer>
    </div>
  );
}
