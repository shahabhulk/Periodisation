import type { DayEntry, Microcycle, Mesocycle, Macrocycle } from '../components/PeriodisationAnalysisView';

export interface CalculatedSessionMetrics {
  date: string;
  title: string;
  selectedLift?: string;
  totalVolume: number;
  workingSets: number;
  totalReps: number;
  peakWeight: number;
  peak1RM: number;
  avgIntensity: number; // Volume / totalReps
  fatigueDecayPct: number; // Drop-off between first working set and last working set at similar weight
  primaryCategory: string;
  exercisesCount: number;
  statusNote?: string;
  durationSeconds?: number;
  density: number; // kg per minute
}

export interface CalculatedMicrocycleMetrics {
  microId: string;
  index: number;
  label: string | null;
  selectedLift?: string;
  workoutDaysCount: number;
  restDaysCount: number;
  totalVolume: number;
  totalSets: number;
  peak1RM: number;
  peakWeight: number;
  benchSets: number;
  squatSets: number;
  deadliftSets: number;
  accessoriesSets: number;
  volumeChangeFromPriorPct: number | null;
  peak1RMChangeFromPriorPct: number | null;
  dayOverDayFatigueTrend: 'increasing' | 'stable' | 'decreasing' | 'insufficient_data';
}

export interface CalculatedMesocycleMetrics {
  mesoId: string;
  name: string;
  phaseKey: string;
  selectedLift?: string;
  microcyclesCount: number;
  totalVolume: number;
  avgWeeklyVolume: number;
  peak1RM: number;
  peakWeight: number;
  volumeProgressionRatePct: number;
  e1RMProgressionRatePct: number;
  acuteToChronicWorkloadRatio: number; // Simulated ACWR
  deloadRecommended: boolean;
  deloadReason?: string;
  targetComplianceRatePct: number;
  strategyNotes?: string;
}

export interface CalculatedMacrocycleMetrics {
  macroId: string;
  name: string;
  selectedLift?: string;
  mesocyclesCount: number;
  totalVolume: number;
  peak1RM: number;
  phasesDistribution: Record<string, number>;
  longTermProgressionPct: number;
}

export interface AIAnalysisReport {
  level: 'session' | 'microcycle' | 'mesocycle' | 'macrocycle';
  targetName: string;
  selectedLift?: string;
  status: 'Optimal Adaptation' | 'Productive Accumulation' | 'Peak Performance' | 'Fatigue Accumulating' | 'Deload Triggered' | 'Active Recovery';
  statusColor: string;
  score: number; // 0 - 100
  summary: string;
  diagnostics: string[];
  prescriptions: string[];
  metricsHighlights: { label: string; value: string; hint?: string }[];
  isOfflineHeuristic?: boolean;
  timestamp: string;
}

// -------------------------------------------------------------
// HELPER FORMULAS & LIFT MATCHING
// -------------------------------------------------------------

export function calculateE1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  if (reps <= 10) {
    return Math.round(weight / (1.0278 - 0.0278 * reps));
  }
  return Math.round(weight * (1 + reps / 30));
}

export function isLiftMatching(liftName: string, targetLift?: string): boolean {
  if (!targetLift || targetLift === 'all') return true;
  const l = (liftName || '').toLowerCase().trim();
  const t = targetLift.toLowerCase().trim();

  if (t === 'bench' || t === 'bench press') {
    return l.includes('bench') || l.includes('chest');
  }
  if (t === 'squat') {
    return l.includes('squat');
  }
  if (t === 'deadlift') {
    return l.includes('deadlift');
  }
  if (t === 'ohp' || t === 'overhead press') {
    return l.includes('ohp') || l.includes('shoulder');
  }
  return l.includes(t) || t.includes(l);
}

// -------------------------------------------------------------
// 1. SESSION METRICS CALCULATOR
// -------------------------------------------------------------

