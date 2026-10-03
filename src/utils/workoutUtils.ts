import type { WorkoutEntry, PhaseType, PRRecord } from '../types/workout';

export function getPhaseFromMesocycle(mesocycle: string, microcycle: string): PhaseType {
  const mesoLower = mesocycle.toLowerCase();
  const microLower = microcycle.toLowerCase();

  if (microLower.includes('deload') || mesoLower.includes('deload')) return 'Deload';
  if (microLower.includes('taper')) return 'Taper';
  if (mesoLower.includes('peaking') || microLower.includes('peaking')) return 'Peaking';
  if (mesoLower.includes('accumulation') || microLower.includes('accumulation')) return 'Accumulation';
  if (mesoLower.includes('strength') || microLower.includes('strength')) return 'Strength';
  if (mesoLower.includes('hypertrophy') || microLower.includes('hypertrophy')) return 'Hypertrophy';
  
  return 'Hypertrophy';
}

export function getCategoryFromWorkout(workout: string, status: string): { label: string; color: string; badgeBg: string } {
  const w = workout.toLowerCase();
  const s = status.toLowerCase();

  if (w.includes('recovery') || w === 'sunday' || w === '' || s.includes('holiday') || s.includes('recovery')) {
    if (w.includes('active recovery')) return { label: 'Active Recovery', color: '#38bdf8', badgeBg: 'rgba(56, 189, 248, 0.15)' };
    return { label: 'Recovery', color: '#94a3b8', badgeBg: 'rgba(148, 163, 184, 0.12)' };
  }

  if (w.includes('bench') || w.includes('bp practice') || w.includes('dumbell bench') || w.includes('incline dumbell') || w.includes('chest')) {
    return { label: 'Bench / Chest', color: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.15)' };
  }

  if (w.includes('squat') || w.includes('leg')) {
    return { label: 'Squats / Legs', color: '#eab308', badgeBg: 'rgba(234, 179, 8, 0.15)' };
  }

  if (w.includes('deadlift') || w.includes('531 deadlift') || w.includes('back')) {
    return { label: 'Deadlift / Back', color: '#10b981', badgeBg: 'rgba(16, 185, 129, 0.15)' };
  }

  if (w.includes('shoulder') || w.includes('ohp')) {
    return { label: 'Shoulder / OHP', color: '#a855f7', badgeBg: 'rgba(168, 85, 247, 0.15)' };
  }

  if (w.includes('biceps') || w.includes('triceps') || w.includes('arms') || w.includes('cheat curls') || w.includes('forearm')) {
    return { label: 'Arms / Biceps / Triceps', color: '#ec4899', badgeBg: 'rgba(236, 72, 153, 0.15)' };
  }

  if (s.includes('cold') || s.includes('illness') || s.includes('sore throat') || s.includes('fever') || s.includes('pain') || s.includes('infection')) {
    return { label: 'Illness / Recovery', color: '#f97316', badgeBg: 'rgba(249, 115, 22, 0.15)' };
  }

  return { label: 'General Strength', color: '#6366f1', badgeBg: 'rgba(99, 102, 241, 0.15)' };
}

export function extractPRs(entries: WorkoutEntry[]): PRRecord[] {
  const prs: PRRecord[] = [];

  for (const entry of entries) {
    const rawPr = entry.pr.trim();
    if (!rawPr) continue;

    const match = rawPr.match(/(\d+(?:\.\d+)?)\s*kg\s*x?\s*(\d+)?/i);
    let exercise = 'Bench Press';
    const wLower = entry.workout.toLowerCase();
    const prLower = rawPr.toLowerCase();

    if (
      wLower.includes('slingshot') ||
      wLower.includes('sling shot') ||
      wLower.includes('sling-shot') ||
      prLower.includes('slingshot') ||
      prLower.includes('sling shot') ||
      prLower.includes('sling-shot')
    ) {
      exercise = 'Slingshot Bench Press';
    } else if (wLower.includes('squat')) exercise = 'Squat';
    else if (wLower.includes('deadlift')) exercise = 'Deadlift';
    else if (wLower.includes('dumbell press') || wLower.includes('flat dumbell')) exercise = 'Dumbbell Bench Press';
    else if (wLower.includes('shoulder') || wLower.includes('ohp')) exercise = 'OHP';

    if (match) {
      const weight = parseFloat(match[1]);
      const reps = match[2] ? parseInt(match[2], 10) : 1;
      prs.push({
        date: entry.date,
        exercise,
        weight,
        reps,
        rawText: rawPr,
        isPR: rawPr.toLowerCase().includes('pr'),
        notes: entry.workout
      });
    } else if (rawPr.toLowerCase().includes('vol')) {
      const volVal = rawPr.match(/vol\s*(\d+)/i);
      if (volVal) {
        prs.push({
          date: entry.date,
          exercise: 'Volume Load',
          weight: parseInt(volVal[1], 10),
          reps: 1,
          rawText: rawPr,
          isPR: false,
          notes: entry.workout
        });
      }
    }
  }

  return prs;
}

