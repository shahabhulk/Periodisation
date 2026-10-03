import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  Calendar,
  Zap,
  TrendingUp,
  Dumbbell,
  CheckCircle2,
  ExternalLink,
  Flame,
  Activity,
  Filter,
  Target,
} from 'lucide-react';
import { formatDateDMY } from '../utils/workoutUtils';

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
  index: number;
  label: string | null;
  days: DayEntry[];
  note?: string;
}

export interface Mesocycle {
  id: string;
  macroId: string;
  index: number;
  name: string;
  phaseKey: string;
  micRange?: string;
  start: string;
  end: string;
  status: string;
  microcycles: Microcycle[];
  targets?: any[];
  notes?: string;
}

export interface Macrocycle {
  id: string;
  index: number;
  name: string;
  start: string;
}

export interface PeriodisationAnalysisViewProps {
  macrocycles: Macrocycle[];
  mesocycles: Mesocycle[];
  today: string;
  initialLevel?: 'macrocycle' | 'mesocycle' | 'microcycle';
  controlledLevel?: 'macrocycle' | 'mesocycle' | 'microcycle';
  selectedMacroId?: string | null;
  selectedMesoId?: string | null;
  selectedMicId?: string | null;
  hideLevelBar?: boolean;
  hideScopeSelect?: boolean;
  onLevelChange?: (level: 'macrocycle' | 'mesocycle' | 'microcycle') => void;
  onDayClick?: (mesoId: string, micId: string, day: any) => void;
  onSelectMeso?: (mesoId: string) => void;
  onSelectMacro?: (macroId: string) => void;
}

const PHASE_COLORS: Record<string, string> = {
  Hypertrophy: '#f59e0b', // Amber
  Strength: '#3b82f6',    // Blue
  Peaking: '#f43f5e',     // Rose
  Accumulation: '#10b981',// Emerald
  Base: '#8b5cf6',        // Purple
  Deload: '#06b6d4',      // Cyan
  Taper: '#ec4899',       // Pink
  Recovery: '#14b8a6',    // Teal
};

// Check if a set was performed with slingshot / gear
function isGearOrSlingshotSet(set?: any): boolean {
  if (!set) return false;
  const eq = String(set.equipment || '').toLowerCase();
  const note = String(set.note || set.comments || '').toLowerCase();
  return (
    eq === 'gear' ||
    note.includes('slingshot') ||
    note.includes('sling') ||
    note.includes('gear')
  );
}

// Check if a lift or set is a static hold / unrack overload / pause hold
function isStaticOrHold(liftName: string, set?: any): boolean {
  const l = (liftName || '').toLowerCase();
  const note = String(set?.note || set?.comments || set?.type || '').toLowerCase();
  return (
    l.includes('hold') ||
    l.includes('static') ||
    l.includes('unrack') ||
    l.includes('overload') ||
    l.includes('walkout') ||
    l.includes('isometric') ||
    l.includes('pause static') ||
    note.includes('hold') ||
    note.includes('static') ||
    note.includes('unrack') ||
    note.includes('overload') ||
    note.includes('isometric') ||
    note.includes('pause static')
  );
}

// Robust lift name matcher
function isLiftMatch(
  liftName: string,
  target: string,
  set?: SetEntry,
  equipmentFilter: 'all' | 'raw' | 'gear' = 'all'
): boolean {
  const l = (liftName || '').trim().toLowerCase();
  const t = (target || 'all').trim().toLowerCase();

  // Equipment filtering: considers BOTH Raw and Gear unless explicitly filtered
  if (set) {
    const isGear = isGearOrSlingshotSet(set);
    if (equipmentFilter === 'raw' && isGear) return false;
    if (equipmentFilter === 'gear' && !isGear) return false;
  }

  const isHold = isStaticOrHold(liftName, set);
  const isTargetHold = t.includes('hold') || t.includes('static') || t.includes('unrack');
  if (!isTargetHold && isHold) {
    // Strictly exclude static holds from standard dynamic lifts!
    return false;
  }

  if (t === 'all') return true;

  // Exact exercise match (e.g. "Smith Chair Squat", "Barbell Full Squat", "Lever Lying Leg Curl")
  if (l === t) return true;

  // Slingshot target
  const isTargetSlingshot = t.includes('slingshot') || t.includes('sling');
  if (isTargetSlingshot) {
    return (
      (l.includes('bench') || l.includes('press') || l.includes('sling')) &&
      (l.includes('slingshot') || l.includes('sling') || isGearOrSlingshotSet(set))
    );
  }

  // Standard flat bench press category
  if (t === 'bench press' || t === 'bench' || t === 'bench press (raw)') {
    if (l.includes('incline') || l.includes('decline') || l.includes('dumbbell') || l.includes('db')) {
      return false;
    }
    if (l.includes('slingshot') || l.includes('sling shot') || l.includes('sling-shot')) {
      return false;
    }
    return l.includes('bench') || l === 'bp' || l.includes('chest press');
  }

  // General Squat category: matches free barbell squats (Barbell Full Squat, Barbell Squat, Front Squat, Back Squat)
  // Strictly excludes machine / smith / hack variations so machine lifts don't contaminate free squat stats
  if (t === 'squat' || t === 'barbell squat') {
    if (l.includes('smith') || l.includes('hack') || l.includes('leg press') || l.includes('pistol')) {
      return false;
    }
    return l.includes('squat');
  }

  // General Deadlift category
  if (t === 'deadlift') {
    if (l.includes('rdl') || l.includes('romanian') || l.includes('stiff')) return false;
    return l.includes('deadlift') || l === 'dl';
  }

  return l.includes(t) || t.includes(l);
}

// Compute metrics for any array of DayEntry, with optional specific lift & equipment filter
function calculateDaysMetrics(
  days: DayEntry[],
  todayStr: string,
  targetLift: string = 'all',
  equipmentFilter: 'all' | 'raw' | 'gear' = 'all'
) {
  let volume = 0;
  let totalSets = 0;
  let totalReps = 0;
  let peakWeight = 0;
  let peak1RM = 0;
  let workoutsScheduled = 0;
  let workoutsCompleted = 0;
  let restDays = 0;
  let sessionsWithLift = 0;

  const categoryStats: Record<string, { volume: number; sets: number }> = {
    'Bench Press': { volume: 0, sets: 0 },
    'Squat': { volume: 0, sets: 0 },
    'Deadlift': { volume: 0, sets: 0 },
    'Accessories': { volume: 0, sets: 0 },
  };

  days.forEach((d) => {
    const hasAnyLifts = Boolean(d.lifts && d.lifts.length > 0);
    const titleLower = (d.title || '').toLowerCase();
    const isRest = d.type === 'recovery' || (!hasAnyLifts && (titleLower.includes('recovery') || titleLower === 'rest'));
    const isWk = d.type === 'workout' || hasAnyLifts;

    if (isRest) restDays += 1;
    if (isWk) {
      workoutsScheduled += 1;
      if (d.date <= todayStr && (hasAnyLifts || d.type === 'workout')) {
        workoutsCompleted += 1;
      }
    }

    let dayHadTargetLift = false;

    (d.lifts || []).forEach((lift) => {
      const lName = (lift.name || '').toLowerCase();
      let category = 'Accessories';
      const isHold = isStaticOrHold(lift.name);
      if (!isHold) {
        if (lName.includes('bench') || lName.includes('chest')) category = 'Bench Press';
        else if (lName.includes('squat')) category = 'Squat';
        else if (lName.includes('deadlift')) category = 'Deadlift';
      }

      (lift.sets || []).forEach((s) => {
        const w = parseFloat(String(s.weight)) || 0;
        const r = parseFloat(String(s.reps)) || 0;
        const setVol = w * r;

        // Global category breakdown
        categoryStats[category].volume += setVol;
        categoryStats[category].sets += 1;

        // Check if this set matches specific lift filter AND equipment filter
        if (isLiftMatch(lift.name, targetLift, s, equipmentFilter)) {
          const isHoldSet = isStaticOrHold(lift.name, s);
          dayHadTargetLift = true;
          volume += setVol;
          totalSets += 1;
          totalReps += r;

          // Exclude static holds (e.g. pause static bench press hold) from dynamic peak weight & 1RM
          const isTargetHold = (targetLift || '').toLowerCase().includes('hold') || (targetLift || '').toLowerCase().includes('static');
          if (isTargetHold || !isHoldSet) {
            if (w > peakWeight) peakWeight = w;
            if (w > 0 && r > 0) {
              const estRM = Math.round(w * (1 + r / 30));
              if (estRM > peak1RM) peak1RM = estRM;
            }
          }
        }
      });
    });

    if (dayHadTargetLift) sessionsWithLift += 1;
  });

  const avgIntensity = totalReps > 0 ? Math.round(volume / totalReps) : 0;

  return {
    volume,
    totalSets,
    totalReps,
    peakWeight,
    peak1RM,
    avgIntensity,
    workoutsScheduled,
    workoutsCompleted,
    restDays,
    sessionsWithLift,
    categoryStats,
  };
}