export function computeSessionMetrics(day: DayEntry, selectedLift = 'all'): CalculatedSessionMetrics {
  let totalVolume = 0;
  let workingSets = 0;
  let totalReps = 0;
  let peakWeight = 0;
  let peak1RM = 0;
  let benchCount = 0;
  let squatCount = 0;
  let deadliftCount = 0;

  const drops: number[] = [];

  (day.lifts || []).forEach((lift) => {
    if (!isLiftMatching(lift.name, selectedLift)) return;

    const lName = (lift.name || '').toLowerCase();
    if (lName.includes('bench') || lName.includes('chest')) benchCount++;
    else if (lName.includes('squat')) squatCount++;
    else if (lName.includes('deadlift')) deadliftCount++;

    const sets = lift.sets || [];
    if (sets.length >= 2) {
      const firstSet = sets[0];
      const lastSet = sets[sets.length - 1];
      const w1 = parseFloat(String(firstSet.weight)) || 0;
      const w2 = parseFloat(String(lastSet.weight)) || 0;
      const r1 = parseFloat(String(firstSet.reps)) || 0;
      const r2 = parseFloat(String(lastSet.reps)) || 0;

      if (w1 > 0 && Math.abs(w1 - w2) / w1 <= 0.05 && r1 > 0) {
        const decay = Math.max(0, ((r1 - r2) / r1) * 100);
        drops.push(decay);
      }
    }

    sets.forEach((s) => {
      const w = parseFloat(String(s.weight)) || 0;
      const r = parseFloat(String(s.reps)) || 0;
      if (w > 0 && r > 0) {
        totalVolume += w * r;
        workingSets += 1;
        totalReps += r;
        if (w > peakWeight) peakWeight = w;
        const e1rm = calculateE1RM(w, r);
        if (e1rm > peak1RM) peak1RM = e1rm;
      }
    });
  });

  const avgIntensity = totalReps > 0 ? Math.round(totalVolume / totalReps) : 0;
  const avgFatigueDecay = drops.length > 0 ? Math.round(drops.reduce((a, b) => a + b, 0) / drops.length) : 0;

  let primaryCategory = selectedLift !== 'all' ? selectedLift : 'Accessories & Core';
  if (selectedLift === 'all') {
    if (benchCount >= squatCount && benchCount >= deadliftCount && benchCount > 0) primaryCategory = 'Bench Press & Chest';
    else if (squatCount >= benchCount && squatCount >= deadliftCount && squatCount > 0) primaryCategory = 'Squat & Lower Body';
    else if (deadliftCount >= benchCount && deadliftCount >= squatCount && deadliftCount > 0) primaryCategory = 'Deadlift & Posterior Chain';
  }

  const durationMin = day.durationSeconds ? day.durationSeconds / 60 : 60;
  const density = durationMin > 0 ? Math.round(totalVolume / durationMin) : 0;

  return {
    date: day.date,
    title: day.title || (day.type === 'recovery' ? 'Rest / Recovery' : 'Workout Session'),
    selectedLift,
    totalVolume,
    workingSets,
    totalReps,
    peakWeight,
    peak1RM,
    avgIntensity,
    fatigueDecayPct: avgFatigueDecay,
    primaryCategory,
    exercisesCount: (day.lifts || []).filter((l) => isLiftMatching(l.name, selectedLift)).length,
    statusNote: day.notes,
    durationSeconds: day.durationSeconds,
    density,
  };
}

// -------------------------------------------------------------
// 2. MICROCYCLE METRICS CALCULATOR
// -------------------------------------------------------------

