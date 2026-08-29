import React from 'react';
import { Dumbbell, Calendar, BarChart3, ShieldCheck, Download, PlusCircle, RefreshCw } from 'lucide-react';

interface NavbarProps {
  activeTab: 'timeline' | 'analytics' | 'discipline';
  setActiveTab: (tab: 'timeline' | 'analytics' | 'discipline') => void;
  onOpenLogModal: () => void;
  onOpenExportModal: () => void;
  onResetData: () => void;
  currentMicrocycle: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenLogModal,
  onOpenExportModal,
  onResetData,
  currentMicrocycle,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border-color)] bg-[#090d16]/90 backdrop-blur-md px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand Logo & Active Stage Badge */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-500 flex items-center justify-center shadow-lg shadow-rose-600/30">
              <Dumbbell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                IRON<span className="text-rose-500">PERIOD</span>
              </h1>
              <p className="text-xs text-[var(--text-muted)] font-medium">Powerlifting & Hypertrophy Periodization</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            <span>Active: {currentMicrocycle || 'Microcycle 37'}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-[#131a2a] p-1 rounded-xl border border-[var(--border-color)]">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'timeline'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Schedule & Logs
          </button>
          
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'analytics'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics & PRs
          </button>

          <button
            onClick={() => setActiveTab('discipline')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'discipline'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Jihad Ul Nafs Focus
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            onClick={onOpenLogModal}
            className="btn-primary"
            title="Log or edit today's workout"
          >
            <PlusCircle className="w-4 h-4" />
            Log Session
          </button>

          <button
            onClick={onOpenExportModal}
            className="btn-secondary"
            title="Export or Import dataset"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Data</span>
          </button>

          <button
            onClick={onResetData}
            className="p-2.5 rounded-lg bg-white/5 border border-[var(--border-color)] text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-all"
            title="Reset data to initial Excel default"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
