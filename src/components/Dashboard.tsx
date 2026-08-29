import React from 'react';
import type { WorkoutEntry } from '../types/workout';
import { Trophy, Dumbbell, Flame, HeartPulse, Sparkles } from 'lucide-react';

interface DashboardProps {
  entries: WorkoutEntry[];
  onOpenLogModal: (entry?: WorkoutEntry) => void;
  onFilterCategory: (cat: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ entries, onOpenLogModal, onFilterCategory }) => {
  const totalDays = entries.length;
  const completedWorkouts = entries.filter(e => e.workout && e.workout.toLowerCase() !== 'recovery' && e.workout.toLowerCase() !== 'sunday').length;
  const recoveryDays = entries.filter(e => e.workout.toLowerCase() === 'recovery' || e.workout.toLowerCase() === 'sunday').length;
  const prEntries = entries.filter(e => e.pr && (e.pr.toLowerCase().includes('pr') || e.pr.toLowerCase().includes('kg')));

  const todayIso = new Date().toISOString().split('T')[0];
  const todayEntry = entries.find(e => e.date === todayIso) || entries.find(e => e.date === '2026-08-27') || entries[0];

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Active Mesocycle & Quick Log Prompt */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-rose-500/30 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold uppercase tracking-wider border border-rose-500/30">
              <Sparkles className="w-3.5 h-3.5" /> Macrocycle Target 2025-2026
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              MESOCYCLE 12 <span className="text-rose-400">(Microcycle 37-40)</span>
            </h2>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Peaking Phase: Tapering load towards peak single maximums for Bench Press, Squat, and Deadlift.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => onOpenLogModal(todayEntry)}
              className="btn-primary py-3 px-6 text-base font-bold shadow-lg shadow-rose-600/40"
            >
              <Dumbbell className="w-5 h-5" />
              Log Today's Session
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Key Performance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Sessions Card */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Macrocycle Days</span>
            <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-400">
              <Dumbbell className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{totalDays}</span>
            <span className="text-xs text-slate-400">({completedWorkouts} workouts)</span>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, (completedWorkouts/totalDays)*100)}%` }}></div>
          </div>
        </div>

        {/* Max Bench PR Card */}
        <div className="glass-panel p-5 relative overflow-hidden border-rose-500/30 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Bench Press PR</span>
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 pr-badge-animated">
              <Trophy className="w-5 h-5 text-amber-300" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white text-gradient-gold">130 kg</span>
            <span className="text-xs text-amber-400 font-semibold">1RM PR</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Progressed from 110kg $\rightarrow$ 120kg $\rightarrow$ 125kg $\rightarrow$ 130kg (plus 130kgx2 wraps)
          </p>
        </div>

        {/* Squat & DB Press PR Card */}
        <div className="glass-panel p-5 relative overflow-hidden border-amber-500/30 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Squat & DB PRs</span>
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-black text-white">140 kg</div>
              <div className="text-[11px] text-slate-400 font-medium">Squat 1RM PR</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-white">60 kg</div>
              <div className="text-[11px] text-slate-400 font-medium">DB Bench each</div>
            </div>
          </div>
        </div>

        {/* Recovery & Deload Ratio Card */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Recovery & Deloads</span>
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400">
              <HeartPulse className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{recoveryDays}</span>
            <span className="text-xs text-slate-400">Recovery Days</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {prEntries.length} Recorded PR / Volume milestones
          </p>
        </div>

      </div>

      {/* Quick Filter Shortcuts */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] whitespace-nowrap">Quick Filter:</span>
        <button onClick={() => onFilterCategory('all')} className="btn-secondary py-1.5 px-3 text-xs">All Logs</button>
        <button onClick={() => onFilterCategory('Bench / Chest')} className="btn-secondary py-1.5 px-3 text-xs border-rose-500/30 text-rose-300">Bench & Chest</button>
        <button onClick={() => onFilterCategory('Squats / Legs')} className="btn-secondary py-1.5 px-3 text-xs border-amber-500/30 text-amber-300">Squats & Legs</button>
        <button onClick={() => onFilterCategory('Deadlift / Back')} className="btn-secondary py-1.5 px-3 text-xs border-emerald-500/30 text-emerald-300">Deadlift & Back</button>
        <button onClick={() => onFilterCategory('Shoulder / OHP')} className="btn-secondary py-1.5 px-3 text-xs border-purple-500/30 text-purple-300">Shoulders & OHP</button>
        <button onClick={() => onFilterCategory('Recovery')} className="btn-secondary py-1.5 px-3 text-xs">Recovery</button>
        <button onClick={() => onFilterCategory('PR')} className="btn-secondary py-1.5 px-3 text-xs bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold">✨ PRs Only</button>
      </div>

    </div>
  );
};