export function computeMicrocycleMetrics(
  micro: Microcycle,
  priorMic?: Microcycle,
  selectedLift = 'all'
): CalculatedMicrocycleMetrics {
  let workoutDaysCount = 0;
  let restDaysCount = 0;
  let totalVolume = 0;
  let totalSets = 0;
  let peak1RM = 0;
  let peakWeight = 0;
  let benchSets = 0;
  let squatSets = 0;
  let deadliftSets = 0;
  let accessoriesSets = 0;

  const dayVolumes: number[] = [];

  (micro.days || []).forEach((d) => {
    const matchingLifts = (d.lifts || []).filter((l) => isLiftMatching(l.name, selectedLift));
    const hasLifts = matchingLifts.length > 0;
    const isRest = d.type === 'recovery' || (!hasLifts && ((d.title || '').toLowerCase().includes('rest') || (d.title || '').toLowerCase().includes('recovery')));

    if (isRest) restDaysCount++;
    else if (hasLifts || d.type === 'workout') workoutDaysCount++;

    const session = computeSessionMetrics(d, selectedLift);
    if (session.totalVolume > 0) {
      dayVolumes.push(session.totalVolume);
    }
    totalVolume += session.totalVolume;
    totalSets += session.workingSets;
    if (session.peakWeight > peakWeight) peakWeight = session.peakWeight;
    if (session.peak1RM > peak1RM) peak1RM = session.peak1RM;

    matchingLifts.forEach((lift) => {
      const lName = (lift.name || '').toLowerCase();
      const count = (lift.sets || []).length;
      if (lName.includes('bench') || lName.includes('chest')) benchSets += count;
      else if (lName.includes('squat')) squatSets += count;
      else if (lName.includes('deadlift')) deadliftSets += count;
      else accessoriesSets += count;
    });
  });

  let volumeChangeFromPriorPct: number | null = null;
  let peak1RMChangeFromPriorPct: number | null = null;

  if (priorMic) {
    const priorMetrics = computeMicrocycleMetrics(priorMic, undefined, selectedLift);
    if (priorMetrics.totalVolume > 0) {
      volumeChangeFromPriorPct = Math.round(((totalVolume - priorMetrics.totalVolume) / priorMetrics.totalVolume) * 100);
    }
    if (priorMetrics.peak1RM > 0) {
      peak1RMChangeFromPriorPct = Math.round(((peak1RM - priorMetrics.peak1RM) / priorMetrics.peak1RM) * 100);
    }
  }

  let dayOverDayFatigueTrend: 'increasing' | 'stable' | 'decreasing' | 'insufficient_data' = 'insufficient_data';
  if (dayVolumes.length >= 3) {
    const firstHalf = dayVolumes.slice(0, Math.floor(dayVolumes.length / 2)).reduce((a, b) => a + b, 0);
    const secondHalf = dayVolumes.slice(Math.floor(dayVolumes.length / 2)).reduce((a, b) => a + b, 0);
    if (secondHalf < firstHalf * 0.8) dayOverDayFatigueTrend = 'increasing';
    else if (secondHalf > firstHalf * 1.15) dayOverDayFatigueTrend = 'decreasing';
    else dayOverDayFatigueTrend = 'stable';
  }

  return {
    microId: micro.id,
    index: micro.index,
    label: micro.label,
    selectedLift,
    workoutDaysCount,
    restDaysCount,
    totalVolume,
    totalSets,
    peak1RM,
    peakWeight,
    benchSets,
    squatSets,
    deadliftSets,
    accessoriesSets,
    volumeChangeFromPriorPct,
    peak1RMChangeFromPriorPct,
    dayOverDayFatigueTrend,
  };
}

// -------------------------------------------------------------
// 3. MESOCYCLE METRICS CALCULATOR
// -------------------------------------------------------------

