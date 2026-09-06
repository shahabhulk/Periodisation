import React, { useState, useEffect, useRef, useMemo } from "react";
import { Pencil, Trash2, MoreVertical, RotateCcw, Share2, Star, BatteryCharging, AlertCircle, Timer, Dumbbell, Layers } from "lucide-react";
import { SidebarNav, NavHeaderButton, type TabType } from "./components/SidebarNav";
import { ExerciseKanbanView } from "./components/ExerciseKanbanView";
import { ProfileView } from "./components/ProfileView";
import { TimelineFeedView } from "./components/TimelineFeedView";
import { PeriodisationSettingsView } from "./components/PeriodisationSettingsView";
import { Analytics } from "./components/Analytics";
import { INITIAL_WORKOUT_DATA } from "./data/initialWorkoutData";
import type { WorkoutEntry } from "./types/workout";
import { fetchLyftaExercises } from "./services/lyftaApi";

/* ============================================================
   IRON LEDGER — powerlifting periodisation tracker
   Mesocycle -> Microcycle -> Day, with a PR shelf up top.
   Data persists via localStorage.
   ============================================================ */

const PHASES: Record<string, { color: string; label: string }> = {
  Hypertrophy: { color: "#f59e0b", label: "Hypertrophy" },
  Strength: { color: "#3b82f6", label: "Strength" },
  Peaking: { color: "#f43f5e", label: "Peaking" },
  Accumulation: { color: "#10b981", label: "Accumulation" },
  Base: { color: "#a855f7", label: "Base Building" },
  Deload: { color: "#06b6d4", label: "Deload" },
};

function phaseKeyFromName(name: string) {
  const n = name.toLowerCase();
  if (n.includes("peak")) return "Peaking";
  if (n.includes("accumul")) return "Accumulation";
  if (n.includes("strength")) return "Strength";
  if (n.includes("hypertrophy")) return "Hypertrophy";
  if (n.includes("deload") || n.includes("recovery")) return "Deload";
  return "Base";
}

const DAY_TYPES: Record<string, { label: string; color: string; iconType?: 'workout' | 'recovery' | 'alert' }> = {
  workout: { label: "Workout", color: "#10b981", iconType: 'workout' },
  recovery: { label: "Recovery", color: "#38bdf8", iconType: 'recovery' },
  event: { label: "Event", color: "#ef4444", iconType: 'alert' },
  illness: { label: "Illness", color: "#ef4444", iconType: 'alert' },
  note: { label: "Note", color: "#ef4444", iconType: 'alert' },
  empty: { label: "—", color: "transparent" },
};

const BODY_TAGS = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Full Body", "Cardio"];
// const LIFT_PRESETS = ["Squat", "Bench Press", "Deadlift", "Overhead Press", "Dumbbell Bench Press"];

const uid = () => Math.random().toString(36).slice(2, 10);

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmtDateFull(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
function fmtDateShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" });
}
function todayStr() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().slice(0, 10);
}

/* ---------- types ---------- */

interface SetEntry {
  id: string;
  type: string; // "W" or "1", "2", "3" etc.
  weight: string | number;
  reps: string | number;
  isPR: boolean;
  equipment?: 'raw' | 'gear';
}

interface LiftEntry {
  id: string;
  name: string;
  gifUrl?: string;
  unit: string; // e.g. "kg"
  sets: SetEntry[];
}

interface DayEntry {
  id: string;
  date: string;
  type: string;
  title: string;
  bodyTags: string[];
  lifts: LiftEntry[];
  notes: string;
  durationSeconds?: number;
}

interface Microcycle {
  id: string;
  index: number;
  label: string | null;
  days: DayEntry[];
}

interface Mesocycle {
  id: string;
  macroId: string;
  index: number;
  name: string;
  phaseKey: string;
  micRange: string;
  start: string;
  end: string;
  status: string;
  microcycles: Microcycle[];
}

interface Macrocycle {
  id: string;
  index: number;
  name: string;
  start: string;
}

interface PREntry {
  id: string;
  lift: string;
  weight: number;
  unit: string;
  reps: number;
  date: string;
  note?: string;
}

function healMesocycleDates(meso: Mesocycle): Mesocycle {
  let cursor = meso.start;
  const healedMicrocycles = meso.microcycles.map((mc) => {
    const healedDays = mc.days.map((d, i) => {
      const newDate = addDays(cursor, i);
      return { ...d, date: newDate };
    });
    cursor = addDays(cursor, mc.days.length);
    return { ...mc, days: healedDays };
  });

  const totalDays = meso.microcycles.reduce((acc, mc) => acc + mc.days.length, 0);
  const healedEnd = totalDays > 0 ? addDays(meso.start, totalDays - 1) : meso.end;
  const today = todayStr();
  const status = today < meso.start ? "upcoming" : today > healedEnd ? "completed" : "active";

  return {
    ...meso,
    end: healedEnd,
    status,
    microcycles: healedMicrocycles,
  };
}

function healAllMesocycles(mesos: Mesocycle[], macros: Macrocycle[]): Mesocycle[] {
  const macroList = [...(macros && macros.length > 0 ? macros : seedMacrocycles())];
  macroList.sort((a, b) => {
    const dateA = a.start || "";
    const dateB = b.start || "";
    if (dateA && dateB && dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    return (a.index || 0) - (b.index || 0);
  });
  const macroIdSet = new Set(macroList.map((m) => m.id));
  const defaultMacroId = macroList[0]?.id || "macro-1";

  const byMacro: Record<string, Mesocycle[]> = {};
  macroList.forEach((macro) => { byMacro[macro.id] = []; });

  mesos.forEach((m) => {
    const mId = (m.macroId && macroIdSet.has(m.macroId)) ? m.macroId : defaultMacroId;
    if (!byMacro[mId]) byMacro[mId] = [];
    byMacro[mId].push({ ...m, macroId: mId });
  });

  const result: Mesocycle[] = [];
  macroList.forEach((macro) => {
    const list = byMacro[macro.id] || [];
    // Sort mesocycles chronologically by start date so earlier phases appear first
    list.sort((a, b) => {
      const dateA = a.start || "";
      const dateB = b.start || "";
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      return (a.index || 0) - (b.index || 0);
    });

    let macroMicCursor = 0;

    list.forEach((m, idx) => {
      const micCount = m.microcycles.length;
      const startMic = macroMicCursor + 1;
      let endMic = macroMicCursor + (micCount > 0 ? micCount : 1);

      if (micCount === 0 && m.micRange) {
        const parts = m.micRange.split(/[–-]/);
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1] || parts[0], 10);
        const rangeLen = !isNaN(p0) && !isNaN(p1) && p1 >= p0 ? p1 - p0 + 1 : 1;
        endMic = macroMicCursor + rangeLen;
      }

      const micRangeStr = micCount > 0
        ? (micCount === 1 ? `${startMic}` : `${startMic}–${endMic}`)
        : (m.micRange || `${startMic}–${endMic}`);

      const reindexedMicrocycles = m.microcycles.map((mc, mcIdx) => ({
        ...mc,
        index: startMic + mcIdx,
      }));

      macroMicCursor = endMic;

      result.push(healMesocycleDates({
        ...m,
        index: idx + 1,
        micRange: micRangeStr,
        microcycles: reindexedMicrocycles,
      }));
    });
  });

  return result;
}

/* ---------- seed functions ---------- */

function buildMicrocycles(startDate: string, ranges: { index: number; length: number; label?: string | null }[]): Microcycle[] {
  let cursor = startDate;
  return ranges.map((r) => {
    const days: DayEntry[] = Array.from({ length: r.length }, (_, i) => ({
      id: uid(),
      date: addDays(cursor, i),
      type: "empty",
      title: "",
      bodyTags: [],
      lifts: [],
      notes: "",
    }));
    cursor = addDays(cursor, r.length);
    return { id: uid(), index: r.index, label: r.label || null, days };
  });
}

function seedMacrocycles(): Macrocycle[] {
  return [{ id: "macro-1", index: 1, name: "Macrocycle 1", start: "2025-09-15" }];
}

function seedMesocycles(): Mesocycle[] {
  const macroId = "macro-1";
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

  const today = todayStr();

  return meta.map((m) => {
    const status = today > m.end ? "completed" : today < m.start ? "upcoming" : "active";
    let microcycles: Microcycle[] = [];
    if (m.index === 12) {
      microcycles = buildMicrocycles(m.start, [
        { index: 37, length: 7 },
        { index: 38, length: 7 },
        { index: 39, length: 7, label: "Taper" },
        { index: 40, length: 7, label: "Deload" },
      ]);
    }
    return {
      id: uid(),
      macroId,
      index: m.index,
      name: m.name,
      phaseKey: phaseKeyFromName(m.name),
      micRange: m.micRange,
      start: m.start,
      end: m.end,
      status,
      microcycles,
    };
  });
}

function seedPRLog(): PREntry[] {
  return [
    { id: uid(), lift: "Bench Press", weight: 120, unit: "kg", reps: 1, date: "2025-10-10" },
    { id: uid(), lift: "Squat", weight: 130, unit: "kg", reps: 1, date: "2025-11-02" },
    { id: uid(), lift: "Bench Press", weight: 125, unit: "kg", reps: 1, date: "2026-03-03" },
    { id: uid(), lift: "Bench Press", weight: 130, unit: "kg", reps: 1, date: "2026-03-16" },
    { id: uid(), lift: "Squat", weight: 140, unit: "kg", reps: 1, date: "2026-06-03" },
    { id: uid(), lift: "Bench Press", weight: 130, unit: "kg", reps: 1, date: "2026-08-10", note: "elbow wraps" },
    { id: uid(), lift: "Dumbbell Bench Press", weight: 60, unit: "kg", reps: 1, date: "2026-08-23", note: "each side" },
  ];
}

/* ---------------- storage ---------------- */
const STORAGE_KEY = "iron-ledger-data";

function useLedgerStore() {
  const [macrocycles, setMacrocycles] = useState<Macrocycle[]>(seedMacrocycles);
  const [mesocycles, setMesocycles] = useState<Mesocycle[]>(seedMesocycles);
  const [prLog, setPrLog] = useState<PREntry[]>(seedPRLog);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const macros = parsed.macrocycles || seedMacrocycles();
        if (parsed.macrocycles) setMacrocycles(parsed.macrocycles);
        if (parsed.mesocycles) {
          const healed = healAllMesocycles(parsed.mesocycles, macros);
          setMesocycles(healed);
        } else {
          setMesocycles(healAllMesocycles(seedMesocycles(), macros));
        }
        if (parsed.prLog) setPrLog(parsed.prLog);
      } else {
        setMesocycles(healAllMesocycles(seedMesocycles(), seedMacrocycles()));
      }
    } catch {
      setMesocycles(healAllMesocycles(seedMesocycles(), seedMacrocycles()));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ macrocycles, mesocycles, prLog }));
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [macrocycles, mesocycles, prLog, loaded]);

  return { macrocycles, setMacrocycles, mesocycles, setMesocycles, prLog, setPrLog, loaded, saveState };
}

/* ---------------- small UI atoms ---------------- */

function PlateIcon({ size = 22, color = "#EDEAE2" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      <circle cx="12" cy="12" r="4.5" stroke={color} strokeWidth="1.4" opacity="0.6" />
    </svg>
  );
}

/* ---------------- Day modal ---------------- */

const SET_TYPE_ITEMS = [
  // Left Column
  { code: "W", label: "Warm-up", color: "#f59e0b", desc: "Low intensity set to prepare muscles and joints for working weight." },
  { code: "F", label: "Failure", color: "#ef4444", desc: "Set performed to complete muscular failure (0 RIR)." },
  { code: "L", label: "Left", color: "#10b981", desc: "Unilateral set performed for the left side only." },
  { code: "R", label: "Right", color: "#a855f7", desc: "Unilateral set performed for the right side only." },
  { code: "D", label: "Drop Set", color: "#3b82f6", desc: "Immediately drop weight and perform additional reps without rest." },
  { code: "N", label: "Negative", color: "#f97316", desc: "Focus on the eccentric/lowering phase under heavy load." },
  { code: "P", label: "Partial Reps", color: "#84cc16", desc: "Performing partial range-of-motion reps past technical failure." },
  { code: "M", label: "Myo Reps", color: "#f43f5e", desc: "Rest-pause activation set followed by short mini-sets." },
  { code: "FD", label: "Feeder Set", color: "#eab308", desc: "Low-fatigue set to acclimatize to heavier weight before working sets." },
  { code: "T", label: "Top Set", color: "#6366f1", desc: "The primary and heaviest working set of the exercise." },
  { code: "B", label: "Back-off Set", color: "#06b6d4", desc: "Lighter set performed after the top set for accumulated volume." },
];

function getSetTypeColor(type: string) {
  const match = SET_TYPE_ITEMS.find((item) => item.code === type);
  return match ? match.color : "#edeae2";
}

