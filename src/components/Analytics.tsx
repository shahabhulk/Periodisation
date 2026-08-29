import React, { useMemo } from 'react';
import type { WorkoutEntry } from '../types/workout';
import { extractPRs } from '../utils/workoutUtils';
import { Trophy, TrendingUp, Award, Zap } from 'lucide-react';

interface AnalyticsProps {
  entries: WorkoutEntry[];
}

export const Analytics: React.FC<AnalyticsProps> = ({ entries }) => {
  const prRecords = useMemo(() => extractPRs(entries), [entries]);

  const benchTrajectory = useMemo(() => {
    return [
      { date: 'Sep 15, 2025', weight: 110, note: 'Bench 110x3' },
      { date: 'Oct 10, 2025', weight: 120, note: '120kgx1 PR' },
      { date: 'Jan 31, 2026', weight: 120, note: '120kgx2' },
      { date: 'Feb 19, 2026', weight: 120, note: '120kgx2' },
      { date: 'Feb 27, 2026', weight: 120, note: '120kgx3' },
      { date: 'Mar 03, 2026', weight: 125, note: '125kg x1 PR' },
      { date: 'Mar 16, 2026', weight: 130, note: '130kgx1 PR' },
      { date: 'Aug 02, 2026', weight: 120, note: '120kgx4 (wraps)' },
      { date: 'Aug 10, 2026', weight: 130, note: '130kgx2 (wraps)' },
    ];
  }, []);

  const squatTrajectory = useMemo(() => {
    return [
      { date: 'Nov 02, 2025', weight: 130, note: 'pr 130kg' },
      { date: 'May 21, 2026', weight: 130, note: '130kgx2' },
      { date: 'May 28, 2026', weight: 130, note: '130kgx3' },
      { date: 'Jun 03, 2026', weight: 140, note: '140kgx1 PR' },
    ];
  }, []);

  const dbBenchTrajectory = useMemo(() => {
    return [
      { date: 'Sep 28, 2025', weight: 55, note: '55kg each' },
      { date: 'Dec 21, 2025', weight: 50, note: '50kg each' },
      { date: 'Jan 11, 2026', weight: 55, note: '55kg each' },
      { date: 'Jun 07, 2026', weight: 55, note: '55kg each' },
      { date: 'Aug 23, 2026', weight: 60, note: '60kg each PR' },
    ];
  }, []);

  return (
    <div className="space-y-8">
      
      {/* Top Banner */}
      <div className="glass-panel p-6 border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-slate-900 to-rose-950/20">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Strength & Personal Record Trajectory</h2>
            <p className="text-xs text-slate-300">Empirical progress tracking across your periodization macrocycle.</p>
          </div>
        </div>
      </div>

      {/* Bench Press Progression Trajectory Card */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-rose-400" />
            <h3 className="text-lg font-bold text-white">Bench Press Progression Timeline</h3>
          </div>
          <span className="badge-tag bg-rose-500/20 text-rose-300 border border-rose-500/30">
            Peak 130 kg (Raw & Wraps)
          </span>
        </div>

        {/* Custom SVG Line Chart */}
        <div className="h-64 w-full pt-4 pb-2 relative">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 800 200">
            <line x1="50" y1="20" x2="780" y2="20" stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />
            <line x1="50" y1="70" x2="780" y2="70" stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />
            <line x1="50" y1="120" x2="780" y2="120" stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />
            <line x1="50" y1="170" x2="780" y2="170" stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />

            <text x="15" y="25" fill="#94a3b8" fontSize="11" fontWeight="bold">135kg</text>
            <text x="15" y="75" fill="#94a3b8" fontSize="11" fontWeight="bold">125kg</text>
            <text x="15" y="125" fill="#94a3b8" fontSize="11" fontWeight="bold">115kg</text>
            <text x="15" y="175" fill="#94a3b8" fontSize="11" fontWeight="bold">105kg</text>

            <path
              d="M 60,150 L 150,95 L 240,95 L 330,95 L 420,95 L 510,70 L 600,45 L 690,95 L 770,45"
              fill="none"
              stroke="#f43f5e"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {benchTrajectory.map((pt, i) => {
              const xCoords = [60, 150, 240, 330, 420, 510, 600, 690, 770];
              const yCoords = [150, 95, 95, 95, 95, 70, 45, 95, 45];
              const x = xCoords[i];
              const y = yCoords[i];

              return (
                <g key={i} className="group cursor-pointer">
                  <circle cx={x} cy={y} r="6" fill="#f43f5e" stroke="#ffffff" strokeWidth="2" />
                  <text x={x} y={y - 12} fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">
                    {pt.weight}kg
                  </text>
                  <text x={x} y={192} fill="#64748b" fontSize="9" textAnchor="middle">
                    {pt.date.split(',')[0]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Grid of Squat & Dumbbell Press Trajectories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="glass-panel p-6 space-y-4 border-amber-500/30">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Squat Peak 1RM Trajectory
            </h3>
            <span className="text-xs font-bold text-amber-400">Max 140kg PR</span>
          </div>

          <div className="space-y-3">
            {squatTrajectory.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div>
                  <div className="text-xs font-bold text-white">{s.note}</div>
                  <div className="text-[11px] text-slate-400">{s.date}</div>
                </div>
                <div className="text-lg font-black text-amber-400">{s.weight} kg</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-6 space-y-4 border-cyan-500/30">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-cyan-400" /> Dumbbell Bench Press PRs
            </h3>
            <span className="text-xs font-bold text-cyan-400">Max 60kg each</span>
          </div>

          <div className="space-y-3">
            {dbBenchTrajectory.map((d, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div>
                  <div className="text-xs font-bold text-white">{d.note}</div>
                  <div className="text-[11px] text-slate-400">{d.date}</div>
                </div>
                <div className="text-lg font-black text-cyan-400">{d.weight} kg each</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Complete Logged PR Records Table */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" /> All Recorded PR & Load Milestones ({prRecords.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Exercise Lift</th>
                <th className="py-3 px-4">Raw Metric / Note</th>
                <th className="py-3 px-4">Session Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {prRecords.map((rec, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-bold text-white">{rec.date}</td>
                  <td className="py-3 px-4">
                    <span className="badge-tag bg-amber-500/15 text-amber-300">
                      {rec.exercise}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-amber-400">{rec.rawText}</td>
                  <td className="py-3 px-4 text-slate-300 truncate max-w-xs">{rec.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
