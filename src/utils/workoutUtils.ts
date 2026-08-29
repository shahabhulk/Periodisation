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

    if (wLower.includes('squat')) exercise = 'Squat';
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