interface SwipeableSetRowProps {
  s: SetEntry;
  unit: string;
  listSetsLength: number;
  onOpenTypeModal: (id: string) => void;
  updateSet: (id: string, patch: Partial<SetEntry>) => void;
  removeSet: (id: string) => void;
}

function SwipeableSetRow({
  s,
  unit,
  listSetsLength,
  onOpenTypeModal,
  updateSet,
  removeSet,
}: SwipeableSetRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isHorizontalRef = useRef<boolean | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("input, button, select, label")) {
      touchStartXRef.current = null;
      return;
    }
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isHorizontalRef.current = null;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diffX = e.touches[0].clientX - touchStartXRef.current;
    const diffY = e.touches[0].clientY - (touchStartYRef.current || 0);

    if (isHorizontalRef.current === null) {
      if (Math.abs(diffX) > 6 || Math.abs(diffY) > 6) {
        isHorizontalRef.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    if (!isHorizontalRef.current) return;
    if (diffX < 0) {
      setOffsetX(diffX);
    } else {
      setOffsetX(0);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null) return;
    touchStartXRef.current = null;
    setIsSwiping(false);

    if (offsetX < -70 && listSetsLength > 1) {
      setIsDeleting(true);
      setOffsetX(-400);
      setTimeout(() => removeSet(s.id), 200);
    } else {
      setOffsetX(0);
    }
  };

  const triggerDeleteSet = () => {
    if (listSetsLength <= 1) return;
    setIsDeleting(true);
    setOffsetX(-400);
    setTimeout(() => removeSet(s.id), 200);
  };

  return (
    <div
      className="swipe-set-outer"
      style={{
        position: "relative",
        borderRadius: "8px",
        overflow: "hidden",
        maxHeight: isDeleting ? "0px" : "48px",
        opacity: isDeleting ? 0 : 1,
        transition: isDeleting ? "all 0.2s ease" : "none",
      }}
    >
      {/* Red Background Behind Set */}
      {listSetsLength > 1 && (
        <div
          onClick={triggerDeleteSet}
          style={{
            position: "absolute",
            inset: 0,
            background: "#dc2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingRight: "14px",
            borderRadius: "8px",
            color: "#ffffff",
            cursor: "pointer",
          }}
        >
          <Trash2 size={16} />
        </div>
      )}

      {/* Set Row Content */}
      <div
        className="set-row"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "var(--bg-elevated, #1a1e26)",
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? "none" : "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          padding: "2px 0",
        }}
      >
        {/* Set Type badge button */}
        <button
          type="button"
          className="set-type-badge-btn"
          onClick={() => onOpenTypeModal(s.id)}
          title="Tap to change set type"
          style={{ color: getSetTypeColor(s.type) }}
        >
          {s.type}
        </button>

        {/* Weight Input */}
        <input
          className="text-input set-num"
          type="number"
          placeholder="Wt"
          value={s.weight}
          onChange={(e) => updateSet(s.id, { weight: e.target.value })}
          style={{ width: "58px", padding: "4px 6px", fontSize: "12px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "6px" }}
        />
        <span style={{ fontSize: "11px", color: "var(--chalk-dim)" }}>{unit || "kg"}</span>

        <span style={{ color: "var(--chalk-dim)", fontSize: "12px" }}>×</span>

        {/* Reps Input */}
        <input
          className="text-input set-num"
          type="number"
          placeholder="Reps"
          value={s.reps}
          onChange={(e) => updateSet(s.id, { reps: e.target.value })}
          style={{ width: "48px", padding: "4px 6px", fontSize: "12px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "6px" }}
        />
        <span style={{ fontSize: "11px", color: "var(--chalk-dim)" }}>Reps</span>

        {/* Raw vs Gear Segmented Switch */}
        <div className="set-equip-toggle">
          <button
            type="button"
            className={`set-equip-btn ${s.equipment !== 'gear' ? 'is-raw' : ''}`}
            onClick={() => updateSet(s.id, { equipment: 'raw' })}
            title="Raw set"
          >
            Raw
          </button>
          <button
            type="button"
            className={`set-equip-btn ${s.equipment === 'gear' ? 'is-gear' : ''}`}
            onClick={() => updateSet(s.id, { equipment: 'gear' })}
            title="Gear / Equipped set"
          >
            Gear
          </button>
        </div>
      </div>
    </div>
  );
}

interface LiftRowItemProps {
  l: LiftEntry;
  updateLift: (id: string, patch: Partial<LiftEntry>) => void;
  removeLift: (id: string) => void;
  onOpenSetTypeModal: (liftId: string, setId: string) => void;
}

function LiftRowItem({ l, updateLift, removeLift, onOpenSetTypeModal }: LiftRowItemProps) {
  const [query, setQuery] = useState(String(l.name));
  const [suggestions, setSuggestions] = useState<{ exerciseId: string; name: string; gifUrl: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Swipe lift to remove state
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isHorizontalRef = useRef<boolean | null>(null);

  // Sync query when l.name changes from outside
  useEffect(() => {
    setQuery(String(l.name));
  }, [l.name]);

  // Migrate older flat dataset entries on the fly
  const listSets: SetEntry[] = useMemo(() => {
    if (Array.isArray(l.sets)) return l.sets;
    // Fallback migration mapping flat values to array of sets
    const count = parseInt(String((l as any).sets || 1), 10) || 1;
    return Array.from({ length: count }, (_, i) => ({
      id: uid() + i,
      type: String(i + 1),
      weight: (l as any).weight || "",
      reps: (l as any).reps || "",
      isPR: (l as any).isPR || false,
    }));
  }, [l.sets, (l as any).weight, (l as any).reps, (l as any).isPR]);

  // Persist migrated format to store state
  useEffect(() => {
    if (!Array.isArray(l.sets)) {
      updateLift(l.id, { sets: listSets });
    }
  }, [l.sets, listSets, l.id]);

  const handleNameChange = (val: string) => {
    setQuery(val);
    updateLift(l.id, { name: val });

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length >= 2) {
      debounceRef.current = setTimeout(async () => {
        try {
          const result = await fetchLyftaExercises({ search: val.trim(), limit: 20 });
          if (result.exercises && result.exercises.length > 0) {
            setSuggestions(
              result.exercises.map((ex) => ({
                exerciseId: ex.exerciseId,
                name: ex.name,
                gifUrl: ex.gifUrl,
              }))
            );
            setShowDropdown(true);
          } else {
            setSuggestions([]);
            setShowDropdown(false);
          }
        } catch (e) {
          console.error("Fuzzy search fetch failed:", e);
        }
      }, 300);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  };

  const selectSuggestion = (name: string, gifUrl: string) => {
    setQuery(name);
    updateLift(l.id, { name, gifUrl });
    setShowDropdown(false);
    setSuggestions([]);
  };

  const addSet = () => {
    const nextNum = listSets.filter((s) => !isNaN(Number(s.type))).length + 1;
    const lastSet = listSets[listSets.length - 1];
    const prevEquipment = lastSet?.equipment || 'raw';
    const newSets = [...listSets, { id: uid(), type: String(nextNum), weight: "", reps: "", isPR: false, equipment: prevEquipment }];
    updateLift(l.id, { sets: newSets });
  };

  const updateSet = (setId: string, patch: Partial<SetEntry>) => {
    const newSets = listSets.map(s => s.id === setId ? { ...s, ...patch } : s);
    updateLift(l.id, { sets: newSets });
  };

  const removeSet = (setId: string) => {
    const newSets = listSets.filter(s => s.id !== setId);
    updateLift(l.id, { sets: newSets });
  };

  const triggerDeleteLift = () => {
    setIsDeleting(true);
    setOffsetX(-600);
    setTimeout(() => {
      removeLift(l.id);
    }, 250);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("input, button, select, textarea, .suggestions-dropdown, .set-type-modal-backdrop, .swipe-set-outer")) {
      touchStartXRef.current = null;
      return;
    }
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isHorizontalRef.current = null;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diffX = e.touches[0].clientX - touchStartXRef.current;
    const diffY = e.touches[0].clientY - (touchStartYRef.current || 0);

    if (isHorizontalRef.current === null) {
      if (Math.abs(diffX) > 6 || Math.abs(diffY) > 6) {
        isHorizontalRef.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    if (!isHorizontalRef.current) return;
    if (diffX < 0) {
      setOffsetX(diffX);
    } else {
      setOffsetX(0);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null) return;
    touchStartXRef.current = null;
    setIsSwiping(false);

    if (offsetX < -90) {
      triggerDeleteLift();
    } else {
      setOffsetX(0);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("input, button, select, textarea, .suggestions-dropdown, .set-type-modal-backdrop, .swipe-set-outer")) {
      return;
    }
    const startX = e.clientX;
    setIsSwiping(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diffX = moveEvent.clientX - startX;
      if (diffX < 0) {
        setOffsetX(diffX);
      } else {
        setOffsetX(0);
      }
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      setIsSwiping(false);
      const diffX = upEvent.clientX - startX;
      if (diffX < -90) {
        triggerDeleteLift();
      } else {
        setOffsetX(0);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      className="swipe-lift-container"
      style={{
        position: "relative",
        borderRadius: "12px",
        overflow: "hidden",
        marginBottom: "10px",
        maxHeight: isDeleting ? "0px" : "1000px",
        opacity: isDeleting ? 0 : 1,
        transition: isDeleting ? "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)" : "none",
      }}
    >
      {/* Red Background Behind Lift with Delete Label & Trash Icon */}
      <div
        onClick={triggerDeleteLift}
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg, #991b1b 0%, #ef4444 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: "22px",
          gap: "8px",
          color: "#ffffff",
          fontWeight: 700,
          fontSize: "13px",
          borderRadius: "12px",
          cursor: "pointer",
        }}
      >
        <Trash2 size={20} />
        <span>Delete Lift</span>
      </div>

      {/* Foreground Lift Card */}
      <div
        className="lift-item-wrapper"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        style={{
          position: "relative",
          zIndex: 2,
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "12px",
          background: "var(--bg-elevated, #1a1e26)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? "none" : "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
          boxShadow: offsetX < 0 ? "-6px 0 20px rgba(0,0,0,0.5)" : "none",
          touchAction: "pan-y",
        }}
      >
        {/* Header Row */}
        <div className="lift-header" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* GIF Box Thumbnail */}
          <div className="lift-gif-box" style={{ width: "48px", height: "48px", borderRadius: "8px", border: "1px solid var(--border)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0b0d", flexShrink: 0 }}>
            {l.gifUrl ? (
              <img src={l.gifUrl} alt={l.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <PlateIcon size={18} color="var(--chalk-dim)" />
            )}
          </div>

          {/* Lift Name Input / Suggestion Box */}
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <input
              className="text-input lift-name"
              placeholder="Barbell Bench Press"
              value={query}
              onChange={(e) => handleNameChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowDropdown(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowDropdown(false), 200);
              }}
              style={{ fontWeight: "700", fontSize: "16px", fontFamily: "Oswald, sans-serif", border: "none", background: "transparent", borderBottom: "1px solid transparent", borderRadius: "0", padding: "4px 0" }}
            />
            {showDropdown && suggestions.length > 0 && (
              <div className="suggestions-dropdown" style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "0 0 7px 7px", zIndex: 10, maxHeight: "160px", overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
                {suggestions.map((s) => (
                  <div
                    key={s.exerciseId}
                    className="suggestion-item"
                    onMouseDown={() => selectSuggestion(s.name, s.gifUrl)}
                    style={{ padding: "8px 10px", fontSize: "12px", cursor: "pointer", color: "var(--chalk)", textTransform: "capitalize" }}
                  >
                    {s.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Header Actions (Cross mark removed, now swipe left to delete) */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            <select
              className="text-input lift-unit"
              value={l.unit || "kg"}
              onChange={(e) => updateLift(l.id, { unit: e.target.value })}
              style={{ width: "60px", padding: "4px 6px", fontSize: "12px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "6px" }}
            >
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={addSet}
              style={{ padding: "4px 8px", fontSize: "11px", height: "auto" }}
            >
              + Set
            </button>
          </div>
        </div>

        {/* Sets List (Indented with SwipeableSetRows) */}
        <div className="lift-sets-list" style={{ paddingLeft: "60px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {listSets.map((s) => (
            <SwipeableSetRow
              key={s.id}
              s={s}
              unit={l.unit}
              listSetsLength={listSets.length}
              onOpenTypeModal={() => onOpenSetTypeModal(l.id, s.id)}
              updateSet={updateSet}
              removeSet={removeSet}
            />
          ))}
        </div>
      </div>
    </div>
  );
}



function DayModal({ day, phaseColor, onClose, onSave, onDelete, onDiscard, onUpdateDraft, onGoToExerciseLibrary, onPerformAgain, initialEditMode = false, isLive = false }: {
  day: DayEntry; phaseColor: string; onClose: () => void; onSave: (d: DayEntry) => void; onDelete: (id: string) => void; onDiscard?: () => void; onUpdateDraft: (d: DayEntry) => void; onGoToExerciseLibrary: () => void;
  onPerformAgain?: (d: DayEntry) => void;
  initialEditMode?: boolean;
  isLive?: boolean;
}) {
  const [type, setType] = useState(day.type === "empty" ? "workout" : day.type);
  const [title, setTitle] = useState(day.title);
  const [bodyTags, setBodyTags] = useState(day.bodyTags || []);
  const [lifts, setLifts] = useState<LiftEntry[]>(day.lifts && day.lifts.length ? day.lifts : []);
  const [notes, setNotes] = useState(day.notes || "");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(day.durationSeconds || 0);
  const [activeSetTypeModalInfo, setActiveSetTypeModalInfo] = useState<{
    liftId: string;
    setId: string;
  } | null>(null);
  const [activeInfo, setActiveInfo] = useState<string | null>(null);

  const hasExistingData = day.type !== "empty" && ((day.lifts && day.lifts.length > 0) || (day.title && day.title.trim().length > 0));
  const [isEditMode, setIsEditMode] = useState<boolean>(initialEditMode || !hasExistingData);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  useEffect(() => {
    setType(day.type === "empty" ? "workout" : day.type);
    setTitle(day.title || "");
    setBodyTags(day.bodyTags || []);
    setLifts(day.lifts && day.lifts.length ? day.lifts : []);
    setNotes(day.notes || "");
    setElapsedSeconds(day.durationSeconds || 0);
    const exists = day.type !== "empty" && ((day.lifts && day.lifts.length > 0) || (day.title && day.title.trim().length > 0));
    setIsEditMode(Boolean(initialEditMode) || !exists);
    setIsMenuOpen(false);
    setShowDiscardConfirm(false);
  }, [day, initialEditMode]);

  const handleCancelClick = () => {
    if (isEditMode) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    if (onDiscard) {
      onDiscard();
    } else {
      onClose();
    }
  };

  useEffect(() => {
    // Only tick live timer during an active live workout session.
    // Finished/saved workout sessions display their recorded time statically without ticking!
    if (type !== 'workout' || !isLive) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [type, isLive]);

  const totalSets = useMemo(() => {
    return (lifts || []).reduce((acc, lift) => acc + (Array.isArray(lift.sets) ? lift.sets.length : 0), 0);
  }, [lifts]);

  const totalVolume = useMemo(() => {
    return (lifts || []).reduce((acc, lift) => {
      const sets = Array.isArray(lift.sets) ? lift.sets : [];
      const liftVol = sets.reduce((sum, s) => {
        const w = parseFloat(String(s.weight)) || 0;
        const r = parseFloat(String(s.reps)) || 0;
        return sum + (w * r);
      }, 0);
      return acc + liftVol;
    }, 0);
  }, [lifts]);

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    try {
      const favs = JSON.parse(localStorage.getItem("iron_favorite_workouts") || "[]");
      setIsFavorite(Array.isArray(favs) && favs.includes(day.id));
    } catch {
      setIsFavorite(false);
    }
  }, [day.id]);

  const toggleFavorite = () => {
    try {
      const favs: string[] = JSON.parse(localStorage.getItem("iron_favorite_workouts") || "[]");
      let updated: string[];
      if (favs.includes(day.id)) {
        updated = favs.filter((id) => id !== day.id);
        setIsFavorite(false);
      } else {
        updated = [...favs, day.id];
        setIsFavorite(true);
      }
      localStorage.setItem("iron_favorite_workouts", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    setIsMenuOpen(false);
  };

  const handleShare = () => {
    const lines = [
      `🏋️ ${title || "Workout Session"}`,
      `📅 ${fmtDateFull(day.date)}`,
      type === "workout" && elapsedSeconds > 0 ? `⏱ Duration: ${formatTimer(elapsedSeconds)}` : "",
      type === "workout" ? `📊 Volume: ${totalVolume.toLocaleString()} kg · ${totalSets} sets` : "",
      bodyTags.length > 0 ? `🎯 Focus: ${bodyTags.join(", ")}` : "",
      "",
      ...lifts.map((l) => {
        const setsText = (l.sets || [])
          .map((s) => `${s.weight || 0}${l.unit || "kg"} × ${s.reps || 0} (${s.equipment === 'gear' ? 'Gear' : 'Raw'})`)
          .join(", ");
        return `• ${l.name}: ${setsText}`;
      }),
      notes ? `\n📝 Notes: ${notes}` : "",
    ].filter(Boolean);

    const text = lines.join("\n");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2500);
      });
    }
    setIsMenuOpen(false);
  };

  const handlePerformAgain = () => {
    setIsMenuOpen(false);
    if (onPerformAgain) {
      onPerformAgain(day);
    }
  };

  const toggleTag = (tag: string) =>
    setBodyTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));

  const updateLift = (id: string, patch: Partial<LiftEntry>) =>
    setLifts((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeLift = (id: string) => setLifts((l) => l.filter((x) => x.id !== id));

  const handleAddLiftClick = () => {
    const cleanLifts = lifts.filter((l) => l.name.toString().trim());
    const updatedDraft: DayEntry = {
      ...day,
      type,
      title: title.trim(),
      bodyTags,
      lifts: cleanLifts,
      notes: notes.trim(),
      durationSeconds: type === "workout" ? elapsedSeconds : 0,
    };
    onUpdateDraft(updatedDraft);
    onGoToExerciseLibrary();
  };

  const handleSave = () => {
    const cleanLifts = lifts.filter((l) => l.name.toString().trim());
    onSave({
      ...day,
      type,
      title: title.trim(),
      bodyTags,
      lifts: cleanLifts,
      notes: notes.trim(),
      durationSeconds: type === "workout" ? elapsedSeconds : 0,
    });
  };

  return (
    <>
      <div className="modal-backdrop" onClick={handleCancelClick}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ "--phase": phaseColor, position: "relative" } as React.CSSProperties}>
          
          {/* Share toast */}
          {shareToast && (
            <div
              style={{
                position: "absolute",
                top: "16px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "#059669",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 700,
                padding: "6px 16px",
                borderRadius: "20px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                zIndex: 1100,
                pointerEvents: "none",
              }}
            >
              ✓ Workout copied to clipboard!
            </div>
          )}

          {/* Modal Header */}
          <div className="modal-header" style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
              <div className="modal-date">{fmtDateFull(day.date)}</div>
              {isFavorite && (
                <span title="Favorite Workout" style={{ color: "#fbbf24", display: "inline-flex", alignItems: "center" }}>
                  <Star size={15} fill="#fbbf24" />
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {/* 3-dots Menu Button ':' */}
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsMenuOpen(true)}
                title="Workout Session Options"
                aria-label="Workout Session Options"
                style={{
                  padding: "6px 8px",
                  borderRadius: "8px",
                  background: isMenuOpen ? "rgba(255,255,255,0.12)" : "transparent",
                  color: isMenuOpen ? "#ffffff" : "var(--chalk-dim)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MoreVertical size={18} />
              </button>

              {/* Close Button */}
              <button className="icon-btn" onClick={handleCancelClick} aria-label="Close">✕</button>
            </div>
          </div>

          <div className="modal-body">
            {!isEditMode ? (
              /* Non-Editable / Read-Only View */
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Title and tags */}
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", margin: 0, fontFamily: "Oswald, sans-serif", display: "flex", alignItems: "center", gap: "8px" }}>
                    {type === "recovery" && <BatteryCharging size={20} className="text-sky-400" style={{ color: "#38bdf8" }} />}
                    {["event", "illness", "note"].includes(type) && <AlertCircle size={20} className="text-rose-400" style={{ color: "#ef4444" }} />}
                    <span>{title || (type === "recovery" ? "Recovery" : type !== "workout" && type !== "empty" ? type.charAt(0).toUpperCase() + type.slice(1) : "Workout Session")}</span>
                  </h2>
                  {bodyTags && bodyTags.length > 0 && (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                      {bodyTags.map((tag) => (
                        <span key={tag} className="pill pill-sm" style={{ cursor: "default", opacity: 0.9 }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Compact Live Workout Stats Bar */}
                {type === "workout" && (
                  <div className="workout-live-stats-bar">
                    <div className="workout-live-stat-card">
                      <div className="workout-stat-header">
                        <Timer size={11} className="text-emerald-400 flex-shrink-0" />
                        <span className="workout-stat-label">Time</span>
                      </div>
                      <div className="workout-stat-value text-emerald-400">
                        {formatTimer(elapsedSeconds)}
                      </div>
                    </div>

                    <div className="workout-live-stat-card">
                      <div className="workout-stat-header">
                        <Dumbbell size={11} className="text-sky-400 flex-shrink-0" />
                        <span className="workout-stat-label">Volume</span>
                      </div>
                      <div className="workout-stat-value text-sky-400">
                        {totalVolume.toLocaleString()}<span className="workout-stat-unit">kg</span>
                      </div>
                    </div>

                    <div className="workout-live-stat-card">
                      <div className="workout-stat-header">
                        <Layers size={11} className="text-amber-400 flex-shrink-0" />
                        <span className="workout-stat-label">Sets</span>
                      </div>
                      <div className="workout-stat-value text-amber-400">
                        {totalSets}<span className="workout-stat-unit">sets</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Non-Editable Lifts View */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {lifts.length === 0 ? (
                    <div style={{ color: "var(--chalk-dim)", fontStyle: "italic", padding: "16px 0" }}>
                      No exercises in this session.
                    </div>
                  ) : (
                    lifts.map((l) => (
                      <div
                        key={l.id}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: "10px",
                          padding: "12px",
                          background: "var(--bg-elevated)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        {/* Lift Name & Thumbnail */}
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "42px", height: "42px", borderRadius: "8px", border: "1px solid var(--border)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0b0d", flexShrink: 0 }}>
                            {l.gifUrl ? (
                              <img src={l.gifUrl} alt={l.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <PlateIcon size={16} color="var(--chalk-dim)" />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: "15px", fontFamily: "Oswald, sans-serif", color: "#ffffff" }}>
                              {l.name}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--chalk-dim)" }}>
                              {(l.sets || []).length} {(l.sets || []).length === 1 ? "set" : "sets"}
                            </div>
                          </div>
                        </div>

                        {/* Sets list in clean read-only format */}
                        <div style={{ paddingLeft: "54px", display: "flex", flexDirection: "column", gap: "6px" }}>
                          {(l.sets || []).map((s) => (
                            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
                              <span
                                className="set-type-badge-btn"
                                style={{
                                  color: getSetTypeColor(s.type),
                                  cursor: "default",
                                  pointerEvents: "none",
                                  width: "36px",
                                  height: "26px",
                                  fontSize: "12px",
                                }}
                              >
                                {s.type}
                              </span>
                              <span style={{ fontWeight: 600, color: "var(--chalk)" }}>
                                {s.weight || 0} {l.unit || "kg"}
                              </span>
                              <span style={{ color: "var(--chalk-dim)", fontSize: "12px" }}>×</span>
                              <span style={{ fontWeight: 600, color: "var(--chalk)" }}>
                                {s.reps || 0} reps
                              </span>
                              {s.equipment === 'gear' ? (
                                <span className="read-gear-badge">Gear</span>
                              ) : (
                                <span className="read-raw-badge">Raw</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {notes && (
                  <div style={{ padding: "10px 14px", background: "var(--bg-card)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "11px", color: "var(--chalk-dim)", textTransform: "uppercase", marginBottom: "4px" }}>
                      Notes
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--chalk)", whiteSpace: "pre-wrap" }}>
                      {notes}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Editable Form */
              <>
                <div className="field-row">
                  <label className="field-label">Type</label>
                  <div className="type-pills">
                    {Object.entries(DAY_TYPES)
                      .filter(([k]) => k !== "empty")
                      .map(([k, v]) => (
                        <button
                          key={k}
                          className={`pill ${type === k ? "pill-active" : ""}`}
                          onClick={() => setType(k)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            ...(type === k && v.iconType === "workout" ? { borderColor: "#10b981", color: "#34d399", background: "rgba(16, 185, 129, 0.2)" } : {}),
                            ...(type === k && v.iconType === "recovery" ? { borderColor: "#38bdf8", color: "#38bdf8", background: "rgba(56, 189, 248, 0.2)" } : {}),
                            ...(type === k && v.iconType === "alert" ? { borderColor: "#ef4444", color: "#f87171", background: "rgba(239, 68, 68, 0.2)" } : {}),
                          }}
                        >
                          {v.iconType === "recovery" && <BatteryCharging size={12} className="text-sky-400" style={{ color: "#38bdf8" }} />}
                          {v.iconType === "alert" && <AlertCircle size={12} className="text-rose-400" style={{ color: "#ef4444" }} />}
                          <span>{v.label}</span>
                        </button>
                      ))}
                  </div>
                </div>

                {/* Compact Live Workout Stats Bar */}
                {type === "workout" && (
                  <div className="workout-live-stats-bar">
                    {/* Live Timer */}
                    <div className="workout-live-stat-card">
                      <div className="workout-stat-header">
                        <Timer size={11} className="text-emerald-400 flex-shrink-0" />
                        <span className="workout-stat-label">Time</span>
                      </div>
                      <div className="workout-stat-value text-emerald-400">
                        {formatTimer(elapsedSeconds)}
                      </div>
                    </div>

                    {/* Volume */}
                    <div className="workout-live-stat-card">
                      <div className="workout-stat-header">
                        <Dumbbell size={11} className="text-sky-400 flex-shrink-0" />
                        <span className="workout-stat-label">Volume</span>
                      </div>
                      <div className="workout-stat-value text-sky-400">
                        {totalVolume.toLocaleString()}<span className="workout-stat-unit">kg</span>
                      </div>
                    </div>

                    {/* Sets */}
                    <div className="workout-live-stat-card">
                      <div className="workout-stat-header">
                        <Layers size={11} className="text-amber-400 flex-shrink-0" />
                        <span className="workout-stat-label">Sets</span>
                      </div>
                      <div className="workout-stat-value text-amber-400">
                        {totalSets}<span className="workout-stat-unit">sets</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="field-row">
                  <label className="field-label" htmlFor="title-input">Title</label>
                  <input
                    id="title-input"
                    className="text-input"
                    placeholder={type === "workout" ? "e.g. Bench press + tricep" : "e.g. Feeling drained"}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {type === "workout" && (
                  <>
                    <div className="field-row">
                      <label className="field-label">Body focus</label>
                      <div className="type-pills">
                        {BODY_TAGS.map((tag) => (
                          <button
                            key={tag}
                            className={`pill pill-sm ${bodyTags.includes(tag) ? "pill-active" : ""}`}
                            onClick={() => toggleTag(tag)}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="field-row">
                      <label className="field-label">Lifts</label>
                      <div className="lift-table" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {lifts.map((l) => (
                          <LiftRowItem
                            key={l.id}
                            l={l}
                            updateLift={updateLift}
                            removeLift={removeLift}
                            onOpenSetTypeModal={(liftId, setId) => {
                              setActiveSetTypeModalInfo({ liftId, setId });
                              setActiveInfo(null);
                            }}
                          />
                        ))}

                        <button className="add-lift-btn" type="button" onClick={handleAddLiftClick}>+ Add lift</button>
                      </div>
                    </div>
                  </>
                )}

                <div className="field-row">
                  <label className="field-label" htmlFor="notes-input">Notes</label>
                  <textarea
                    id="notes-input"
                    className="text-input textarea"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            {!isEditMode ? (
              <>
                <button
                  className="btn-ghost"
                  onClick={() => setIsEditMode(true)}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <Pencil size={13} />
                  <span>Edit Workout</span>
                </button>
                <div className="spacer" />
                <button className="btn-primary" onClick={onClose}>Done</button>
              </>
            ) : (
              <>
                {day.type !== "empty" && (
                  <button className="btn-ghost" onClick={() => onDelete(day.id)}>Clear day</button>
                )}
                <div className="spacer" />
                <button
                  className="btn-ghost"
                  onClick={handleCancelClick}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    handleSave();
                    setIsEditMode(false);
                  }}
                >
                  Save entry
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Common Set Type Bottom Sheet Modal across all exercises */}
      {(() => {
        if (!activeSetTypeModalInfo) return null;
        const targetLift = lifts.find((l) => l.id === activeSetTypeModalInfo.liftId);
        if (!targetLift) return null;
        const sets: SetEntry[] = Array.isArray(targetLift.sets) ? targetLift.sets : [];
        const targetSet = sets.find((s) => s.id === activeSetTypeModalInfo.setId);
        if (!targetSet) return null;
        const targetIndex = sets.findIndex((s) => s.id === activeSetTypeModalInfo.setId);
        const normalSetNumber = targetIndex >= 0
          ? String(sets.slice(0, targetIndex + 1).filter((s) => s.id === targetSet.id || !isNaN(Number(s.type))).length || 1)
          : "1";
        const isNormalSelected = !isNaN(Number(targetSet.type));

        const handleSelectType = (code: string) => {
          const newType = code === "NORMAL" ? normalSetNumber : code;
          const updatedSets = sets.map((s) => (s.id === targetSet.id ? { ...s, type: newType } : s));
          updateLift(targetLift.id, { sets: updatedSets });
          setActiveSetTypeModalInfo(null);
          setActiveInfo(null);
        };

        const handleRemoveSet = () => {
          const updatedSets = sets.filter((s) => s.id !== targetSet.id);
          updateLift(targetLift.id, { sets: updatedSets });
          setActiveSetTypeModalInfo(null);
          setActiveInfo(null);
        };

        return (
          <div
            className="set-type-modal-backdrop"
            onClick={() => {
              setActiveSetTypeModalInfo(null);
              setActiveInfo(null);
            }}
          >
            <div
              className="set-type-bottom-sheet"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="set-type-drag-handle" />

              {/* Title Header with Exercise Name */}
              <div style={{ textAlign: "center", marginBottom: "14px" }}>
                <div style={{ fontSize: "12px", color: "var(--chalk-dim, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>
                  {targetLift.name || "Exercise"} • Set {normalSetNumber}
                </div>
                <div className="set-type-sheet-title" style={{ margin: 0 }}>
                  Select set type
                </div>
              </div>

              {/* Info hint banner if ? clicked */}
              {activeInfo && (
                <div className="set-type-info-banner">
                  <span>{activeInfo}</span>
                  <button
                    type="button"
                    onClick={() => setActiveInfo(null)}
                    className="set-type-info-close"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Normal Working Set option */}
              <button
                type="button"
                className={`set-type-grid-card ${isNormalSelected ? "is-selected" : ""}`}
                onClick={() => handleSelectType("NORMAL")}
                style={{ marginBottom: "8px", width: "100%" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ color: "#edeae2", fontWeight: 800, fontSize: "15px", width: "28px", textAlign: "left" }}>
                    {normalSetNumber}
                  </span>
                  <span style={{ color: "#ffffff", fontWeight: 600, fontSize: "14px" }}>
                    Normal Set
                  </span>
                </div>
                <span
                  className="set-type-help-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveInfo("Normal Set: Standard working set counted towards training volume.");
                  }}
                  title="View info"
                >
                  ?
                </span>
              </button>

              {/* 2-Column Grid (Row-by-Row matching user screenshot) */}
              <div className="set-type-options-grid">
                {SET_TYPE_ITEMS.map((item) => {
                  const isSelected = targetSet.type === item.code;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      className={`set-type-grid-card ${isSelected ? "is-selected" : ""}`}
                      onClick={() => handleSelectType(item.code)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ color: item.color, fontWeight: 800, fontSize: "15px", width: "28px", textAlign: "left" }}>
                          {item.code}
                        </span>
                        <span style={{ color: "#ffffff", fontWeight: 600, fontSize: "14px" }}>
                          {item.label}
                        </span>
                      </div>
                      <span
                        className="set-type-help-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveInfo(`${item.label}: ${item.desc}`);
                        }}
                        title="View info"
                      >
                        ?
                      </span>
                    </button>
                  );
                })}

                {/* Remove Set Button (Matching screenshot bottom-right) */}
                <button
                  type="button"
                  className="set-type-grid-card set-type-remove-card"
                  onClick={handleRemoveSet}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Trash2 size={16} className="text-rose-400" />
                    <span style={{ color: "#f87171", fontWeight: 600, fontSize: "14px" }}>
                      Remove set
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Workout Options Bottom Action Sheet for DayModal */}
      {isMenuOpen && (
        <div
          className="workout-sheet-backdrop"
          onClick={() => setIsMenuOpen(false)}
        >
          <div
            className="workout-sheet-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="workout-sheet-drag-handle" />

            {/* Header info */}
            <div className="workout-sheet-header">
              <div className="workout-sheet-title">
                {day.title || "Workout Session"}
              </div>
              <div className="workout-sheet-date">
                {fmtDateFull(day.date)} • {lifts.length} exercises
              </div>
            </div>

            {/* Menu options list */}
            <div className="workout-sheet-options">
              {/* 1. Edit */}
              <button
                type="button"
                className="workout-sheet-btn"
                onClick={() => {
                  setIsEditMode(true);
                  setIsMenuOpen(false);
                }}
              >
                <div className="workout-sheet-btn-icon" style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                  <Pencil size={18} />
                </div>
                <div className="workout-sheet-btn-text">
                  <div className="workout-sheet-btn-title">Edit Workout</div>
                  <div className="workout-sheet-btn-sub">Modify exercises, sets, weights, and reps</div>
                </div>
              </button>

              {/* 2. Perform Again */}
              <button
                type="button"
                className="workout-sheet-btn"
                onClick={() => {
                  setIsMenuOpen(false);
                  handlePerformAgain();
                }}
              >
                <div className="workout-sheet-btn-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                  <RotateCcw size={18} />
                </div>
                <div className="workout-sheet-btn-text">
                  <div className="workout-sheet-btn-title">Perform Again</div>
                  <div className="workout-sheet-btn-sub">Start a live workout with these exercises</div>
                </div>
              </button>

              {/* 3. Share */}
              <button
                type="button"
                className="workout-sheet-btn"
                onClick={() => {
                  setIsMenuOpen(false);
                  handleShare();
                }}
              >
                <div className="workout-sheet-btn-icon" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8" }}>
                  <Share2 size={18} />
                </div>
                <div className="workout-sheet-btn-text">
                  <div className="workout-sheet-btn-title">Share Workout</div>
                  <div className="workout-sheet-btn-sub">Copy formatted summary to clipboard</div>
                </div>
              </button>

              {/* 4. Favorites */}
              <button
                type="button"
                className="workout-sheet-btn"
                onClick={() => {
                  toggleFavorite();
                  setIsMenuOpen(false);
                }}
              >
                <div className="workout-sheet-btn-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
                  <Star size={18} className={isFavorite ? "fill-amber-400" : ""} />
                </div>
                <div className="workout-sheet-btn-text">
                  <div className="workout-sheet-btn-title">
                    {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                  </div>
                  <div className="workout-sheet-btn-sub">Bookmark this routine for quick access</div>
                </div>
              </button>

              {/* Divider */}
              <div style={{ height: "1px", background: "#252d3d", margin: "6px 0" }} />

              {/* 5. Delete */}
              <button
                type="button"
                className="workout-sheet-btn workout-sheet-btn-danger"
                onClick={() => {
                  setIsMenuOpen(false);
                  if (window.confirm("Are you sure you want to delete this workout session?")) {
                    onDelete(day.id);
                  }
                }}
              >
                <div className="workout-sheet-btn-icon" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#f87171" }}>
                  <Trash2 size={18} />
                </div>
                <div className="workout-sheet-btn-text">
                  <div className="workout-sheet-btn-title" style={{ color: "#f87171" }}>Delete Workout</div>
                  <div className="workout-sheet-btn-sub">Permanently remove this session log</div>
                </div>
              </button>
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              className="workout-sheet-cancel-btn"
              onClick={() => setIsMenuOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Discard Workout Confirmation Modal */}
      {showDiscardConfirm && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 1200 }}
          onClick={() => setShowDiscardConfirm(false)}
        >
          <div
            className="modal modal-narrow"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#111622",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              boxShadow: "0 12px 36px rgba(0, 0, 0, 0.75)",
              maxWidth: "380px",
              padding: "0",
              overflow: "hidden",
            }}
          >
            <div
              className="modal-header"
              style={{
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "14px 18px",
              }}
            >
              <div
                className="modal-date"
                style={{
                  color: "#ffffff",
                  fontSize: "15px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AlertCircle size={17} className="text-rose-400" style={{ color: "#ef4444" }} />
                <span>Discard Workout?</span>
              </div>
              <button
                className="icon-btn"
                onClick={() => setShowDiscardConfirm(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ gap: "10px", padding: "18px" }}>
              <p style={{ fontSize: "14px", color: "#e2e8f0", margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
                Would you like to discard the workout?
              </p>
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0, lineHeight: 1.4 }}>
                Any unsaved changes and logged sets in this session will be lost.
              </p>
            </div>

            <div
              className="modal-footer"
              style={{
                padding: "12px 18px 16px",
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
                borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <button
                type="button"
                className="btn-ghost"
                style={{
                  padding: "8px 16px",
                  fontSize: "12.5px",
                  color: "#e2e8f0",
                }}
                onClick={() => setShowDiscardConfirm(false)}
              >
                No, Continue
              </button>
              <button
                type="button"
                style={{
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "7px",
                  padding: "8px 16px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(239, 68, 68, 0.35)",
                }}
                onClick={handleConfirmDiscard}
              >
                Yes, Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AddMacrocycleModal({ onClose, onCreate, nextIndex, defaultStart }: {
  onClose: () => void; onCreate: (data: { name: string; start: string }) => void; nextIndex: number; defaultStart: string;
}) {
  const [name, setName] = useState(`Macrocycle ${nextIndex}`);
  const [start, setStart] = useState(defaultStart);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-date">New macrocycle</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <div className="field-row">
            <label className="field-label">Name</label>
            <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={`Macrocycle ${nextIndex}`} />
          </div>
          <div className="field-row">
            <label className="field-label">Start date</label>
            <input className="text-input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <div className="spacer" />
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => {
              if (!name.trim()) return;
              onCreate({ name: name.trim(), start });
            }}
          >
            Create macrocycle
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Add mesocycle ---------------- */

function AddMesocycleModal({ onClose, onCreate, lastEnd, macrocycles, defaultMacroId }: {
  onClose: () => void; onCreate: (data: { name: string; phaseKey: string; start: string; weeks: number; micLen: number; macroId: string }) => void;
  lastEnd: string; macrocycles: Macrocycle[]; defaultMacroId: string;
}) {
  const [name, setName] = useState("");
  const [phaseKey, setPhaseKey] = useState("Hypertrophy");
  const [macroId, setMacroId] = useState(defaultMacroId || macrocycles[macrocycles.length - 1]?.id);
  const [start, setStart] = useState(addDays(lastEnd, 1));
  const [weeks, setWeeks] = useState<number | "">(4);
  const [micLen, setMicLen] = useState<number | "">(7);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-date">New mesocycle</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          {macrocycles.length > 1 && (
            <div className="field-row">
              <label className="field-label">Macrocycle</label>
              <div className="type-pills">
                {macrocycles.map((mc) => (
                  <button
                    key={mc.id}
                    className={`pill ${macroId === mc.id ? "pill-active" : ""}`}
                    onClick={() => setMacroId(mc.id)}
                  >
                    {mc.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="field-row">
            <label className="field-label">Name</label>
            <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Volume Block" />
          </div>
          <div className="field-row">
            <label className="field-label">Phase</label>
            <div className="type-pills">
              {Object.entries(PHASES).map(([k, v]) => (
                <button
                  key={k}
                  className={`pill ${phaseKey === k ? "pill-active" : ""}`}
                  onClick={() => setPhaseKey(k)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field-row">
            <label className="field-label">Start date</label>
            <input className="text-input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field-row two-col">
            <div>
              <label className="field-label">Microcycles</label>
              <input
                className="text-input"
                type="number"
                min={1}
                value={weeks}
                onChange={(e) => {
                  const val = e.target.value;
                  setWeeks(val === "" ? "" : parseInt(val, 10));
                }}
              />
            </div>
            <div>
              <label className="field-label">Days / microcycle</label>
              <input
                className="text-input"
                type="number"
                min={1}
                max={21}
                value={micLen}
                onChange={(e) => {
                  const val = e.target.value;
                  setMicLen(val === "" ? "" : parseInt(val, 10));
                }}
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <div className="spacer" />
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => {
              if (!name.trim()) return;
              const finalWeeks = weeks === "" ? 1 : Number(weeks);
              const finalMicLen = micLen === "" ? 7 : Number(micLen);
              onCreate({ name: name.trim(), phaseKey, start, weeks: finalWeeks, micLen: finalMicLen, macroId });
            }}
          >
            Create block
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Resume or discard prompt modal ---------------- */

function ResumeOrDiscardModal({
  activeDayTitle,
  activeDayDate,
  onClose,
  onResume,
  onDiscard,
}: {
  activeDayTitle: string;
  activeDayDate: string;
  onClose: () => void;
  onResume: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-narrow"
        onClick={(e) => e.stopPropagation()}
        style={{ "--phase": "#C1432E", background: "#111622" } as React.CSSProperties}
      >
        <div className="modal-header" style={{ borderBottom: "1px solid #232d42" }}>
          <div className="modal-date" style={{ color: "#ffffff", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#f87171" }}>⏱</span> Active Workout In Progress
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ gap: "12px", padding: "20px" }}>
          <p style={{ fontSize: "13.5px", color: "#cbd5e1", margin: 0, lineHeight: 1.5 }}>
            You have a live workout session in progress for <strong>{fmtDateShort(activeDayDate)}</strong> ({activeDayTitle || "Workout Session"}).
          </p>
          <p style={{ fontSize: "12.5px", color: "#94a3b8", margin: 0 }}>
            Would you like to resume your current workout or discard it to start a new session?
          </p>
        </div>

        <div className="modal-footer" style={{ flexDirection: "column", gap: "10px", padding: "16px 20px" }}>
          <button
            className="btn-primary"
            style={{ width: "100%", padding: "11px", fontSize: "13px", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff" }}
            onClick={onResume}
          >
            ▶ Resume Current Workout
          </button>
          <button
            className="btn-ghost"
            style={{ width: "100%", padding: "11px", fontSize: "13px", color: "#f87171", borderColor: "#7f1d1d" }}
            onClick={onDiscard}
          >
            🗑 Discard Current Workout & Start New
          </button>
          <button
            className="btn-ghost"
            style={{ width: "100%", padding: "8px", fontSize: "12px", color: "#64748b", border: "none" }}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- App ---------------- */

export default function IronLedger() {
  const {
    macrocycles, setMacrocycles,
    mesocycles, setMesocycles,
    prLog, setPrLog,
    loaded, saveState,
  } = useLedgerStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<{ mesoId: string; micId: string; day: DayEntry; initialEditMode?: boolean; isLive?: boolean; originalDay?: DayEntry } | null>(null);
  const [liveWorkout, setLiveWorkout] = useState<{ mesoId: string; micId: string; day: DayEntry; initialEditMode?: boolean; originalDay?: DayEntry } | null>(null);
  const [addingMeso, setAddingMeso] = useState(false);
  const [addingMesoMacroId, setAddingMesoMacroId] = useState<string | null>(null);
  const [addingMacro, setAddingMacro] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [workoutEntries, setWorkoutEntries] = useState<WorkoutEntry[]>(INITIAL_WORKOUT_DATA);
  const [isDayModalMinimized, setIsDayModalMinimized] = useState(false);
  const [showResumeDiscardPrompt, setShowResumeDiscardPrompt] = useState(false);
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
  const today = todayStr();

  useEffect(() => {
    if (!loaded || selectedId) return;
    const active = mesocycles.find((m) => m.status === "active");
    setSelectedId(active ? active.id : mesocycles[mesocycles.length - 1]?.id || null);
  }, [loaded, mesocycles, selectedId]);

  const selectedMeso = mesocycles.find((m) => m.id === selectedId) || null;

  const openDay = (mesoId: string, micId: string, day: DayEntry, initialEditMode = false) => {
    setActiveDay({
      mesoId,
      micId,
      day,
      initialEditMode,
      isLive: false,
      originalDay: JSON.parse(JSON.stringify(day)),
    });
    setLiveWorkout(null);
    setIsDayModalMinimized(false);
  };

  const handlePerformAgain = (sourceDay: DayEntry) => {
    const meso = selectedMeso || mesocycles.find((m) => m.status === "active") || mesocycles[0];
    if (!meso) return;

    const clonedLifts: LiftEntry[] = (sourceDay.lifts || []).map((l) => ({
      ...l,
      id: uid(),
      sets: (l.sets || []).map((s) => ({
        ...s,
        id: uid(),
        isPR: false,
      })),
    }));

    let targetMicId = meso.microcycles[0]?.id || "";
    let targetDay = meso.microcycles[0]?.days[0];
    for (const mc of meso.microcycles) {
      const found = mc.days.find((d) => d.date === today);
      if (found) {
        targetMicId = mc.id;
        targetDay = found;
        break;
      }
    }

    if (!targetDay || !targetMicId) return;

    const originalSnapshot: DayEntry = JSON.parse(JSON.stringify(targetDay));

    const newDay: DayEntry = {
      ...targetDay,
      type: "workout",
      title: sourceDay.title ? `${sourceDay.title} (Repeat)` : "Workout Session",
      bodyTags: [...(sourceDay.bodyTags || [])],
      lifts: clonedLifts,
      notes: sourceDay.notes || "",
    };

    updateDayDraft(newDay);
    const liveSession = {
      mesoId: meso.id,
      micId: targetMicId,
      day: newDay,
      initialEditMode: true,
      originalDay: originalSnapshot,
    };
    setLiveWorkout(liveSession);
    setActiveDay({ ...liveSession, isLive: true });
    setIsDayModalMinimized(false);
  };

  const handleStartWorkoutClick = () => {
    if (liveWorkout !== null) {
      setShowResumeDiscardPrompt(true);
    } else {
      handleStartNewWorkout();
    }
  };

  const handleStartNewWorkout = () => {
    const meso = selectedMeso || mesocycles.find((m) => m.status === "active") || mesocycles[mesocycles.length - 1];
    if (!meso) return;
    
    // Find today's day entry in the mesocycle
    for (const mc of meso.microcycles) {
      const todayDay = mc.days.find((d: DayEntry) => d.date === today);
      if (todayDay) {
        const originalSnapshot: DayEntry = JSON.parse(JSON.stringify(todayDay));
        const liveSession = { mesoId: meso.id, micId: mc.id, day: todayDay, initialEditMode: true, originalDay: originalSnapshot };
        setLiveWorkout(liveSession);
        setActiveDay({ ...liveSession, isLive: true });
        setIsDayModalMinimized(false);
        return;
      }
    }
    
    // Fallback: pick the first day of the active microcycle
    if (meso.microcycles.length > 0 && meso.microcycles[0].days.length > 0) {
      const mc = meso.microcycles[0];
      const originalSnapshot: DayEntry = JSON.parse(JSON.stringify(mc.days[0]));
      const liveSession = { mesoId: meso.id, micId: mc.id, day: mc.days[0], initialEditMode: true, originalDay: originalSnapshot };
      setLiveWorkout(liveSession);
      setActiveDay({ ...liveSession, isLive: true });
      setIsDayModalMinimized(false);
    }
  };

  const handleDiscardWorkout = () => {
    if (!activeDay) return;
    const { mesoId, micId, day, originalDay } = activeDay;

    // Check if it was originally an empty day or unlogged session
    const wasEmpty =
      !originalDay ||
      originalDay.type === "empty" ||
      (!originalDay.title && (!originalDay.lifts || originalDay.lifts.length === 0));

    if (wasEmpty) {
      // Revert completely back to an empty day in mesocycles
      setMesocycles((prev) =>
        prev.map((m) =>
          m.id !== mesoId
            ? m
            : {
                ...m,
                microcycles: m.microcycles.map((mc) =>
                  mc.id !== micId
                    ? mc
                    : {
                        ...mc,
                        days: mc.days.map((d) =>
                          d.id === day.id
                            ? {
                                id: d.id,
                                date: d.date,
                                type: "empty",
                                title: "",
                                bodyTags: [],
                                lifts: [],
                                notes: "",
                                durationSeconds: 0,
                              }
                            : d
                        ),
                      }
                ),
              }
        )
      );
    } else {
      // Restore original day snapshot exactly as it was before editing
      setMesocycles((prev) =>
        prev.map((m) =>
          m.id !== mesoId
            ? m
            : {
                ...m,
                microcycles: m.microcycles.map((mc) =>
                  mc.id !== micId
                    ? mc
                    : {
                        ...mc,
                        days: mc.days.map((d) => (d.id === day.id ? originalDay : d)),
                      }
                ),
              }
        )
      );
    }

    setActiveDay(null);
    setLiveWorkout(null);
    setIsDayModalMinimized(false);
  };

  const saveDay = (updatedDay: DayEntry) => {
    if (!activeDay) return;
    setMesocycles((prev) =>
      prev.map((m) =>
        m.id !== activeDay.mesoId
          ? m
          : {
              ...m,
              microcycles: m.microcycles.map((mc) =>
                mc.id !== activeDay.micId
                  ? mc
                  : { ...mc, days: mc.days.map((d) => (d.id === updatedDay.id ? updatedDay : d)) }
              ),
            }
      )
    );
    const newPRs: PREntry[] = [];
    (updatedDay.lifts || []).forEach((l) => {
      const sets = Array.isArray(l.sets) ? l.sets : [];
      sets.forEach((s) => {
        if (s.isPR && l.name && s.weight) {
          newPRs.push({
            id: uid(),
            lift: l.name,
            weight: parseFloat(String(s.weight)) || 0,
            unit: l.unit || "kg",
            reps: parseFloat(String(s.reps)) || 1,
            date: updatedDay.date,
            note: "",
          });
        }
      });
    });
    if (newPRs.length) {
      setPrLog((prev) => {
        const withoutSameDayLift = prev.filter(
          (p) => !newPRs.some((n) => n.lift === p.lift && n.date === p.date)
        );
        return [...withoutSameDayLift, ...newPRs];
      });
    }

    setActiveDay(null);
    setLiveWorkout(null);
    setIsDayModalMinimized(false);
  };

  const updateDayDraft = (updatedDay: DayEntry) => {
    if (!activeDay) return;
    setMesocycles((prev) =>
      prev.map((m) =>
        m.id !== activeDay.mesoId
          ? m
          : {
              ...m,
              microcycles: m.microcycles.map((mc) =>
                mc.id !== activeDay.micId
                  ? mc
                  : { ...mc, days: mc.days.map((d) => (d.id === updatedDay.id ? updatedDay : d)) }
              ),
            }
      )
    );
    setActiveDay({ ...activeDay, day: updatedDay });
    if (activeDay.isLive) {
      setLiveWorkout((prev) => (prev ? { ...prev, day: updatedDay } : null));
    }
  };

  const handleAddExerciseToActiveDay = (name: string, gifUrl?: string) => {
    let currentActive = activeDay;
    if (!currentActive) {
      const meso = selectedMeso || mesocycles.find((m) => m.status === "active") || mesocycles[mesocycles.length - 1];
      if (meso && meso.microcycles.length > 0 && meso.microcycles[0].days.length > 0) {
        const mc = meso.microcycles[0];
        const day = mc.days[0];
        currentActive = { mesoId: meso.id, micId: mc.id, day, isLive: false };
      }
    }
    if (!currentActive) return;

    const newLift: LiftEntry = {
      id: uid(),
      name,
      gifUrl: gifUrl || "",
      unit: "kg",
      sets: [{ id: uid(), type: "1", weight: "", reps: "", isPR: false }]
    };
    const updatedDay: DayEntry = {
      ...currentActive.day,
      type: currentActive.day.type === "empty" ? "workout" : currentActive.day.type,
      lifts: [...(currentActive.day.lifts || []), newLift]
    };

    setMesocycles((prev) =>
      prev.map((m) =>
        m.id !== currentActive!.mesoId
          ? m
          : {
              ...m,
              microcycles: m.microcycles.map((mc) =>
                mc.id !== currentActive!.micId
                  ? mc
                  : { ...mc, days: mc.days.map((d) => (d.id === updatedDay.id ? updatedDay : d)) }
              ),
            }
      )
    );
    setActiveDay({ ...currentActive, day: updatedDay, initialEditMode: true });
    if (currentActive.isLive) {
      setLiveWorkout({ mesoId: currentActive.mesoId, micId: currentActive.micId, day: updatedDay, initialEditMode: true });
    }
    setIsDayModalMinimized(false);
  };

  const handleAddExercisesToActiveDay = (exercisesList: { name: string; gifUrl?: string }[]) => {
    if (!exercisesList || exercisesList.length === 0) return;
    let currentActive = activeDay;
    if (!currentActive) {
      const meso = selectedMeso || mesocycles.find((m) => m.status === "active") || mesocycles[mesocycles.length - 1];
      if (meso && meso.microcycles.length > 0 && meso.microcycles[0].days.length > 0) {
        const mc = meso.microcycles[0];
        const day = mc.days[0];
        currentActive = { mesoId: meso.id, micId: mc.id, day, initialEditMode: true, isLive: false };
      }
    }
    if (!currentActive) return;

    const newLifts: LiftEntry[] = exercisesList.map((ex) => ({
      id: uid(),
      name: ex.name,
      gifUrl: ex.gifUrl || "",
      unit: "kg",
      sets: [{ id: uid(), type: "1", weight: "", reps: "", isPR: false }]
    }));

    const updatedDay: DayEntry = {
      ...currentActive.day,
      type: currentActive.day.type === "empty" ? "workout" : currentActive.day.type,
      lifts: [...(currentActive.day.lifts || []), ...newLifts]
    };

    setMesocycles((prev) =>
      prev.map((m) =>
        m.id !== currentActive!.mesoId
          ? m
          : {
              ...m,
              microcycles: m.microcycles.map((mc) =>
                mc.id !== currentActive!.micId
                  ? mc
                  : { ...mc, days: mc.days.map((d) => (d.id === updatedDay.id ? updatedDay : d)) }
              ),
            }
      )
    );
    setActiveDay({ ...currentActive, day: updatedDay, initialEditMode: true });
    if (currentActive.isLive) {
      setLiveWorkout({ mesoId: currentActive.mesoId, micId: currentActive.micId, day: updatedDay, initialEditMode: true });
    }
    setIsDayModalMinimized(false);
  };

  const clearDay = (dayId: string) => {
    setMesocycles((prev) =>
      prev.map((m) => ({
        ...m,
        microcycles: m.microcycles.map((mc) => ({
          ...mc,
          days: mc.days.map((d) =>
            d.id === dayId
              ? { ...d, type: "empty", title: "", bodyTags: [], lifts: [], notes: "" }
              : d
          ),
        })),
      }))
    );
    if (activeDay?.day.id === dayId) setActiveDay(null);
    if (liveWorkout?.day.id === dayId) setLiveWorkout(null);
  };

  const addMicrocycleTo = (mesoId: string, built: Microcycle) => {
    setMesocycles((prev) =>
      healAllMesocycles(
        prev.map((m) => (m.id === mesoId ? { ...m, microcycles: [...m.microcycles, built] } : m)),
        macrocycles
      )
    );
  };

  const createMesocycle = ({ name, phaseKey, start, weeks, micLen, macroId }: {
    name: string; phaseKey: string; start: string; weeks: number; micLen: number; macroId: string;
  }) => {
    const targetMacroId = macroId || macrocycles[macrocycles.length - 1]?.id;
    const totalDays = weeks * micLen;
    const end = addDays(start, totalDays - 1);
    const micCount = weeks;

    const ranges = Array.from({ length: micCount }, (_, i) => ({
      index: i + 1,
      length: micLen,
    }));
    const microcycles = buildMicrocycles(start, ranges);
    const newMeso: Mesocycle = {
      id: uid(),
      macroId: targetMacroId,
      index: 1,
      name,
      phaseKey,
      micRange: `1–${micCount}`,
      start,
      end,
      status: today < start ? "upcoming" : today > end ? "completed" : "active",
      microcycles,
    };
    setMesocycles((prev) => healAllMesocycles([...prev, newMeso], macrocycles));
    setSelectedId(newMeso.id);
    setAddingMeso(false);
    setAddingMesoMacroId(null);
  };

  const createMacrocycle = ({ name, start }: { name: string; start: string }) => {
    const lastIndex = macrocycles[macrocycles.length - 1]?.index || 0;
    const newMacro: Macrocycle = { id: uid(), index: lastIndex + 1, name, start };
    setMacrocycles((prev) => [...prev, newMacro]);
    setAddingMacro(false);
  };

  const renameMacrocycle = (macroId: string, newName: string) => {
    setMacrocycles((prev) => prev.map((m) => m.id === macroId ? { ...m, name: newName } : m));
  };

  const updateMesocycle = (mesoId: string, updates: { name: string; phaseKey: string; start: string; macroId: string }) => {
    setMesocycles((prev) => {
      const updated = prev.map((m) => {
        if (m.id !== mesoId) return m;

        const weeks = m.microcycles.length || 1;
        const micLen = m.microcycles[0]?.days.length || 7;
        const totalDays = weeks * micLen;
        const start = updates.start || m.start;
        const end = addDays(start, totalDays - 1);

        let microcycles = m.microcycles;
        if (updates.start && updates.start !== m.start && m.microcycles.length > 0) {
          const ranges = m.microcycles.map((mc) => ({
            index: mc.index,
            length: mc.days.length,
            label: mc.label,
          }));
          const rebuiltMics = buildMicrocycles(start, ranges);
          microcycles = rebuiltMics.map((newMc, mcIdx) => {
            const oldMc = m.microcycles[mcIdx];
            if (!oldMc) return newMc;
            return {
              ...newMc,
              label: oldMc.label,
              days: newMc.days.map((newDay, dayIdx) => {
                const oldDay = oldMc.days[dayIdx];
                if (!oldDay || oldDay.type === "empty") return newDay;
                return {
                  ...oldDay,
                  id: newDay.id,
                  date: newDay.date,
                };
              }),
            };
          });
        }

        const today = todayStr();
        const status = today < start ? "upcoming" : today > end ? "completed" : "active";

        return {
          ...m,
          name: updates.name,
          phaseKey: updates.phaseKey,
          start,
          end,
          status,
          macroId: updates.macroId || m.macroId,
          microcycles,
        };
      });

      return healAllMesocycles(updated, macrocycles);
    });
  };

  const renameMicrocycle = (micId: string, newLabel: string) => {
    setMesocycles((prev) =>
      prev.map((m) => {
        const hasMic = m.microcycles.some((mc) => mc.id === micId);
        if (!hasMic) return m;
        return {
          ...m,
          microcycles: m.microcycles.map((mc) =>
            mc.id === micId ? { ...mc, label: newLabel || null } : mc
          ),
        };
      })
    );
  };

  const deleteMacrocycle = (macroId: string) => {
    if (window.confirm("Are you sure you want to delete this Macrocycle? This will permanently delete all its Mesocycles, Microcycles, and associated workout logs.")) {
      const remainingMacros = macrocycles.filter((m) => m.id !== macroId);
      setMacrocycles(remainingMacros);
      const remainingMesos = mesocycles.filter((m) => m.macroId !== macroId);
      const healed = healAllMesocycles(remainingMesos, remainingMacros);
      setMesocycles(healed);
      if (selectedMeso && selectedMeso.macroId === macroId) {
        setSelectedId(healed[0]?.id || null);
      }
    }
  };

  const deleteMesocycle = (mesoId: string) => {
    if (window.confirm("Are you sure you want to delete this Mesocycle? This will permanently delete all its Microcycles and associated workout logs.")) {
      const remainingMesos = mesocycles.filter((m) => m.id !== mesoId);
      const healed = healAllMesocycles(remainingMesos, macrocycles);
      setMesocycles(healed);
      if (selectedId === mesoId) {
        setSelectedId(healed[0]?.id || null);
      }
    }
  };

  const deleteMicrocycle = (mesoId: string, micId: string) => {
    if (window.confirm("Are you sure you want to delete this Microcycle? This will permanently delete all its workout logs.")) {
      setMesocycles((prev) => {
        const updated = prev.map((m) => {
          if (m.id !== mesoId) return m;
          const filteredMics = m.microcycles.filter((mc) => mc.id !== micId);
          return {
            ...m,
            microcycles: filteredMics,
          };
        });
        return healAllMesocycles(updated, macrocycles);
      });
    }
  };

  const setActiveMesocycleStatus = (mesoId: string) => {
    setMesocycles((prev) =>
      prev.map((m) => ({
        ...m,
        status: m.id === mesoId ? "active" : m.status === "active" ? "completed" : m.status,
      }))
    );
    setSelectedId(mesoId);
  };

  return (
    <div className="iron-ledger">
      <style>{`
        .iron-ledger {
          --bg: #14161A;
          --bg-elevated: #1B1E23;
          --bg-card: #20242A;
          --border: #2C3038;
          --chalk: #EDEAE2;
          --chalk-dim: #8F9299;
          --iron-red: #C1432E;
          --brass: #B08D57;
          --steel: #5C7A8A;
          --sage: #7A8B6F;
          font-family: 'Inter', sans-serif;
          background: var(--bg);
          color: var(--chalk);
          min-height: 100vh;
          padding: 20px 16px 60px 16px;
          box-sizing: border-box;
        }
        .iron-ledger * { box-sizing: border-box; }
        .iron-ledger h1, .iron-ledger h2, .iron-ledger h3 { font-family: 'Oswald', sans-serif; margin: 0; }

        .header {
          display: flex; justify-content: space-between; align-items: flex-end;
          margin-bottom: 26px; flex-wrap: wrap; gap: 12px;
          border-bottom: 1px solid var(--border); padding-bottom: 18px;
        }
        .header-title { font-size: 28px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; font-family: 'Oswald', sans-serif; }
        .header-sub { color: var(--chalk-dim); font-size: 13px; margin-top: 4px; font-family: 'IBM Plex Mono', monospace; }
        .header-stats { display: flex; gap: 22px; align-items: center; }
        .stat { text-align: right; }
        .stat-num { font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 500; }
        .stat-label { font-size: 11px; color: var(--chalk-dim); text-transform: uppercase; letter-spacing: 0.5px; }
        .save-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; margin-right: 6px; vertical-align: middle; }
        .save-idle, .save-saved { background: var(--sage); }
        .save-saving { background: var(--brass); }
        .save-error { background: var(--iron-red); }

        .workout-live-stats-bar {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(56, 189, 248, 0.15);
          border-radius: 9px;
          padding: 6px 8px;
          margin: 4px 0 10px 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        }
        .workout-live-stat-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 7px;
          padding: 5px 8px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
        }
        .workout-stat-header {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .workout-stat-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #94a3b8;
          line-height: 1;
        }
        .workout-stat-value {
          font-family: 'Oswald', sans-serif;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.15;
          margin-top: 3px;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .workout-stat-unit {
          font-size: 10px;
          font-weight: 500;
          color: #94a3b8;
          margin-left: 2px;
        }

        .pr-shelf { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 28px; }
        .pr-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
        .pr-card-top { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
        .pr-lift-name { font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--chalk-dim); font-weight: 500; }
        .pr-weight { font-family: 'IBM Plex Mono', monospace; font-size: 26px; font-weight: 500; color: var(--chalk); }
        .pr-unit { font-size: 13px; color: var(--chalk-dim); margin-left: 3px; }
        .pr-reps { font-size: 13px; color: var(--chalk-dim); margin-left: 6px; }
        .pr-date { font-size: 11px; color: var(--chalk-dim); margin-top: 2px; margin-bottom: 6px; font-family: 'IBM Plex Mono', monospace; }
        .pr-empty { color: var(--chalk-dim); font-size: 13px; font-style: italic; padding: 8px 0; }

        .layout { display: grid; grid-template-columns: 260px 1fr; gap: 24px; align-items: start; }
        @media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }

        .timeline { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 12px; padding: 16px; position: sticky; top: 16px; }
        .macro-group { margin-bottom: 18px; }
        .macro-group:last-of-type { margin-bottom: 8px; }
        .timeline-heading { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--chalk); font-weight: 600; }
        .macro-heading-range { color: var(--chalk-dim); font-weight: 400; text-transform: none; letter-spacing: 0; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; }
        .macro-empty-hint { color: var(--chalk-dim); font-size: 11.5px; font-style: italic; padding: 6px 8px; }
        .add-meso-inline-btn {
          width: 100%; background: none; border: none; color: var(--chalk-dim);
          padding: 5px 8px 4px; cursor: pointer; font-size: 11px; font-family: 'Inter', sans-serif; text-align: left;
        }
        .add-meso-inline-btn:hover { color: var(--chalk); }
        .add-macro-btn {
          width: 100%; background: none; border: 1px solid var(--border); color: var(--chalk-dim);
          padding: 9px; border-radius: 8px; cursor: pointer; font-size: 12px; font-family: 'Inter', sans-serif; margin-top: 4px;
        }
        .add-macro-btn:hover { color: var(--chalk); border-color: var(--chalk-dim); }
        .timeline-list { display: flex; flex-direction: column; gap: 3px; max-height: 70vh; overflow-y: auto; margin-top: 10px; }
        .timeline-item {
          display: flex; align-items: center; gap: 10px; background: none; border: none; text-align: left;
          padding: 8px 8px; border-radius: 8px; cursor: pointer; color: var(--chalk); width: 100%; font-family: 'Inter', sans-serif;
        }
        .timeline-item:hover { background: var(--bg-card); }
        .timeline-item-active { background: var(--bg-card); border: 1px solid var(--phase); }
        .timeline-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--phase); flex-shrink: 0; }
        .timeline-item-body { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
        .timeline-index { font-size: 10px; font-family: 'IBM Plex Mono', monospace; color: var(--chalk-dim); }
        .timeline-name { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .timeline-range { font-size: 10.5px; color: var(--chalk-dim); font-family: 'IBM Plex Mono', monospace; }
        .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--iron-red); box-shadow: 0 0 0 3px rgba(193,67,46,0.25); flex-shrink: 0; }

        .meso-detail { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 12px; padding: 22px; }
        .meso-detail-header { margin-bottom: 6px; }
        .meso-eyebrow { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--phase); font-family: 'IBM Plex Mono', monospace; margin-bottom: 6px; }
        .meso-title { font-size: 24px; font-weight: 600; }
        .meso-dates { color: var(--chalk-dim); font-size: 12.5px; margin-top: 6px; font-family: 'IBM Plex Mono', monospace; display: flex; align-items: center; gap: 10px; }
        .status-badge { font-family: 'Inter', sans-serif; text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.5px; padding: 2px 7px; border-radius: 20px; border: 1px solid var(--border); }
        .status-active { color: var(--iron-red); border-color: var(--iron-red); }
        .status-completed { color: var(--chalk-dim); }
        .status-upcoming { color: var(--steel); border-color: var(--steel); }
        .meso-empty { color: var(--chalk-dim); font-size: 13.5px; margin: 20px 0; font-style: italic; }

        .microcycle-row { margin-top: 22px; }
        .microcycle-label { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .mc-index { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--chalk-dim); }
        .mc-tag { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px; background: var(--bg-card); border: 1px solid var(--border); padding: 2px 7px; border-radius: 20px; color: var(--brass); }

        .day-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 7px; }
        .day-card {
          background: var(--bg-card); border: 1px solid var(--border); border-top: 3px solid var(--day-color, var(--border));
          border-radius: 8px; padding: 8px 8px 10px; text-align: left; cursor: pointer; color: var(--chalk);
          min-height: 74px; display: flex; flex-direction: column; gap: 4px; position: relative;
          font-family: 'Inter', sans-serif;
        }
        .day-card:hover { border-color: var(--chalk-dim); }
        .day-empty { opacity: 0.55; }
        .day-today { box-shadow: 0 0 0 1.5px var(--iron-red); }
        .day-card-top { display: flex; align-items: baseline; gap: 4px; }
        .day-weekday { font-size: 9.5px; text-transform: uppercase; color: var(--chalk-dim); font-family: 'IBM Plex Mono', monospace; }
        .day-num { font-size: 13px; font-family: 'IBM Plex Mono', monospace; font-weight: 500; }
        .pr-flag { margin-left: auto; font-size: 8.5px; background: var(--iron-red); color: var(--chalk); padding: 1px 4px; border-radius: 4px; font-weight: 600; }
        .day-title { font-size: 11.5px; line-height: 1.3; color: var(--chalk); }
        .day-tags { font-size: 9.5px; color: var(--chalk-dim); }

        .add-mc-btn, .add-mc-form { margin-top: 16px; }
        .add-mc-btn { background: none; border: 1px dashed var(--border); color: var(--chalk-dim); padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-family: 'Inter', sans-serif; }
        .add-mc-btn:hover { color: var(--chalk); }
        .add-mc-form { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px; }
        .add-mc-hint { font-size: 11.5px; color: var(--chalk-dim); }

        .modal-backdrop { position: fixed; inset: 0; background: rgba(10,11,13,0.72); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 560px; max-height: 88vh; overflow-y: auto; --phase: var(--iron-red); }
        .modal-narrow { max-width: 420px; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; border-bottom: 1px solid var(--border); }
        .modal-date { font-family: 'Oswald', sans-serif; font-size: 17px; font-weight: 500; }
        .icon-btn { background: none; border: none; color: var(--chalk-dim); font-size: 15px; cursor: pointer; padding: 4px; }
        .icon-btn:hover { color: var(--chalk); }
        .modal-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 16px; }
        .field-row { display: flex; flex-direction: column; gap: 7px; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .field-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--chalk-dim); }
        .text-input {
          background: var(--bg-card); border: 1px solid var(--border); border-radius: 7px; color: var(--chalk);
          padding: 8px 10px; font-size: 13.5px; font-family: 'Inter', sans-serif; width: 100%;
        }
        .text-input:focus { outline: none; border-color: var(--phase, var(--iron-red)); }
        .textarea { resize: vertical; font-family: 'Inter', sans-serif; }
        .type-pills { display: flex; gap: 6px; flex-wrap: wrap; }
        .pill {
          background: var(--bg-card); border: 1px solid var(--border); color: var(--chalk-dim); border-radius: 20px;
          padding: 6px 12px; font-size: 12px; cursor: pointer; font-family: 'Inter', sans-serif;
        }
        .pill-sm { padding: 4px 9px; font-size: 11px; }
        .pill-active { border-color: var(--phase, var(--iron-red)); color: var(--chalk); background: color-mix(in srgb, var(--phase, var(--iron-red)) 22%, var(--bg-card)); }
        .pill:hover { color: var(--chalk); }
        .lift-table { display: flex; flex-direction: column; gap: 7px; }
        .lift-row { display: grid; grid-template-columns: 1.6fr 0.7fr 0.6fr 0.6fr 0.6fr auto auto auto; gap: 6px; align-items: center; }
        .lift-name { min-width: 0; }
        .lift-num, .lift-unit { min-width: 0; }
        .pr-check { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--chalk-dim); white-space: nowrap; cursor: pointer; }
        .add-lift-btn { align-self: flex-start; background: none; border: 1px dashed var(--border); color: var(--chalk-dim); padding: 6px 12px; border-radius: 7px; cursor: pointer; font-size: 12px; font-family: 'Inter', sans-serif; }
        .add-lift-btn:hover { color: var(--chalk); }

        .suggestions-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-top: none;
          border-radius: 0 0 7px 7px;
          z-index: 10;
          max-height: 160px;
          overflow-y: auto;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        .suggestion-item {
          padding: 8px 10px;
          font-size: 12px;
          cursor: pointer;
          color: var(--chalk);
          text-transform: capitalize;
          font-family: 'Inter', sans-serif;
        }
        .suggestion-item:hover {
          background: var(--border);
        }

        .lift-item-wrapper {
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px;
          background: var(--bg-elevated);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .set-equip-toggle {
          display: inline-flex;
          align-items: center;
          background: #0d121c;
          border: 1px solid #232c3f;
          border-radius: 7px;
          padding: 2px;
          gap: 2px;
          margin-left: auto;
          flex-shrink: 0;
        }

        .set-equip-btn {
          font-family: 'Inter', sans-serif;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 7px;
          border-radius: 5px;
          border: 1px solid transparent;
          background: transparent;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
          line-height: 1.2;
        }

        .set-equip-btn:hover {
          color: #cbd5e1;
        }

        .set-equip-btn.is-raw {
          background: #1e293b;
          color: #38bdf8;
          border-color: rgba(56, 189, 248, 0.3);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
        }

        .set-equip-btn.is-gear {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: #ffffff;
          font-weight: 800;
          border-color: #fbbf24;
          box-shadow: 0 1px 6px rgba(245, 158, 11, 0.4);
        }

        .read-gear-badge {
          font-size: 9.5px;
          font-weight: 800;
          color: #ffffff;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          border: 1px solid #fbbf24;
          padding: 2px 7px;
          border-radius: 5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-left: auto;
          box-shadow: 0 1px 6px rgba(245, 158, 11, 0.4);
          display: inline-flex;
          align-items: center;
        }

        .read-raw-badge {
          font-size: 9.5px;
          font-weight: 800;
          color: #38bdf8;
          background: #1e293b;
          border: 1px solid rgba(56, 189, 248, 0.35);
          padding: 2px 7px;
          border-radius: 5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-left: auto;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
          display: inline-flex;
          align-items: center;
        }

        .set-type-badge-btn {
          width: 40px;
          height: 28px;
          padding: 0;
          font-size: 13px;
          font-weight: 800;
          font-family: 'Inter', sans-serif;
          background: var(--bg-card, #1a1f2c);
          border: 1px solid var(--border, #293245);
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
        }
        .set-type-badge-btn:hover {
          border-color: #ffffff;
          transform: scale(1.05);
        }

        .set-type-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          z-index: 12000;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 0;
        }

        .set-type-bottom-sheet {
          background: #131722;
          border: 1px solid #283248;
          border-bottom: none;
          border-radius: 24px 24px 0 0;
          width: 100%;
          max-width: 480px;
          padding: 16px 20px 28px;
          box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.85);
          animation: slideUpSheet 0.24s cubic-bezier(0.16, 1, 0.3, 1);
          max-height: 85vh;
          overflow-y: auto;
        }

        @keyframes slideUpSheet {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .set-type-drag-handle {
          width: 38px;
          height: 4px;
          background: #374151;
          border-radius: 2px;
          margin: 0 auto 14px;
        }

        .set-type-sheet-title {
          text-align: center;
          font-size: 16px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 14px;
        }

        .set-type-options-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .set-type-grid-card {
          background: #181d29;
          border: 1.5px solid #263043;
          border-radius: 12px;
          height: 48px;
          padding: 0 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
        }
        .set-type-grid-card:hover {
          background: #202738;
          border-color: #3e4d6a;
        }
        .set-type-grid-card.is-selected {
          border: 2px solid #ffffff;
          background: #1d2433;
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.2);
        }

        .set-type-remove-card:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.4);
        }

        .set-type-help-btn {
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
          padding: 4px 6px;
          border-radius: 4px;
          transition: all 0.15s ease;
        }
        .set-type-help-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.1);
        }

        .set-type-info-banner {
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.35);
          border-radius: 10px;
          padding: 8px 12px;
          margin-bottom: 12px;
          font-size: 12px;
          color: #93c5fd;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .set-type-info-close {
          background: none;
          border: none;
          color: #93c5fd;
          cursor: pointer;
          font-size: 12px;
          padding: 2px;
        }

        .workout-sheet-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.78);
          backdrop-filter: blur(6px);
          z-index: 12000;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 0;
          animation: fadeInSheet 0.18s ease;
        }
        @keyframes fadeInSheet {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .workout-sheet-container {
          background: #141824;
          border: 1px solid #283248;
          border-bottom: none;
          border-radius: 24px 24px 0 0;
          width: 100%;
          max-width: 480px;
          padding: 16px 18px 26px;
          box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.85);
          animation: slideUpSheet 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          max-height: 90vh;
          overflow-y: auto;
        }

        .workout-sheet-drag-handle {
          width: 40px;
          height: 4px;
          background: #374151;
          border-radius: 2px;
          margin: 0 auto 14px;
        }

        .workout-sheet-header {
          text-align: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #232c3d;
        }

        .workout-sheet-title {
          font-family: 'Oswald', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .workout-sheet-date {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 3px;
        }

        .workout-sheet-options {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .workout-sheet-btn {
          width: 100%;
          background: #1a2030;
          border: 1px solid #263044;
          border-radius: 12px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .workout-sheet-btn:hover {
          background: #222a3e;
          border-color: #3b82f6;
          transform: translateY(-1px);
        }

        .workout-sheet-btn-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .workout-sheet-btn-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .workout-sheet-btn-title {
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
        }

        .workout-sheet-btn-sub {
          font-size: 11px;
          color: #94a3b8;
        }

        .workout-sheet-btn-danger:hover {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.12);
        }

        .workout-sheet-cancel-btn {
          width: 100%;
          margin-top: 12px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #283248;
          border-radius: 12px;
          color: #94a3b8;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .workout-sheet-cancel-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }
        .lift-details-panel {
          margin-top: 8px;
          border-top: 1px dashed var(--border);
          padding-top: 8px;
          font-size: 12px;
        }
        .details-loader, .details-error {
          color: var(--chalk-dim);
          padding: 10px;
          text-align: center;
          font-style: italic;
        }
        .details-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .details-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .details-title {
          font-family: 'Oswald', sans-serif;
          font-size: 14px;
          text-transform: uppercase;
          color: var(--brass);
        }
        .details-badge {
          font-size: 10px;
          background: var(--border);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--chalk-dim);
          text-transform: uppercase;
        }
        .details-body {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        @media (max-width: 480px) {
          .details-body {
            flex-direction: column;
          }
        }
        .details-gif {
          width: 90px;
          height: 90px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: #000;
          object-fit: cover;
          flex-shrink: 0;
        }
        .details-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }
        .details-instructions {
          margin-top: 4px;
        }
        .details-instructions ol {
          margin-left: 16px;
          margin-top: 2px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .modal-footer { display: flex; align-items: center; gap: 10px; padding: 16px 20px; border-top: 1px solid var(--border); }
        .spacer { flex: 1; }
        .btn-primary { background: var(--phase, var(--iron-red)); color: #14161A; border: none; padding: 9px 18px; border-radius: 7px; font-weight: 600; cursor: pointer; font-size: 13px; font-family: 'Inter', sans-serif; }
        .btn-primary:hover { filter: brightness(1.1); }
        .btn-ghost { background: none; border: 1px solid var(--border); color: var(--chalk-dim); padding: 9px 16px; border-radius: 7px; cursor: pointer; font-size: 13px; font-family: 'Inter', sans-serif; }
        .btn-ghost:hover { color: var(--chalk); }
        .btn-sm { padding: 6px 12px; font-size: 12px; }

        .delete-btn-link {
          color: var(--chalk-dim);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 4px;
          transition: all 0.2s ease;
        }
        .delete-btn-link:hover {
          color: var(--iron-red);
          background: rgba(193, 67, 46, 0.1);
        }

        .action-icon-btn {
          background: none;
          border: 1px solid var(--border);
          color: var(--chalk-dim);
          padding: 5px;
          border-radius: 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .action-icon-btn:hover {
          color: var(--chalk);
          border-color: var(--chalk-dim);
          background: var(--bg-card);
        }
        .action-icon-btn-danger:hover {
          color: var(--iron-red);
          border-color: var(--iron-red);
          background: rgba(193, 67, 46, 0.1);
        }

        .timeline-mobile-toggle {
          display: none;
          width: 100%;
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--chalk);
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          text-align: left;
          font-weight: 600;
        }
        .timeline-mobile-toggle:hover {
          background: var(--border);
        }

        @media (max-width: 860px) {
          .timeline {
            position: relative;
            top: 0;
          }
          .timeline-mobile-toggle {
            display: block;
          }
          .timeline-collapsed .timeline-content {
            display: none;
          }
          .timeline-open .timeline-content {
            display: block;
            margin-top: 12px;
          }
        }

        @media (max-width: 600px) {
          .iron-ledger {
            padding: 16px 12px 80px;
          }
          .layout {
            gap: 16px;
          }
          .pr-shelf {
            display: flex;
            overflow-x: auto;
            gap: 10px;
            padding-bottom: 8px;
            margin-bottom: 16px;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
          }
          .pr-card {
            flex: 0 0 140px;
            scroll-snap-align: start;
            padding: 10px;
          }
          .pr-weight {
            font-size: 20px;
          }
        }

        @media (max-width: 480px) {
          .day-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
          }
          .day-card {
            min-height: 68px;
            padding: 6px;
          }
          .day-num {
            font-size: 12px;
          }
          .day-weekday {
            font-size: 8px;
          }
          .day-title {
            font-size: 10px;
          }
          .lift-sets-list {
            padding-left: 12px !important;
          }
          .modal-backdrop {
            padding: 8px;
          }
          .modal {
            max-height: 96vh;
            border-radius: 12px;
          }
          .modal-body {
            padding: 12px 14px;
            gap: 12px;
          }
          .modal-footer {
            padding: 12px 14px;
          }
        .iron-ledger ::-webkit-scrollbar { width: 6px; }
        .iron-ledger ::-webkit-scrollbar-track { background: var(--bg); }
        .iron-ledger ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

        .global-app-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: rgba(18, 22, 32, 0.95);
          backdrop-filter: blur(16px);
          border: 1px solid #232d40;
          border-radius: 14px;
          margin-bottom: 18px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
        }
        .global-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .global-header-title {
          font-family: 'Oswald', sans-serif;
          font-size: 19px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #ffffff;
        }
        .global-header-right {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #94a3b8;
          font-weight: 600;
        }
      `}</style>

      {/* Persistent Global Top Navigation Header (Outside all content boxes) */}
      <div className="global-app-header">
        <div className="global-header-left">
          <NavHeaderButton onClick={() => setIsNavDrawerOpen(true)} />
          <span className="global-header-title">
            {activeTab === 'home' ? 'Home' :
             activeTab === 'periodisation' ? 'Periodisation Settings' :
             activeTab === 'exercises' ? 'Exercise Library' :
             activeTab === 'explore' ? 'Analytics & Trajectory' : 'Athlete Profile'}
          </span>
        </div>
        <div className="global-header-right">
          <span className={`save-dot save-${saveState}`} />
          <span>{saveState === "saving" ? "saving…" : "synced"}</span>
        </div>
      </div>

      {/* Page Tabs */}
      {activeTab === 'home' && (
        <TimelineFeedView
          mesocycles={mesocycles}
          selectedMesoId={selectedId}
          onSelectMeso={setSelectedId}
          onDayClick={(mesoId, micId, day, initialEditMode) => openDay(mesoId, micId, day, initialEditMode)}
          onDeleteDay={(dayId) => clearDay(dayId)}
          onPerformAgain={(day) => handlePerformAgain(day)}
        />
      )}

      {activeTab === 'periodisation' && (
        <PeriodisationSettingsView
          macrocycles={macrocycles}
          mesocycles={mesocycles}
          today={today}
          onDayClick={(mesoId, micId, day) => openDay(mesoId, micId, day)}
          onAddMacro={() => setAddingMacro(true)}
          onAddMeso={(macroId) => {
            if (macroId) setAddingMesoMacroId(macroId);
            setAddingMeso(true);
          }}
          onAddMicrocycle={(mesoId, built) => addMicrocycleTo(mesoId, built)}
          onUpdateMeso={updateMesocycle}
          onDeleteMeso={deleteMesocycle}
          onDeleteMicrocycle={(mesoId, micId) => deleteMicrocycle(mesoId, micId)}
          onRenameMicrocycle={(_mesoId, micId, newLabel) => renameMicrocycle(micId, newLabel)}
          onSetActiveMeso={setActiveMesocycleStatus}
          onRenameMacro={renameMacrocycle}
          onDeleteMacro={deleteMacrocycle}
        />
      )}

      {activeTab === 'exercises' && (
        <ExerciseKanbanView
          onSelectExercise={handleAddExerciseToActiveDay}
          onSelectExercises={handleAddExercisesToActiveDay}
          onResumeWorkout={() => setIsDayModalMinimized(false)}
        />
      )}

      {activeTab === 'explore' && (
        <div className="max-w-4xl mx-auto space-y-6 pt-2 pb-24">
          <Analytics entries={workoutEntries} />
        </div>
      )}

      {activeTab === 'you' && (
        <ProfileView
          prLog={prLog}
          workoutEntries={workoutEntries}
          onImportData={setWorkoutEntries}
        />
      )}

      {activeDay && selectedMeso && !isDayModalMinimized && (
        <DayModal
          day={activeDay.day}
          phaseColor={PHASES[selectedMeso.phaseKey]?.color || "#C1432E"}
          initialEditMode={activeDay.initialEditMode}
          isLive={Boolean(activeDay.isLive)}
          onClose={handleDiscardWorkout}
          onDiscard={handleDiscardWorkout}
          onSave={(updatedDay) => {
            saveDay(updatedDay);
          }}
          onDelete={(dayId) => {
            clearDay(dayId);
            setActiveDay(null);
            setLiveWorkout(null);
            setIsDayModalMinimized(false);
          }}
          onUpdateDraft={(updatedDay) => {
            updateDayDraft(updatedDay);
          }}
          onGoToExerciseLibrary={() => {
            setIsDayModalMinimized(true);
            setActiveTab('exercises');
            setActiveDay((prev) => prev ? { ...prev, initialEditMode: true } : null);
          }}
          onPerformAgain={(d) => handlePerformAgain(d)}
        />
      )}

      {showResumeDiscardPrompt && liveWorkout && (
        <ResumeOrDiscardModal
          activeDayTitle={liveWorkout.day.title}
          activeDayDate={liveWorkout.day.date}
          onClose={() => setShowResumeDiscardPrompt(false)}
          onResume={() => {
            setShowResumeDiscardPrompt(false);
            setActiveDay({ ...liveWorkout, isLive: true });
            setIsDayModalMinimized(false);
          }}
          onDiscard={() => {
            setShowResumeDiscardPrompt(false);
            if (liveWorkout) {
              const wasEmpty = !liveWorkout.originalDay || liveWorkout.originalDay.type === "empty" || (!liveWorkout.originalDay.title && (!liveWorkout.originalDay.lifts || liveWorkout.originalDay.lifts.length === 0));
              if (wasEmpty) {
                clearDay(liveWorkout.day.id);
              } else if (liveWorkout.originalDay) {
                const orig = liveWorkout.originalDay;
                setMesocycles((prev) =>
                  prev.map((m) =>
                    m.id !== liveWorkout.mesoId
                      ? m
                      : {
                          ...m,
                          microcycles: m.microcycles.map((mc) =>
                            mc.id !== liveWorkout.micId
                              ? mc
                              : {
                                  ...mc,
                                  days: mc.days.map((d) => (d.id === orig.id ? orig : d)),
                                }
                          ),
                        }
                  )
                );
              }
            }
            setLiveWorkout(null);
            setActiveDay(null);
            setIsDayModalMinimized(false);
            handleStartNewWorkout();
          }}
        />
      )}

      {addingMeso && (
        <AddMesocycleModal
          lastEnd={(() => {
            const tMacroId = addingMesoMacroId || (selectedMeso && selectedMeso.macroId) || macrocycles[macrocycles.length - 1]?.id;
            const macroMesos = mesocycles.filter((m) => m.macroId === tMacroId);
            return macroMesos.length > 0 ? macroMesos[macroMesos.length - 1].end : (mesocycles[mesocycles.length - 1]?.end || today);
          })()}
          macrocycles={macrocycles}
          defaultMacroId={addingMesoMacroId || (selectedMeso && selectedMeso.macroId) || macrocycles[macrocycles.length - 1]?.id}
          onClose={() => { setAddingMeso(false); setAddingMesoMacroId(null); }}
          onCreate={createMesocycle}
        />
      )}

      {addingMacro && (
        <AddMacrocycleModal
          nextIndex={(macrocycles[macrocycles.length - 1]?.index || 0) + 1}
          defaultStart={mesocycles[mesocycles.length - 1]?.end ? addDays(mesocycles[mesocycles.length - 1].end, 1) : today}
          onClose={() => setAddingMacro(false)}
          onCreate={createMacrocycle}
        />
      )}

      {/* Retractable Side Navigation Bar */}
      <SidebarNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onStartWorkout={handleStartWorkoutClick}
        isWorkoutMinimized={liveWorkout !== null && isDayModalMinimized}
        activeWorkoutTitle={liveWorkout?.day.title || "Workout Session"}
        onResumeWorkout={() => {
          if (liveWorkout) {
            setActiveDay({ ...liveWorkout, isLive: true });
          }
          setIsDayModalMinimized(false);
        }}
        isOpen={isNavDrawerOpen}
        onClose={() => setIsNavDrawerOpen(false)}
      />
    </div>
  );
}