/**
 * Formats a date string (e.g. "2025-09-15" or ISO string) into d m y format (e.g. "15/09/2025").
 */
export function formatDateDMY(dateStr?: string | null): string {
  if (!dateStr || dateStr === '—' || !dateStr.trim()) return dateStr || '—';
  const cleanStr = dateStr.trim();

  // Match YYYY-MM-DD or YYYY/MM/DD, optionally followed by time
  const isoMatch = cleanStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  // If already in DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${day}/${month}/${year}`;
  }

  // Fallback for standard date string parsing
  const d = new Date(cleanStr);
  if (!isNaN(d.getTime())) {
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  return cleanStr;
}

/**
 * Determines whether a lift / exercise represents a cardio movement (calories & minutes)
 * rather than a traditional strength / resistance movement (weight & reps).
 */
export function isCardioExercise(lift?: {
  name?: string;
  gifUrl?: string;
  isCardio?: boolean;
  unit?: string;
  category?: string;
} | null): boolean {
  if (!lift) return false;
  if (lift.isCardio !== undefined) return lift.isCardio;
  if (lift.unit === 'cal' || lift.unit === 'kcal' || lift.unit === 'min') return true;
  if (lift.category && /cardio/i.test(lift.category)) return true;
  if (lift.gifUrl && /cardio/i.test(lift.gifUrl)) return true;
  const n = (lift.name || '').toLowerCase();
  return /\b(cardio|treadmill|elliptical|bike|bicycle|cycling|cycle|rowing|rower|stair|stepper|running|runner|run|jogging|jog|walk|walking|incline walk|jump rope|skipping|burpee|sprint|aerobic|swim|swimming|hiit|cross trainer|assault bike|spin bike|skierg)\b/i.test(n);
}

/**
 * Calculates Estimated 1RM from weight and reps using the Epley formula:
 * 1RM = weight * (1 + reps / 30)
 */
export function calcE1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Calculates required reps for a given weight to match target E1RM using inverse Epley formula:
 * reps = 30 * (E1RM / weight - 1)
 * If laterality is 'uni', reps are divided by 2 and rounded.
 */
export function calcRepsFromE1RM(e1rm: number, weight: number, laterality: 'bi' | 'uni' = 'bi'): number {
  if (!e1rm || !weight || weight <= 0 || e1rm <= 0) return 0;
  if (weight >= e1rm) return 1;
  const computed = Math.round(((e1rm - weight) * 30) / weight);
  const baseReps = Math.max(1, computed);
  if (laterality === 'uni') {
    return Math.max(1, Math.round(baseReps / 2));
  }
  return baseReps;
}

/**
 * Inversely calculates required weight for given reps to match target E1RM:
 * weight = E1RM / (1 + reps / 30) = (30 * E1RM) / (30 + reps)
 * If laterality is 'uni', effective bilateral reps is reps * 2.
 */
export function calcWeightFromE1RM(e1rm: number, reps: number, laterality: 'bi' | 'uni' = 'bi'): number {
  if (!e1rm || !reps || reps <= 0 || e1rm <= 0) return 0;
  const effectiveReps = laterality === 'uni' ? reps * 2 : reps;
  if (effectiveReps <= 1) return e1rm;
  const rawWeight = (30 * e1rm) / (30 + effectiveReps);
  // Round to nearest 0.5 (e.g. 30, 32.5) for clean weight displays
  const rounded = Math.round(rawWeight * 2) / 2;
  return Math.max(0.5, rounded);
}


