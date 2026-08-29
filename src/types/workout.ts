export interface WorkoutEntry {
  id: string; // ISO Date YYYY-MM-DD
  date: string; // ISO Date YYYY-MM-DD
  displayDate: string; // e.g. "Monday, 15 September, 2025"
  mesocycle: string; // e.g. "MESOCYCLE 1 (MicroCycle 1-3)(HYPERTROPHY)"
  mesoNotes?: string;
  microcycle: string; // e.g. "MICROCYCLE 1 (BENCH 3 times per microcycle)"
  status: string; // e.g. "Bad. day", "Jihad al nafs priming up", "Physio session Started"
  workout: string; // e.g. "Bench(110x3)+Chest hypertrophy"
  pr: string; // e.g. "120kgx1 pr", "130kgx1 PR", "vol 6055"
  diet: string; // e.g. "Idiyapam+egg curry...", "3 chappathis+beef roast..."
}

export type PhaseType = 'Hypertrophy' | 'Strength' | 'Peaking' | 'Accumulation' | 'Deload' | 'Taper' | 'Recovery';

export interface MesocycleGroup {
  name: string;
  number: number;
  phase: string;
  notes?: string;
  microcycles: MicrocycleGroup[];
}

export interface MicrocycleGroup {
  name: string;
  number: number;
  entries: WorkoutEntry[];
}

export interface PRRecord {
  date: string;
  exercise: string;
  weight: number;
  reps: number;
  rawText: string;
  isPR: boolean;
  notes?: string;
}

export interface DisciplineTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}
