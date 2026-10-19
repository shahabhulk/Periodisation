import type { WorkoutEntry, PREntry as WorkoutPREntry } from '../types/workout';
import { INITIAL_WORKOUT_DATA } from '../data/initialWorkoutData';
import type {
  Mesocycle,
  Microcycle,
  DayEntry,
  LiftEntry,
  SetEntry,
  Macrocycle,
} from '../components/PeriodisationAnalysisView';
import {
  computeMesocycleMetrics,
  calculateE1RM,
  isLiftMatching,
} from './periodisationMetrics';

export interface PhaseTargetSummary {
  exercise: string;
  target: string;
  completed: boolean;
}

export interface PhaseSummary {
  index: number;
  id: string;
  name: string;
  phaseKey: string;
  micRange: string;
  startDate: string;
  endDate: string;
  status: string;
  notes: string;
  targets: PhaseTargetSummary[];
  targetCompliancePct: number;
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  workoutDaysCount: number;
  restDaysCount: number;
  peakWeight: number;
  peak1RM: number;
  peakLifts: Record<string, { weight: number; reps: number; e1rm: number; date: string }>;
  prsLogged: { date: string; text: string; lift?: string }[];
  keyWorkouts: string[];
  dietSnippets: string[];
  statusSnippets: string[];
}

export interface CrossPhaseProgression {
  volumeProgression: {
    phaseIndex: number;
    phaseName: string;
    phaseKey: string;
    volume: number;
    deltaFromPriorPct: number | null;
  }[];
  strengthProgression: {
    lift: string;
    history: {
      phaseIndex: number;
      phaseName: string;
      phaseKey: string;
      weight: number;
      reps: number;
      e1rm: number;
    }[];
  }[];
  currentVsPreviousComparison: {
    hasPrior: boolean;
    priorPhaseName?: string;
    priorPhaseKey?: string;
    volumeDeltaPct?: number;
    summary: string;
  };
}

export interface AllTimeLiftRecord {
  lift: string;
  maxWeight: number;
  repsAtMax: number;
  peak1RM: number;
  date: string;
  notes?: string;
}

export interface ComprehensiveTrainingContext {
  allPhases: PhaseSummary[];
  currentPhase: PhaseSummary | null;
  previousPhases: PhaseSummary[];
  crossPhaseProgression: CrossPhaseProgression;
  allTimeRecords: Record<string, AllTimeLiftRecord>;
  recentWorkouts: { date: string; title: string; liftsSummary: string; notes?: string }[];
  recentDiets: { date: string; diet: string }[];
  recentStatuses: { date: string; status: string }[];
  totalWorkoutsLogged: number;
  formattedContextString: string;
}

// -------------------------------------------------------------
// 1. WORKOUT ENTRY PARSING & HYDRATION
// -------------------------------------------------------------