export function computeMesocycleMetrics(
  meso: Mesocycle,
  _priorMeso?: Mesocycle,
  selectedLift = 'all'
): CalculatedMesocycleMetrics {
  const microcycles = meso.microcycles || [];
  let totalVolume = 0;
  let peak1RM = 0;
  let peakWeight = 0;
  const micVolumes: number[] = [];
  const mic1RMs: number[] = [];

  microcycles.forEach((m, idx) => {
    const prior = idx > 0 ? microcycles[idx - 1] : undefined;
    const mMetrics = computeMicrocycleMetrics(m, prior, selectedLift);
    totalVolume += mMetrics.totalVolume;
    if (mMetrics.totalVolume > 0) micVolumes.push(mMetrics.totalVolume);
    if (mMetrics.peak1RM > 0) mic1RMs.push(mMetrics.peak1RM);
    if (mMetrics.peak1RM > peak1RM) peak1RM = mMetrics.peak1RM;
    if (mMetrics.peakWeight > peakWeight) peakWeight = mMetrics.peakWeight;
  });

  const avgWeeklyVolume = microcycles.length > 0 ? Math.round(totalVolume / microcycles.length) : 0;

  let volumeProgressionRatePct = 0;
  if (micVolumes.length > 1 && micVolumes[0] > 0) {
    const peakV = Math.max(...micVolumes);
    volumeProgressionRatePct = Math.round(((peakV - micVolumes[0]) / micVolumes[0]) * 100);
  }

  let e1RMProgressionRatePct = 0;
  if (mic1RMs.length > 1 && mic1RMs[0] > 0) {
    const last1RM = mic1RMs[mic1RMs.length - 1];
    e1RMProgressionRatePct = Math.round(((last1RM - mic1RMs[0]) / mic1RMs[0]) * 100);
  }

  const acuteWorkload = micVolumes.length > 0 ? micVolumes[micVolumes.length - 1] : 0;
  const chronicWorkload = avgWeeklyVolume || 1;
  const acuteToChronicWorkloadRatio = parseFloat((acuteWorkload / chronicWorkload).toFixed(2));

  let deloadRecommended = false;
  let deloadReason: string | undefined;

  const phaseLower = (meso.phaseKey || '').toLowerCase();
  const isDeloadPhase = phaseLower.includes('deload') || phaseLower.includes('recovery');

  if (isDeloadPhase) {
    deloadRecommended = false;
    deloadReason = 'Currently taking an easy recovery week as planned.';
  } else if (acuteToChronicWorkloadRatio > 1.45) {
    deloadRecommended = true;
    deloadReason = `Your training load jumped up way too fast (${acuteToChronicWorkloadRatio}x higher than your normal average). Doing too much too quickly risks burning out or injuring a joint.`;
  } else if (mic1RMs.length >= 3) {
    const last = mic1RMs[mic1RMs.length - 1];
    const prev = mic1RMs[mic1RMs.length - 2];
    const prev2 = mic1RMs[mic1RMs.length - 3];
    if (last < prev && prev < prev2) {
      deloadRecommended = true;
      deloadReason = 'Your top strength has been dropping for 3 weeks in a row because your body is carrying too much fatigue. Take an easy deload week to reset.';
    }
  } else if (microcycles.length >= 5 && volumeProgressionRatePct >= 25 && !isDeloadPhase) {
    deloadRecommended = true;
    deloadReason = `You have been lifting heavy for ${microcycles.length} weeks straight (+${volumeProgressionRatePct}% volume). Your body needs an easy week to recharge before the next block.`;
  }

  let targetComplianceRatePct = 100;
  if (meso.targets && meso.targets.length > 0) {
    const completed = meso.targets.filter((t: any) => t.completed).length;
    targetComplianceRatePct = Math.round((completed / meso.targets.length) * 100);
  }

  return {
    mesoId: meso.id,
    name: meso.name,
    phaseKey: meso.phaseKey,
    selectedLift,
    microcyclesCount: microcycles.length,
    totalVolume,
    avgWeeklyVolume,
    peak1RM,
    peakWeight,
    volumeProgressionRatePct,
    e1RMProgressionRatePct,
    acuteToChronicWorkloadRatio,
    deloadRecommended,
    deloadReason,
    targetComplianceRatePct,
    strategyNotes: meso.notes,
  };
}

// -------------------------------------------------------------
// 4. MACROCYCLE METRICS CALCULATOR
// -------------------------------------------------------------

export function computeMacrocycleMetrics(
  macro: Macrocycle,
  mesos: Mesocycle[],
  selectedLift = 'all'
): CalculatedMacrocycleMetrics {
  const relevantMesos = mesos.filter((m) => m.macroId === macro.id || !m.macroId);
  let totalVolume = 0;
  let peak1RM = 0;
  const phasesDistribution: Record<string, number> = {};
  const mesoPeaks: number[] = [];

  relevantMesos.forEach((m) => {
    const pKey = m.phaseKey || 'General';
    phasesDistribution[pKey] = (phasesDistribution[pKey] || 0) + 1;
    const mMetrics = computeMesocycleMetrics(m, undefined, selectedLift);
    totalVolume += mMetrics.totalVolume;
    if (mMetrics.peak1RM > 0) {
      mesoPeaks.push(mMetrics.peak1RM);
      if (mMetrics.peak1RM > peak1RM) peak1RM = mMetrics.peak1RM;
    }
  });

  let longTermProgressionPct = 0;
  if (mesoPeaks.length > 1 && mesoPeaks[0] > 0) {
    const finalPeak = mesoPeaks[mesoPeaks.length - 1];
    longTermProgressionPct = Math.round(((finalPeak - mesoPeaks[0]) / mesoPeaks[0]) * 100);
  }

  return {
    macroId: macro.id,
    name: macro.name,
    selectedLift,
    mesocyclesCount: relevantMesos.length,
    totalVolume,
    peak1RM,
    phasesDistribution,
    longTermProgressionPct,
  };
}

