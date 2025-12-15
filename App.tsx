import React, { useState } from 'react';
import { INITIAL_CONSTRAINTS, INITIAL_DEMAND, Constraints, DemandData, StaffingSolution } from './types';
import DemandInput from './components/DemandInput';
import ConstraintsForm from './components/ConstraintsForm';
import SolutionDashboard from './components/SolutionDashboard';
import { generateAlgorithmicStaffingPlan } from './services/staffingAlgorithm';
import { generateStaffingPlan } from './services/geminiService'; // AI Service
import { Layers, Zap, Loader2, Calculator, Bot, BrainCircuit } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'input' | 'results'>('input');
  const [solverType, setSolverType] = useState<'algo' | 'ai'>('algo');
  const [demand, setDemand] = useState<DemandData[]>(INITIAL_DEMAND);
  const [constraints, setConstraints] = useState<Constraints>(INITIAL_CONSTRAINTS);
  const [isLoading, setIsLoading] = useState(false);
  const [solution, setSolution] = useState<StaffingSolution | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async () => {
    setIsLoading(true);
    setError(null);
    setSolution(null);
    
    try {
      if (solverType === 'algo') {
        // Local Algorithm with simulated delay
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
      } else {
        // AI Solver
        try {
          const result = await generateStaffingPlan(demand, constraints);
          setSolution(result);
          setActiveTab('results');
        } catch (err: any) {
             console.error(err);
             setError("AI Service Error: " + (err.message || "Failed to generate solution."));
        } finally {
             setIsLoading(false);
        }
      }
    } catch (err: any) {
      setError(err.message);
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
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                {error}
            </div>
        )}

        {activeTab === 'input' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Left Column: Inputs */}
            <div className="lg:col-span-2 space-y-6">
              <DemandInput 
                demand={demand} 
                onChange={setDemand} 
                weekendSpike={constraints.weekendSpike} 
              />
            </div>

            {/* Right Column: Constraints & Action */}
            <div className="space-y-6">
              <ConstraintsForm constraints={constraints} onChange={setConstraints} />
              
              {/* Solver Selection */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-indigo-500" />
                  Optimization Engine
                </h3>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                  <button
                    onClick={() => setSolverType('algo')}
                    className={`flex flex-col items-center justify-center py-3 px-2 rounded-md text-sm font-medium transition-all ${
                      solverType === 'algo'
                        ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                  >
                    <Calculator className="w-5 h-5 mb-1.5" />
                    <span>Algorithmic</span>
                  </button>
                  <button
                    onClick={() => setSolverType('ai')}
                    className={`flex flex-col items-center justify-center py-3 px-2 rounded-md text-sm font-medium transition-all ${
                      solverType === 'ai'
                        ? 'bg-white text-violet-700 shadow-sm ring-1 ring-black/5'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                  >
                    <Bot className="w-5 h-5 mb-1.5" />
                    <span>Gemini AI</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-3 px-1">
                  {solverType === 'algo' 
                    ? "Uses a deterministic 'Bucket-Fill' algorithm. Fast, strict rule adherence, best for standard patterns."
                    : "Uses Google Gemini 2.5 Flash. Creative, flexible, finds novel patterns but may take longer."
                  }
                </p>
              </div>

              {/* Action Box */}
              <div className={`p-6 rounded-xl shadow-lg transition-colors ${
                solverType === 'algo' ? 'bg-slate-800 text-white' : 'bg-gradient-to-br from-violet-600 to-indigo-700 text-white'
              }`}>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  {solverType === 'algo' ? <Zap className="w-5 h-5 text-yellow-400" /> : <Bot className="w-5 h-5 text-violet-200" />}
                  {solverType === 'algo' ? 'Generate Standard Roster' : 'Ask AI to Solve'}
                </h3>
                <p className="text-white/80 text-sm mb-6">
                  {solverType === 'algo' 
                    ? "Instantly solve for 24/7 coverage with strict 48h/24h contract rules."
                    : "Send your demand curve to Gemini to find an optimal solution."
                  }
                </p>
                <button
                  onClick={handleOptimize}
                  disabled={isLoading}
                  className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed backdrop-blur-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {solverType === 'algo' ? 'Calculating...' : 'Thinking...'}
                    </>
                  ) : (
                    <>
                      {solverType === 'algo' ? <Calculator className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                      {solverType === 'algo' ? 'Run Algorithm' : 'Generate with AI'}
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'results' && solution && (
          <SolutionDashboard solution={solution} />
        )}
      </main>
    </div>
  );
}