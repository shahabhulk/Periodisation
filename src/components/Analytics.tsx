import React, { useState, useEffect, useMemo } from 'react';
import type { WorkoutEntry, PREntry } from '../types/workout';
import { extractPRs, formatDateDMY } from '../utils/workoutUtils';
import {
  fetchLyftaExerciseProgress,
  type LyftaExerciseProgressResponse,
  type LyftaExerciseProgressDataPoint,
} from '../services/lyftaApi';
import {
  Trophy,
  TrendingUp,
  Award,
  Zap,
  Calendar,
  Layers,
  Activity,
  RefreshCw,
  Sliders,
  Dumbbell,
  Database,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  ExternalLink,
  X,
} from 'lucide-react';
import { PeriodisationAnalysisView } from './PeriodisationAnalysisView';

export interface SetEntry {
  id: string;
  type: string;
  weight: string | number;
  reps: string | number;
  isPR?: boolean;
  equipment?: 'raw' | 'gear';
}

export interface LiftEntry {
  id: string;
  name: string;
  unit?: string;
  sets: SetEntry[];
  e1rm?: string | number;
  laterality?: 'bi' | 'uni';
}

export interface DayEntry {
  id: string;
  date: string;
  type: string;
  title: string;
  bodyTags?: string[];
  lifts: LiftEntry[];
  notes?: string;
  durationSeconds?: number;
}

export interface Microcycle {
  id: string;
  index?: number;
  label?: string | null;
  days: DayEntry[];
  note?: string;
}

export interface Mesocycle {
  id: string;
  macroId?: string;
  index?: number;
  name?: string;
  phaseKey?: string;
  micRange?: string;
  start?: string;
  end?: string;
  status?: string;
  microcycles: Microcycle[];
}

export interface Macrocycle {
  id: string;
  index: number;
  name: string;
  start: string;
}

interface AnalyticsProps {
  entries: WorkoutEntry[];
  mesocycles?: Mesocycle[];
  macrocycles?: Macrocycle[];
  today?: string;
  prLog?: PREntry[];
  onOpenDay?: (mesoId: string, micId: string, day: DayEntry) => void;
}

const PRESET_EXERCISES = [
  { id: 2, name: 'Bench Press', category: 'Chest' },
  { id: 1, name: 'Squat', category: 'Legs' },
  { id: 7, name: 'Deadlift', category: 'Back' },
  { id: 4, name: 'Dumbbell Bench Press', category: 'Chest' },
  { id: 5, name: 'Overhead Press', category: 'Shoulders' },
  { id: 6, name: 'Barbell Row', category: 'Back' },
  { id: 481569, name: 'Slingshot Bench Press', category: 'Chest' },
];

const DURATION_OPTIONS = [
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
  { label: '6 Months', value: 180 },
  { label: '1 Year', value: 365 },
  { label: '2 Years', value: 730 },
  { label: 'All Time', value: 9999 },
];

type MetricType = 'estimated_rm' | 'best_weight' | 'best_volume';

/**
 * Check if a set is a static hold / unrack / isometric overload set
 */
function isHoldOrSpecialSet(set: SetEntry & { note?: string; comments?: string }): boolean {
  if (!set) return false;
  const t = String(set.type || '').toLowerCase().trim();
  const note = String(set.note || (set as any).comments || '').toLowerCase().trim();
  const eq = String(set.equipment || '').toLowerCase().trim();
  const repsStr = String(set.reps || '').toLowerCase().trim();
  const weightStr = String(set.weight || '').toLowerCase().trim();

  const isHoldWord = (s: string) =>
    s.includes('hold') ||
    s.includes('static') ||
    s.includes('overload') ||
    s.includes('unrack') ||
    s.includes('isometric') ||
    s.includes('heavy hold') ||
    s.includes('pin hold');

  return (
    isHoldWord(t) ||
    isHoldWord(note) ||
    isHoldWord(eq) ||
    isHoldWord(repsStr) ||
    isHoldWord(weightStr)
  );
}

/**
 * Check if a set is equipped/gear or done with a slingshot
 */
function isGearOrSlingshotSet(set: SetEntry & { note?: string; comments?: string }): boolean {
  if (!set) return false;
  const eq = String(set.equipment || '').toLowerCase().trim();
  if (eq === 'gear') return true;
  const note = String(set.note || (set as any).comments || '').toLowerCase().trim();
  const t = String(set.type || '').toLowerCase().trim();
  const wStr = String(set.weight || '').toLowerCase().trim();
  const rStr = String(set.reps || '').toLowerCase().trim();

  const isGearWord = (s: string) =>
    s.includes('slingshot') ||
    s.includes('sling shot') ||
    s.includes('sling-shot') ||
    s.includes('gear') ||
    s.includes('equipped') ||
    s.includes('bench shirt') ||
    s.includes('shirt');

  return (
    isGearWord(eq) ||
    isGearWord(note) ||
    isGearWord(t) ||
    isGearWord(wStr) ||
    isGearWord(rStr)
  );
}

/**
 * Check if a set is a warm-up set
 */
function isWarmupSet(set: SetEntry): boolean {
  if (!set) return false;
  const t = (set.type || '').toLowerCase().trim();
  return t === 'warmup' || t === 'warm-up' || t === 'w' || t.includes('warm');
}

/**
 * Robust helper to extract weight and reps from workout/PR text strings
 * Excludes static holds (e.g. "140kg hold") unless explicitly targeting a hold exercise
 * Excludes slingshot / equipped sets when targeting raw lifts
 */
function parseWeightAndReps(
  text: string,
  isHoldTarget = false,
  isSlingshotTarget = false
): { weight: number; reps: number } | null {
  if (!text || typeof text !== 'string') return null;

  // Split text by delimiters like commas, pluses, pipes, or newlines to evaluate phrases independently
  const phrases = text.split(/[,+|\n]/);
  let maxW = 0;
  let bestR = 1;

  for (const rawPhrase of phrases) {
    const pLow = rawPhrase.toLowerCase();

    // Skip phrase if it represents a static hold/overload set when not targeting holds
    if (
      !isHoldTarget &&
      (pLow.includes('hold') ||
        pLow.includes('static') ||
        pLow.includes('unrack') ||
        pLow.includes('overload') ||
        pLow.includes('isometric'))
    ) {
      continue;
    }

    // Skip phrase if it represents slingshot / gear when not targeting slingshot
    const hasSlingshot =
      pLow.includes('slingshot') ||
      pLow.includes('sling shot') ||
      pLow.includes('sling-shot') ||
      pLow.includes('gear') ||
      pLow.includes('equipped');
    if (!isSlingshotTarget && hasSlingshot) {
      continue;
    }

    // Pattern A: 120x3 or 120X3 or 120 x 3
    const xMatch = rawPhrase.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(\d+)/);
    if (xMatch) {
      const w = parseFloat(xMatch[1]);
      const r = parseInt(xMatch[2], 10);
      if (w > 0 && w <= 500 && r > 0 && r <= 100) {
        if (w > maxW || (w === maxW && r > bestR)) {
          maxW = w;
          bestR = r;
        }
      }
    } else {
      // Pattern B: 120kg or 130 kg
      const kgMatch = rawPhrase.match(/(\d+(?:\.\d+)?)\s*kg/i);
      if (kgMatch) {
        const w = parseFloat(kgMatch[1]);
        if (w > 0 && w <= 500) {
          if (w > maxW) {
            maxW = w;
            bestR = 1;
          }
        }
      }
    }
  }

  if (maxW > 0) {
    return { weight: maxW, reps: bestR };
  }
  return null;
}

