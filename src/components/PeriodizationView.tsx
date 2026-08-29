import React, { useState, useMemo } from 'react';
import type { WorkoutEntry } from '../types/workout';
import { getCategoryFromWorkout } from '../utils/workoutUtils';
import { Search, Calendar, Trophy, Edit3, ChevronRight, Layers, Utensils, AlertTriangle, Sparkles } from 'lucide-react';

interface PeriodizationViewProps {
  entries: WorkoutEntry[];
  filterCategory: string;
  onSelectEntry: (entry: WorkoutEntry) => void;
}

export const PeriodizationView: React.FC<PeriodizationViewProps> = ({
  entries,
  filterCategory,
  onSelectEntry,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMesocycle, setSelectedMesocycle] = useState<string>('ALL');
  const [selectedMicrocycle, setSelectedMicrocycle] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const uniqueMesocycles = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => {
      if (e.mesocycle) set.add(e.mesocycle);
    });
    return Array.from(set);
  }, [entries]);

  const uniqueMicrocycles = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => {
      if (e.microcycle) set.add(e.microcycle);
    });
    return Array.from(set);
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const query = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        entry.displayDate.toLowerCase().includes(query) ||
        entry.workout.toLowerCase().includes(query) ||
        entry.status.toLowerCase().includes(query) ||
        entry.pr.toLowerCase().includes(query) ||
        entry.diet.toLowerCase().includes(query) ||
        entry.microcycle.toLowerCase().includes(query);

      const matchesMeso = selectedMesocycle === 'ALL' || entry.mesocycle === selectedMesocycle;
      const matchesMicro = selectedMicrocycle === 'ALL' || entry.microcycle === selectedMicrocycle;

      let matchesCategory = true;
      if (filterCategory === 'PR') {
        matchesCategory = Boolean(entry.pr && (entry.pr.toLowerCase().includes('pr') || entry.pr.toLowerCase().includes('kg')));
      } else if (filterCategory !== 'all') {
        const catInfo = getCategoryFromWorkout(entry.workout, entry.status);
        matchesCategory = catInfo.label === filterCategory;
      }

      return matchesSearch && matchesMeso && matchesMicro && matchesCategory;
    });
  }, [entries, searchTerm, selectedMesocycle, selectedMicrocycle, filterCategory]);

  return (
    <div className="space-y-6">
      
      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search date, exercise, PR, diet..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-custom pl-10"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          
          {/* Mesocycle Select */}
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-rose-400" />
            <select
              value={selectedMesocycle}
              onChange={(e) => {
                setSelectedMesocycle(e.target.value);
                setSelectedMicrocycle('ALL');
              }}
              className="input-custom py-2 text-xs md:text-sm font-semibold max-w-[200px]"
            >
              <option value="ALL">All Mesocycles (1-12)</option>
              {uniqueMesocycles.map((meso, idx) => (
                <option key={idx} value={meso}>
                  {meso.length > 35 ? meso.substring(0, 35) + '...' : meso}
                </option>
              ))}
            </select>
          </div>

          {/* Microcycle Select */}
          <select
            value={selectedMicrocycle}
            onChange={(e) => setSelectedMicrocycle(e.target.value)}
            className="input-custom py-2 text-xs md:text-sm font-semibold max-w-[180px]"
          >
            <option value="ALL">All Microcycles</option>
            {uniqueMicrocycles.map((micro, idx) => (
              <option key={idx} value={micro}>
                {micro}
              </option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'grid' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
                <div className="bg-current rounded-[1px]"></div>
                <div className="bg-current rounded-[1px]"></div>
                <div className="bg-current rounded-[1px]"></div>
                <div className="bg-current rounded-[1px]"></div>
              </div>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'list' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="List View"
            >
              <div className="flex flex-col gap-1 w-4 h-4 justify-center">
                <div className="h-0.5 bg-current rounded-full w-full"></div>
                <div className="h-0.5 bg-current rounded-full w-full"></div>
                <div className="h-0.5 bg-current rounded-full w-full"></div>
              </div>
            </button>
          </div>

        </div>

      </div>

      {/* Mesocycle Header Notes */}
      {selectedMesocycle !== 'ALL' && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-white">{selectedMesocycle}</h4>
            {selectedMesocycle.includes('MESOCYCLE 3') && (
              <p className="text-xs text-rose-300 mt-1 font-semibold">
                🔥 Focus Directives: SLEEP PRIORITY (&lt; 1 am) | HIGH PROTEIN | NO PORN/MASTURBATION | LESS SOCIAL MEDIA | 5 DAILY PRAYERS | PUSH BEYOND LIMITS
              </p>
            )}
          </div>
        </div>
      )}

      {/* Count Indicator */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-1">
        <span>Showing <strong className="text-white">{filteredEntries.length}</strong> periodization logs</span>
        {searchTerm && <span>Search filter active</span>}
      </div>

      {/* Grid or List of Workout Entries */}
      {filteredEntries.length === 0 ? (
        <div className="glass-panel p-12 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Workout Logs Match Your Search</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try clearing your search keyword or switching your Mesocycle/Microcycle filter.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedMesocycle('ALL');
              setSelectedMicrocycle('ALL');
            }}
            className="btn-secondary text-xs"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntries.map((entry) => {
            const cat = getCategoryFromWorkout(entry.workout, entry.status);
            const isPR = Boolean(entry.pr && (entry.pr.toLowerCase().includes('pr') || entry.pr.toLowerCase().includes('kg')));
            const isRecovery = entry.workout.toLowerCase() === 'recovery' || entry.workout.toLowerCase() === 'sunday';

            return (
              <div
                key={entry.id}
                onClick={() => onSelectEntry(entry)}
                className={`glass-card p-5 relative flex flex-col justify-between cursor-pointer group ${
                  isPR ? 'border-amber-500/40 shadow-lg shadow-amber-500/10' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide truncate max-w-[200px]">
                    {entry.microcycle}
                  </span>
                  <div className="p-1.5 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity text-rose-400 hover:bg-rose-500/20">
                    <Edit3 className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-rose-400" />
                      {entry.displayDate}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="badge-tag"
                      style={{ backgroundColor: cat.badgeBg, color: cat.color }}
                    >
                      {cat.label}
                    </span>

                    {entry.status && (
                      <span className="badge-tag bg-slate-800 text-amber-300 border border-amber-500/20">
                        {entry.status}
                      </span>
                    )}
                  </div>
                </div>

                <div className="my-2 py-2 border-y border-[var(--border-color)]">
                  <p className={`text-sm font-semibold ${isRecovery ? 'text-slate-400 italic' : 'text-slate-100'}`}>
                    {entry.workout || 'No session details'}
                  </p>
                </div>

                <div className="mt-2 pt-1 space-y-1.5">
                  {entry.pr && (
                    <div className={`flex items-center gap-1.5 text-xs font-bold ${isPR ? 'text-amber-400' : 'text-cyan-400'}`}>
                      <Trophy className="w-3.5 h-3.5 shrink-0" />
                      <span>{entry.pr}</span>
                    </div>
                  )}

                  {entry.diet && (
                    <div className="flex items-start gap-1.5 text-xs text-emerald-400/90 font-medium">
                      <Utensils className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{entry.diet}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="divide-y divide-[var(--border-color)]">
            {filteredEntries.map((entry) => {
              const cat = getCategoryFromWorkout(entry.workout, entry.status);
              const isPR = Boolean(entry.pr && (entry.pr.toLowerCase().includes('pr') || entry.pr.toLowerCase().includes('kg')));

              return (
                <div
                  key={entry.id}
                  onClick={() => onSelectEntry(entry)}
                  className="p-4 hover:bg-slate-800/50 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start md:items-center gap-4 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 md:mt-0" style={{ backgroundColor: cat.color }}></div>
                    
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{entry.displayDate}</span>
                        <span className="text-xs text-slate-400">({entry.microcycle})</span>
                      </div>
                      <p className="text-sm text-slate-200 font-medium truncate">{entry.workout}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {entry.status && (
                      <span className="badge-tag bg-slate-800 text-amber-300 text-[10px]">
                        {entry.status}
                      </span>
                    )}

                    {entry.pr && (
                      <span className={`badge-tag ${isPR ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-cyan-300'}`}>
                        <Trophy className="w-3 h-3" />
                        {entry.pr}
                      </span>
                    )}

                    <button className="p-1.5 text-slate-400 hover:text-rose-400">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
