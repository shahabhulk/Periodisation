import React, { useState, useEffect } from 'react';
import type { WorkoutEntry } from '../types/workout';
import { X, Save, Trophy, Utensils, Dumbbell } from 'lucide-react';
import confetti from 'canvas-confetti';

interface WorkoutModalProps {
  isOpen: boolean;
  entry: WorkoutEntry | null;
  onClose: () => void;
  onSave: (updatedEntry: WorkoutEntry) => void;
}

export const WorkoutModal: React.FC<WorkoutModalProps> = ({
  isOpen,
  entry,
  onClose,
  onSave,
}) => {
  const [workout, setWorkout] = useState('');
  const [status, setStatus] = useState('');
  const [pr, setPr] = useState('');
  const [diet, setDiet] = useState('');
  const [mesocycle, setMesocycle] = useState('');
  const [microcycle, setMicrocycle] = useState('');

  useEffect(() => {
    if (entry) {
      setWorkout(entry.workout || '');
      setStatus(entry.status || '');
      setPr(entry.pr || '');
      setDiet(entry.diet || '');
      setMesocycle(entry.mesocycle || '');
      setMicrocycle(entry.microcycle || '');
    }
  }, [entry]);

  if (!isOpen || !entry) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (pr.toLowerCase().includes('pr') && (!entry.pr || !entry.pr.toLowerCase().includes('pr'))) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    const updated: WorkoutEntry = {
      ...entry,
      workout,
      status,
      pr,
      diet,
      mesocycle,
      microcycle,
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl glass-panel p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto border-rose-500/40">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">{entry.displayDate}</h3>
              <p className="text-xs text-rose-400 font-semibold">{microcycle || entry.microcycle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">
              Workout Session / Exercises
            </label>
            <textarea
              rows={3}
              value={workout}
              onChange={(e) => setWorkout(e.target.value)}
              placeholder="e.g. Bench(120kgx3)+Chest hypertrophy or Recovery"
              className="input-custom font-medium"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">
                Status / Mindset Tag
              </label>
              <input
                type="text"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="e.g. Bad day, Physio session, Jihad al nafs"
                className="input-custom text-amber-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-400 uppercase mb-1 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" /> PR Record / Load
              </label>
              <input
                type="text"
                value={pr}
                onChange={(e) => setPr(e.target.value)}
                placeholder="e.g. 130kgx1 PR, 120kgx4 (elbow wraps)"
                className="input-custom border-amber-500/30 text-amber-300 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-emerald-400 uppercase mb-1 flex items-center gap-1">
              <Utensils className="w-3.5 h-3.5" /> Diet & Nutrition Log
            </label>
            <input
              type="text"
              value={diet}
              onChange={(e) => setDiet(e.target.value)}
              placeholder="e.g. 3 chappathis + beef roast + protein shake"
              className="input-custom border-emerald-500/30 text-emerald-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-color)]">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Mesocycle
              </label>
              <input
                type="text"
                value={mesocycle}
                onChange={(e) => setMesocycle(e.target.value)}
                className="input-custom text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                Microcycle
              </label>
              <input
                type="text"
                value={microcycle}
                onChange={(e) => setMicrocycle(e.target.value)}
                className="input-custom text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn-primary"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