export const Analytics: React.FC<AnalyticsProps> = ({
  entries,
  mesocycles = [],
  macrocycles = [],
  today = new Date().toISOString().slice(0, 10),
  prLog = [],
  onOpenDay,
}) => {
  const prRecords = useMemo(() => extractPRs(entries), [entries]);

  // View Mode: 'lifts' (Individual Lift Trajectory) vs 'periodisation' (Macro / Meso / Microcycle)
  const [analyticsViewType, setAnalyticsViewType] = useState<'lifts' | 'periodisation'>('lifts');

  // Exercise selection state
  const [selectedExerciseId, setSelectedExerciseId] = useState<number>(2); // Default: Bench Press (ID 2)
  const [selectedCustomName, setSelectedCustomName] = useState<string>('Bench Press');
  const [duration, setDuration] = useState<number>(365); // Default: 365 days
  const [activeMetric, setActiveMetric] = useState<MetricType | 'all'>('all');
  const [show1RM, setShow1RM] = useState<boolean>(true);
  const [showBestWeight, setShowBestWeight] = useState<boolean>(true);
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progressResponse, setProgressResponse] = useState<LyftaExerciseProgressResponse | null>(null);

  // Interactive Selected Node State for Chart Scrubbing & HUD Inspection
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Viewing Session Details Modal State
  const [viewingSessionDate, setViewingSessionDate] = useState<string | null>(null);

  // Extract all unique lift names recorded in the user's app
  const appLiftNames = useMemo(() => {
    const names = new Set<string>();
    PRESET_EXERCISES.forEach((p) => names.add(p.name));

    // From mesocycles
    for (const meso of mesocycles) {
      for (const micro of meso.microcycles || []) {
        for (const day of micro.days || []) {
          for (const lift of day.lifts || []) {
            if (lift.name && lift.name.trim()) {
              names.add(lift.name.trim());
              if (lift.sets && lift.sets.some((s) => isGearOrSlingshotSet(s))) {
                names.add('Slingshot Bench Press');
              }
            }
          }
        }
      }
    }

    // From prLog
    for (const pr of prLog) {
      if (pr.lift && pr.lift.trim()) {
        names.add(pr.lift.trim());
      }
    }

    // From PR records
    for (const pr of prRecords) {
      if (pr.exercise) names.add(pr.exercise);
    }

    return Array.from(names);
  }, [mesocycles, prLog, prRecords]);

  // Selected exercise info
  const currentExercise = useMemo(() => {
    const preset = PRESET_EXERCISES.find((e) => e.id === selectedExerciseId);
    if (preset) return preset;
    return {
      id: selectedExerciseId,
      name: selectedCustomName || `Exercise #${selectedExerciseId}`,
      category: 'Custom',
    };
  }, [selectedExerciseId, selectedCustomName]);

  // Fetch progress status from GET /api/v1/exercises/progress
  const loadProgress = async () => {
    setIsLoading(true);
    try {
      const res = await fetchLyftaExerciseProgress({
        exerciseId: selectedExerciseId,
        duration: duration,
      });
      setProgressResponse(res);
    } catch (err) {
      console.error('Failed to load Lyfta progress:', err);
      setProgressResponse(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, [selectedExerciseId, duration]);

  // Calculate lift progress strictly from data entered in the user's new app
  const appLiftPoints = useMemo(() => {
    const mapByDate = new Map<
      string,
      { weight: number; reps: number; volume: number; source: string }
    >();

    const searchLow = currentExercise.name.toLowerCase().trim();
    const isTargetHold = searchLow.includes('hold') || searchLow.includes('static');
    const isTargetSlingshot =
      searchLow.includes('slingshot') ||
      searchLow.includes('sling shot') ||
      searchLow.includes('sling-shot');

    // Strict Exercise Matcher preventing cross-contamination (e.g. Dumbbell Bench vs Barbell Bench vs Static Holds vs Slingshot)
    const matchesLift = (candidateName: string) => {
      if (!candidateName) return false;
      const n = candidateName.toLowerCase().trim();

      // If user is searching for a regular exercise (like Bench Press), exclude static hold lift names
      if (!isTargetHold) {
        if (n.includes('hold') || n.includes('static') || n.includes('unrack') || n.includes('overload')) {
          return false;
        }
      }

      // Check slingshot separation: Slingshot Bench Press vs Raw Bench Press
      const isCandidateSlingshot =
        n.includes('slingshot') ||
        n.includes('sling shot') ||
        n.includes('sling-shot');

      if (!isTargetSlingshot && isCandidateSlingshot) {
        return false;
      }
      if (isTargetSlingshot) {
        return isCandidateSlingshot && (n.includes('bench') || n.includes('press') || n === 'bp');
      }

      if (n === searchLow) return true;

      // Dumbbell Bench Press vs Barbell Bench Press
      if (searchLow.includes('dumbbell bench') || searchLow.includes('dumbell bench')) {
        return n.includes('dumbell') || n.includes('dumbbell') || n.includes('db bench');
      }

      if (searchLow === 'bench press' || searchLow === 'bench' || searchLow === 'barbell bench press') {
        // Exclude Dumbbell/DB Bench Press entries
        if (n.includes('dumbell') || n.includes('dumbbell') || n.includes('db')) {
          return false;
        }
        // Exclude Slingshot and non-flat bench press variations from standard raw bench press
        if (isCandidateSlingshot || n.includes('incline') || n.includes('decline')) {
          return false;
        }
        return n.includes('bench') || n === 'bp' || n.includes('barbell bench');
      }

      // Squat vs Leg Press / Hack Squat / Pistol Squat / Smith Machine
      if (searchLow === 'squat' || searchLow === 'barbell squat') {
        if (n.includes('pistol') || n.includes('hack') || n.includes('leg press') || n.includes('smith')) {
          return false;
        }
        return n.includes('squat');
      }

      // Deadlift vs RDL / Stiff Leg
      if (searchLow === 'deadlift' || searchLow === 'conventional deadlift') {
        if (n.includes('rdl') || n.includes('romanian') || n.includes('stiff')) {
          return false;
        }
        return n.includes('deadlift') || n === 'dl';
      }

      // Overhead Press vs Bench Press
      if (searchLow.includes('overhead press') || searchLow === 'ohp' || searchLow.includes('military press')) {
        if (n.includes('bench')) return false;
        return n.includes('ohp') || n.includes('overhead') || n.includes('military') || n.includes('shoulder press');
      }

      // Barbell Row vs Dumbbell Row
      if (searchLow.includes('barbell row')) {
        if (n.includes('dumbell') || n.includes('dumbbell') || n.includes('db')) return false;
        return n.includes('row');
      }

      return n.includes(searchLow) || searchLow.includes(n);
    };

    // 1. Process active app mesocycle logs (Day Lifts and Sets)
    for (const meso of mesocycles) {
      for (const micro of meso.microcycles || []) {
        for (const day of micro.days || []) {
          if (!day.date || !day.lifts) continue;
          
          let dayExerciseBestW = 0;
          let dayExerciseBestR = 1;
          let dayExerciseVolume = 0;
          let hasMatchingLift = false;

          for (const lift of day.lifts) {
            if (!lift.name || !matchesLift(lift.name)) continue;

            const liftNameLow = lift.name.toLowerCase();
            if (
              !isTargetHold &&
              (liftNameLow.includes('hold') ||
                liftNameLow.includes('static') ||
                liftNameLow.includes('unrack') ||
                liftNameLow.includes('overload') ||
                liftNameLow.includes('isometric'))
            ) {
              continue;
            }

            const isLiftSlingshot =
              liftNameLow.includes('slingshot') ||
              liftNameLow.includes('sling shot') ||
              liftNameLow.includes('sling-shot');

            if (!isTargetSlingshot && isLiftSlingshot) {
              continue;
            }

            const setsToFilter = lift.sets || [];
            // Filter out static hold/overload sets for dynamic exercise tracking
            let validSets = isTargetHold
              ? setsToFilter
              : setsToFilter.filter((s) => !isHoldOrSpecialSet(s));

            // Exclude gear sets ONLY if user explicitly requested a "Raw" target
            const isTargetExplicitRaw = searchLow.includes('(raw)') || searchLow.includes(' raw');
            if (isTargetExplicitRaw) {
              validSets = validSets.filter((s) => !isGearOrSlingshotSet(s));
            } else if (isTargetSlingshot) {
              // If targeting Slingshot Bench Press, include all sets if lift is explicitly Slingshot, or only gear/slingshot sets
              if (!isLiftSlingshot) {
                validSets = validSets.filter((s) => isGearOrSlingshotSet(s));
              }
            }

            if (validSets.length === 0) continue;

            hasMatchingLift = true;

            // Prefer working sets over warmup sets for best weight
            const workingSets = validSets.filter((s) => !isWarmupSet(s));
            const setsForBestWeight = workingSets.length > 0 ? workingSets : validSets;

            for (const s of validSets) {
              const w = typeof s.weight === 'number' ? s.weight : parseFloat(String(s.weight)) || 0;
              const r = typeof s.reps === 'number' ? s.reps : parseInt(String(s.reps), 10) || 1;
              if (w > 0) {
                // EXERCISE-SPECIFIC VOLUME: Sum volume only from sets of this specific exercise
                dayExerciseVolume += w * r;
              }
            }

            for (const s of setsForBestWeight) {
              const w = typeof s.weight === 'number' ? s.weight : parseFloat(String(s.weight)) || 0;
              const r = typeof s.reps === 'number' ? s.reps : parseInt(String(s.reps), 10) || 1;
              if (w > 0) {
                if (w > dayExerciseBestW || (w === dayExerciseBestW && r > dayExerciseBestR)) {
                  dayExerciseBestW = w;
                  dayExerciseBestR = r;
                }
              }
            }
          }

          if (hasMatchingLift && dayExerciseBestW > 0) {
            const existing = mapByDate.get(day.date);
            if (!existing || dayExerciseBestW > existing.weight) {
              mapByDate.set(day.date, {
                weight: dayExerciseBestW,
                reps: dayExerciseBestR,
                volume: dayExerciseVolume,
                source: isTargetSlingshot ? 'Slingshot Mesocycle Set' : 'App Mesocycle Set',
              });
            } else if (existing && dayExerciseBestW === existing.weight) {
              mapByDate.set(day.date, {
                ...existing,
                volume: Math.max(existing.volume, dayExerciseVolume),
              });
            }
          }
        }
      }
    }

    // 2. Process prLog entries
    for (const pr of prLog) {
      if (!pr.date || !pr.lift) continue;
      const prNote = (pr.note || '').toLowerCase();
      const prLift = pr.lift.toLowerCase();
      if (
        !isTargetHold &&
        (prNote.includes('hold') ||
          prNote.includes('static') ||
          prNote.includes('unrack') ||
          prNote.includes('overload') ||
          prNote.includes('isometric') ||
          prLift.includes('hold') ||
          prLift.includes('static'))
      ) {
        continue;
      }

      const isPRSlingshot =
        prNote.includes('slingshot') ||
        prNote.includes('sling shot') ||
        prNote.includes('sling-shot') ||
        prNote.includes('gear') ||
        prLift.includes('slingshot') ||
        prLift.includes('sling shot') ||
        prLift.includes('sling-shot');

      if (!isTargetSlingshot && isPRSlingshot) {
        continue;
      }

      if (matchesLift(pr.lift)) {
        const w = typeof pr.weight === 'number' ? pr.weight : parseFloat(String(pr.weight)) || 0;
        const r = typeof pr.reps === 'number' ? pr.reps : parseInt(String(pr.reps), 10) || 1;
        if (w > 0) {
          const existing = mapByDate.get(pr.date);
          if (!existing || w > existing.weight) {
            mapByDate.set(pr.date, {
              weight: w,
              reps: r,
              volume: existing?.volume || w * r * 3,
              source: isTargetSlingshot ? 'Slingshot PR Log' : 'PR Log Entry',
            });
          }
        }
      }
    }

    // 3. Process stored workoutEntries and PR text strings
    for (const entry of entries) {
      if (!entry.date) continue;
      const workoutText = entry.workout || '';
      const prText = entry.pr || '';

      const matchInWorkout = matchesLift(workoutText);
      const matchInPR = matchesLift(prText);

      if (matchInWorkout || matchInPR) {
        const parsedPR = parseWeightAndReps(prText, isTargetHold, isTargetSlingshot);
        const parsedWorkout = parseWeightAndReps(workoutText, isTargetHold, isTargetSlingshot);
        const parsed = parsedPR || parsedWorkout;

        if (parsed && parsed.weight > 0) {
          const existing = mapByDate.get(entry.date);
          if (!existing) {
            mapByDate.set(entry.date, {
              weight: parsed.weight,
              reps: parsed.reps,
              volume: parsed.weight * parsed.reps * 3,
              source: isTargetSlingshot ? 'Slingshot Workout Log' : 'Workout History Log',
            });
          } else if (parsed.weight > existing.weight) {
            mapByDate.set(entry.date, {
              ...existing,
              weight: parsed.weight,
              reps: parsed.reps,
            });
          }
        }
      }
    }

    // Filter points by duration
    const today = new Date();
    const cutoffDate = new Date(today.getTime() - duration * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    const resultPoints: (LyftaExerciseProgressDataPoint & { source?: string })[] = [];
    mapByDate.forEach((val, dateStr) => {
      if (duration < 3500 && dateStr < cutoffStr) return;
      const est1RM = Math.round(val.weight * (1 + val.reps / 30));
      resultPoints.push({
        date: dateStr,
        best_weight: val.weight,
        best_reps: val.reps,
        best_volume: val.volume,
        estimated_rm: String(est1RM),
        source: val.source,
      });
    });

    return resultPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [currentExercise.name, mesocycles, prLog, entries, duration]);

  // Data points strictly from user's app logs
  const rawPoints = appLiftPoints;

  // Chronologically sorted data points
  const points = useMemo(() => {
    return [...rawPoints].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [rawPoints]);

  // Keep selected index in bounds whenever points change
  useEffect(() => {
    if (points.length > 0) {
      setSelectedIndex(points.length - 1);
    } else {
      setSelectedIndex(null);
    }
  }, [points.length, selectedExerciseId]);

  const weightUnit = progressResponse?.weight_unit || 'kg';

  // Selected Session Workout Detail calculation for viewing complete workout done
  const viewingSessionDetail = useMemo(() => {
    if (!viewingSessionDate) return null;

    let mesoId: string | undefined;
    let micId: string | undefined;
    let foundDay: DayEntry | undefined;
    let foundMesoName: string | undefined;
    let foundMicroName: string | undefined;

    for (const meso of mesocycles) {
      for (const mc of meso.microcycles || []) {
        const d = (mc.days || []).find((day) => day.date === viewingSessionDate);
        if (d) {
          mesoId = meso.id;
          micId = mc.id;
          foundDay = d;
          foundMesoName = meso.name;
          foundMicroName = mc.label || (mc.index !== undefined ? `Microcycle ${mc.index}` : 'Microcycle');
          break;
        }
      }
      if (foundDay) break;
    }

    const workoutEntry = entries.find((e) => e.date === viewingSessionDate || e.id === viewingSessionDate);
    const prEntries = prLog.filter((p) => p.date === viewingSessionDate);
    const pt = points.find((p) => p.date === viewingSessionDate);

    const title =
      foundDay?.title && foundDay.title.trim()
        ? foundDay.title
        : workoutEntry?.workout && workoutEntry.workout.trim()
        ? workoutEntry.workout
        : `${currentExercise.name} Session`;

    const prText =
      workoutEntry?.pr && workoutEntry.pr.trim()
        ? workoutEntry.pr
        : prEntries.length > 0
        ? prEntries.map((p) => `${p.lift}: ${p.weight}${p.unit || 'kg'} × ${p.reps}${p.note ? ` (${p.note})` : ''}`).join(', ')
        : '';

    return {
      date: viewingSessionDate,
      displayDate: workoutEntry?.displayDate || formatDateDMY(viewingSessionDate),
      source:
        pt?.source ||
        (foundDay?.lifts && foundDay.lifts.length > 0
          ? 'App Mesocycle Set'
          : workoutEntry
          ? 'Workout History Log'
          : 'App Workout Log'),
      title,
      workoutText: workoutEntry?.workout || '',
      prText,
      mesocycle: foundMesoName || workoutEntry?.mesocycle || '',
      microcycle: foundMicroName || workoutEntry?.microcycle || '',
      status: workoutEntry?.status || '',
      diet: workoutEntry?.diet || '',
      notes: foundDay?.notes || workoutEntry?.mesoNotes || '',
      lifts: foundDay?.lifts || [],
      bestWeight: pt?.best_weight || 0,
      bestReps: pt?.best_reps || 1,
      volume: pt?.best_volume || 0,
      estimatedRM: pt?.estimated_rm || 0,
      mesoId,
      micId,
      day: foundDay,
    };
  }, [viewingSessionDate, mesocycles, entries, prLog, points, currentExercise.name]);

  // Highlight Stats calculations
  const stats = useMemo(() => {
    if (points.length === 0) {
      return {
        peak1RM: 0,
        peak1RMDate: '—',
        bestWeight: 0,
        bestWeightReps: 0,
        bestWeightDate: '—',
        maxVolume: 0,
        totalSessions: 0,
      };
    }

    let peak1RM = 0;
    let peak1RMDate = '—';
    let bestWeight = 0;
    let bestWeightReps = 0;
    let bestWeightDate = '—';
    let maxVolume = 0;

    for (const p of points) {
      const rmNum = typeof p.estimated_rm === 'string' ? parseFloat(p.estimated_rm) : p.estimated_rm;
      if (rmNum > peak1RM) {
        peak1RM = rmNum;
        peak1RMDate = p.date;
      }
      if (p.best_weight > bestWeight) {
        bestWeight = p.best_weight;
        bestWeightReps = p.best_reps;
        bestWeightDate = p.date;
      }
      if (p.best_volume > maxVolume) {
        maxVolume = p.best_volume;
      }
    }

    return {
      peak1RM: Math.round(peak1RM),
      peak1RMDate,
      bestWeight,
      bestWeightReps,
      bestWeightDate,
      maxVolume,
      totalSessions: points.length,
    };
  }, [points]);

  // SVG Chart Geometry Calculations optimized for integrated dual-axis visualization
  const chartData = useMemo(() => {
    if (points.length === 0) {
      return {
        nodes: [],
        path1RM: '',
        pathWeight: '',
        pathVolume: '',
        minWeight: 0,
        maxWeight: 100,
        minVol: 0,
        maxVol: 1000,
        viewWidth: 600,
        viewHeight: 220,
        paddingLeft: 55,
        paddingRight: 55,
      };
    }

    const rmValues = points.map((p) =>
      typeof p.estimated_rm === 'string' ? parseFloat(p.estimated_rm) : p.estimated_rm
    );
    const weightValues = points.map((p) => p.best_weight);
    const volValues = points.map((p) => p.best_volume);

    // Left Y-Axis Domain (Weight / 1RM in kg)
    const allWeightVals = [...rmValues, ...weightValues];
    const minWRaw = Math.min(...allWeightVals);
    const maxWRaw = Math.max(...allWeightVals);
    const wPadding = (maxWRaw - minWRaw) * 0.15 || 10;
    const minWeight = Math.max(0, Math.floor(minWRaw - wPadding));
    const maxWeight = Math.ceil(maxWRaw + wPadding);

    // Right Y-Axis Domain (Exercise Volume in kg)
    const minVRaw = Math.min(...volValues);
    const maxVRaw = Math.max(...volValues);
    const vPadding = (maxVRaw - minVRaw) * 0.15 || 100;
    const minVol = Math.max(0, Math.floor(minVRaw - vPadding));
    const maxVol = Math.ceil(maxVRaw + vPadding);

    const viewWidth = isExpanded ? 800 : 600;
    const viewHeight = isExpanded ? 320 : 220;
    const paddingLeft = 55;
    const paddingRight = 55;
    const paddingTop = 25;
    const paddingBottom = 30;
    const chartWidth = viewWidth - (paddingLeft + paddingRight);
    const chartHeight = viewHeight - (paddingTop + paddingBottom);

    const nodes = points.map((p, i) => {
      const x =
        points.length === 1
          ? viewWidth / 2
          : paddingLeft + (i / (points.length - 1)) * chartWidth;

      const rmVal = rmValues[i];
      const wVal = weightValues[i];
      const vVal = volValues[i];

      const rmRatio = (rmVal - minWeight) / (maxWeight - minWeight || 1);
      const y1RM = viewHeight - paddingBottom - rmRatio * chartHeight;

      const wRatio = (wVal - minWeight) / (maxWeight - minWeight || 1);
      const yWeight = viewHeight - paddingBottom - wRatio * chartHeight;

      const vRatio = (vVal - minVol) / (maxVol - minVol || 1);
      const yVolume = viewHeight - paddingBottom - vRatio * chartHeight;

      const isPeak1RM = rmVal === Math.max(...rmValues);
      const isPeakWeight = wVal === Math.max(...weightValues);
      const isPeakVol = vVal === Math.max(...volValues);
      const isStartOrEnd = i === 0 || i === points.length - 1;

      return {
        index: i,
        x,
        y1RM,
        yWeight,
        yVolume,
        rmVal,
        wVal,
        vVal,
        date: p.date,
        isPeak1RM,
        isPeakWeight,
        isPeakVol,
        isStartOrEnd,
        rawPoint: p,
      };
    });

    let path1RM = '';
    let pathWeight = '';
    let pathVolume = '';

    if (nodes.length > 0) {
      path1RM = `M ${nodes[0].x},${nodes[0].y1RM}`;
      pathWeight = `M ${nodes[0].x},${nodes[0].yWeight}`;
      pathVolume = `M ${nodes[0].x},${nodes[0].yVolume}`;

      for (let i = 1; i < nodes.length; i++) {
        path1RM += ` L ${nodes[i].x},${nodes[i].y1RM}`;
        pathWeight += ` L ${nodes[i].x},${nodes[i].yWeight}`;
        pathVolume += ` L ${nodes[i].x},${nodes[i].yVolume}`;
      }
    }

    return {
      nodes,
      path1RM,
      pathWeight,
      pathVolume,
      minWeight,
      maxWeight,
      minVol,
      maxVol,
      viewWidth,
      viewHeight,
      paddingLeft,
      paddingRight,
    };
  }, [points, isExpanded]);

  const activeNode = selectedIndex !== null && chartData.nodes[selectedIndex] ? chartData.nodes[selectedIndex] : null;

  const handleSelectPreset = (preset: typeof PRESET_EXERCISES[0]) => {
    setSelectedExerciseId(preset.id);
    setSelectedCustomName(preset.name);
  };

  const handlePrevSession = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleNextSession = () => {
    if (selectedIndex !== null && selectedIndex < points.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  // Interactive Touch/Pointer Scrubbing across the SVG canvas
  const handlePointerScrub = (e: React.PointerEvent<SVGSVGElement>) => {
    if (chartData.nodes.length === 0) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const touchX = e.clientX - rect.left;
    const relativeX = (touchX / rect.width) * chartData.viewWidth;

    let closestIdx = 0;
    let minDiff = Infinity;
    chartData.nodes.forEach((node, idx) => {
      const diff = Math.abs(node.x - relativeX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    setSelectedIndex(closestIdx);
  };

  return (
    <div className="analytics-container">
      <style>{`
        .analytics-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding-bottom: 90px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #ffffff;
        }

        .analytics-banner {
          background: linear-gradient(135deg, rgba(159, 18, 57, 0.3), rgba(15, 23, 42, 0.95), rgba(120, 53, 15, 0.2));
          border: 1px solid rgba(244, 63, 94, 0.3);
          border-radius: 18px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }
        @media (min-width: 640px) {
          .analytics-banner {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }

        .banner-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .banner-icon-box {
          background: rgba(244, 63, 94, 0.2);
          color: #f43f5e;
          border: 1px solid rgba(244, 63, 94, 0.3);
          border-radius: 14px;
          padding: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .banner-title-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .banner-title {
          font-size: 20px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: 0.3px;
        }

        .banner-tag {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          padding: 2px 8px;
          border-radius: 9999px;
          background: #1e293b;
          color: #cbd5e1;
          border: 1px solid #334155;
        }

        .banner-sub {
          font-size: 12px;
          color: #cbd5e1;
          margin-top: 3px;
        }

        .banner-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .refresh-btn {
          background: rgba(30, 41, 59, 0.8);
          color: #cbd5e1;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }
        .refresh-btn:hover {
          background: #334155;
          color: #ffffff;
        }

        .status-badge-app {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 12px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .control-panel {
          background: #141c2b;
          border: 1px solid #243046;
          border-radius: 18px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .control-row {
          display: flex;
          flex-direction: column;
          gap: 16px;
          border-bottom: 1px solid #1e293b;
          padding-bottom: 16px;
        }
        @media (min-width: 768px) {
          .control-row {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }

        .control-group-title {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
        }

        .chip-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .chip-btn {
          background: #1e293b;
          color: #cbd5e1;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .chip-btn:hover {
          background: #334155;
          color: #ffffff;
        }
        .chip-btn-active {
          background: #f43f5e !important;
          color: #ffffff !important;
          border-color: #f43f5e !important;
          box-shadow: 0 4px 14px rgba(244, 63, 94, 0.35);
        }

        .duration-container {
          display: flex;
          align-items: center;
          gap: 4px;
          background: #0f172a;
          border: 1px solid #1e293b;
          padding: 4px;
          border-radius: 12px;
        }

        .duration-pill {
          background: none;
          border: none;
          color: #94a3b8;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .duration-pill-active {
          background: #f59e0b;
          color: #0f172a;
        }

        .metric-toggle-row {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        @media (min-width: 640px) {
          .metric-toggle-row {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }

        .id-input-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .select-input {
          padding: 6px 12px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 8px;
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          outline: none;
        }

        .metric-tabs {
          display: flex;
          align-items: center;
          gap: 4px;
          background: #0f172a;
          border: 1px solid #1e293b;
          padding: 4px;
          border-radius: 12px;
        }

        .metric-tab-btn {
          background: none;
          border: none;
          color: #94a3b8;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .metric-tab-btn-active {
          background: #f43f5e;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(244, 63, 94, 0.4);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }
        @media (min-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        .stat-card {
          background: #141c2b;
          border: 1px solid #243046;
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }

        .stat-card-title {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .stat-card-val {
          font-size: 22px;
          font-weight: 900;
          color: #ffffff;
        }

        .stat-card-sub {
          font-size: 10px;
          color: #64748b;
        }

        .chart-card {
          background: #141c2b;
          border: 1px solid #243046;
          border-radius: 18px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          transition: all 0.3s ease;
        }

        .chart-header {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        @media (min-width: 640px) {
          .chart-header {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }

        .chart-title {
          font-size: 16px;
          font-weight: 800;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Interactive Session HUD Card */
        .session-hud-card {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98));
          border: 1px solid rgba(244, 63, 94, 0.4);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
        }

        .hud-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 8px;
        }

        .hud-date-title {
          font-size: 14px;
          font-weight: 800;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .hud-badge {
          font-size: 11px;
          font-weight: 800;
          padding: 3px 10px;
          border-radius: 9999px;
          background: rgba(245, 158, 11, 0.2);
          color: #fde047;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .hud-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .hud-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .hud-cell-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #94a3b8;
        }

        .hud-cell-val {
          font-size: 16px;
          font-weight: 900;
          color: #ffffff;
        }

        .hud-cell-highlight {
          color: #f43f5e;
        }

        .session-hud-card.clickable {
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .session-hud-card.clickable:hover {
          border-color: rgba(244, 63, 94, 0.7);
          box-shadow: 0 8px 28px rgba(244, 63, 94, 0.2);
        }
        .hud-action-pill-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(244, 63, 94, 0.2);
          color: #fda4af;
          border: 1px solid rgba(244, 63, 94, 0.4);
          padding: 4px 12px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .hud-action-pill-btn:hover {
          background: #f43f5e;
          color: #ffffff;
          box-shadow: 0 0 12px rgba(244, 63, 94, 0.5);
        }
        .clickable-table-row {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .clickable-table-row:hover {
          background: rgba(244, 63, 94, 0.12) !important;
        }
        .session-date-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .session-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.82);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .session-modal-content {
          background: #141c2b;
          border: 1px solid rgba(244, 63, 94, 0.35);
          border-radius: 20px;
          width: 100%;
          max-width: 540px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75);
          overflow: hidden;
          animation: modalFadeIn 0.2s ease-out;
        }
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .session-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(15, 23, 42, 0.6);
        }
        .session-modal-icon-badge {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: rgba(244, 63, 94, 0.15);
          border: 1px solid rgba(244, 63, 94, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .session-modal-title {
          font-size: 16px;
          font-weight: 800;
          color: #ffffff;
        }
        .session-source-badge {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          background: rgba(245, 158, 11, 0.2);
          color: #fde047;
          border: 1px solid rgba(245, 158, 11, 0.35);
          padding: 2px 8px;
          border-radius: 9999px;
        }
        .session-phase-badge {
          font-size: 10px;
          font-weight: 700;
          background: rgba(56, 189, 248, 0.15);
          color: #7dd3fc;
          border: 1px solid rgba(56, 189, 248, 0.25);
          padding: 2px 8px;
          border-radius: 9999px;
        }
        .session-modal-close-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 6px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .session-modal-close-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.1);
        }
        .session-stats-bar {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          padding: 12px 20px;
          background: rgba(10, 15, 26, 0.6);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .session-stat-box {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .session-stat-sub {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: #94a3b8;
        }
        .session-stat-number {
          font-size: 15px;
          font-weight: 900;
          color: #ffffff;
        }
        .session-modal-body {
          padding: 18px 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .workout-done-card {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(15, 23, 42, 0.7));
          border: 1px solid rgba(16, 185, 129, 0.35);
          border-radius: 14px;
          padding: 14px;
        }
        .workout-card-label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #34d399;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
        }
        .workout-done-text {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          line-height: 1.4;
        }
        .pr-milestone-card {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.14), rgba(15, 23, 42, 0.7));
          border: 1px solid rgba(245, 158, 11, 0.4);
          border-radius: 14px;
          padding: 14px;
        }
        .pr-card-label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #fbbf24;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
        }
        .pr-done-text {
          font-size: 15px;
          font-weight: 800;
          color: #fef08a;
          line-height: 1.4;
        }
        .section-subtitle {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #94a3b8;
          margin-bottom: 8px;
        }
        .lift-card-item {
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 10px 12px;
        }
        .set-pill-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 12px;
        }
        .set-tag {
          font-size: 10px;
          font-weight: 800;
          color: #94a3b8;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          padding: 1px 5px;
        }
        .pill-gear {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          color: #fca5a5;
          background: rgba(244, 63, 94, 0.2);
          padding: 1px 5px;
          border-radius: 4px;
        }
        .pill-raw {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          color: #93c5fd;
          background: rgba(59, 130, 246, 0.2);
          padding: 1px 5px;
          border-radius: 4px;
        }
        .meta-card {
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 10px 14px;
        }
        .meta-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          color: #94a3b8;
          display: block;
          margin-bottom: 2px;
        }
        .meta-text {
          font-size: 13px;
          color: #cbd5e1;
          line-height: 1.4;
        }
        .session-modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 14px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(15, 23, 42, 0.6);
        }
        .btn-open-planner {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f43f5e;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .btn-open-planner:hover {
          background: #e11d48;
        }
        .btn-modal-close {
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-modal-close:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
        }

        .stepper-btn-group {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .stepper-btn {
          background: #1e293b;
          color: #cbd5e1;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s ease;
        }
        .stepper-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .stepper-btn:hover:not(:disabled) {
          background: #334155;
          color: #ffffff;
        }

        .table-card {
          background: #141c2b;
          border: 1px solid #243046;
          border-radius: 18px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .table-wrapper {
          overflow-x: auto;
          width: 100%;
        }

        .custom-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          text-align: left;
        }

        .custom-table th {
          padding: 12px 14px;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          border-bottom: 1px solid #1e293b;
        }

        .custom-table td {
          padding: 12px 14px;
          border-bottom: 1px solid #192334;
          color: #cbd5e1;
        }

        .custom-table tr:hover td {
          background: rgba(255, 255, 255, 0.03);
        }

        .badge-pill {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 800;
        }
      `}</style>

      {/* Top Banner & Data Source Status */}
      <div className="analytics-banner">
        <div className="banner-left">
          <div className="banner-icon-box">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="banner-title-group">
              <span className="banner-title">Lift Progress Trajectory</span>
              <span className="banner-tag">App Data Only</span>
            </div>
            <p className="banner-sub">
              Empirical progress tracking calculated strictly from data entered in your app
            </p>
          </div>
        </div>

        <div className="banner-actions">
          <button onClick={loadProgress} disabled={isLoading} className="refresh-btn">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} style={{ color: '#f43f5e' }} />
            <span>Recalculate Logs</span>
          </button>

          <div className="status-badge-app">
            <Database className="w-4 h-4 text-amber-400" />
            <span>App Data Log (Iron Ledger) ({weightUnit})</span>
          </div>
        </div>
      </div>

      {/* Top Mode Switcher: Lift Trajectory vs Macro/Meso/Micro Periodisation */}
      <div style={{ display: 'flex', alignItems: 'center', background: '#0b0f17', border: '1px solid #232d40', borderRadius: '12px', padding: '4px', gap: '4px' }}>
        <button
          type="button"
          onClick={() => setAnalyticsViewType('lifts')}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '9px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            background: analyticsViewType === 'lifts' ? '#1e293b' : 'transparent',
            color: analyticsViewType === 'lifts' ? '#ffffff' : '#94a3b8',
            boxShadow: analyticsViewType === 'lifts' ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <TrendingUp size={15} style={{ color: analyticsViewType === 'lifts' ? '#f43f5e' : '#94a3b8' }} />
          <span>Individual Lift Trajectory</span>
        </button>

        <button
          type="button"
          onClick={() => setAnalyticsViewType('periodisation')}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '9px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            background: analyticsViewType === 'periodisation' ? '#1e293b' : 'transparent',
            color: analyticsViewType === 'periodisation' ? '#ffffff' : '#94a3b8',
            boxShadow: analyticsViewType === 'periodisation' ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <Layers size={15} style={{ color: analyticsViewType === 'periodisation' ? '#38bdf8' : '#94a3b8' }} />
          <span>Macro / Meso / Microcycle Periodisation</span>
        </button>
      </div>

      {analyticsViewType === 'periodisation' ? (
        <PeriodisationAnalysisView
          macrocycles={macrocycles as any}
          mesocycles={mesocycles as any}
          today={today}
          onDayClick={onOpenDay}
        />
      ) : (
        <>
          {/* Control Bar: Lift Selector, Duration & Metric View */}
      <div className="control-panel">
        <div className="control-row">
          {/* Preset Exercise Chips */}
          <div>
            <div className="control-group-title">
              <Dumbbell className="w-3.5 h-3.5" style={{ color: '#f43f5e' }} /> Select Lift Target
            </div>
            <div className="chip-group">
              {PRESET_EXERCISES.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => handleSelectPreset(ex)}
                  className={`chip-btn ${selectedCustomName.toLowerCase() === ex.name.toLowerCase() ? 'chip-btn-active' : ''}`}
                >
                  {ex.name}
                </button>
              ))}
            </div>
          </div>

          {/* Duration Chips */}
          <div>
            <div className="control-group-title">
              <Calendar className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} /> Progress Timeframe
            </div>
            <div className="duration-container">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDuration(opt.value)}
                  className={`duration-pill ${duration === opt.value ? 'duration-pill-active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom Exercise Selector & Metric View Toggle */}
        <div className="metric-toggle-row">
          <div className="id-input-group">
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Recorded Lifts:</span>
            <select
              value={selectedCustomName}
              onChange={(e) => {
                setSelectedCustomName(e.target.value);
                const foundPreset = PRESET_EXERCISES.find((p) => p.name.toLowerCase() === e.target.value.toLowerCase());
                if (foundPreset) setSelectedExerciseId(foundPreset.id);
              }}
              className="select-input"
            >
              {appLiftNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <span
              style={{
                fontSize: '12px',
                fontWeight: '800',
                color: '#f43f5e',
                background: 'rgba(244, 63, 94, 0.1)',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(244, 63, 94, 0.2)',
              }}
            >
              {currentExercise.name}
            </span>
          </div>

          {/* Metric View Tabs */}
          <div className="id-input-group">
            <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sliders className="w-3.5 h-3.5" style={{ color: '#38bdf8' }} /> View Mode:
            </span>
            <div className="metric-tabs">
              <button
                onClick={() => {
                  setActiveMetric('all');
                  setShow1RM(true);
                  setShowBestWeight(true);
                  setShowVolume(true);
                }}
                className={`metric-tab-btn ${activeMetric === 'all' ? 'metric-tab-btn-active' : ''}`}
                style={activeMetric === 'all' ? { background: '#f43f5e', color: '#ffffff' } : {}}
              >
                All Integrated (3-in-1)
              </button>
              <button
                onClick={() => {
                  setActiveMetric('estimated_rm');
                  setShow1RM(true);
                  setShowBestWeight(false);
                  setShowVolume(false);
                }}
                className={`metric-tab-btn ${activeMetric === 'estimated_rm' ? 'metric-tab-btn-active' : ''}`}
                style={activeMetric === 'estimated_rm' ? { background: '#f43f5e', color: '#ffffff' } : {}}
              >
                Est. 1RM ({weightUnit})
              </button>
              <button
                onClick={() => {
                  setActiveMetric('best_weight');
                  setShow1RM(false);
                  setShowBestWeight(true);
                  setShowVolume(false);
                }}
                className={`metric-tab-btn ${activeMetric === 'best_weight' ? 'metric-tab-btn-active' : ''}`}
                style={activeMetric === 'best_weight' ? { background: '#38bdf8', color: '#0f172a' } : {}}
              >
                Best Weight ({weightUnit})
              </button>
              <button
                onClick={() => {
                  setActiveMetric('best_volume');
                  setShow1RM(false);
                  setShowBestWeight(false);
                  setShowVolume(true);
                }}
                className={`metric-tab-btn ${activeMetric === 'best_volume' ? 'metric-tab-btn-active' : ''}`}
                style={activeMetric === 'best_volume' ? { background: '#f59e0b', color: '#0f172a' } : {}}
              >
                Exercise Volume
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Highlights Cards */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderColor: 'rgba(244, 63, 94, 0.3)', background: 'linear-gradient(180deg, rgba(159, 18, 57, 0.2), #141c2b)' }}>
          <div className="stat-card-title">
            <span>Peak Est. 1RM</span>
            <Zap className="w-4 h-4 text-rose-400" />
          </div>
          <div className="stat-card-val">
            {stats.peak1RM} <span style={{ fontSize: '12px', color: '#f43f5e' }}>{weightUnit}</span>
          </div>
          <div className="stat-card-sub">Date: {formatDateDMY(stats.peak1RMDate)}</div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(56, 189, 248, 0.3)', background: 'linear-gradient(180deg, rgba(12, 74, 110, 0.2), #141c2b)' }}>
          <div className="stat-card-title">
            <span>Max Weight</span>
            <Award className="w-4 h-4 text-sky-400" />
          </div>
          <div className="stat-card-val">
            {stats.bestWeight} <span style={{ fontSize: '12px', color: '#38bdf8' }}>{weightUnit}</span>
            {stats.bestWeightReps ? <span style={{ fontSize: '12px', color: '#cbd5e1', marginLeft: '4px' }}>x{stats.bestWeightReps}</span> : null}
          </div>
          <div className="stat-card-sub">Date: {formatDateDMY(stats.bestWeightDate)}</div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)', background: 'linear-gradient(180deg, rgba(120, 53, 15, 0.2), #141c2b)' }}>
          <div className="stat-card-title">
            <span>Max Exercise Vol</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="stat-card-val">
            {stats.maxVolume.toLocaleString()} <span style={{ fontSize: '12px', color: '#f59e0b' }}>{weightUnit}</span>
          </div>
          <div className="stat-card-sub">Peak {currentExercise.name} load</div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'linear-gradient(180deg, rgba(6, 78, 59, 0.2), #141c2b)' }}>
          <div className="stat-card-title">
            <span>Logged Sessions</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="stat-card-val">
            {stats.totalSessions} <span style={{ fontSize: '12px', color: '#34d399' }}>sessions</span>
          </div>
          <div className="stat-card-sub">From App Logs ({duration > 3500 ? 'All Time' : `${duration} days`})</div>
        </div>
      </div>

      {/* Main Interactive Touch-Enabled Integrated SVG Chart */}
      <div className="chart-card">
        <div className="chart-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div className="chart-title">
              <TrendingUp className="w-5 h-5 text-rose-400" />
              <span>{currentExercise.name} Integrated Trajectory</span>
            </div>
            {/* Interactive Series Toggle Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
              <button
                onClick={() => setShow1RM(!show1RM)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  background: show1RM ? 'rgba(244, 63, 94, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                  color: show1RM ? '#f43f5e' : '#64748b',
                  border: `1px solid ${show1RM ? '#f43f5e' : '#334155'}`,
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e' }}></span>
                Est. 1RM
              </button>
              <button
                onClick={() => setShowBestWeight(!showBestWeight)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  background: showBestWeight ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                  color: showBestWeight ? '#38bdf8' : '#64748b',
                  border: `1px solid ${showBestWeight ? '#38bdf8' : '#334155'}`,
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }}></span>
                Best Weight
              </button>
              <button
                onClick={() => setShowVolume(!showVolume)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  background: showVolume ? 'rgba(245, 158, 11, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                  color: showVolume ? '#f59e0b' : '#64748b',
                  border: `1px solid ${showVolume ? '#f59e0b' : '#334155'}`,
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></span>
                Volume (Right Axis)
              </button>
            </div>
          </div>

          <div className="stepper-btn-group">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="stepper-btn"
              title={isExpanded ? 'Standard' : 'Expand Height'}
            >
              {isExpanded ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-amber-400" /> Standard
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-rose-400" /> Expand
                </>
              )}
            </button>
            <button
              onClick={handlePrevSession}
              disabled={selectedIndex === null || selectedIndex <= 0}
              className="stepper-btn"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button
              onClick={handleNextSession}
              disabled={selectedIndex === null || selectedIndex >= points.length - 1}
              className="stepper-btn"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ height: isExpanded ? '320px' : '220px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px' }}>
            <RefreshCw className="w-6 h-6 animate-spin text-rose-400" />
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Processing App Workout Logs...</span>
          </div>
        ) : points.length === 0 ? (
          <div style={{ height: isExpanded ? '320px' : '220px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px' }}>
            <Database className="w-8 h-8 text-amber-400" />
            <span style={{ fontSize: '14px', fontWeight: '600' }}>No workout logs recorded yet for {currentExercise.name} in this timeframe.</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Log a workout session in Home or Start a Workout to generate trajectory data.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Interactive Dual-Axis Integrated SVG Graph Canvas */}
            <div style={{ height: isExpanded ? '320px' : '220px', width: '100%', position: 'relative', paddingTop: '6px', paddingBottom: '6px', touchAction: 'none' }}>
              <svg
                style={{ width: '100%', height: '100%', overflow: 'visible', cursor: 'crosshair' }}
                viewBox={`0 0 ${chartData.viewWidth} ${chartData.viewHeight}`}
                onPointerDown={handlePointerScrub}
                onPointerMove={handlePointerScrub}
              >
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* Grid Guidelines */}
                <line x1={chartData.paddingLeft} y1="20" x2={chartData.viewWidth - chartData.paddingRight} y2="20" stroke="rgba(255,255,255,0.08)" strokeDasharray="4" />
                <line x1={chartData.paddingLeft} y1={chartData.viewHeight * 0.35} x2={chartData.viewWidth - chartData.paddingRight} y2={chartData.viewHeight * 0.35} stroke="rgba(255,255,255,0.08)" strokeDasharray="4" />
                <line x1={chartData.paddingLeft} y1={chartData.viewHeight * 0.65} x2={chartData.viewWidth - chartData.paddingRight} y2={chartData.viewHeight * 0.65} stroke="rgba(255,255,255,0.08)" strokeDasharray="4" />
                <line x1={chartData.paddingLeft} y1={chartData.viewHeight - 28} x2={chartData.viewWidth - chartData.paddingRight} y2={chartData.viewHeight - 28} stroke="rgba(255,255,255,0.08)" strokeDasharray="4" />

                {/* Left Axis Labels (Weight / 1RM) */}
                <text x="8" y="22" fill="#cbd5e1" fontSize="10.5" fontWeight="extrabold">
                  {chartData.maxWeight} {weightUnit}
                </text>
                <text x="8" y={chartData.viewHeight - 22} fill="#cbd5e1" fontSize="10.5" fontWeight="extrabold">
                  {chartData.minWeight} {weightUnit}
                </text>

                {/* Right Axis Labels (Exercise Volume) */}
                {showVolume && (
                  <g>
                    <text x={chartData.viewWidth - 8} y="22" fill="#f59e0b" fontSize="10.5" fontWeight="extrabold" textAnchor="end">
                      {chartData.maxVol.toLocaleString()} {weightUnit}
                    </text>
                    <text x={chartData.viewWidth - 8} y={chartData.viewHeight - 22} fill="#f59e0b" fontSize="10.5" fontWeight="extrabold" textAnchor="end">
                      {chartData.minVol.toLocaleString()} {weightUnit}
                    </text>
                  </g>
                )}

                {/* Est 1RM Area Fill */}
                {show1RM && chartData.nodes.length > 1 && (
                  <path
                    d={`${chartData.path1RM} L ${chartData.nodes[chartData.nodes.length - 1].x},${chartData.viewHeight - 28} L ${chartData.nodes[0].x},${chartData.viewHeight - 28} Z`}
                    fill="url(#chartGradient)"
                  />
                )}

                {/* Exercise Volume Curve Line (Amber) */}
                {showVolume && chartData.pathVolume && (
                  <path
                    d={chartData.pathVolume}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.85"
                  />
                )}

                {/* Best Weight Curve Line (Sky Blue) */}
                {showBestWeight && chartData.pathWeight && (
                  <path
                    d={chartData.pathWeight}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Est 1RM Curve Line (Rose) */}
                {show1RM && chartData.path1RM && (
                  <path
                    d={chartData.path1RM}
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Active Selected Node Crosshair Line */}
                {activeNode && (
                  <line
                    x1={activeNode.x}
                    y1="15"
                    x2={activeNode.x}
                    y2={chartData.viewHeight - 28}
                    stroke="#f43f5e"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    opacity="0.85"
                  />
                )}

                {/* Interactive Touch/Click Nodes */}
                {chartData.nodes.map((node, i) => {
                  const isSelected = selectedIndex === i;

                  return (
                    <g
                      key={i}
                      className="cursor-pointer"
                      onClick={() => setSelectedIndex(i)}
                      onTouchStart={() => setSelectedIndex(i)}
                    >
                      {/* Invisible touch padding for easy finger tapping */}
                      <circle cx={node.x} cy={node.y1RM} r="20" fill="transparent" />

                      {/* Est 1RM Dot */}
                      {show1RM && (
                        <circle
                          cx={node.x}
                          cy={node.y1RM}
                          r={isSelected ? '6.5' : node.isPeak1RM ? '5' : '4'}
                          fill={isSelected ? '#ffffff' : '#f43f5e'}
                          stroke={isSelected ? '#f43f5e' : '#ffffff'}
                          strokeWidth={isSelected ? '3' : '1.5'}
                        />
                      )}

                      {/* Best Weight Dot */}
                      {showBestWeight && (
                        <circle
                          cx={node.x}
                          cy={node.yWeight}
                          r={isSelected ? '6' : node.isPeakWeight ? '4.5' : '3.5'}
                          fill={isSelected ? '#ffffff' : '#38bdf8'}
                          stroke={isSelected ? '#38bdf8' : '#ffffff'}
                          strokeWidth={isSelected ? '2.5' : '1.5'}
                        />
                      )}

                      {/* Volume Dot */}
                      {showVolume && (
                        <circle
                          cx={node.x}
                          cy={node.yVolume}
                          r={isSelected ? '5.5' : node.isPeakVol ? '4.5' : '3'}
                          fill={isSelected ? '#ffffff' : '#f59e0b'}
                          stroke={isSelected ? '#f59e0b' : '#ffffff'}
                          strokeWidth={isSelected ? '2.5' : '1.5'}
                        />
                      )}

                      {/* Metric Value Label on Active Node */}
                      {isSelected && (
                        <text
                          x={node.x}
                          y={Math.min(node.y1RM, node.yWeight) - 12}
                          fill="#ffffff"
                          fontSize="12"
                          fontWeight="900"
                          textAnchor="middle"
                        >
                          {show1RM ? `${node.rmVal}` : showBestWeight ? `${node.wVal}` : `${node.vVal}`}
                        </text>
                      )}

                      {/* Date Axis Label */}
                      {(node.isStartOrEnd || isSelected) && (
                        <text
                          x={node.x}
                          y={chartData.viewHeight - 8}
                          fill={isSelected ? '#f43f5e' : '#94a3b8'}
                          fontSize="9.5"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {formatDateDMY(node.date)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Interactive Session HUD Card */}
            {activeNode && (
              <div
                className="session-hud-card"
                onClick={() => setViewingSessionDate(activeNode.date)}
                title="Click to view workout details"
                style={{ cursor: 'pointer' }}
              >
                <div className="hud-header-row">
                  <div className="hud-date-title">
                    <Calendar className="w-4 h-4 text-rose-400" />
                    <span>Session Date: {formatDateDMY(activeNode.date)}</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '4px' }}>
                      ({activeNode.index + 1} of {points.length} sessions)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="hud-action-pill-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingSessionDate(activeNode.date);
                      }}
                      title="View workout done for this session"
                    >
                      View Workout <ExternalLink className="w-3 h-3" />
                    </button>
                    <span className="hud-badge">
                      {activeNode.rawPoint.source || 'App Workout Log'}
                    </span>
                  </div>
                </div>

                <div className="hud-grid">
                  <div className="hud-cell">
                    <span className="hud-cell-label">Best Weight & Reps</span>
                    <span className="hud-cell-val" style={{ color: '#38bdf8' }}>
                      {activeNode.rawPoint.best_weight} {weightUnit} × {activeNode.rawPoint.best_reps} reps
                    </span>
                  </div>

                  <div className="hud-cell">
                    <span className="hud-cell-label">Estimated 1RM</span>
                    <span className="hud-cell-val hud-cell-highlight">
                      {activeNode.rawPoint.estimated_rm} {weightUnit}
                    </span>
                  </div>

                  <div className="hud-cell">
                    <span className="hud-cell-label">{currentExercise.name} Volume</span>
                    <span className="hud-cell-val" style={{ color: '#f59e0b' }}>
                      {activeNode.rawPoint.best_volume.toLocaleString()} {weightUnit}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Session History Log Table */}
      <div className="table-card">
        <div className="chart-header">
          <div className="chart-title">
            <Trophy className="w-5 h-5 text-rose-400" />
            <span>{currentExercise.name} Session History ({points.length} Sessions)</span>
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>App Data Log</span>
        </div>

        {points.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '12px' }}>
            No workout session logs entered yet for {currentExercise.name}.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Best Weight ({weightUnit})</th>
                  <th>Best Reps</th>
                  <th>{currentExercise.name} Vol ({weightUnit})</th>
                  <th>Estimated 1RM ({weightUnit})</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((pt, idx) => (
                  <tr
                    key={idx}
                    className="clickable-table-row"
                    onClick={() => setViewingSessionDate(pt.date)}
                    title="Click to view workout details"
                  >
                    <td style={{ fontWeight: '800', color: '#ffffff' }}>
                      <span className="session-date-link">
                        {formatDateDMY(pt.date)}
                        <ExternalLink className="w-3 h-3 text-rose-400" />
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: '900', color: '#38bdf8' }}>{pt.best_weight} {weightUnit}</span>
                    </td>
                    <td style={{ fontWeight: '700', color: '#e2e8f0' }}>{pt.best_reps} reps</td>
                    <td style={{ fontWeight: '700', color: '#f59e0b' }}>{pt.best_volume.toLocaleString()} {weightUnit}</td>
                    <td>
                      <span
                        className="badge-pill"
                        style={{
                          background: 'rgba(244, 63, 94, 0.2)',
                          color: '#fca5a5',
                          border: '1px solid rgba(244, 63, 94, 0.3)',
                        }}
                      >
                        {pt.estimated_rm} {weightUnit}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Local Periodisation PR Logged Records */}
      <div className="table-card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
        <div className="chart-header">
          <div className="chart-title">
            <Award className="w-5 h-5 text-amber-400" />
            <span>Local Macrocycle PR Milestones ({prRecords.length})</span>
          </div>
          <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '700' }}>Local Ledger Sync</span>
        </div>

        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Exercise Lift</th>
                <th>Raw Metric / Note</th>
                <th>Session Context</th>
              </tr>
            </thead>
            <tbody>
              {prRecords.map((rec, idx) => (
                <tr
                  key={idx}
                  className="clickable-table-row"
                  onClick={() => setViewingSessionDate(rec.date)}
                  title="Click to view workout details"
                >
                  <td style={{ fontWeight: '800', color: '#ffffff' }}>
                    <span className="session-date-link">
                      {formatDateDMY(rec.date)}
                      <ExternalLink className="w-3 h-3 text-amber-400" />
                    </span>
                  </td>
                  <td>
                    <span
                      className="badge-pill"
                      style={{
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#fde047',
                      }}
                    >
                      {rec.exercise}
                    </span>
                  </td>
                  <td style={{ fontWeight: '800', color: '#f59e0b' }}>{rec.rawText}</td>
                  <td style={{ color: '#cbd5e1', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rec.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Session Workout Details Modal */}
      {viewingSessionDetail && (
        <div
          className="session-modal-overlay"
          onClick={() => setViewingSessionDate(null)}
        >
          <div
            className="session-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="session-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="session-modal-icon-badge">
                  <Dumbbell className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="session-modal-title">{viewingSessionDetail.title || 'Workout Session'}</span>
                    <span className="session-source-badge">
                      {viewingSessionDetail.source}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar className="w-3.5 h-3.5 text-rose-400" />
                    <span style={{ fontWeight: '700', color: '#ffffff' }}>{formatDateDMY(viewingSessionDetail.date)}</span>
                    {viewingSessionDetail.displayDate && viewingSessionDetail.displayDate !== formatDateDMY(viewingSessionDetail.date) && (
                      <span style={{ color: '#94a3b8' }}>• {viewingSessionDetail.displayDate}</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="session-modal-close-btn"
                onClick={() => setViewingSessionDate(null)}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Performance Stats Bar */}
            {viewingSessionDetail.bestWeight > 0 && (
              <div className="session-stats-bar">
                <div className="session-stat-box">
                  <span className="session-stat-sub">Best Weight</span>
                  <span className="session-stat-number" style={{ color: '#38bdf8' }}>
                    {viewingSessionDetail.bestWeight} {weightUnit}
                    <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '4px' }}>
                      ×{viewingSessionDetail.bestReps}
                    </span>
                  </span>
                </div>
                <div className="session-stat-box">
                  <span className="session-stat-sub">Estimated 1RM</span>
                  <span className="session-stat-number" style={{ color: '#f43f5e' }}>
                    {viewingSessionDetail.estimatedRM} {weightUnit}
                  </span>
                </div>
                <div className="session-stat-box">
                  <span className="session-stat-sub">{currentExercise.name} Vol</span>
                  <span className="session-stat-number" style={{ color: '#f59e0b' }}>
                    {viewingSessionDetail.volume.toLocaleString()} {weightUnit}
                  </span>
                </div>
              </div>
            )}

            {/* Modal Body */}
            <div className="session-modal-body">
              {/* Workout Performed Card */}
              <div className="workout-done-card">
                <div className="workout-card-label">
                  <Dumbbell className="w-4 h-4" /> Workout Performed
                </div>
                <div className="workout-done-text">
                  {viewingSessionDetail.workoutText || viewingSessionDetail.title || 'Workout logged (no text details recorded)'}
                </div>
              </div>

              {/* PR / Milestone Card if any */}
              {viewingSessionDetail.prText && (
                <div className="pr-milestone-card">
                  <div className="pr-card-label">
                    <Trophy className="w-4 h-4" /> PR Milestone / Record
                  </div>
                  <div className="pr-done-text">
                    {viewingSessionDetail.prText}
                  </div>
                </div>
              )}

              {/* Structured Lifts & Sets if available from Periodisation Day */}
              {viewingSessionDetail.lifts.length > 0 && (
                <div>
                  <div className="section-subtitle">
                    Structured Exercise Logs ({viewingSessionDetail.lifts.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {viewingSessionDetail.lifts.map((lift: LiftEntry, lIdx: number) => (
                      <div key={lift.id || lIdx} className="lift-card-item">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontWeight: '800', color: '#ffffff', fontSize: '13px' }}>{lift.name}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{lift.sets?.length || 0} sets</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {lift.sets?.map((set: SetEntry, sIdx: number) => {
                            const isGear = isGearOrSlingshotSet(set);
                            return (
                              <div key={set.id || sIdx} className="set-pill-item">
                                <span className="set-tag">S{sIdx + 1}</span>
                                <span style={{ fontWeight: '800', color: '#ffffff' }}>
                                  {set.weight} {lift.unit || weightUnit} × {set.reps}
                                </span>
                                {set.isPR && <Trophy className="w-3 h-3 text-amber-400" />}
                                {isGear ? (
                                  <span className="pill-gear">GEAR/SLING</span>
                                ) : (
                                  <span className="pill-raw">RAW</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contextual Info (Mesocycle / Microcycle / Phase / Status / Diet) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                {viewingSessionDetail.mesocycle && (
                  <div className="meta-card">
                    <span className="meta-label">Mesocycle Context</span>
                    <span className="meta-text">
                      {viewingSessionDetail.mesocycle}
                    </span>
                  </div>
                )}

                {viewingSessionDetail.microcycle && (
                  <div className="meta-card">
                    <span className="meta-label">Microcycle Context</span>
                    <span className="meta-text">
                      {viewingSessionDetail.microcycle}
                    </span>
                  </div>
                )}

                {viewingSessionDetail.status && (
                  <div className="meta-card">
                    <span className="meta-label">Status & State</span>
                    <span className="meta-text" style={{ color: '#fbbf24', fontWeight: '700' }}>
                      {viewingSessionDetail.status}
                    </span>
                  </div>
                )}

                {viewingSessionDetail.diet && (
                  <div className="meta-card">
                    <span className="meta-label">Diet & Nutrition Log</span>
                    <span className="meta-text">
                      {viewingSessionDetail.diet}
                    </span>
                  </div>
                )}

                {viewingSessionDetail.notes && (
                  <div className="meta-card" style={{ gridColumn: '1 / -1' }}>
                    <span className="meta-label">Day Notes</span>
                    <span className="meta-text">
                      {viewingSessionDetail.notes}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="session-modal-footer">
              {viewingSessionDetail.mesoId && viewingSessionDetail.micId && viewingSessionDetail.day && onOpenDay && (
                <button
                  type="button"
                  className="btn-open-planner"
                  onClick={() => {
                    const { mesoId, micId, day } = viewingSessionDetail;
                    setViewingSessionDate(null);
                    onOpenDay(mesoId!, micId!, day!);
                  }}
                >
                  <ExternalLink className="w-4 h-4" /> Open in Periodisation Planner
                </button>
              )}
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setViewingSessionDate(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
