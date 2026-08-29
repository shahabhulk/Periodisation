import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, Circle, Sparkles } from 'lucide-react';

interface TaskItem {
  id: string;
  title: string;
  desc: string;
  category: string;
  completed: boolean;
}

const DEFAULT_DISCIPLINE_TASKS: TaskItem[] = [
  { id: 'sleep', title: 'Sleep Priority', desc: 'Sleep strictly within 1:00 AM (No excuses)', category: 'Recovery', completed: true },
  { id: 'protein', title: 'Increase Protein Intake', desc: 'Ensure target protein per kg bodyweight', category: 'Nutrition', completed: true },
  { id: 'noporn', title: 'No Masturbation / No Porn', desc: 'Maintain spiritual purity and retain focus', category: 'Mindset', completed: true },
  { id: 'socialmedia', title: 'Less Social Media', desc: 'Minimize doomscrolling and screen distraction', category: 'Mindset', completed: false },
  { id: 'prayers', title: '5 Times Prayer (Salah)', desc: 'Fulfill daily spiritual obligations on time', category: 'Spiritual', completed: true },
  { id: 'pushlimits', title: 'Push Beyond Limits', desc: 'Intense focus and max effort during workout sessions', category: 'Training', completed: true },
];

export const DisciplineTracker: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    const saved = localStorage.getItem('ironperiod_discipline_tasks');
    return saved ? JSON.parse(saved) : DEFAULT_DISCIPLINE_TASKS;
  });

  useEffect(() => {
    localStorage.setItem('ironperiod_discipline_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const toggleTask = (id: string) => {
    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const completionPercentage = Math.round((completedCount / tasks.length) * 100);

  return (
    <div className="space-y-6">
      
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-rose-950/40 border border-emerald-500/30 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" /> JIHAD UL NAFS MS3 DISCIPLINE FOCUS
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white">
              Daily Discipline & Mindset Check-In
            </h2>
            <p className="text-sm text-slate-300 max-w-xl">
              Strict adherence to non-negotiable personal standards for physical, mental, and spiritual resilience.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800 shrink-0">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="32" cy="32" r="26" stroke="#1e293b" strokeWidth="6" fill="transparent" />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  stroke="#10b981"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray="163"
                  strokeDashoffset={163 - (163 * completionPercentage) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <span className="absolute text-sm font-black text-white">{completionPercentage}%</span>
            </div>
            <div>
              <div className="text-sm font-bold text-white">{completedCount} of {tasks.length} Completed</div>
              <div className="text-xs text-emerald-400 font-semibold">Daily Streak Active</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tasks.map(task => (
          <div
            key={task.id}
            onClick={() => toggleTask(task.id)}
            className={`p-5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-4 ${
              task.completed
                ? 'bg-emerald-950/20 border-emerald-500/30 shadow-md shadow-emerald-950/20'
                : 'glass-card border-slate-800'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="badge-tag bg-slate-800 text-slate-300 text-[10px]">
                  {task.category}
                </span>
                <h4 className={`text-base font-extrabold ${task.completed ? 'text-emerald-300 line-through' : 'text-white'}`}>
                  {task.title}
                </h4>
              </div>
              <p className="text-xs text-slate-400 font-medium">{task.desc}</p>
            </div>

            <button className="shrink-0 mt-1">
              {task.completed ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 fill-emerald-500/20" />
              ) : (
                <Circle className="w-6 h-6 text-slate-600 hover:text-slate-400" />
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="glass-panel p-6 border-rose-500/20 bg-slate-900/50 space-y-3">
        <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-4 h-4" /> Periodization Mindset Principle
        </div>
        <p className="text-sm text-slate-200 italic font-medium leading-relaxed">
          "Consistency in the dark breeds maximum performance under the lights. Never make excuses for sleep, nutrition, or focus."
        </p>
      </div>

    </div>
  );
};