// -------------------------------------------------------------
// 5. GROUNDED MODERATE SCIENTIFIC HEURISTICS ENGINE (100% OFFLINE)
// -------------------------------------------------------------

export function generateOfflineAnalysis(
  level: 'session' | 'microcycle' | 'mesocycle' | 'macrocycle',
  metrics: any,
  meta?: { phaseKey?: string; strategyNotes?: string; targets?: any[]; dayDate?: string; selectedLift?: string; [key: string]: any }
): AIAnalysisReport {
  const timestamp = new Date().toISOString();
  const selectedLift = meta?.selectedLift || metrics?.selectedLift || 'all';
  const liftLabel = selectedLift !== 'all' ? selectedLift : 'Overall';

  if (level === 'session') {
    const s = metrics as CalculatedSessionMetrics;
    const isHeavy = s.peak1RM > 0 && s.peakWeight >= s.peak1RM * 0.88;
    const highDecay = s.fatigueDecayPct >= 20;

    let status: AIAnalysisReport['status'] = 'Optimal Adaptation';
    let statusColor = '#10b981';
    let score = 88;
    const diagnostics: string[] = [];
    const prescriptions: string[] = [];

    if (s.totalVolume === 0) {
      return {
        level: 'session',
        targetName: s.title,
        selectedLift,
        status: 'Active Recovery',
        statusColor: '#06b6d4',
        score: 100,
        summary: 'Rest day! Time to let your muscles heal, refuel your energy, and recover.',
        diagnostics: ['No heavy lifting logged today, giving your joints and muscles a full break to repair.'],
        prescriptions: ['Drink plenty of water and eat enough protein.', 'Go for a light walk or do some stretching if you feel stiff.'],
        metricsHighlights: [{ label: 'Focus', value: 'Rest & Repair' }],
        isOfflineHeuristic: true,
        timestamp,
      };
    }

    if (highDecay) {
      status = 'Fatigue Accumulating';
      statusColor = '#f59e0b';
      score = 75;
      diagnostics.push(`Your reps dropped off by ${s.fatigueDecayPct}% across sets. Your muscles were running out of steam or your rest periods were too short.`);
      prescriptions.push('Rest an extra 1 to 2 minutes between your heavy working sets so you can push with full power.');
    } else {
      diagnostics.push(`You kept your reps very consistent (${s.fatigueDecayPct}% drop-off). Great energy and endurance throughout the session!`);
    }

    if (isHeavy) {
      diagnostics.push(`Your top set was very heavy at ${s.peakWeight}kg (~${Math.round((s.peakWeight / (s.peak1RM || 1)) * 100)}% of your max), pushing your body hard.`);
      prescriptions.push('Eat a good meal and get 8+ hours of sleep tonight so your body can bounce back stronger.');
    } else {
      diagnostics.push(`Solid volume workout: completed ${s.workingSets} working sets with consistent effort.`);
      prescriptions.push('If today felt smooth and you had 2 reps left in the tank, add 1–2.5 kg next time.');
    }

    return {
      level: 'session',
      targetName: s.title,
      selectedLift,
      status,
      statusColor,
      score,
      summary: `${s.title}: Logged ${s.workingSets} working sets (${(s.totalVolume / 1000).toFixed(1)}k kg total volume) with peak ${liftLabel} strength at ${s.peak1RM}kg.`,
      diagnostics,
      prescriptions,
      metricsHighlights: [
        { label: 'Total Volume', value: `${(s.totalVolume / 1000).toFixed(1)}k kg` },
        { label: 'Top Max', value: `${s.peak1RM} kg` },
        { label: 'Work Sets', value: `${s.workingSets}` },
        { label: 'Rep Drop-off', value: `${s.fatigueDecayPct}%` },
      ],
      isOfflineHeuristic: true,
      timestamp,
    };
  }

  if (level === 'microcycle') {
    const m = metrics as CalculatedMicrocycleMetrics;
    const volChange = m.volumeChangeFromPriorPct ?? 0;
    let status: AIAnalysisReport['status'] = 'Productive Accumulation';
    let statusColor = '#3b82f6';
    let score = 86;
    const diagnostics: string[] = [];
    const prescriptions: string[] = [];

    if (volChange > 20) {
      status = 'Fatigue Accumulating';
      statusColor = '#f59e0b';
      score = 75;
      diagnostics.push(`Your weekly volume jumped up by +${volChange}%. Bumping your workload that fast will make you feel beat up rather than building muscle.`);
      prescriptions.push('Keep your volume the same next week so your joints and muscles have time to adapt.');
    } else if (volChange >= 5 && volChange <= 15) {
      diagnostics.push(`Volume increase was right in the sweet spot (+${volChange}%). You are making steady, sustainable gains!`);
      prescriptions.push('Keep progressing your main lifts gradually while keeping your form clean.');
    } else {
      diagnostics.push(`Workload was steady (${volChange >= 0 ? '+' : ''}${volChange}%), keeping you strong without burning you out.`);
      prescriptions.push('If you feel fresh and energetic, add 1 extra working set on your main lift next week.');
    }

    if (selectedLift !== 'all') {
      diagnostics.push(`${selectedLift} focus: completed ${m.totalSets} working sets with top strength at ${m.peak1RM}kg.`);
    } else {
      diagnostics.push(`Work sets done: Bench (${m.benchSets}), Squat (${m.squatSets}), Deadlift (${m.deadliftSets}), Accessories (${m.accessoriesSets}).`);
    }

    return {
      level: 'microcycle',
      targetName: m.label || `Microcycle ${m.index}`,
      selectedLift,
      status,
      statusColor,
      score,
      summary: `Week ${m.index}: ${m.workoutDaysCount} workouts done, totaling ${(m.totalVolume / 1000).toFixed(1)}k kg volume across ${m.totalSets} sets. Top ${liftLabel} strength at ${m.peak1RM}kg.`,
      diagnostics,
      prescriptions,
      metricsHighlights: [
        { label: 'Weekly Volume', value: `${(m.totalVolume / 1000).toFixed(1)}k kg` },
        { label: 'Total Sets', value: `${m.totalSets}` },
        { label: 'Top Max', value: `${m.peak1RM} kg` },
        { label: 'Volume Change', value: `${volChange >= 0 ? '+' : ''}${volChange}%` },
      ],
      isOfflineHeuristic: true,
      timestamp,
    };
  }

  if (level === 'mesocycle') {
    const meso = metrics as CalculatedMesocycleMetrics;
    const phase = meso.phaseKey || meta?.phaseKey || 'General';
    let status: AIAnalysisReport['status'] = 'Optimal Adaptation';
    let statusColor = '#10b981';
    let score = 88;
    const diagnostics: string[] = [];
    const prescriptions: string[] = [];

    // Phase-specific coaching logic (Peaking vs Hypertrophy vs Strength)
    if (phase === 'Peaking') {
      if (meso.volumeProgressionRatePct > 15) {
        status = 'Fatigue Accumulating';
        statusColor = '#f59e0b';
        score = 72;
        diagnostics.push(
          `Your ${liftLabel} volume grew +${meso.volumeProgressionRatePct}% over ${meso.microcyclesCount} weeks. During a Peaking phase, doing this much volume makes you too tired to hit your heaviest 1RM max.`
        );
        diagnostics.push(
          `Your top single touched ${meso.peak1RM}kg (heaviest set: ${meso.peakWeight}kg). To smash a new personal record, you must shed this built-up fatigue right now.`
        );
        prescriptions.push(
          `Cut your back-off sets on ${liftLabel} by 40% to 50% next week. Focus only on 1–2 crisp, heavy singles or doubles with great speed.`
        );
        prescriptions.push(
          'Rest a full 3 to 5 minutes between your heaviest sets so you have 100% of your power ready.'
        );
      } else {
        status = 'Peak Performance';
        statusColor = '#8b5cf6';
        score = 94;
        diagnostics.push(
          `Your ${liftLabel} peaking is looking great: top strength hit ${meso.peak1RM}kg while keeping extra fatigue under control.`
        );
        diagncriptions:
        diagnostics.push(`You have managed your weekly workload well, keeping yourself fresh for heavy attempts.`);
        prescriptions.push('Hit your heavy singles with crisp form and confidence. Always keep 1 rep in the tank.');
      }
    } else if (phase === 'Hypertrophy') {
      diagnostics.push(
        `Your ${liftLabel} volume grew +${meso.volumeProgressionRatePct}% across ${meso.microcyclesCount} weeks. This gives your muscles the progressive overload they need to grow.`
      );
      diagnostics.push(
        `Averaged ${(meso.avgWeeklyVolume / 1000).toFixed(1)}k kg of volume per week with top strength holding at ${meso.peak1RM}kg.`
      );
      prescriptions.push('Add 1–2.5kg to your main working sets next week if you still have 1-2 reps left before failure.');
      prescriptions.push('Push your accessory exercises hard, stopping 1 or 2 reps before complete failure.');
    } else if (phase === 'Strength') {
      diagnostics.push(
        `Your ${liftLabel} working strength peaked at ${meso.peak1RM}kg with steady weekly training (${(meso.avgWeeklyVolume / 1000).toFixed(1)}k kg per week).`
      );
      diagnostics.push(`Your progression has been very consistent and sustainable without any reckless volume jumps.`);
      prescriptions.push('Stick to heavy sets of 3 to 5 reps. Focus on moving the bar fast and explosively on the way up.');
    } else if (meso.deloadRecommended) {
      status = 'Deload Triggered';
      statusColor = '#06b6d4';
      score = 70;
      diagnostics.push(meso.deloadReason || 'Your body is carrying too much fatigue and needs an easy week to recharge.');
      prescriptions.push('Take an easy deload week: cut your sets in half and keep the weights light to moderate (around 70-80%).');
      prescriptions.push('Get plenty of sleep and eat well so you return completely fresh for the next training cycle.');
    } else {
      diagnostics.push(`Your ${liftLabel} volume increased +${meso.volumeProgressionRatePct}% across ${meso.microcyclesCount} weeks.`);
      prescriptions.push('Keep up the steady progressive overload throughout the rest of this cycle.');
    }

    if (meta?.strategyNotes) {
      diagnostics.push(`Planned Strategy: "${meta.strategyNotes.slice(0, 90)}..." was tracked against execution.`);
    }

    return {
      level: 'mesocycle',
      targetName: meso.name,
      selectedLift,
      status,
      statusColor,
      score,
      summary: `${phase} block: ${liftLabel} reached peak e1RM of ${meso.peak1RM}kg (top set ${meso.peakWeight}kg) with avg weekly volume of ${(meso.avgWeeklyVolume / 1000).toFixed(1)}k kg across ${meso.microcyclesCount} microcycles.`,
      diagnostics,
      prescriptions,
      metricsHighlights: [
        { label: 'Phase', value: phase },
        { label: `${liftLabel} 1RM`, value: `${meso.peak1RM} kg` },
        { label: 'Vol Growth', value: `+${meso.volumeProgressionRatePct}%` },
        { label: 'ACWR Ratio', value: `${meso.acuteToChronicWorkloadRatio}` },
      ],
      isOfflineHeuristic: true,
      timestamp,
    };
  }

  // MACROCYCLE
  const mac = metrics as CalculatedMacrocycleMetrics;
  return {
    level: 'macrocycle',
    targetName: mac.name,
    selectedLift,
    status: 'Peak Performance',
    statusColor: '#8b5cf6',
    score: 92,
    summary: `Macrocycle overview: ${mac.mesocyclesCount} sequenced phases with cumulative ${liftLabel} volume of ${(mac.totalVolume / 1000).toFixed(1)}k kg and long-term progression of +${mac.longTermProgressionPct}%.`,
    diagnostics: [
      `Phase breakdown: ${Object.entries(mac.phasesDistribution).map(([k, v]) => `${k} (${v} blocks)`).join(', ') || 'Varied'}.`,
      `Peak strength expression topped at ${mac.peak1RM}kg across the entire periodised timeline.`,
    ],
    prescriptions: [
      'Keep your training phases balanced: start with building muscle (Hypertrophy), then move to heavy weights (Strength), and finish by testing your top max (Peaking).',
      'Pay attention to how your joints and tendons feel before jumping into higher volume in your next block.',
    ],
    metricsHighlights: [
      { label: 'Total Mesos', value: `${mac.mesocyclesCount}` },
      { label: 'Peak 1RM', value: `${mac.peak1RM} kg` },
      { label: 'Total Vol', value: `${(mac.totalVolume / 1000).toFixed(1)}k kg` },
      { label: 'Long Gain', value: `+${mac.longTermProgressionPct}%` },
    ],
    isOfflineHeuristic: true,
    timestamp,
  };
}