export function parseLiftsFromWorkoutText(
  workoutText: string,
  prText?: string,
  statusText?: string
): LiftEntry[] {
  const lifts: LiftEntry[] = [];
  const full = `${workoutText || ''} ${prText || ''} ${statusText || ''}`;
  const lower = full.toLowerCase();

  const addLift = (
    name: string,
    weight: number,
    reps: number,
    isPR = false,
    setType = '1'
  ) => {
    if (weight <= 0 || reps <= 0) return;
    let existing = lifts.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (!existing) {
      existing = {
        id: `lift-${name.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        unit: 'kg',
        sets: [],
        e1rm: calculateE1RM(weight, reps),
      };
      lifts.push(existing);
    }
    const setEntry: SetEntry = {
      id: `set-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: setType,
      weight,
      reps,
      isPR,
    };
    existing.sets.push(setEntry);
    const setE1RM = calculateE1RM(weight, reps);
    if (!existing.e1rm || setE1RM > (Number(existing.e1rm) || 0)) {
      existing.e1rm = setE1RM;
    }
  };

  // 1. Parse PR string if available (e.g. "120kgx1 pr", "130kgx1 PR", "125kg x1 PR", "pr 130kg")
  const pr = (prText || '').trim();
  if (pr) {
    const prMatch =
      pr.match(/(\d+(?:\.\d+)?)\s*kg\s*(?:[xX]\s*(\d+))?/i) ||
      pr.match(/(?:pr\s*)(\d+(?:\.\d+)?)\s*kg/i);
    if (prMatch) {
      const wt = parseFloat(prMatch[1]);
      const reps = prMatch[2] ? parseInt(prMatch[2], 10) : 1;
      let targetLift = 'Bench Press';
      if (lower.includes('squat')) targetLift = 'Squat';
      else if (lower.includes('deadlift')) targetLift = 'Deadlift';
      else if (lower.includes('dumbell') || lower.includes('dumbbell')) targetLift = 'Dumbbell Bench Press';
      else if (lower.includes('curl')) targetLift = 'Cheat Curls';
      else if (lower.includes('slingshot') || lower.includes('sling shot')) targetLift = 'Slingshot Bench Press';
      else if (lower.includes('ohp') || lower.includes('shoulder')) targetLift = 'Overhead Press';

      addLift(targetLift, wt, reps, true, 'T');
    }
  }

  // 2. Parse Bench Press from workout (e.g. "Bench(110x3)", "Bench(110 x 3)", "bp practice 100x5")
  const benchMatches = [
    ...(workoutText || '').matchAll(
      /(?:bench|bp|bench press).*?\(?(\d+(?:\.\d+)?)\s*(?:kg)?\s*[xX]\s*(\d+)\)?/gi
    ),
  ];
  benchMatches.forEach((bm) => {
    const wt = parseFloat(bm[1]);
    const reps = parseInt(bm[2], 10);
    addLift('Bench Press', wt, reps, false, '1');
  });

  // 3. Parse Squat from workout (e.g. "Squat(130x3)", "Squat 120x5")
  const squatMatches = [
    ...(workoutText || '').matchAll(
      /(?:squat).*?\(?(\d+(?:\.\d+)?)\s*(?:kg)?\s*[xX]\s*(\d+)\)?/gi
    ),
  ];
  squatMatches.forEach((sm) => {
    const wt = parseFloat(sm[1]);
    const reps = parseInt(sm[2], 10);
    addLift('Squat', wt, reps, false, '1');
  });

  // 4. Parse Deadlift from workout
  const deadMatches = [
    ...(workoutText || '').matchAll(
      /(?:deadlift).*?\(?(\d+(?:\.\d+)?)\s*(?:kg)?\s*[xX]\s*(\d+)\)?/gi
    ),
  ];
  deadMatches.forEach((dm) => {
    const wt = parseFloat(dm[1]);
    const reps = parseInt(dm[2], 10);
    addLift('Deadlift', wt, reps, false, '1');
  });

  // 5. Parse Cheat Curls from workout
  const curlMatches = [
    ...(workoutText || '').matchAll(
      /(?:cheat\s+curls?|curls?).*?\(?(\d+(?:\.\d+)?)\s*[xX]\s*(\d+)\)?/gi
    ),
  ];
  curlMatches.forEach((cm) => {
    const wt = parseFloat(cm[1]);
    const reps = parseInt(cm[2], 10);
    addLift('Cheat Curls', wt, reps, false, '1');
  });

  // 6. Parse Dumbbell Press (e.g. "Dumbell bench 55kg each", "55kg each dumbell")
  const dbMatches = [
    ...(workoutText || '').matchAll(
      /(?:dumbell|dumbbell).*?(\d+(?:\.\d+)?)\s*kg/gi
    ),
  ];
  dbMatches.forEach((dbm) => {
    const wt = parseFloat(dbm[1]);
    addLift('Dumbbell Bench Press', wt, 5, false, '1');
  });

  // 7. Generic weight x rep patterns like "(110x3)" or "110x3"
  if (lifts.length === 0) {
    const genMatch = (workoutText || '').match(
      /\(?(\d+(?:\.\d+)?)\s*(?:kg)?\s*[xX]\s*(\d+)\)?/i
    );
    if (genMatch) {
      const wt = parseFloat(genMatch[1]);
      const reps = parseInt(genMatch[2], 10);
      if (wt >= 20 && reps > 0 && reps <= 30) {
        let name = 'Main Compound';
        if (lower.includes('chest') || lower.includes('bench') || lower.includes('press'))
          name = 'Bench Press';
        else if (lower.includes('leg') || lower.includes('squat')) name = 'Squat';
        else if (lower.includes('back') || lower.includes('deadlift')) name = 'Deadlift';
        else if (lower.includes('arm') || lower.includes('bicep')) name = 'Cheat Curls';
        else if (lower.includes('shoulder') || lower.includes('ohp')) name = 'Overhead Press';
        addLift(name, wt, reps, false, '1');
      }
    }
  }

  return lifts;
}

function inferBodyTags(workout: string, status: string): string[] {
  const tags: string[] = [];
  const text = `${workout || ''} ${status || ''}`.toLowerCase();
  if (text.includes('bench') || text.includes('chest')) tags.push('Chest');
  if (text.includes('squat') || text.includes('leg')) tags.push('Legs');
  if (text.includes('deadlift') || text.includes('back') || text.includes('row')) tags.push('Back');
  if (text.includes('shoulder') || text.includes('ohp')) tags.push('Shoulders');
  if (text.includes('arm') || text.includes('bicep') || text.includes('tricep') || text.includes('curl')) tags.push('Arms');
  if (text.includes('cardio') || text.includes('cycle') || text.includes('run')) tags.push('Cardio');
  if (tags.length === 0) {
    if (text.includes('recovery') || text.includes('rest')) tags.push('Recovery');
    else tags.push('Full Body');
  }
  return tags;
}

export function extractMicrocycleIndex(microcycleName: string): number {
  const match = (microcycleName || '').match(/microcycle\s*(\d+)/i) || (microcycleName || '').match(/mc\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : 1;
}

export function extractMesocycleIndex(mesoName: string): number {
  const match = (mesoName || '').match(/mesocycle\s*(\d+)/i) || (mesoName || '').match(/meso\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Ensures all mesocycles (especially historical phases 1 through 11) have full
 * microcycle hierarchies and days populated from the 377+ workout entries.
 */
export function hydrateAllMesocyclesWithWorkoutData<T extends { id: string; name: string; phaseKey: string; microcycles?: any[]; [key: string]: any }>(
  mesos: T[],
  entries?: WorkoutEntry[]
): T[] {
  const workoutList = entries && entries.length > 0 ? entries : getStoredWorkoutEntries();
  if (!workoutList || workoutList.length === 0) return mesos;

  // Group entries by mesocycle index (1 to 12)
  const entriesByMesoIndex: Record<number, WorkoutEntry[]> = {};
  workoutList.forEach((e) => {
    const mIdx = extractMesocycleIndex(e.mesocycle);
    if (!entriesByMesoIndex[mIdx]) entriesByMesoIndex[mIdx] = [];
    entriesByMesoIndex[mIdx].push(e);
  });

  return mesos.map((meso) => {
    const mesoIdx = meso.index || extractMesocycleIndex(meso.name);
    const existingMics = meso.microcycles || [];

    // Check if the mesocycle already has microcycles with populated days & lifts
    const hasPopulatedDays = existingMics.some(
      (mc: any) => mc.days && mc.days.some((d: any) => d.lifts && d.lifts.length > 0)
    );

    const relatedEntries = entriesByMesoIndex[mesoIdx] || [];
    if (relatedEntries.length === 0) return meso;

    // If mesocycle is empty or only has empty dummy days, rebuild microcycles from actual entries
    if (!hasPopulatedDays) {
      // Group related entries by microcycle index
      const byMic: Record<number, { label: string; entries: WorkoutEntry[] }> = {};
      relatedEntries.forEach((entry) => {
        const micIdx = extractMicrocycleIndex(entry.microcycle);
        if (!byMic[micIdx]) {
          byMic[micIdx] = {
            label: entry.microcycle || `Microcycle ${micIdx}`,
            entries: [],
          };
        }
        byMic[micIdx].entries.push(entry);
      });

      const sortedMicIndices = Object.keys(byMic)
        .map(Number)
        .sort((a, b) => a - b);

      const hydratedMicrocycles: Microcycle[] = sortedMicIndices.map((micIdx) => {
        const group = byMic[micIdx];
        const days: DayEntry[] = group.entries.map((e) => {
          const wLower = (e.workout || '').toLowerCase();
          const sLower = (e.status || '').toLowerCase();
          const isRecovery =
            wLower.includes('recovery') ||
            wLower === 'sunday' ||
            wLower === '' ||
            sLower.includes('recovery') ||
            sLower.includes('holiday');

          const lifts = parseLiftsFromWorkoutText(e.workout, e.pr, e.status);
          const bodyTags = inferBodyTags(e.workout, e.status);

          const notesParts = [e.status, e.diet, e.mesoNotes].filter(Boolean);
          const combinedNotes = notesParts.join('\n\n');

          return {
            id: e.id || e.date,
            date: e.date,
            type: isRecovery ? 'recovery' : 'workout',
            title: e.workout || (isRecovery ? 'Recovery Day' : 'Workout Session'),
            bodyTags,
            lifts,
            notes: combinedNotes || e.workout || '',
            durationSeconds: isRecovery ? 0 : 3600,
            diet: e.diet,
            status: e.status,
          } as DayEntry;
        });

        return {
          id: `mc-${meso.id}-${micIdx}`,
          index: micIdx,
          label: group.label,
          days,
          note: group.entries[0]?.mesoNotes,
        };
      });

      return {
        ...meso,
        microcycles: hydratedMicrocycles as any,
      };
    }

    return meso;
  });
}

// -------------------------------------------------------------
// 2. LOCAL STORAGE RETRIEVAL HELPERS
// -------------------------------------------------------------

export function getStoredWorkoutEntries(): WorkoutEntry[] {
  if (typeof window === 'undefined') return INITIAL_WORKOUT_DATA;
  try {
    const raw = localStorage.getItem('iron_workout_entries');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return INITIAL_WORKOUT_DATA;
}

export function saveStoredWorkoutEntries(entries: WorkoutEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('iron_workout_entries', JSON.stringify(entries));
  } catch {
    // quota
  }
}

export function getDefaultMesocycles(): Mesocycle[] {
  const meta = [
    { index: 1, name: "Hypertrophy", micRange: "1–3", start: "2025-09-15", end: "2025-10-14" },
    { index: 2, name: "Hypertrophy Priority + Strength", micRange: "4–6", start: "2025-10-15", end: "2025-11-19" },
    { index: 3, name: "Comeback Block — Hypertrophy + Strength", micRange: "7–9", start: "2025-11-20", end: "2025-12-19" },
    { index: 4, name: "Base Building", micRange: "10–12", start: "2025-12-20", end: "2026-01-18" },
    { index: 5, name: "Base Building", micRange: "13–15", start: "2026-01-19", end: "2026-02-17" },
    { index: 6, name: "Peaking", micRange: "16–18", start: "2026-02-18", end: "2026-03-19" },
    { index: 7, name: "Accumulation", micRange: "19–21", start: "2026-03-20", end: "2026-04-18" },
    { index: 8, name: "Strength", micRange: "22–24", start: "2026-04-19", end: "2026-05-18" },
    { index: 9, name: "Peaking", micRange: "25–27", start: "2026-05-19", end: "2026-06-17" },
    { index: 10, name: "Hypertrophy", micRange: "28–32", start: "2026-06-22", end: "2026-07-26" },
    { index: 11, name: "Strength", micRange: "33–36", start: "2026-07-27", end: "2026-08-23" },
    { index: 12, name: "Peaking", micRange: "37–40", start: "2026-08-24", end: "2026-09-20" },
  ];

  return meta.map((m) => {
    let phaseKey = 'Peaking';
    const n = m.name.toLowerCase();
    if (n.includes('peak')) phaseKey = 'Peaking';
    else if (n.includes('accumul')) phaseKey = 'Accumulation';
    else if (n.includes('strength')) phaseKey = 'Strength';
    else if (n.includes('hypertrophy')) phaseKey = 'Hypertrophy';
    else if (n.includes('deload') || n.includes('recovery')) phaseKey = 'Deload';

    return {
      id: `meso-${m.index}`,
      macroId: 'macro-1',
      index: m.index,
      name: m.name,
      phaseKey,
      micRange: m.micRange,
      start: m.start,
      end: m.end,
      status: m.index === 12 ? 'active' : 'completed',
      microcycles: [],
    };
  });
}

export function getStoredLedgerData(): {
  macrocycles: Macrocycle[];
  mesocycles: Mesocycle[];
  prLog: WorkoutPREntry[];
} {
  const defaultMacros: Macrocycle[] = [{ id: 'macro-1', index: 1, name: 'Macrocycle 1', start: '2025-09-15' }];
  const defaultMesos: Mesocycle[] = getDefaultMesocycles();
  const defaultPrLog: WorkoutPREntry[] = [
    { id: 'pr-1', lift: 'Bench Press', weight: 120, unit: 'kg', reps: 1, date: '2025-10-10' },
    { id: 'pr-2', lift: 'Squat', weight: 130, unit: 'kg', reps: 1, date: '2025-11-02' },
    { id: 'pr-3', lift: 'Bench Press', weight: 125, unit: 'kg', reps: 1, date: '2026-03-03' },
    { id: 'pr-4', lift: 'Bench Press', weight: 130, unit: 'kg', reps: 1, date: '2026-03-16' },
    { id: 'pr-5', lift: 'Squat', weight: 140, unit: 'kg', reps: 1, date: '2026-06-03' },
    { id: 'pr-6', lift: 'Bench Press', weight: 130, unit: 'kg', reps: 1, date: '2026-08-10', note: 'elbow wraps' },
    { id: 'pr-7', lift: 'Dumbbell Bench Press', weight: 60, unit: 'kg', reps: 1, date: '2026-08-23', note: 'each side' },
  ];

  if (typeof window === 'undefined') {
    return { macrocycles: defaultMacros, mesocycles: defaultMesos, prLog: defaultPrLog };
  }

  try {
    const raw = localStorage.getItem('iron-ledger-data');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        macrocycles: Array.isArray(parsed.macrocycles) && parsed.macrocycles.length > 0 ? parsed.macrocycles : defaultMacros,
        mesocycles: Array.isArray(parsed.mesocycles) && parsed.mesocycles.length > 0 ? parsed.mesocycles : defaultMesos,
        prLog: Array.isArray(parsed.prLog) && parsed.prLog.length > 0 ? parsed.prLog : defaultPrLog,
      };
    }
  } catch {
    // fallback
  }

  return { macrocycles: defaultMacros, mesocycles: defaultMesos, prLog: defaultPrLog };
}

// -------------------------------------------------------------
// 3. COMPREHENSIVE TRAINING CONTEXT BUILDER
// -------------------------------------------------------------

export function buildComprehensiveTrainingContext(params?: {
  mesocycles?: Mesocycle[];
  prLog?: WorkoutPREntry[];
  workoutEntries?: WorkoutEntry[];
  currentMesoId?: string;
  currentMicId?: string;
  selectedLift?: string;
}): ComprehensiveTrainingContext {
  const ledger = getStoredLedgerData();
  const rawMesos = params?.mesocycles && params.mesocycles.length > 0 
    ? params.mesocycles 
    : (ledger.mesocycles.length > 0 ? ledger.mesocycles : getDefaultMesocycles());
  const entries = params?.workoutEntries && params.workoutEntries.length > 0 ? params.workoutEntries : getStoredWorkoutEntries();
  const prList = params?.prLog && params.prLog.length > 0 ? params.prLog : ledger.prLog;

  // Ensure all mesocycles are fully hydrated with microcycles and workout days
  const hydratedMesos = hydrateAllMesocyclesWithWorkoutData(rawMesos, entries);

  // Sort mesocycles chronologically
  const sortedMesos = [...hydratedMesos].sort((a, b) => (a.index || 0) - (b.index || 0));

  // Determine current active or selected mesocycle
  let currentMeso: Mesocycle | null = null;
  if (params?.currentMesoId) {
    currentMeso = sortedMesos.find((m) => m.id === params.currentMesoId) || null;
  }
  if (!currentMeso) {
    currentMeso = sortedMesos.find((m) => m.status === 'active') || sortedMesos[sortedMesos.length - 1] || null;
  }

  const currentMesoIndex = currentMeso?.index || 12;

  // Build PhaseSummary for every phase
  const allPhases: PhaseSummary[] = sortedMesos.map((m) => {
    const mesoMetrics = computeMesocycleMetrics(m, undefined, params?.selectedLift || 'all');
    const peakLifts: Record<string, { weight: number; reps: number; e1rm: number; date: string }> = {};
    const prsLogged: { date: string; text: string; lift?: string }[] = [];
    const keyWorkouts: string[] = [];
    const dietSnippets: string[] = [];
    const statusSnippets: string[] = [];

    let workoutCount = 0;
    let restCount = 0;

    (m.microcycles || []).forEach((mc) => {
      (mc.days || []).forEach((d) => {
        if (d.type === 'workout' || (d.lifts && d.lifts.length > 0)) {
          workoutCount++;
          if (d.title && keyWorkouts.length < 5 && !d.title.toLowerCase().includes('recovery')) {
            keyWorkouts.push(`${d.date}: ${d.title}`);
          }
        } else {
          restCount++;
        }

        // Lifts & sets
        (d.lifts || []).forEach((l) => {
          const lName = l.name;
          (l.sets || []).forEach((s) => {
            const wt = parseFloat(String(s.weight)) || 0;
            const reps = parseInt(String(s.reps), 10) || 1;
            const e1rm = calculateE1RM(wt, reps);
            if (wt > 0) {
              if (!peakLifts[lName] || wt > peakLifts[lName].weight) {
                peakLifts[lName] = { weight: wt, reps, e1rm, date: d.date };
              }
              if (s.isPR) {
                prsLogged.push({ date: d.date, text: `${lName} ${wt}kg x ${reps} PR`, lift: lName });
              }
            }
          });
        });

        // Diet snippets
        const dietText = (d as any).diet || '';
        if (dietText && dietSnippets.length < 3) {
          dietSnippets.push(`${d.date}: ${dietText.slice(0, 60)}`);
        }

        // Status snippets
        const statusText = (d as any).status || d.notes || '';
        if (statusText && statusSnippets.length < 3 && statusText.length > 5) {
          statusSnippets.push(`${d.date}: ${statusText.slice(0, 60)}`);
        }
      });
    });

    // Also look up any PRs logged in entries for this mesocycle
    entries
      .filter((e) => extractMesocycleIndex(e.mesocycle) === m.index && e.pr && e.pr.trim())
      .forEach((e) => {
        if (!prsLogged.some((p) => p.date === e.date)) {
          prsLogged.push({ date: e.date, text: e.pr, lift: e.workout });
        }
      });

    // Targets
    const targets: PhaseTargetSummary[] = (m.targets || []).map((t: any) => ({
      exercise: t.exercise || 'Main Lift',
      target: t.target || 'Progressive Overload',
      completed: Boolean(t.completed),
    }));

    const compCount = targets.filter((t) => t.completed).length;
    const targetCompliancePct = targets.length > 0 ? Math.round((compCount / targets.length) * 100) : 100;

    let totalSetsCount = 0;
    let totalRepsCount = 0;
    (m.microcycles || []).forEach((mc) => {
      (mc.days || []).forEach((d) => {
        (d.lifts || []).forEach((l) => {
          totalSetsCount += (l.sets || []).length;
          (l.sets || []).forEach((s) => {
            totalRepsCount += Number(s.reps) || 0;
          });
        });
      });
    });

    return {
      index: m.index,
      id: m.id,
      name: m.name,
      phaseKey: m.phaseKey,
      micRange: m.micRange || '',
      startDate: m.start,
      endDate: m.end,
      status: m.status,
      notes: m.notes || '',
      targets,
      targetCompliancePct,
      totalVolume: mesoMetrics.totalVolume,
      totalSets: totalSetsCount,
      totalReps: totalRepsCount,
      workoutDaysCount: workoutCount,
      restDaysCount: restCount,
      peakWeight: mesoMetrics.peakWeight,
      peak1RM: mesoMetrics.peak1RM,
      peakLifts,
      prsLogged,
      keyWorkouts,
      dietSnippets,
      statusSnippets,
    };
  });

  const currentSummary = allPhases.find((p) => p.index === currentMesoIndex) || allPhases[allPhases.length - 1] || null;
  const previousPhases = allPhases.filter((p) => p.index < currentMesoIndex);

  // Cross-phase progression calculations
  const volumeProgression = allPhases.map((p, idx) => {
    let deltaFromPriorPct: number | null = null;
    if (idx > 0 && allPhases[idx - 1].totalVolume > 0) {
      deltaFromPriorPct = Math.round(
        ((p.totalVolume - allPhases[idx - 1].totalVolume) / allPhases[idx - 1].totalVolume) * 100
      );
    }
    return {
      phaseIndex: p.index,
      phaseName: p.name,
      phaseKey: p.phaseKey,
      volume: p.totalVolume,
      deltaFromPriorPct,
    };
  });

  // Track lift progression across phases for key lifts
  const trackedLifts = ['Bench Press', 'Squat', 'Deadlift', 'Dumbbell Bench Press', 'Cheat Curls'];
  const strengthProgression = trackedLifts.map((liftName) => {
    const history = allPhases
      .map((p) => {
        const found = Object.entries(p.peakLifts).find(([name]) =>
          isLiftMatching(name, liftName)
        );
        if (found) {
          return {
            phaseIndex: p.index,
            phaseName: p.name,
            phaseKey: p.phaseKey,
            weight: found[1].weight,
            reps: found[1].reps,
            e1rm: found[1].e1rm,
          };
        }
        return null;
      })
      .filter(Boolean) as {
        phaseIndex: number;
        phaseName: number | string;
        phaseKey: string;
        weight: number;
        reps: number;
        e1rm: number;
      }[];

    return {
      lift: liftName,
      history: history as any,
    };
  });

  // Current vs immediately preceding phase
  const priorPhase = previousPhases.length > 0 ? previousPhases[previousPhases.length - 1] : null;
  let volumeDeltaPct: number | undefined;
  if (priorPhase && priorPhase.totalVolume > 0 && currentSummary) {
    volumeDeltaPct = Math.round(
      ((currentSummary.totalVolume - priorPhase.totalVolume) / priorPhase.totalVolume) * 100
    );
  }

  const currentVsPreviousComparison = {
    hasPrior: Boolean(priorPhase),
    priorPhaseName: priorPhase?.name,
    priorPhaseKey: priorPhase?.phaseKey,
    volumeDeltaPct,
    summary: priorPhase && currentSummary
      ? `Transitioning from Phase ${priorPhase.index} (${priorPhase.phaseKey}: ${(priorPhase.totalVolume / 1000).toFixed(1)}k kg) into Current Phase ${currentSummary.index} (${currentSummary.phaseKey}: ${(currentSummary.totalVolume / 1000).toFixed(1)}k kg${volumeDeltaPct !== undefined ? `, ${volumeDeltaPct >= 0 ? `+${volumeDeltaPct}%` : `${volumeDeltaPct}%`}` : ''}).`
      : 'First initial periodisation phase.',
  };

  const crossPhaseProgression: CrossPhaseProgression = {
    volumeProgression,
    strengthProgression,
    currentVsPreviousComparison,
  };

  // Compile all-time records
  const allTimeRecords: Record<string, AllTimeLiftRecord> = {};
  prList.forEach((pr) => {
    const w = typeof pr.weight === 'number' ? pr.weight : parseFloat(String(pr.weight)) || 0;
    const r = typeof pr.reps === 'number' ? pr.reps : parseInt(String(pr.reps), 10) || 1;
    const e1rm = calculateE1RM(w, r);
    const lift = pr.lift;
    if (w > 0 && (!allTimeRecords[lift] || w > allTimeRecords[lift].maxWeight)) {
      allTimeRecords[lift] = {
        lift,
        maxWeight: w,
        repsAtMax: r,
        peak1RM: e1rm,
        date: pr.date,
        notes: pr.note,
      };
    }
  });

  // Merge PRs from all phases
  allPhases.forEach((p) => {
    Object.entries(p.peakLifts).forEach(([lName, stat]) => {
      if (!allTimeRecords[lName] || stat.weight > allTimeRecords[lName].maxWeight) {
        allTimeRecords[lName] = {
          lift: lName,
          maxWeight: stat.weight,
          repsAtMax: stat.reps,
          peak1RM: stat.e1rm,
          date: stat.date,
        };
      }
    });
  });

  // Recent logs
  const recentWorkouts: { date: string; title: string; liftsSummary: string; notes?: string }[] = [];
  const recentDiets: { date: string; diet: string }[] = [];
  const recentStatuses: { date: string; status: string }[] = [];

  entries
    .slice()
    .reverse()
    .slice(0, 15)
    .forEach((e) => {
      if (e.workout && recentWorkouts.length < 10) {
        recentWorkouts.push({
          date: e.date,
          title: e.workout,
          liftsSummary: e.pr ? `PR: ${e.pr}` : '',
          notes: e.status,
        });
      }
      if (e.diet && recentDiets.length < 5) {
        recentDiets.push({ date: e.date, diet: e.diet });
      }
      if (e.status && recentStatuses.length < 5) {
        recentStatuses.push({ date: e.date, status: e.status });
      }
    });

  // Build the rich formatted Markdown context block for AI Prompts
  const formattedContextString = formatComprehensiveContextForAI({
    allPhases,
    currentPhase: currentSummary,
    previousPhases,
    crossPhaseProgression,
    allTimeRecords,
    recentWorkouts,
    recentDiets,
    recentStatuses,
    totalWorkoutsLogged: entries.length,
    formattedContextString: '',
  });

  return {
    allPhases,
    currentPhase: currentSummary,
    previousPhases,
    crossPhaseProgression,
    allTimeRecords,
    recentWorkouts,
    recentDiets,
    recentStatuses,
    totalWorkoutsLogged: entries.length,
    formattedContextString,
  };
}

// -------------------------------------------------------------
// 4. PROMPT CONTEXT FORMATTER FOR AI (LAYMAN & SPORTS SCIENCE)
// -------------------------------------------------------------

function formatComprehensiveContextForAI(ctx: ComprehensiveTrainingContext): string {
  const lines: string[] = [];

  lines.push('================================================================');
  lines.push('ATHLETE COMPLETE PERIODISATION RECORD & ALL APPS DATA');
  lines.push('================================================================');
  lines.push(`Total Logged Sessions: ${ctx.totalWorkoutsLogged} across ${ctx.allPhases.length} Mesocycle Phases.`);
  lines.push('');

  // 1. ALL-TIME PERSONAL RECORDS
  lines.push('--- ALL-TIME PERSONAL RECORDS & PEAK LIFTS ---');
  Object.values(ctx.allTimeRecords).forEach((rec) => {
    lines.push(
      `• ${rec.lift}: ${rec.maxWeight}kg × ${rec.repsAtMax} (Est 1RM: ${rec.peak1RM}kg) on ${rec.date}${rec.notes ? ` [${rec.notes}]` : ''}`
    );
  });
  lines.push('');

  // 2. COMPLETE CHRONOLOGICAL PHASE HISTORY (All 12 Mesocycles)
  lines.push('--- COMPLETE PERIODISATION PHASES (CHRONOLOGICAL PROGRESSION) ---');
  ctx.allPhases.forEach((p) => {
    const isCurrent = ctx.currentPhase?.index === p.index;
    const volStr = (p.totalVolume / 1000).toFixed(1);
    const prStr = p.prsLogged.length > 0 ? p.prsLogged.map((pr) => pr.text).join(', ') : 'None';
    const topLiftsStr = Object.entries(p.peakLifts)
      .map(([name, stat]) => `${name} ${stat.weight}kg×${stat.reps}`)
      .join(', ') || 'No compound lift tracked';

    lines.push(
      `Phase ${p.index}: ${p.name} (${p.phaseKey.toUpperCase()}) ${isCurrent ? '[★ CURRENT ACTIVE PHASE]' : `[${p.status.toUpperCase()}]`}`
    );
    lines.push(`  - Dates: ${p.startDate} to ${p.endDate} (Weeks ${p.micRange})`);
    lines.push(`  - Total Volume: ${volStr}k kg | Workouts: ${p.workoutDaysCount} days | Rest: ${p.restDaysCount} days`);
    lines.push(`  - Peak Lifts in Phase: ${topLiftsStr}`);
    if (p.prsLogged.length > 0) {
      lines.push(`  - Key PRs Hit: ${prStr}`);
    }
    if (p.notes) {
      lines.push(`  - Phase Strategy / Notes: "${p.notes}"`);
    }
    if (p.targets.length > 0) {
      const tgtStr = p.targets.map((t) => `${t.exercise}: ${t.target} (${t.completed ? 'HIT' : 'Pending'})`).join('; ');
      lines.push(`  - Phase Targets (${p.targetCompliancePct}% Done): ${tgtStr}`);
    }
    if (p.keyWorkouts.length > 0) {
      lines.push(`  - Notable Workouts: ${p.keyWorkouts.slice(0, 3).join(' | ')}`);
    }
    lines.push('');
  });

  // 3. CROSS-PHASE COMPARISON & ADAPTATION TRANSITION
  lines.push('--- CROSS-PHASE VOLUME & STRENGTH PROGRESSION MATRIX ---');
  ctx.crossPhaseProgression.volumeProgression.forEach((vp) => {
    const deltaStr = vp.deltaFromPriorPct !== null ? `(${vp.deltaFromPriorPct >= 0 ? `+${vp.deltaFromPriorPct}%` : `${vp.deltaFromPriorPct}%`} vs prior)` : '(Baseline)';
    lines.push(`• Phase ${vp.phaseIndex} [${vp.phaseKey}]: ${(vp.volume / 1000).toFixed(1)}k kg ${deltaStr}`);
  });
  lines.push('');
  lines.push(`Current Phase Transition: ${ctx.crossPhaseProgression.currentVsPreviousComparison.summary}`);
  lines.push('');

  // 4. RECENT NUTRITION & PHYSIO OBSERVATIONS
  if (ctx.recentDiets.length > 0 || ctx.recentStatuses.length > 0) {
    lines.push('--- RECENT DIET & PHYSIO / HEALTH OBSERVATIONS ---');
    if (ctx.recentDiets.length > 0) {
      lines.push(`Recent Meals/Diet: ${ctx.recentDiets.map((d) => `[${d.date}] ${d.diet}`).join('; ')}`);
    }
    if (ctx.recentStatuses.length > 0) {
      lines.push(`Recent Recovery/Physio: ${ctx.recentStatuses.map((s) => `[${s.date}] ${s.status}`).join('; ')}`);
    }
    lines.push('');
  }

  lines.push('================================================================');

  return lines.join('\n');
}