export const PeriodisationAnalysisView: React.FC<PeriodisationAnalysisViewProps> = ({
  macrocycles,
  mesocycles,
  today,
  initialLevel = 'mesocycle',
  controlledLevel,
  selectedMacroId: propMacroId,
  selectedMesoId: propMesoId,
  selectedMicId: propMicId,
  hideLevelBar = false,
  hideScopeSelect = false,
  onLevelChange,
  onDayClick,
  onSelectMeso,
  onSelectMacro,
}) => {
  // Navigation level: Macrocycle vs Mesocycle vs Microcycle
  const [level, setLevel] = useState<'macrocycle' | 'mesocycle' | 'microcycle'>(
    controlledLevel || initialLevel
  );

  // Sync level if controlledLevel changes
  useEffect(() => {
    if (controlledLevel) {
      setLevel(controlledLevel);
    }
  }, [controlledLevel]);

  // Selected specific lift filter
  const [selectedLift, setSelectedLift] = useState<string>('all');

  // Equipment Filter: 'all' (Raw + Gear), 'raw', or 'gear'
  const [equipmentFilter, setEquipmentFilter] = useState<'all' | 'raw' | 'gear'>('all');

  // Chart View Display Mode: separate graphs for '1rm', 'bestWeight', 'volume', or 'all'
  const [chartViewMode, setChartViewMode] = useState<'1rm' | 'bestWeight' | 'volume' | 'all'>('1rm');

  // Selected entities
  const [selectedMacroId, setSelectedMacroId] = useState<string | null>(
    propMacroId || macrocycles[0]?.id || null
  );

  useEffect(() => {
    if (propMacroId !== undefined && propMacroId !== null) {
      setSelectedMacroId(propMacroId);
    }
  }, [propMacroId]);

  const currentMacro = useMemo(() => {
    return (selectedMacroId ? macrocycles.find((m) => m.id === selectedMacroId) : null) || macrocycles[0] || null;
  }, [selectedMacroId, macrocycles]);

  // Mesocycles in current macrocycle
  const macroMesos = useMemo(() => {
    if (!currentMacro) return [];
    return mesocycles
      .filter((m) => m.macroId === currentMacro.id)
      .sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  }, [currentMacro, mesocycles]);

  const [selectedMesoId, setSelectedMesoId] = useState<string | null>(
    propMesoId || macroMesos[0]?.id || mesocycles[0]?.id || null
  );

  useEffect(() => {
    if (propMesoId !== undefined) {
      setSelectedMesoId(propMesoId);
      // When a specific mesocycle is selected from outside and we're not in macrocycle overview,
      // reset view to mesocycle wave
      if (propMesoId && controlledLevel !== 'macrocycle') {
        setLevel('mesocycle');
      }
    }
  }, [propMesoId, controlledLevel]);

  const currentMeso = useMemo(() => {
    const found = selectedMesoId ? mesocycles.find((m) => m.id === selectedMesoId) : null;
    return found || macroMesos[0] || mesocycles[0] || null;
  }, [selectedMesoId, macroMesos, mesocycles]);

  // Microcycles in current mesocycle
  const mesoMicrocycles = useMemo(() => {
    return currentMeso?.microcycles || [];
  }, [currentMeso]);

  const [selectedMicId, setSelectedMicId] = useState<string | null>(
    propMicId || mesoMicrocycles[0]?.id || null
  );

  useEffect(() => {
    if (propMicId !== undefined && propMicId !== null) {
      setSelectedMicId(propMicId);
    } else if (mesoMicrocycles.length > 0) {
      setSelectedMicId((prev) => {
        if (prev && mesoMicrocycles.some((mc) => mc.id === prev)) return prev;
        return mesoMicrocycles[0]?.id || null;
      });
    }
  }, [propMicId, mesoMicrocycles]);

  const currentMicrocycle = useMemo(() => {
    const found = selectedMicId ? mesoMicrocycles.find((m) => m.id === selectedMicId) : null;
    return found || mesoMicrocycles[0] || null;
  }, [selectedMicId, mesoMicrocycles]);

  // Extract all unique lift names recorded across all mesocycles
  const recordedLiftNames = useMemo(() => {
    const set = new Set<string>();
    set.add('Squat');
    set.add('Bench Press');
    set.add('Deadlift');

    for (const m of mesocycles) {
      for (const mc of m.microcycles || []) {
        for (const d of mc.days || []) {
          for (const l of d.lifts || []) {
            if (l.name && l.name.trim()) {
              set.add(l.name.trim());
            }
          }
        }
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [mesocycles]);

  // Interactive Graph Hover state
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Phase Status Helper
  const getPhaseStatus = (start: string, end: string) => {
    if (today < start) return 'upcoming';
    if (today > end) return 'completed';
    return 'active';
  };

  /* ============================================================
     1. MACROCYCLE DATA CALCULATIONS (FILTERED BY SELECTED LIFT)
     ============================================================ */
  const macrocycleAnalysis = useMemo(() => {
    if (!currentMacro) return null;

    const allDaysInMacro: DayEntry[] = [];
    const mesoSeries = macroMesos.map((m, idx) => {
      const days = (m.microcycles || []).flatMap((mc) => mc.days || []);
      days.forEach((d) => allDaysInMacro.push(d));
      const metrics = calculateDaysMetrics(days, today, selectedLift, equipmentFilter);
      const phaseColor = PHASE_COLORS[m.phaseKey] || '#38bdf8';
      const status = getPhaseStatus(m.start, m.end);

      return {
        id: m.id,
        index: idx + 1,
        name: m.name,
        phaseKey: m.phaseKey,
        phaseColor,
        status,
        start: m.start,
        end: m.end,
        microcycleCount: m.microcycles?.length || 0,
        ...metrics,
      };
    });

    const totalMetrics = calculateDaysMetrics(allDaysInMacro, today, selectedLift, equipmentFilter);
    const maxMesoVol = Math.max(...mesoSeries.map((s) => s.volume), 1000);
    const maxMesoIntensity = Math.max(...mesoSeries.map((s) => s.avgIntensity), 100);
    const maxMesoStrength = Math.max(
      ...mesoSeries.map((s) => Math.max(s.peak1RM || 0, s.peakWeight || 0)),
      60
    );

    return {
      macro: currentMacro,
      mesoSeries,
      totalMetrics,
      maxMesoVol,
      maxMesoIntensity,
      maxMesoStrength,
    };
  }, [currentMacro, macroMesos, today, selectedLift, equipmentFilter]);

  /* ============================================================
     2. MESOCYCLE DATA CALCULATIONS (FILTERED BY SELECTED LIFT)
     ============================================================ */
  const mesocycleAnalysis = useMemo(() => {
    if (!currentMeso) return null;

    const allDaysInMeso: DayEntry[] = [];
    const microSeries = (currentMeso.microcycles || []).map((mc, idx) => {
      const days = mc.days || [];
      days.forEach((d) => allDaysInMeso.push(d));
      const metrics = calculateDaysMetrics(days, today, selectedLift, equipmentFilter);

      return {
        id: mc.id,
        index: mc.index || idx + 1,
        label: mc.label || `Week ${mc.index || idx + 1}`,
        daysCount: days.length,
        days,
        ...metrics,
      };
    });

    const totalMetrics = calculateDaysMetrics(allDaysInMeso, today, selectedLift, equipmentFilter);
    const maxMicVol = Math.max(...microSeries.map((s) => s.volume), 1000);
    const maxMicIntensity = Math.max(...microSeries.map((s) => s.avgIntensity), 100);
    const maxMicStrength = Math.max(
      ...microSeries.map((s) => Math.max(s.peak1RM || 0, s.peakWeight || 0)),
      60
    );

    let volumeProgressionRate = 0;
    if (microSeries.length > 1 && microSeries[0].volume > 0) {
      const peakVol = Math.max(...microSeries.map((s) => s.volume));
      volumeProgressionRate = Math.round(((peakVol - microSeries[0].volume) / microSeries[0].volume) * 100);
    }

    return {
      meso: currentMeso,
      microSeries,
      totalMetrics,
      maxMicVol,
      maxMicIntensity,
      maxMicStrength,
      volumeProgressionRate,
    };
  }, [currentMeso, today, selectedLift, equipmentFilter]);

  /* ============================================================
     3. MICROCYCLE DATA CALCULATIONS (FILTERED BY SELECTED LIFT)
     ============================================================ */
  const microcycleAnalysis = useMemo(() => {
    if (!currentMicrocycle) return null;

    const days = currentMicrocycle.days || [];
    const metrics = calculateDaysMetrics(days, today, selectedLift, equipmentFilter);

    const daySeries = days.map((d, idx) => {
      const dayMetrics = calculateDaysMetrics([d], today, selectedLift, equipmentFilter);
      const isToday = d.date === today;
      const isFuture = d.date > today;
      const isWorkout = d.type === 'workout' || (d.lifts && d.lifts.length > 0);
      const isRest = !isWorkout && (d.type === 'recovery' || (d.title || '').toLowerCase().includes('rest'));

      // Filter lifts and sets to show for this specific day according to lift target AND equipment filter
      const matchingLifts = (d.lifts || [])
        .filter((l) => isLiftMatch(l.name, selectedLift, undefined, equipmentFilter))
        .map((l) => ({
          ...l,
          sets: (l.sets || []).filter((s) => isLiftMatch(l.name, selectedLift, s, equipmentFilter)),
        }))
        .filter((l) => l.sets.length > 0);

      return {
        day: d,
        index: idx + 1,
        date: d.date,
        title: d.title || (isRest ? 'Recovery Day' : isWorkout ? `Day ${idx + 1}` : 'Rest'),
        isToday,
        isFuture,
        isWorkout,
        isRest,
        volume: dayMetrics.volume,
        sets: dayMetrics.totalSets,
        reps: dayMetrics.totalReps,
        peakWeight: dayMetrics.peakWeight,
        peak1RM: dayMetrics.peak1RM,
        avgIntensity: dayMetrics.avgIntensity,
        lifts: matchingLifts.length > 0 ? matchingLifts : d.lifts || [],
        hadTargetLift: dayMetrics.volume > 0 || matchingLifts.length > 0,
      };
    });

    const maxDayVol = Math.max(...daySeries.map((s) => s.volume), 500);
    const maxDayStrength = Math.max(
      ...daySeries.map((s) => Math.max(s.peak1RM || 0, s.peakWeight || 0)),
      60
    );

    return {
      microcycle: currentMicrocycle,
      daySeries,
      totalMetrics: metrics,
      maxDayVol,
      maxDayStrength,
    };
  }, [currentMicrocycle, today, selectedLift, equipmentFilter]);

  const liftLabel = selectedLift === 'all' ? 'All Lifts' : selectedLift;

  return (
    <div className="periodisation-analysis-container">
      <style>{`
        .periodisation-analysis-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #ffffff;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          overflow-x: hidden;
        }

        /* Level Tab Navigation */
        .level-switcher-bar {
          display: flex;
          align-items: center;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 3px;
          gap: 3px;
          width: 100%;
          box-sizing: border-box;
        }
        .level-btn {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 4px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 700;
          color: #94a3b8;
          border: none;
          background: transparent;
          cursor: pointer;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          transition: all 0.15s ease;
        }
        .level-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.05);
        }
        .level-btn-active {
          background: #1e293b !important;
          color: #ffffff !important;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
        }
        .level-btn-active.level-macro {
          border-bottom: 2px solid #38bdf8;
          color: #38bdf8 !important;
        }
        .level-btn-active.level-meso {
          border-bottom: 2px solid #f43f5e;
          color: #f43f5e !important;
        }
        .level-btn-active.level-micro {
          border-bottom: 2px solid #10b981;
          color: #34d399 !important;
        }

        .level-btn-text-short { display: none; }
        @media (max-width: 480px) {
          .level-btn-text-full { display: none; }
          .level-btn-text-short { display: inline; }
        }

        /* Scope & Filter Control Card */
        .analysis-scope-card {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.98));
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }
        .scope-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }
        .scope-select-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          width: 100%;
        }
        .scope-select {
          background: #0f172a;
          border: 1px solid #334155;
          color: #ffffff;
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 11.5px;
          font-weight: 700;
          outline: none;
          cursor: pointer;
          max-width: 100%;
          box-sizing: border-box;
        }

        /* Ultra-Compact Lift & Equipment Filter Bar */
        .lift-filter-bar {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-top: 6px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          width: 100%;
          box-sizing: border-box;
        }
        .lift-filter-row {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          box-sizing: border-box;
        }
        .filter-label {
          font-size: 10px;
          font-weight: 800;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 3px;
          flex-shrink: 0;
          min-width: 42px;
        }
        .lift-chip-scroll {
          display: flex;
          align-items: center;
          gap: 4px;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          flex: 1;
          min-width: 0;
          padding: 1px 0;
        }
        .lift-chip-scroll::-webkit-scrollbar {
          display: none;
        }
        .lift-chip {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 3.5px 8px;
          border-radius: 7px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(15, 23, 42, 0.6);
          color: #94a3b8;
          transition: all 0.12s ease;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .lift-chip:hover {
          border-color: #38bdf8;
          color: #ffffff;
        }
        .lift-chip-active {
          background: rgba(56, 189, 248, 0.18) !important;
          border-color: #38bdf8 !important;
          color: #38bdf8 !important;
          font-weight: 800;
        }
        .compact-select {
          padding: 3px 6px;
          font-size: 11px;
          height: 26px;
          max-width: 135px;
          flex-shrink: 0;
          border-radius: 7px;
          background: #0f172a;
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .equip-toggle-group {
          display: flex;
          align-items: center;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 7px;
          padding: 2px;
          gap: 2px;
          flex: 1;
          max-width: 260px;
        }
        .equip-pill {
          flex: 1;
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 6px;
          border-radius: 5px;
          cursor: pointer;
          text-align: center;
          white-space: nowrap;
          transition: all 0.12s ease;
        }
        .equip-pill:hover {
          color: #ffffff;
        }
        .equip-pill-active {
          background: rgba(56, 189, 248, 0.2);
          color: #38bdf8;
          font-weight: 800;
        }
        .equip-pill-raw {
          background: rgba(16, 185, 129, 0.2);
          color: #34d399;
          font-weight: 800;
        }
        .equip-pill-gear {
          background: rgba(245, 158, 11, 0.22);
          color: #f59e0b;
          font-weight: 800;
        }

        /* KPI Highlights Grid */
        .analytics-kpi-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          width: 100%;
          box-sizing: border-box;
        }
        @media (min-width: 640px) {
          .analytics-kpi-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
          }
        }
        .kpi-card {
          background: #141c2b;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 12px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
          overflow: hidden;
        }
        .kpi-title {
          font-size: 10.5px;
          font-weight: 700;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: space-between;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .kpi-value {
          font-size: 17px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: 0.2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .kpi-sub {
          font-size: 10px;
          color: #64748b;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Chart Card Surface */
        .chart-surface-card {
          background: #141c2b;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 14px 14px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          width: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }
        .chart-surface-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 8px;
          width: 100%;
          box-sizing: border-box;
        }
        .chart-surface-title {
          font-size: 13.5px;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 6px;
          color: #ffffff;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .chart-legend-row {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 10px;
          font-weight: 700;
          flex-wrap: wrap;
        }
        .legend-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        /* Breakdown list */
        .breakdown-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 6px;
          width: 100%;
          box-sizing: border-box;
        }
        .breakdown-row {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          width: 100%;
          box-sizing: border-box;
        }
        .breakdown-row:hover {
          background: rgba(30, 41, 59, 0.8);
          border-color: rgba(56, 189, 248, 0.4);
        }

        /* Chart Mode Pill Switcher */
        .chart-mode-pill-bar {
          display: flex;
          align-items: center;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 2.5px;
          gap: 3px;
          width: 100%;
          box-sizing: border-box;
          margin-bottom: 4px;
        }
        .chart-mode-pill {
          flex: 1;
          background: transparent;
          border: 1px solid transparent;
          color: #94a3b8;
          font-size: 10.5px;
          font-weight: 700;
          padding: 5px 6px;
          border-radius: 7px;
          cursor: pointer;
          text-align: center;
          transition: all 0.15s ease;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chart-mode-pill:hover {
          color: #ffffff;
        }
        .chart-mode-pill-active {
          background: rgba(56, 189, 248, 0.18);
          color: #38bdf8;
          border-color: rgba(56, 189, 248, 0.35);
          font-weight: 800;
        }
      `}</style>

      {/* 1. Level Navigation Tabs */}
      {!hideLevelBar && (
        <div className="level-switcher-bar">
          <button
            type="button"
            onClick={() => {
              setLevel('macrocycle');
              if (onLevelChange) onLevelChange('macrocycle');
            }}
            className={`level-btn level-macro ${level === 'macrocycle' ? 'level-btn-active' : ''}`}
          >
            <Layers className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="level-btn-text-full">Macrocycle Overview</span>
            <span className="level-btn-text-short">Macro</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLevel('mesocycle');
              if (onLevelChange) onLevelChange('mesocycle');
            }}
            className={`level-btn level-meso ${level === 'mesocycle' ? 'level-btn-active' : ''}`}
          >
            <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="level-btn-text-full">Mesocycle Wave</span>
            <span className="level-btn-text-short">Meso</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLevel('microcycle');
              if (onLevelChange) onLevelChange('microcycle');
            }}
            className={`level-btn level-micro ${level === 'microcycle' ? 'level-btn-active' : ''}`}
          >
            <Activity className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="level-btn-text-full">Microcycle Daily</span>
            <span className="level-btn-text-short">Micro</span>
          </button>
        </div>
      )}

      {/* 2. Filter & Scope Control Card with Specific Lift Filter */}
      <div className="analysis-scope-card" style={hideScopeSelect ? { padding: '10px 12px' } : undefined}>
        {/* Row 1: Target entity selector */}
        {!hideScopeSelect && (
          <div className="scope-select-wrap">
            {level === 'macrocycle' && (
              <>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8' }}>MACRO:</span>
                <select
                  className="scope-select"
                  style={{ flex: 1 }}
                  value={currentMacro?.id || ''}
                  onChange={(e) => {
                    setSelectedMacroId(e.target.value);
                    if (onSelectMacro) onSelectMacro(e.target.value);
                  }}
                >
                  {macrocycles.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({formatDateDMY(m.start)})
                    </option>
                  ))}
                </select>
              </>
            )}

            {level === 'mesocycle' && (
              <>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8' }}>PHASE:</span>
                <select
                  className="scope-select"
                  style={{ flex: 1 }}
                  value={currentMeso?.id || ''}
                  onChange={(e) => {
                    setSelectedMesoId(e.target.value);
                    if (onSelectMeso) onSelectMeso(e.target.value);
                  }}
                >
                  {mesocycles.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.phaseKey})
                    </option>
                  ))}
                </select>
              </>
            )}

            {level === 'microcycle' && (
              <>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8' }}>WEEK:</span>
                <select
                  className="scope-select"
                  style={{ flex: 1 }}
                  value={currentMicrocycle?.id || ''}
                  onChange={(e) => setSelectedMicId(e.target.value)}
                >
                  {mesoMicrocycles.map((mc, idx) => (
                    <option key={mc.id} value={mc.id}>
                      Microcycle {mc.index || idx + 1} {mc.label ? `— ${mc.label}` : ''} ({mc.days?.length || 0} days)
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}

        {/* Row 2: Space-Optimized Lift & Equipment Filter Bar */}
        <div className="lift-filter-bar">
          {/* Row 1: Core Lift Targets & Specific Lift Dropdown */}
          <div className="lift-filter-row">
            <span className="filter-label">
              <Filter size={11} className="text-sky-400" /> LIFT:
            </span>

            <div className="lift-chip-scroll">
              <button
                type="button"
                onClick={() => setSelectedLift('all')}
                className={`lift-chip ${selectedLift === 'all' ? 'lift-chip-active' : ''}`}
              >
                All Lifts
              </button>

              <button
                type="button"
                onClick={() => setSelectedLift('Squat')}
                className={`lift-chip ${selectedLift === 'Squat' ? 'lift-chip-active' : ''}`}
              >
                Squat
              </button>

              <button
                type="button"
                onClick={() => setSelectedLift('Bench Press')}
                className={`lift-chip ${selectedLift === 'Bench Press' ? 'lift-chip-active' : ''}`}
              >
                Bench
              </button>

              <button
                type="button"
                onClick={() => setSelectedLift('Deadlift')}
                className={`lift-chip ${selectedLift === 'Deadlift' ? 'lift-chip-active' : ''}`}
              >
                Deadlift
              </button>

              {/* When a specific lift is selected from dropdown, show it as an active removable chip */}
              {!['all', 'Squat', 'Bench Press', 'Deadlift'].includes(selectedLift) && (
                <button
                  type="button"
                  onClick={() => setSelectedLift('all')}
                  className="lift-chip lift-chip-active"
                  title="Click to reset to All Lifts"
                  style={{ gap: '5px' }}
                >
                  <span>{selectedLift.length > 20 ? `${selectedLift.slice(0, 18)}…` : selectedLift}</span>
                  <span style={{ fontSize: '10px', opacity: 0.8 }}>✕</span>
                </button>
              )}
            </div>

            {/* Compact Specific Lift Dropdown */}
            <select
              className="compact-select"
              value={['all', 'Squat', 'Bench Press', 'Deadlift'].includes(selectedLift) ? '' : selectedLift}
              onChange={(e) => {
                if (e.target.value) setSelectedLift(e.target.value);
              }}
            >
              <option value="">Specific Lift ▾</option>
              {recordedLiftNames
                .filter((n) => !['all', 'Squat', 'Bench Press', 'Deadlift'].includes(n))
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
            </select>
          </div>

          {/* Row 2: Equipment Filter (Inline Single Row) */}
          <div className="lift-filter-row">
            <span className="filter-label">
              <Zap size={11} className="text-amber-400" /> EQUIP:
            </span>

            <div className="equip-toggle-group">
              <button
                type="button"
                onClick={() => setEquipmentFilter('all')}
                className={`equip-pill ${equipmentFilter === 'all' ? 'equip-pill-active' : ''}`}
              >
                All (Raw+Gear)
              </button>

              <button
                type="button"
                onClick={() => setEquipmentFilter('raw')}
                className={`equip-pill ${equipmentFilter === 'raw' ? 'equip-pill-raw' : ''}`}
              >
                Raw
              </button>

              <button
                type="button"
                onClick={() => setEquipmentFilter('gear')}
                className={`equip-pill ${equipmentFilter === 'gear' ? 'equip-pill-gear' : ''}`}
              >
                Gear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          LEVEL 1: MACROCYCLE ANALYSIS & PHASE PROGRESSION GRAPH
          ============================================================ */}
      {level === 'macrocycle' && macrocycleAnalysis && (
        <>
          {/* Macrocycle KPIs */}
          <div className="analytics-kpi-grid">
            <div className="kpi-card" style={{ borderLeft: '3px solid #38bdf8' }}>
              <div className="kpi-title">
                <span>{selectedLift === 'all' ? 'Total Workload' : `${liftLabel} Vol`}</span>
                <Layers className="w-3 h-3 text-sky-400" />
              </div>
              <div className="kpi-value" style={{ color: '#38bdf8' }}>
                {(macrocycleAnalysis.totalMetrics.volume / 1000).toFixed(1)}k <span style={{ fontSize: '10px' }}>kg</span>
              </div>
              <div className="kpi-sub">{macrocycleAnalysis.totalMetrics.totalSets} sets ({macrocycleAnalysis.totalMetrics.totalReps} reps)</div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '3px solid #f59e0b' }}>
              <div className="kpi-title">
                <span>{selectedLift === 'all' ? 'Phases' : `${liftLabel} Sessions`}</span>
                <TrendingUp className="w-3 h-3 text-amber-400" />
              </div>
              <div className="kpi-value" style={{ color: '#f59e0b' }}>
                {selectedLift === 'all'
                  ? macrocycleAnalysis.mesoSeries.length
                  : macrocycleAnalysis.totalMetrics.sessionsWithLift}
                <span style={{ fontSize: '10px', marginLeft: '3px' }}>
                  {selectedLift === 'all' ? 'phases' : 'days'}
                </span>
              </div>
              <div className="kpi-sub">
                Across {macrocycleAnalysis.mesoSeries.reduce((acc, s) => acc + s.microcycleCount, 0)} total weeks
              </div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '3px solid #10b981' }}>
              <div className="kpi-title">
                <span>Workouts Logged</span>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              </div>
              <div className="kpi-value" style={{ color: '#34d399' }}>
                {macrocycleAnalysis.totalMetrics.workoutsCompleted} / {macrocycleAnalysis.totalMetrics.workoutsScheduled}
              </div>
              <div className="kpi-sub">
                {macrocycleAnalysis.totalMetrics.workoutsScheduled > 0
                  ? `${Math.round(
                      (macrocycleAnalysis.totalMetrics.workoutsCompleted /
                        macrocycleAnalysis.totalMetrics.workoutsScheduled) *
                        100
                    )}% adherence`
                  : '0% completed'}
              </div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '3px solid #f43f5e' }}>
              <div className="kpi-title">
                <span>Peak {selectedLift === 'all' ? 'Load' : liftLabel}</span>
                <Zap className="w-3 h-3 text-rose-400" />
              </div>
              <div className="kpi-value" style={{ color: '#f43f5e' }}>
                {macrocycleAnalysis.totalMetrics.peakWeight} <span style={{ fontSize: '10px' }}>kg</span>
              </div>
              <div className="kpi-sub">
                Est 1RM: {macrocycleAnalysis.totalMetrics.peak1RM} kg
              </div>
            </div>
          </div>

          {/* Chart View Switcher */}
          <div className="chart-mode-pill-bar">
            <button
              type="button"
              onClick={() => setChartViewMode('1rm')}
              className={`chart-mode-pill ${chartViewMode === '1rm' ? 'chart-mode-pill-active' : ''}`}
            >
              🎯 Est 1RM
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('bestWeight')}
              className={`chart-mode-pill ${chartViewMode === 'bestWeight' ? 'chart-mode-pill-active' : ''}`}
            >
              ⚡ Best Wt
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('volume')}
              className={`chart-mode-pill ${chartViewMode === 'volume' ? 'chart-mode-pill-active' : ''}`}
            >
              📊 Volume
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('all')}
              className={`chart-mode-pill ${chartViewMode === 'all' ? 'chart-mode-pill-active' : ''}`}
            >
              ☷ All (3)
            </button>
          </div>

          {/* Graph 1: Macrocycle Estimated 1RM Progression (Dedicated, Uncluttered) */}
          {(chartViewMode === 'all' || chartViewMode === '1rm') && (
            <div className="chart-surface-card" style={{ borderLeft: '3px solid #10b981' }}>
              <div className="chart-surface-header">
                <div className="chart-surface-title">
                  <Target className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{currentMacro?.name || 'Macrocycle'} · {liftLabel} Est. 1RM</span>
                </div>

                <div className="chart-legend-row">
                  <span className="legend-chip" style={{ color: '#10b981', fontWeight: '800' }}>
                    Peak 1RM: {macrocycleAnalysis.totalMetrics.peak1RM} kg
                  </span>
                </div>
              </div>

              {macrocycleAnalysis.mesoSeries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '12px' }}>
                  No mesocycles recorded in this macrocycle yet.
                </div>
              ) : (
                <div style={{ width: '100%', height: '200px', position: 'relative' }}>
                  <svg
                    viewBox="0 0 620 200"
                    style={{ width: '100%', height: '100%', overflow: 'visible' }}
                  >
                    {/* Reference Grid lines */}
                    <line x1="35" y1="25" x2="590" y2="25" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="70" x2="590" y2="70" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="115" x2="590" y2="115" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="160" x2="590" y2="160" stroke="rgba(255,255,255,0.15)" />

                    {/* Scale Y-Labels */}
                    <text x="32" y="28" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {macrocycleAnalysis.maxMesoStrength}
                    </text>
                    <text x="32" y="73" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {Math.round(macrocycleAnalysis.maxMesoStrength * 0.66)}
                    </text>
                    <text x="32" y="118" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {Math.round(macrocycleAnalysis.maxMesoStrength * 0.33)}
                    </text>
                    <text x="32" y="163" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      0
                    </text>

                    {/* Estimated 1RM Trendline (Connects only active mesos) */}
                    {macrocycleAnalysis.mesoSeries.filter((m) => m.peak1RM > 0).length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={macrocycleAnalysis.mesoSeries
                          .map((m, i) => {
                            if (!m.peak1RM || m.peak1RM <= 0) return null;
                            const step = 530 / Math.max(macrocycleAnalysis.mesoSeries.length, 1);
                            const cx = 50 + i * step + step / 2;
                            const cy = 160 - (m.peak1RM / (macrocycleAnalysis.maxMesoStrength || 1)) * 135;
                            return `${cx},${cy}`;
                          })
                          .filter(Boolean)
                          .join(' ')}
                      />
                    )}

                    {/* Estimated 1RM Nodes & Floating Badges */}
                    {macrocycleAnalysis.mesoSeries.map((m, i) => {
                      const step = 530 / Math.max(macrocycleAnalysis.mesoSeries.length, 1);
                      const cx = 50 + i * step + step / 2;
                      const has1RM = m.peak1RM > 0;
                      const cy = has1RM
                        ? 160 - (m.peak1RM / (macrocycleAnalysis.maxMesoStrength || 1)) * 135
                        : 160;

                      return (
                        <g
                          key={`macro-1rm-node-${m.id}`}
                          onClick={() => {
                            setSelectedMesoId(m.id);
                            setLevel('mesocycle');
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          {has1RM ? (
                            <>
                              <circle cx={cx} cy={cy} r="4.5" fill="#ffffff" stroke="#10b981" strokeWidth="2.5" />
                              <rect
                                x={cx - 24}
                                y={Math.max(6, cy - 20)}
                                width="48"
                                height="15"
                                rx="4"
                                fill="#064e3b"
                                stroke="#10b981"
                                strokeWidth="1"
                              />
                              <text
                                x={cx}
                                y={Math.max(6, cy - 20) + 11}
                                fill="#34d399"
                                fontSize="8.5"
                                fontWeight="900"
                                textAnchor="middle"
                              >
                                1RM {m.peak1RM}
                              </text>
                            </>
                          ) : (
                            <circle cx={cx} cy={160} r="2.5" fill="#475569" />
                          )}

                          {/* Bottom phase labels */}
                          <text x={cx} y="178" fill="#cbd5e1" fontSize="8.5" fontWeight="700" textAnchor="middle">
                            {m.name.length > 9 ? `${m.name.slice(0, 8)}…` : m.name}
                          </text>
                          <text x={cx} y="192" fill={m.phaseColor} fontSize="7.5" fontWeight="800" textAnchor="middle">
                            {m.phaseKey}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Graph 2: Macrocycle Best Working Weight Trajectory (Dedicated, Uncluttered Bar Chart) */}
          {(chartViewMode === 'all' || chartViewMode === 'bestWeight') && (
            <div className="chart-surface-card" style={{ borderLeft: '3px solid #38bdf8' }}>
              <div className="chart-surface-header">
                <div className="chart-surface-title">
                  <Dumbbell className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <span>{currentMacro?.name || 'Macrocycle'} · {liftLabel} Best Weight</span>
                </div>

                <div className="chart-legend-row">
                  <span className="legend-chip" style={{ color: '#38bdf8', fontWeight: '800' }}>
                    Peak: {macrocycleAnalysis.totalMetrics.peakWeight} kg
                  </span>
                </div>
              </div>

              {macrocycleAnalysis.mesoSeries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '12px' }}>
                  No mesocycles recorded in this macrocycle yet.
                </div>
              ) : (
                <div style={{ width: '100%', height: '200px', position: 'relative' }}>
                  <svg
                    viewBox="0 0 620 200"
                    style={{ width: '100%', height: '100%', overflow: 'visible' }}
                  >
                    <defs>
                      <linearGradient id="macroBestWtGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
                      </linearGradient>
                    </defs>

                    {/* Reference Grid lines */}
                    <line x1="35" y1="25" x2="590" y2="25" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="70" x2="590" y2="70" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="115" x2="590" y2="115" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="160" x2="590" y2="160" stroke="rgba(255,255,255,0.15)" />

                    {/* Scale Y-Labels */}
                    <text x="32" y="28" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {macrocycleAnalysis.maxMesoStrength}
                    </text>
                    <text x="32" y="73" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {Math.round(macrocycleAnalysis.maxMesoStrength * 0.66)}
                    </text>
                    <text x="32" y="118" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {Math.round(macrocycleAnalysis.maxMesoStrength * 0.33)}
                    </text>
                    <text x="32" y="163" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      0
                    </text>

                    {/* Best Weight Bars with clear labels */}
                    {macrocycleAnalysis.mesoSeries.map((m, i) => {
                      const step = 530 / Math.max(macrocycleAnalysis.mesoSeries.length, 1);
                      const barWidth = Math.min(step * 0.48, 52);
                      const x = 50 + i * step + (step - barWidth) / 2;
                      const barHeight = Math.max(
                        m.peakWeight > 0 ? 8 : 2,
                        (m.peakWeight / (macrocycleAnalysis.maxMesoStrength || 1)) * 135
                      );
                      const y = 160 - barHeight;
                      const isHovered = hoveredIndex === i;

                      return (
                        <g
                          key={`macro-wt-bar-${m.id}`}
                          onMouseEnter={() => setHoveredIndex(i)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          onClick={() => {
                            setSelectedMesoId(m.id);
                            setLevel('mesocycle');
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx={4}
                            fill={isHovered ? '#38bdf8' : 'url(#macroBestWtGrad)'}
                            stroke={isHovered ? '#ffffff' : 'rgba(56, 189, 248, 0.4)'}
                            strokeWidth={isHovered ? 1.5 : 1}
                          />

                          {/* Best Weight text */}
                          <text
                            x={x + barWidth / 2}
                            y={y - 6}
                            fill="#38bdf8"
                            fontSize="9"
                            fontWeight="900"
                            textAnchor="middle"
                          >
                            {m.peakWeight > 0 ? `${m.peakWeight} kg` : '—'}
                          </text>

                          {/* Phase name & key */}
                          <text x={x + barWidth / 2} y="178" fill="#cbd5e1" fontSize="8.5" fontWeight="700" textAnchor="middle">
                            {m.name.length > 9 ? `${m.name.slice(0, 8)}…` : m.name}
                          </text>
                          <text x={x + barWidth / 2} y="192" fill={m.phaseColor} fontSize="7.5" fontWeight="800" textAnchor="middle">
                            {m.phaseKey}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Graph 3: Macrocycle Volume & Intensity Wave Chart */}
          {(chartViewMode === 'all' || chartViewMode === 'volume') && (
            <div className="chart-surface-card">
              <div className="chart-surface-header">
                <div className="chart-surface-title">
                  <TrendingUp className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <span>{currentMacro?.name || 'Macrocycle'} · {liftLabel} Volume Wave</span>
                </div>

                <div className="chart-legend-row">
                  <span className="legend-chip" style={{ color: '#38bdf8' }}>
                    <span style={{ width: '8px', height: '8px', background: '#38bdf8', borderRadius: '2px' }} />
                    Vol (kg)
                  </span>
                  <span className="legend-chip" style={{ color: '#f43f5e' }}>
                    <span style={{ width: '10px', height: '2.5px', background: '#f43f5e', borderRadius: '2px' }} />
                    Intensity
                  </span>
                </div>
              </div>

              {macrocycleAnalysis.mesoSeries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '12px' }}>
                  No mesocycles recorded in this macrocycle yet.
                </div>
              ) : (
                <div style={{ width: '100%', height: '200px', position: 'relative' }}>
                  <svg
                    viewBox="0 0 620 200"
                    style={{ width: '100%', height: '100%', overflow: 'visible' }}
                  >
                    <defs>
                      <linearGradient id="macroBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0.3" />
                      </linearGradient>
                    </defs>

                    {/* Grid Guidelines */}
                    <line x1="35" y1="25" x2="590" y2="25" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="75" x2="590" y2="75" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="125" x2="590" y2="125" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="160" x2="590" y2="160" stroke="rgba(255,255,255,0.15)" />

                    {/* Volume Bars */}
                    {macrocycleAnalysis.mesoSeries.map((m, i) => {
                      const step = 540 / Math.max(macrocycleAnalysis.mesoSeries.length, 1);
                      const barWidth = Math.min(step * 0.52, 55);
                      const x = 45 + i * step + (step - barWidth) / 2;
                      const barHeight = Math.max(
                        m.volume > 0 ? 8 : 2,
                        (m.volume / (macrocycleAnalysis.maxMesoVol || 1)) * 130
                      );
                      const y = 160 - barHeight;
                      const isHovered = hoveredIndex === i;

                      return (
                        <g
                          key={m.id}
                          onMouseEnter={() => setHoveredIndex(i)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          onClick={() => {
                            setSelectedMesoId(m.id);
                            setLevel('mesocycle');
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx={4}
                            fill={isHovered ? '#38bdf8' : m.phaseColor || 'url(#macroBarGrad)'}
                            opacity={isHovered ? 1 : 0.85}
                            stroke={isHovered ? '#ffffff' : 'transparent'}
                            strokeWidth={isHovered ? 1.5 : 0}
                          />

                          {/* Top Volume text */}
                          <text
                            x={x + barWidth / 2}
                            y={y - 5}
                            fill="#ffffff"
                            fontSize="9"
                            fontWeight="800"
                            textAnchor="middle"
                          >
                            {m.volume > 0 ? `${(m.volume / 1000).toFixed(1)}k` : '0'}
                          </text>

                          {/* Phase Name Bottom label */}
                          <text
                            x={x + barWidth / 2}
                            y="176"
                            fill="#cbd5e1"
                            fontSize="8.5"
                            fontWeight="700"
                            textAnchor="middle"
                          >
                            {m.name.length > 9 ? `${m.name.slice(0, 8)}…` : m.name}
                          </text>

                          <text
                            x={x + barWidth / 2}
                            y="190"
                            fill={m.phaseColor}
                            fontSize="7.5"
                            fontWeight="800"
                            textAnchor="middle"
                          >
                            {m.phaseKey}
                          </text>
                        </g>
                      );
                    })}

                    {/* Intensity Line across Mesocycles */}
                    {macrocycleAnalysis.mesoSeries.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={macrocycleAnalysis.mesoSeries
                          .map((m, i) => {
                            const step = 540 / Math.max(macrocycleAnalysis.mesoSeries.length, 1);
                            const barWidth = Math.min(step * 0.52, 55);
                            const cx = 45 + i * step + (step - barWidth) / 2 + barWidth / 2;
                            const cy = 150 - (m.avgIntensity / (macrocycleAnalysis.maxMesoIntensity || 1)) * 105;
                            return `${cx},${cy}`;
                          })
                          .join(' ')}
                      />
                    )}

                    {/* Intensity Dots */}
                    {macrocycleAnalysis.mesoSeries.map((m, i) => {
                      const step = 540 / Math.max(macrocycleAnalysis.mesoSeries.length, 1);
                      const barWidth = Math.min(step * 0.52, 55);
                      const cx = 45 + i * step + (step - barWidth) / 2 + barWidth / 2;
                      const cy = 150 - (m.avgIntensity / (macrocycleAnalysis.maxMesoIntensity || 1)) * 105;

                      return (
                        <circle
                          key={`dot-${m.id}`}
                          cx={cx}
                          cy={cy}
                          r="3.5"
                          fill="#ffffff"
                          stroke="#f43f5e"
                          strokeWidth="1.5"
                        />
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Phase-by-Phase Drilldown List */}
          <div className="breakdown-list">
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>
              Phase Breakdown for {liftLabel} ({macrocycleAnalysis.mesoSeries.length} phases)
            </div>

            {macrocycleAnalysis.mesoSeries.map((m) => (
              <div
                key={m.id}
                className="breakdown-row"
                onClick={() => {
                  setSelectedMesoId(m.id);
                  setLevel('mesocycle');
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '800', color: '#ffffff', fontSize: '13px' }}>{m.name}</span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: '800',
                        color: m.phaseColor,
                        background: `${m.phaseColor}20`,
                        border: `1px solid ${m.phaseColor}40`,
                        padding: '1px 5px',
                        borderRadius: '4px',
                      }}
                    >
                      {m.phaseKey}
                    </span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                    {formatDateDMY(m.start)} — {formatDateDMY(m.end)} · {m.microcycleCount} wks
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '900', color: '#38bdf8', fontSize: '13px' }}>
                      {(m.volume / 1000).toFixed(1)}k kg
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>
                      Peak {m.peakWeight} kg
                    </div>
                  </div>
                  <span style={{ color: '#38bdf8', fontSize: '11px', fontWeight: '700' }}>Wave →</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ============================================================
          LEVEL 2: MESOCYCLE ANALYSIS & WEEKLY WAVE GRAPH
          ============================================================ */}
      {level === 'mesocycle' && mesocycleAnalysis && (
        <>
          {/* Mesocycle KPIs */}
          <div className="analytics-kpi-grid">
            <div className="kpi-card" style={{ borderLeft: '3px solid #f43f5e' }}>
              <div className="kpi-title">
                <span>{selectedLift === 'all' ? 'Phase Load' : `${liftLabel} Vol`}</span>
                <Dumbbell className="w-3 h-3 text-rose-400" />
              </div>
              <div className="kpi-value" style={{ color: '#f43f5e' }}>
                {(mesocycleAnalysis.totalMetrics.volume / 1000).toFixed(1)}k <span style={{ fontSize: '10px' }}>kg</span>
              </div>
              <div className="kpi-sub">
                Avg {(mesocycleAnalysis.totalMetrics.volume / Math.max(mesocycleAnalysis.microSeries.length, 1) / 1000).toFixed(1)}k kg/wk
              </div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '3px solid #38bdf8' }}>
              <div className="kpi-title">
                <span>{selectedLift === 'all' ? 'Microcycles' : `${liftLabel} Sets`}</span>
                <Calendar className="w-3 h-3 text-sky-400" />
              </div>
              <div className="kpi-value" style={{ color: '#38bdf8' }}>
                {selectedLift === 'all' ? mesocycleAnalysis.microSeries.length : mesocycleAnalysis.totalMetrics.totalSets}
                <span style={{ fontSize: '10px', marginLeft: '3px' }}>
                  {selectedLift === 'all' ? 'weeks' : 'sets'}
                </span>
              </div>
              <div className="kpi-sub">
                {mesocycleAnalysis.totalMetrics.workoutsScheduled} workouts scheduled
              </div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '3px solid #f59e0b' }}>
              <div className="kpi-title">
                <span>Wave Slope</span>
                <Flame className="w-3 h-3 text-amber-400" />
              </div>
              <div className="kpi-value" style={{ color: '#f59e0b' }}>
                {mesocycleAnalysis.volumeProgressionRate > 0 ? `+${mesocycleAnalysis.volumeProgressionRate}%` : `${mesocycleAnalysis.volumeProgressionRate}%`}
              </div>
              <div className="kpi-sub">Week 1 to peak delta</div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '3px solid #10b981' }}>
              <div className="kpi-title">
                <span>Peak {selectedLift === 'all' ? 'Intensity' : liftLabel}</span>
                <Zap className="w-3 h-3 text-emerald-400" />
              </div>
              <div className="kpi-value" style={{ color: '#34d399' }}>
                {mesocycleAnalysis.totalMetrics.peakWeight} <span style={{ fontSize: '10px' }}>kg</span>
              </div>
              <div className="kpi-sub">
                Est 1RM: {mesocycleAnalysis.totalMetrics.peak1RM} kg
              </div>
            </div>
          </div>

          {/* Week Selector Chips for rapid drilldown into any week */}
          {mesoMicrocycles.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              boxSizing: 'border-box',
              width: '100%',
              marginBottom: '2px',
            }}>
              <span style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', flexShrink: 0, textTransform: 'uppercase' }}>
                Inspect Week:
              </span>
              {mesoMicrocycles.map((mc, idx) => (
                <button
                  key={mc.id}
                  type="button"
                  onClick={() => {
                    setSelectedMicId(mc.id);
                    setLevel('microcycle');
                    if (onLevelChange) onLevelChange('microcycle');
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                  title={`Open Microcycle ${mc.index || idx + 1} daily workouts`}
                >
                  W{mc.index || idx + 1}{mc.label ? ` · ${mc.label}` : ''}
                </button>
              ))}
            </div>
          )}

          {/* Chart View Switcher */}
          <div className="chart-mode-pill-bar">
            <button
              type="button"
              onClick={() => setChartViewMode('1rm')}
              className={`chart-mode-pill ${chartViewMode === '1rm' ? 'chart-mode-pill-active' : ''}`}
            >
              🎯 Est 1RM
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('bestWeight')}
              className={`chart-mode-pill ${chartViewMode === 'bestWeight' ? 'chart-mode-pill-active' : ''}`}
            >
              ⚡ Best Wt
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('volume')}
              className={`chart-mode-pill ${chartViewMode === 'volume' ? 'chart-mode-pill-active' : ''}`}
            >
              📊 Volume
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('all')}
              className={`chart-mode-pill ${chartViewMode === 'all' ? 'chart-mode-pill-active' : ''}`}
            >
              ☷ All (3)
            </button>
          </div>

          {/* Graph 1: Mesocycle Weekly Estimated 1RM Progression (Dedicated, Clean Emerald Curve) */}
          {(chartViewMode === 'all' || chartViewMode === '1rm') && (
            <div className="chart-surface-card" style={{ borderLeft: '3px solid #10b981' }}>
              <div className="chart-surface-header">
                <div className="chart-surface-title">
                  <Target className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{currentMeso?.name || 'Mesocycle'} · {liftLabel} Est. 1RM</span>
                </div>

                <div className="chart-legend-row">
                  <span className="legend-chip" style={{ color: '#10b981', fontWeight: '800' }}>
                    Peak 1RM: {mesocycleAnalysis.totalMetrics.peak1RM} kg
                  </span>
                </div>
              </div>

              {mesocycleAnalysis.microSeries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '12px' }}>
                  No microcycle weeks configured for this phase yet.
                </div>
              ) : (
                <div style={{ width: '100%', height: '200px', position: 'relative' }}>
                  <svg
                    viewBox="0 0 620 200"
                    style={{ width: '100%', height: '100%', overflow: 'visible' }}
                  >
                    {/* Guidelines */}
                    <line x1="35" y1="25" x2="590" y2="25" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="70" x2="590" y2="70" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="115" x2="590" y2="115" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="160" x2="590" y2="160" stroke="rgba(255,255,255,0.15)" />

                    {/* Scale Y-labels */}
                    <text x="32" y="28" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {mesocycleAnalysis.maxMicStrength}
                    </text>
                    <text x="32" y="73" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {Math.round(mesocycleAnalysis.maxMicStrength * 0.66)}
                    </text>
                    <text x="32" y="118" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {Math.round(mesocycleAnalysis.maxMicStrength * 0.33)}
                    </text>
                    <text x="32" y="163" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      0
                    </text>

                    {/* Weekly Estimated 1RM Trendline (Connects only active weeks) */}
                    {mesocycleAnalysis.microSeries.filter((mc) => mc.peak1RM > 0).length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={mesocycleAnalysis.microSeries
                          .map((mc, i) => {
                            if (!mc.peak1RM || mc.peak1RM <= 0) return null;
                            const step = 530 / Math.max(mesocycleAnalysis.microSeries.length, 1);
                            const cx = 50 + i * step + step / 2;
                            const cy =
                              160 -
                              (mc.peak1RM / (mesocycleAnalysis.maxMicStrength || 1)) * 135;
                            return `${cx},${cy}`;
                          })
                          .filter(Boolean)
                          .join(' ')}
                      />
                    )}

                    {/* Weekly 1RM Nodes and Badges */}
                    {mesocycleAnalysis.microSeries.map((mc, i) => {
                      const step = 530 / Math.max(mesocycleAnalysis.microSeries.length, 1);
                      const cx = 50 + i * step + step / 2;
                      const has1RM = Boolean(mc.peak1RM && mc.peak1RM > 0);
                      const cy = has1RM
                        ? 160 - (mc.peak1RM / (mesocycleAnalysis.maxMicStrength || 1)) * 135
                        : 160;

                      return (
                        <g
                          key={`str-1rm-mc-${mc.id}`}
                          onClick={() => {
                            setSelectedMicId(mc.id);
                            setLevel('microcycle');
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          {has1RM ? (
                            <>
                              <circle
                                cx={cx}
                                cy={cy}
                                r="4.5"
                                fill="#ffffff"
                                stroke="#10b981"
                                strokeWidth="2.5"
                              />
                              <rect
                                x={cx - 24}
                                y={Math.max(6, cy - 19)}
                                width="48"
                                height="14"
                                rx="4"
                                fill="#064e3b"
                                stroke="#10b981"
                                strokeWidth="1"
                                opacity="0.95"
                              />
                              <text
                                x={cx}
                                y={Math.max(6, cy - 19) + 10}
                                fill="#34d399"
                                fontSize="8"
                                fontWeight="900"
                                textAnchor="middle"
                              >
                                1RM {mc.peak1RM}
                              </text>
                            </>
                          ) : (
                            <circle cx={cx} cy={160} r="2.5" fill="#334155" />
                          )}

                          {/* Week Bottom Label */}
                          <text
                            x={cx}
                            y="178"
                            fill="#cbd5e1"
                            fontSize="8.5"
                            fontWeight="700"
                            textAnchor="middle"
                          >
                            W{mc.index}
                          </text>

                          {mc.label && (
                            <text
                              x={cx}
                              y="192"
                              fill="#10b981"
                              fontSize="7.5"
                              fontWeight="800"
                              textAnchor="middle"
                            >
                              {mc.label.length > 7 ? `${mc.label.slice(0, 6)}…` : mc.label}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Graph 2: Mesocycle Weekly Best Working Weight (Dedicated Bar Chart) */}
          {(chartViewMode === 'all' || chartViewMode === 'bestWeight') && (
            <div className="chart-surface-card" style={{ borderLeft: '3px solid #38bdf8' }}>
              <div className="chart-surface-header">
                <div className="chart-surface-title">
                  <Dumbbell className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <span>{currentMeso?.name || 'Mesocycle'} · {liftLabel} Best Weight</span>
                </div>

                <div className="chart-legend-row">
                  <span className="legend-chip" style={{ color: '#38bdf8', fontWeight: '800' }}>
                    Peak: {mesocycleAnalysis.totalMetrics.peakWeight} kg
                  </span>
                </div>
              </div>

              {mesocycleAnalysis.microSeries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '12px' }}>
                  No microcycle weeks configured for this phase yet.
                </div>
              ) : (
                <div style={{ width: '100%', height: '200px', position: 'relative' }}>
                  <svg
                    viewBox="0 0 620 200"
                    style={{ width: '100%', height: '100%', overflow: 'visible' }}
                  >
                    <defs>
                      <linearGradient id="mesoBestWtGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
                      </linearGradient>
                    </defs>

                    {/* Guidelines */}
                    <line x1="35" y1="25" x2="590" y2="25" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="70" x2="590" y2="70" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="115" x2="590" y2="115" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="160" x2="590" y2="160" stroke="rgba(255,255,255,0.15)" />

                    {/* Scale Y-labels */}
                    <text x="32" y="28" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {mesocycleAnalysis.maxMicStrength}
                    </text>
                    <text x="32" y="73" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {Math.round(mesocycleAnalysis.maxMicStrength * 0.66)}
                    </text>
                    <text x="32" y="118" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {Math.round(mesocycleAnalysis.maxMicStrength * 0.33)}
                    </text>
                    <text x="32" y="163" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      0
                    </text>

                    {/* Weekly Best Weight Bars */}
                    {mesocycleAnalysis.microSeries.map((mc, i) => {
                      const step = 530 / Math.max(mesocycleAnalysis.microSeries.length, 1);
                      const barWidth = Math.min(step * 0.48, 52);
                      const x = 50 + i * step + (step - barWidth) / 2;
                      const barHeight = Math.max(
                        mc.peakWeight > 0 ? 8 : 2,
                        (mc.peakWeight / (mesocycleAnalysis.maxMicStrength || 1)) * 135
                      );
                      const y = 160 - barHeight;
                      const isHovered = hoveredIndex === i;

                      return (
                        <g
                          key={`str-mic-bar-${mc.id}`}
                          onMouseEnter={() => setHoveredIndex(i)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          onClick={() => {
                            setSelectedMicId(mc.id);
                            setLevel('microcycle');
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx={4}
                            fill={isHovered ? '#38bdf8' : 'url(#mesoBestWtGrad)'}
                            stroke={isHovered ? '#ffffff' : 'rgba(56, 189, 248, 0.4)'}
                            strokeWidth={isHovered ? 1.5 : 1}
                          />

                          {/* Best Weight text */}
                          <text
                            x={x + barWidth / 2}
                            y={y - 5}
                            fill="#38bdf8"
                            fontSize="8.5"
                            fontWeight="800"
                            textAnchor="middle"
                          >
                            {mc.peakWeight > 0 ? `${mc.peakWeight} kg` : '—'}
                          </text>

                          {/* Week Bottom Label */}
                          <text
                            x={x + barWidth / 2}
                            y="178"
                            fill="#cbd5e1"
                            fontSize="8.5"
                            fontWeight="700"
                            textAnchor="middle"
                          >
                            W{mc.index}
                          </text>

                          {mc.label && (
                            <text
                              x={x + barWidth / 2}
                              y="192"
                              fill="#38bdf8"
                              fontSize="7.5"
                              fontWeight="800"
                              textAnchor="middle"
                            >
                              {mc.label.length > 7 ? `${mc.label.slice(0, 6)}…` : mc.label}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Graph 3: Mesocycle Weekly Load Wave SVG Chart */}
          {(chartViewMode === 'all' || chartViewMode === 'volume') && (
            <div className="chart-surface-card">
              <div className="chart-surface-header">
                <div className="chart-surface-title">
                  <Activity className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{currentMeso?.name || 'Mesocycle'} — {liftLabel} Volume Wave</span>
                </div>

                <div className="chart-legend-row">
                  <span className="legend-chip" style={{ color: '#f43f5e' }}>
                    <span style={{ width: '8px', height: '8px', background: '#f43f5e', borderRadius: '2px' }} />
                    Week Vol (kg)
                  </span>
                  <span className="legend-chip" style={{ color: '#38bdf8' }}>
                    <span style={{ width: '10px', height: '2.5px', background: '#38bdf8', borderRadius: '2px' }} />
                    Avg Intensity (kg/rep)
                  </span>
                </div>
              </div>

              {mesocycleAnalysis.microSeries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '12px' }}>
                  No microcycle weeks configured for this phase yet.
                </div>
              ) : (
                <div style={{ width: '100%', height: '210px', position: 'relative' }}>
                  <svg
                    viewBox="0 0 620 210"
                    style={{ width: '100%', height: '100%', overflow: 'visible' }}
                  >
                    <defs>
                      <linearGradient id="mesoBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.85" />
                        <stop offset="100%" stopColor="#be123c" stopOpacity="0.3" />
                      </linearGradient>
                    </defs>

                    {/* Guidelines */}
                    <line x1="35" y1="25" x2="590" y2="25" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="80" x2="590" y2="80" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="135" x2="590" y2="135" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="165" x2="590" y2="165" stroke="rgba(255,255,255,0.15)" />

                    {/* Microcycle Volume Bars */}
                    {mesocycleAnalysis.microSeries.map((mc, i) => {
                      const step = 540 / Math.max(mesocycleAnalysis.microSeries.length, 1);
                      const barWidth = Math.min(step * 0.52, 55);
                      const x = 45 + i * step + (step - barWidth) / 2;
                      const barHeight = Math.max(
                        mc.volume > 0 ? 8 : 2,
                        (mc.volume / (mesocycleAnalysis.maxMicVol || 1)) * 130
                      );
                      const y = 165 - barHeight;
                      const isHovered = hoveredIndex === i;

                      return (
                        <g
                          key={mc.id}
                          onMouseEnter={() => setHoveredIndex(i)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          onClick={() => {
                            setSelectedMicId(mc.id);
                            setLevel('microcycle');
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx={4}
                            fill={isHovered ? '#f43f5e' : 'url(#mesoBarGrad)'}
                            opacity={isHovered ? 1 : 0.85}
                            stroke={isHovered ? '#ffffff' : 'transparent'}
                            strokeWidth={isHovered ? 1.5 : 0}
                          />

                          {/* Top Volume Label */}
                          <text
                            x={x + barWidth / 2}
                            y={y - 5}
                            fill="#ffffff"
                            fontSize="9"
                            fontWeight="800"
                            textAnchor="middle"
                          >
                            {mc.volume > 0 ? `${(mc.volume / 1000).toFixed(1)}k` : '0'}
                          </text>

                          {/* Week Bottom Label */}
                          <text
                            x={x + barWidth / 2}
                            y="180"
                            fill="#cbd5e1"
                            fontSize="8.5"
                            fontWeight="700"
                            textAnchor="middle"
                          >
                            W{mc.index}
                          </text>

                          {mc.label && (
                            <text
                              x={x + barWidth / 2}
                              y="194"
                              fill="#38bdf8"
                              fontSize="7.5"
                              fontWeight="800"
                              textAnchor="middle"
                            >
                              {mc.label.length > 7 ? `${mc.label.slice(0, 6)}…` : mc.label}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Intensity Line across Microcycles */}
                    {mesocycleAnalysis.microSeries.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={mesocycleAnalysis.microSeries
                          .map((mc, i) => {
                            const step = 540 / Math.max(mesocycleAnalysis.microSeries.length, 1);
                            const barWidth = Math.min(step * 0.52, 55);
                            const cx = 45 + i * step + (step - barWidth) / 2 + barWidth / 2;
                            const cy =
                              155 -
                              (mc.avgIntensity / (mesocycleAnalysis.maxMicIntensity || 1)) * 105;
                            return `${cx},${cy}`;
                          })
                          .join(' ')}
                      />
                    )}

                    {/* Intensity Dots */}
                    {mesocycleAnalysis.microSeries.map((mc, i) => {
                      const step = 540 / Math.max(mesocycleAnalysis.microSeries.length, 1);
                      const barWidth = Math.min(step * 0.52, 55);
                      const cx = 45 + i * step + (step - barWidth) / 2 + barWidth / 2;
                      const cy =
                        155 -
                        (mc.avgIntensity / (mesocycleAnalysis.maxMicIntensity || 1)) * 105;

                      return (
                        <circle
                          key={`dot-mic-${mc.id}`}
                          cx={cx}
                          cy={cy}
                          r="3.5"
                          fill="#ffffff"
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Microcycle Weeks List */}
          <div className="breakdown-list">
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>
              Microcycle Weeks for {liftLabel} ({mesocycleAnalysis.microSeries.length} weeks)
            </div>

            {mesocycleAnalysis.microSeries.map((mc) => (
              <div
                key={mc.id}
                className="breakdown-row"
                onClick={() => {
                  setSelectedMicId(mc.id);
                  setLevel('microcycle');
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '800', color: '#ffffff', fontSize: '13px' }}>
                      Microcycle {mc.index}
                    </span>
                    {mc.label && (
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontWeight: '800',
                          color: '#38bdf8',
                          background: 'rgba(56, 189, 248, 0.15)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                        }}
                      >
                        {mc.label}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                    {mc.daysCount} days · {mc.workoutsCompleted} done · {mc.totalSets} sets ({mc.totalReps} reps)
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '900', color: '#f43f5e', fontSize: '13px' }}>
                      {(mc.volume / 1000).toFixed(1)}k kg
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>
                      Peak {mc.peakWeight} kg
                    </div>
                  </div>
                  <span style={{ color: '#f43f5e', fontSize: '11px', fontWeight: '700' }}>Days →</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ============================================================
          LEVEL 3: MICROCYCLE ANALYSIS & DAY DISTRIBUTION GRAPH
          ============================================================ */}
      {level === 'microcycle' && microcycleAnalysis && (
        <>
          {/* Microcycle Header & Navigation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.75), rgba(15, 23, 42, 0.95))',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '10px',
            padding: '7px 10px',
            boxSizing: 'border-box',
            width: '100%',
          }}>
            <button
              type="button"
              onClick={() => {
                setLevel('mesocycle');
                if (onLevelChange) onLevelChange('mesocycle');
              }}
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '6px',
                color: '#38bdf8',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0,
              }}
            >
              ← {currentMeso?.name || 'Phase'} Wave
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {mesoMicrocycles.map((mc, idx) => (
                <button
                  key={mc.id}
                  type="button"
                  onClick={() => setSelectedMicId(mc.id)}
                  style={{
                    background: mc.id === currentMicrocycle?.id ? '#38bdf8' : 'rgba(255, 255, 255, 0.06)',
                    color: mc.id === currentMicrocycle?.id ? '#0f172a' : '#94a3b8',
                    border: 'none',
                    borderRadius: '5px',
                    padding: '3px 7px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  W{mc.index || idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Microcycle KPIs */}
          <div className="analytics-kpi-grid">
            <div className="kpi-card" style={{ borderLeft: '3px solid #10b981' }}>
              <div className="kpi-title">
                <span>{selectedLift === 'all' ? 'Week Load' : `${liftLabel} Vol`}</span>
                <Dumbbell className="w-3 h-3 text-emerald-400" />
              </div>
              <div className="kpi-value" style={{ color: '#34d399' }}>
                {(microcycleAnalysis.totalMetrics.volume / 1000).toFixed(1)}k <span style={{ fontSize: '10px' }}>kg</span>
              </div>
              <div className="kpi-sub">
                {microcycleAnalysis.totalMetrics.totalSets} sets ({microcycleAnalysis.totalMetrics.totalReps} reps)
              </div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '3px solid #38bdf8' }}>
              <div className="kpi-title">
                <span>{selectedLift === 'all' ? 'Work / Rest' : `${liftLabel} Days`}</span>
                <Activity className="w-3 h-3 text-sky-400" />
              </div>
              <div className="kpi-value" style={{ color: '#38bdf8' }}>
                {selectedLift === 'all'
                  ? `${microcycleAnalysis.totalMetrics.workoutsScheduled}W / ${microcycleAnalysis.totalMetrics.restDays}R`
                  : `${microcycleAnalysis.totalMetrics.sessionsWithLift} sessions`}
              </div>
              <div className="kpi-sub">
                {microcycleAnalysis.daySeries.length} total days
              </div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '3px solid #f59e0b' }}>
              <div className="kpi-title">
                <span>Peak {selectedLift === 'all' ? 'Weight' : liftLabel}</span>
                <Zap className="w-3 h-3 text-amber-400" />
              </div>
              <div className="kpi-value" style={{ color: '#f59e0b' }}>
                {microcycleAnalysis.totalMetrics.peakWeight} <span style={{ fontSize: '10px' }}>kg</span>
              </div>
              <div className="kpi-sub">
                Est 1RM: {microcycleAnalysis.totalMetrics.peak1RM} kg
              </div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '3px solid #8b5cf6' }}>
              <div className="kpi-title">
                <span>Workload Density</span>
                <Flame className="w-3 h-3 text-purple-400" />
              </div>
              <div className="kpi-value" style={{ color: '#c084fc' }}>
                {microcycleAnalysis.totalMetrics.avgIntensity} <span style={{ fontSize: '10px' }}>kg/rep</span>
              </div>
              <div className="kpi-sub">Average load per rep</div>
            </div>
          </div>

          {/* Chart View Switcher */}
          <div className="chart-mode-pill-bar">
            <button
              type="button"
              onClick={() => setChartViewMode('1rm')}
              className={`chart-mode-pill ${chartViewMode === '1rm' ? 'chart-mode-pill-active' : ''}`}
            >
              🎯 Est 1RM
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('bestWeight')}
              className={`chart-mode-pill ${chartViewMode === 'bestWeight' ? 'chart-mode-pill-active' : ''}`}
            >
              ⚡ Best Wt
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('volume')}
              className={`chart-mode-pill ${chartViewMode === 'volume' ? 'chart-mode-pill-active' : ''}`}
            >
              📊 Volume
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('all')}
              className={`chart-mode-pill ${chartViewMode === 'all' ? 'chart-mode-pill-active' : ''}`}
            >
              ☷ All (3)
            </button>
          </div>

          {/* Graph 1: Microcycle Daily Estimated 1RM Progression (Dedicated, Clean Emerald Curve) */}
          {(chartViewMode === 'all' || chartViewMode === '1rm') && (
            <div className="chart-surface-card" style={{ borderLeft: '3px solid #10b981' }}>
              <div className="chart-surface-header">
                <div className="chart-surface-title">
                  <Target className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Microcycle {currentMicrocycle?.index} · {liftLabel} Est. 1RM</span>
                </div>

                <div className="chart-legend-row">
                  <span className="legend-chip" style={{ color: '#10b981', fontWeight: '800' }}>
                    Peak 1RM: {microcycleAnalysis.totalMetrics.peak1RM} kg
                  </span>
                </div>
              </div>

              {microcycleAnalysis.daySeries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '12px' }}>
                  No days configured in this microcycle.
                </div>
              ) : (
                <div style={{ width: '100%', height: '200px', position: 'relative' }}>
                  <svg
                    viewBox="0 0 620 200"
                    style={{ width: '100%', height: '100%', overflow: 'visible' }}
                  >
                    {/* Reference Grid lines */}
                    <line x1="35" y1="25" x2="590" y2="25" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="70" x2="590" y2="70" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="115" x2="590" y2="115" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="160" x2="590" y2="160" stroke="rgba(255,255,255,0.15)" />

                    {/* Scale Y-labels */}
                    <text x="32" y="28" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {microcycleAnalysis.maxDayStrength}
                    </text>
                    <text x="32" y="73" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {Math.round(microcycleAnalysis.maxDayStrength * 0.66)}
                    </text>
                    <text x="32" y="118" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {Math.round(microcycleAnalysis.maxDayStrength * 0.33)}
                    </text>
                    <text x="32" y="163" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      0
                    </text>

                    {/* Day Estimated 1RM Trendline: connects ONLY active days where peak1RM > 0 (does not plunge to 0 on rest days) */}
                    {microcycleAnalysis.daySeries.filter((d) => (d.peak1RM || 0) > 0).length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={microcycleAnalysis.daySeries
                          .map((d, i) => {
                            if (!d.peak1RM || d.peak1RM <= 0) return null;
                            const step = 540 / Math.max(microcycleAnalysis.daySeries.length, 1);
                            const barWidth = Math.min(step * 0.45, 48);
                            const cx = 45 + i * step + (step - barWidth) / 2 + barWidth / 2;
                            const cy =
                              160 -
                              ((d.peak1RM || 0) / (microcycleAnalysis.maxDayStrength || 1)) * 135;
                            return `${cx},${cy}`;
                          })
                          .filter(Boolean)
                          .join(' ')}
                      />
                    )}

                    {/* Day 1RM Dots, Badges, and Day Labels */}
                    {microcycleAnalysis.daySeries.map((d, i) => {
                      const step = 540 / Math.max(microcycleAnalysis.daySeries.length, 1);
                      const barWidth = Math.min(step * 0.45, 48);
                      const cx = 45 + i * step + (step - barWidth) / 2 + barWidth / 2;
                      const has1RM = Boolean(d.peak1RM && d.peak1RM > 0);
                      const cy = has1RM
                        ? 160 - ((d.peak1RM || 0) / (microcycleAnalysis.maxDayStrength || 1)) * 135
                        : 160;

                      return (
                        <g
                          key={`str-1rm-dot-${d.day.id}`}
                          onClick={() => {
                            if (onDayClick && currentMeso && currentMicrocycle) {
                              onDayClick(currentMeso.id, currentMicrocycle.id, d.day);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          {has1RM ? (
                            <>
                              <circle
                                cx={cx}
                                cy={cy}
                                r="4.5"
                                fill="#ffffff"
                                stroke="#10b981"
                                strokeWidth="2.5"
                              />
                              <rect
                                x={cx - 24}
                                y={Math.max(6, cy - 19)}
                                width="48"
                                height="14"
                                rx="4"
                                fill="#064e3b"
                                stroke="#10b981"
                                strokeWidth="1"
                                opacity="0.95"
                              />
                              <text
                                x={cx}
                                y={Math.max(6, cy - 19) + 10}
                                fill="#34d399"
                                fontSize="8"
                                fontWeight="900"
                                textAnchor="middle"
                              >
                                1RM {d.peak1RM}
                              </text>
                            </>
                          ) : (
                            <circle cx={cx} cy={160} r="2.5" fill="#334155" />
                          )}

                          {/* Day Label Bottom */}
                          <text
                            x={cx}
                            y="175"
                            fill={d.isToday ? '#38bdf8' : '#cbd5e1'}
                            fontSize="8.5"
                            fontWeight={d.isToday ? '900' : '700'}
                            textAnchor="middle"
                          >
                            D{d.index}
                          </text>

                          {/* Date label */}
                          <text
                            x={cx}
                            y="188"
                            fill={d.isToday ? '#38bdf8' : '#64748b'}
                            fontSize="7.5"
                            fontWeight="700"
                            textAnchor="middle"
                          >
                            {formatDateDMY(d.date).slice(0, 5)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Graph 2: Microcycle Daily Best Working Weight (Dedicated Bar Chart) */}
          {(chartViewMode === 'all' || chartViewMode === 'bestWeight') && (
            <div className="chart-surface-card" style={{ borderLeft: '3px solid #38bdf8' }}>
              <div className="chart-surface-header">
                <div className="chart-surface-title">
                  <Dumbbell className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <span>Microcycle {currentMicrocycle?.index} · {liftLabel} Best Weight</span>
                </div>

                <div className="chart-legend-row">
                  <span className="legend-chip" style={{ color: '#38bdf8', fontWeight: '800' }}>
                    Peak: {microcycleAnalysis.totalMetrics.peakWeight} kg
                  </span>
                </div>
              </div>

              {microcycleAnalysis.daySeries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '12px' }}>
                  No days configured in this microcycle.
                </div>
              ) : (
                <div style={{ width: '100%', height: '200px', position: 'relative' }}>
                  <svg
                    viewBox="0 0 620 200"
                    style={{ width: '100%', height: '100%', overflow: 'visible' }}
                  >
                    <defs>
                      <linearGradient id="dayBestWtGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
                      </linearGradient>
                    </defs>

                    {/* Reference Grid lines */}
                    <line x1="35" y1="25" x2="590" y2="25" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="70" x2="590" y2="70" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="115" x2="590" y2="115" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="160" x2="590" y2="160" stroke="rgba(255,255,255,0.15)" />

                    {/* Scale Y-labels */}
                    <text x="32" y="28" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {microcycleAnalysis.maxDayStrength}
                    </text>
                    <text x="32" y="73" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {Math.round(microcycleAnalysis.maxDayStrength * 0.66)}
                    </text>
                    <text x="32" y="118" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      {Math.round(microcycleAnalysis.maxDayStrength * 0.33)}
                    </text>
                    <text x="32" y="163" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="end">
                      0
                    </text>

                    {/* Day Best Weight Bars */}
                    {microcycleAnalysis.daySeries.map((d, i) => {
                      const step = 540 / Math.max(microcycleAnalysis.daySeries.length, 1);
                      const barWidth = Math.min(step * 0.45, 48);
                      const x = 45 + i * step + (step - barWidth) / 2;
                      const barHeight = d.peakWeight > 0
                        ? Math.max(8, (d.peakWeight / (microcycleAnalysis.maxDayStrength || 1)) * 135)
                        : 4;
                      const y = 160 - barHeight;
                      const isHovered = hoveredIndex === i;

                      return (
                        <g
                          key={`str-day-bar-${d.day.id}`}
                          onMouseEnter={() => setHoveredIndex(i)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          onClick={() => {
                            if (onDayClick && currentMeso && currentMicrocycle) {
                              onDayClick(currentMeso.id, currentMicrocycle.id, d.day);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx={4}
                            fill={d.peakWeight > 0 ? (isHovered ? '#38bdf8' : 'url(#dayBestWtGrad)') : '#1e293b'}
                            stroke={
                              d.isToday
                                ? '#38bdf8'
                                : isHovered
                                ? '#ffffff'
                                : d.peakWeight > 0
                                ? 'rgba(56, 189, 248, 0.4)'
                                : 'transparent'
                            }
                            strokeWidth={d.isToday ? 2 : isHovered ? 1.5 : 1}
                          />

                          {/* Best Weight text above bar */}
                          <text
                            x={x + barWidth / 2}
                            y={y - 5}
                            fill={d.peakWeight > 0 ? '#38bdf8' : '#64748b'}
                            fontSize="8.5"
                            fontWeight="800"
                            textAnchor="middle"
                          >
                            {d.peakWeight > 0 ? `${d.peakWeight} kg` : d.isRest ? 'REST' : '—'}
                          </text>

                          {/* Day Label Bottom */}
                          <text
                            x={x + barWidth / 2}
                            y="175"
                            fill={d.isToday ? '#38bdf8' : '#cbd5e1'}
                            fontSize="8.5"
                            fontWeight={d.isToday ? '900' : '700'}
                            textAnchor="middle"
                          >
                            D{d.index}
                          </text>

                          {/* Date label */}
                          <text
                            x={x + barWidth / 2}
                            y="188"
                            fill={d.isToday ? '#38bdf8' : '#64748b'}
                            fontSize="7.5"
                            fontWeight="700"
                            textAnchor="middle"
                          >
                            {formatDateDMY(d.date).slice(0, 5)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Graph 3: Daily Workload Distribution SVG Bar Chart */}
          {(chartViewMode === 'all' || chartViewMode === 'volume') && (
            <div className="chart-surface-card">
              <div className="chart-surface-header">
                <div className="chart-surface-title">
                  <Calendar className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>
                    Microcycle {currentMicrocycle?.index} — {liftLabel} Daily Distribution
                  </span>
                </div>

                <div className="chart-legend-row">
                  <span className="legend-chip" style={{ color: '#34d399' }}>
                    <span style={{ width: '8px', height: '8px', background: '#34d399', borderRadius: '2px' }} />
                    Daily Vol (kg)
                  </span>
                  <span className="legend-chip" style={{ color: '#94a3b8' }}>
                    <span style={{ width: '8px', height: '8px', background: '#334155', borderRadius: '2px' }} />
                    Rest / Other
                  </span>
                </div>
              </div>

              {microcycleAnalysis.daySeries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '12px' }}>
                  No days configured in this microcycle.
                </div>
              ) : (
                <div style={{ width: '100%', height: '200px', position: 'relative' }}>
                  <svg
                    viewBox="0 0 620 200"
                    style={{ width: '100%', height: '100%', overflow: 'visible' }}
                  >
                    <defs>
                      <linearGradient id="dayWorkoutGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity="0.85" />
                        <stop offset="100%" stopColor="#059669" stopOpacity="0.3" />
                      </linearGradient>
                    </defs>

                    {/* Grid Lines */}
                    <line x1="35" y1="25" x2="590" y2="25" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="80" x2="590" y2="80" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="135" x2="590" y2="135" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                    <line x1="35" y1="160" x2="590" y2="160" stroke="rgba(255,255,255,0.15)" />

                    {/* Day Bars */}
                    {microcycleAnalysis.daySeries.map((d, i) => {
                      const step = 540 / Math.max(microcycleAnalysis.daySeries.length, 1);
                      const barWidth = Math.min(step * 0.52, 55);
                      const x = 45 + i * step + (step - barWidth) / 2;
                      const barHeight = d.volume > 0
                        ? Math.max(10, (d.volume / (microcycleAnalysis.maxDayVol || 1)) * 125)
                        : 5;
                      const y = 160 - barHeight;
                      const isHovered = hoveredIndex === i;

                      return (
                        <g
                          key={d.day.id}
                          onMouseEnter={() => setHoveredIndex(i)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          onClick={() => {
                            if (onDayClick && currentMeso && currentMicrocycle) {
                              onDayClick(currentMeso.id, currentMicrocycle.id, d.day);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx={4}
                            fill={
                              d.volume > 0
                                ? isHovered
                                  ? '#34d399'
                                  : 'url(#dayWorkoutGrad)'
                                : '#1e293b'
                            }
                            stroke={
                              d.isToday
                                ? '#38bdf8'
                                : isHovered
                                ? '#ffffff'
                                : d.volume > 0
                                ? 'rgba(52, 211, 153, 0.4)'
                                : 'transparent'
                            }
                            strokeWidth={d.isToday ? 2 : isHovered ? 1.5 : 1}
                          />

                          {/* Top Volume Label */}
                          <text
                            x={x + barWidth / 2}
                            y={y - 5}
                            fill={d.volume > 0 ? '#ffffff' : '#64748b'}
                            fontSize="8.5"
                            fontWeight="800"
                            textAnchor="middle"
                          >
                            {d.volume > 0 ? `${(d.volume / 1000).toFixed(1)}k` : d.isRest ? 'REST' : '—'}
                          </text>

                          {/* Day Label Bottom */}
                          <text
                            x={x + barWidth / 2}
                            y="175"
                            fill={d.isToday ? '#38bdf8' : '#cbd5e1'}
                            fontSize="8.5"
                            fontWeight={d.isToday ? '900' : '700'}
                            textAnchor="middle"
                          >
                            D{d.index}
                          </text>

                          {/* Date label */}
                          <text
                            x={x + barWidth / 2}
                            y="188"
                            fill={d.isToday ? '#38bdf8' : '#64748b'}
                            fontSize="7.5"
                            fontWeight="700"
                            textAnchor="middle"
                          >
                            {formatDateDMY(d.date).slice(0, 5)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Daily Schedule Drilldown List */}
          <div className="breakdown-list">
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>
              Daily Sessions ({microcycleAnalysis.daySeries.length} days)
            </div>

            {microcycleAnalysis.daySeries.map((d) => (
              <div
                key={d.day.id}
                className="breakdown-row"
                onClick={() => {
                  if (onDayClick && currentMeso && currentMicrocycle) {
                    onDayClick(currentMeso.id, currentMicrocycle.id, d.day);
                  }
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '800', color: '#ffffff', fontSize: '13px' }}>
                      Day {d.index}: {d.title}
                    </span>
                    {d.isToday && (
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: '800',
                          color: '#38bdf8',
                          background: 'rgba(56, 189, 248, 0.2)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                        }}
                      >
                        TODAY
                      </span>
                    )}
                    <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                      {formatDateDMY(d.date)}
                    </span>
                  </div>

                  <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.lifts.length > 0 ? (
                      <span>
                        {d.lifts.map((l) => l.name).join(' · ')} ({d.sets} sets)
                      </span>
                    ) : d.isRest ? (
                      <span style={{ color: '#38bdf8' }}>Recovery Scheduled</span>
                    ) : (
                      <span>Rest</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {d.volume > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '900', color: '#34d399', fontSize: '13px' }}>
                        {d.volume.toLocaleString()} kg
                      </div>
                      <div style={{ fontSize: '9.5px', color: '#64748b' }}>
                        Peak {d.peakWeight} kg
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                    title="Open workout day"
                  >
                    <ExternalLink size={12} className="text-sky-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
