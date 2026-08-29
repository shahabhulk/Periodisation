import React, { useState, useEffect, useRef, useMemo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { SidebarNav, NavHeaderButton, type TabType } from "./components/SidebarNav";
import { ExerciseKanbanView } from "./components/ExerciseKanbanView";
import { ProfileView } from "./components/ProfileView";
import { TimelineFeedView } from "./components/TimelineFeedView";
import { Analytics } from "./components/Analytics";
import { INITIAL_WORKOUT_DATA } from "./data/initialWorkoutData";
import type { WorkoutEntry } from "./types/workout";

/* ============================================================
   IRON LEDGER — powerlifting periodisation tracker
   Mesocycle -> Microcycle -> Day, with a PR shelf up top.
   Data persists via localStorage.
   ============================================================ */

const PHASES: Record<string, { color: string; label: string }> = {
  Hypertrophy: { color: "#B08D57", label: "Hypertrophy" },
  Strength: { color: "#5C7A8A", label: "Strength" },
  Peaking: { color: "#C1432E", label: "Peaking" },
  Accumulation: { color: "#7A8B6F", label: "Accumulation" },
  Base: { color: "#6B6F76", label: "Base Building" },
};

function phaseKeyFromName(name: string) {
  const n = name.toLowerCase();
  if (n.includes("peak")) return "Peaking";
  if (n.includes("accumul")) return "Accumulation";
  if (n.includes("strength")) return "Strength";
  if (n.includes("hypertrophy")) return "Hypertrophy";
  return "Base";
}

const DAY_TYPES: Record<string, { label: string; color: string }> = {
  workout: { label: "Workout", color: "var(--phase)" },
  recovery: { label: "Recovery", color: "#3A3F45" },
  event: { label: "Event", color: "#8A7A5C" },
  illness: { label: "Illness", color: "#7A4A42" },
  note: { label: "Note", color: "#4A4E55" },
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
function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
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

  return {
    ...meso,
    end: healedEnd,
    microcycles: healedMicrocycles,
  };
}

function healAllMesocycles(mesos: Mesocycle[], macros: Macrocycle[]): Mesocycle[] {
  const macroList = macros && macros.length > 0 ? macros : seedMacrocycles();
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

function Sparkline({ points, color }: { points: { weight: number }[]; color: string }) {
  if (!points || points.length < 2) return null;
  const w = 120, h = 34, pad = 4;
  const xs = points.map((_, i) => pad + (i * (w - pad * 2)) / (points.length - 1));
  const min = Math.min(...points.map((p) => p.weight));
  const max = Math.max(...points.map((p) => p.weight));
  const range = max - min || 1;
  const ys = points.map((p) => h - pad - ((p.weight - min) / range) * (h - pad * 2));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={i === xs.length - 1 ? 3 : 1.8} fill={color} />
      ))}
    </svg>
  );
}

/* ---------------- PR shelf ---------------- */

function PRShelf({ prLog }: { prLog: PREntry[] }) {
  const lifts = ["Squat", "Bench Press", "Deadlift", "Dumbbell Bench Press"];
  return (
    <div className="pr-shelf">
      {lifts.map((lift) => {
        const entries = prLog
          .filter((p) => p.lift === lift)
          .sort((a, b) => (a.date > b.date ? 1 : -1));
        const best = entries.reduce<PREntry | null>(
          (acc, e) => (!acc || e.weight >= acc.weight ? e : acc),
          null
        );
        return (
          <div className="pr-card" key={lift}>
            <div className="pr-card-top">
              <PlateIcon size={16} color="var(--iron-red)" />
              <span className="pr-lift-name">{lift}</span>
            </div>
            {best ? (
              <>
                <div className="pr-weight">
                  {best.weight}
                  <span className="pr-unit">{best.unit}</span>
                  <span className="pr-reps">×{best.reps}</span>
                </div>
                <div className="pr-date">{fmtDateShort(best.date)}{best.note ? ` · ${best.note}` : ""}</div>
                {entries.length > 1 && <Sparkline points={entries} color="var(--iron-red)" />}
              </>
            ) : (
              <div className="pr-empty">No PR logged yet</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Day modal ---------------- */

interface LiftRowItemProps {
  l: LiftEntry;
  updateLift: (id: string, patch: Partial<LiftEntry>) => void;
  removeLift: (id: string) => void;
}

function LiftRowItem({ l, updateLift, removeLift }: LiftRowItemProps) {
  const [query, setQuery] = useState(String(l.name));
  const [suggestions, setSuggestions] = useState<{ exerciseId: string; name: string; gifUrl: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          const res = await fetch(`https://oss.exercisedb.dev/api/v1/exercises?name=${encodeURIComponent(val)}&limit=25`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
              setSuggestions(json.data.slice(0, 20));
              setShowDropdown(true);
            }
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
    const nextNum = listSets.filter(s => s.type !== "W").length + 1;
    const newSets = [...listSets, { id: uid(), type: String(nextNum), weight: "", reps: "", isPR: false }];
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

  return (
    <div className="lift-item-wrapper" style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "12px", background: "var(--bg-elevated)", display: "flex", flexDirection: "column", gap: "10px" }}>
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

        {/* Header Actions */}
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
          <button
            type="button"
            className="icon-btn"
            onClick={() => removeLift(l.id)}
            aria-label="Remove lift"
            style={{ padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Sets List (Indented) */}
      <div className="lift-sets-list" style={{ paddingLeft: "60px", display: "flex", flexDirection: "column", gap: "6px" }}>
        {listSets.map((s) => (
          <div key={s.id} className="set-row" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Set Type selection */}
            <select
              className="text-input set-type"
              value={s.type}
              onChange={(e) => updateSet(s.id, { type: e.target.value })}
              style={{ width: "45px", padding: "3px 4px", fontSize: "12px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "6px", textAlign: "center", fontWeight: "bold", color: s.type === "W" ? "var(--brass)" : "var(--chalk)" }}
            >
              <option value="W">W</option>
              {Array.from({ length: 15 }, (_, i) => String(i + 1)).map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>

            {/* Weight Input */}
            <input
              className="text-input set-num"
              type="number"
              placeholder="Wt"
              value={s.weight}
              onChange={(e) => updateSet(s.id, { weight: e.target.value })}
              style={{ width: "65px", padding: "4px 8px", fontSize: "12px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "6px" }}
            />
            <span style={{ fontSize: "11px", color: "var(--chalk-dim)" }}>{l.unit || "kg"}</span>

            <span style={{ color: "var(--chalk-dim)", fontSize: "12px" }}>×</span>

            {/* Reps Input */}
            <input
              className="text-input set-num"
              type="number"
              placeholder="Reps"
              value={s.reps}
              onChange={(e) => updateSet(s.id, { reps: e.target.value })}
              style={{ width: "55px", padding: "4px 8px", fontSize: "12px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "6px" }}
            />
            <span style={{ fontSize: "11px", color: "var(--chalk-dim)" }}>Reps</span>

            {/* PR Checkbox */}
            <label className="pr-check" style={{ marginLeft: "8px", display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--chalk-dim)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={s.isPR}
                onChange={(e) => updateSet(s.id, { isPR: e.target.checked })}
                style={{ cursor: "pointer" }}
              />
              PR
            </label>

            <div style={{ flex: 1 }} />

            {/* Remove Set */}
            {listSets.length > 1 && (
              <button
                type="button"
                className="icon-btn"
                onClick={() => removeSet(s.id)}
                aria-label="Remove set"
                style={{ padding: "2px 6px", fontSize: "11px" }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}



function DayModal({ day, phaseColor, onClose, onSave, onDelete, onUpdateDraft, onGoToExerciseLibrary }: {
  day: DayEntry; phaseColor: string; onClose: () => void; onSave: (d: DayEntry) => void; onDelete: (id: string) => void; onUpdateDraft: (d: DayEntry) => void; onGoToExerciseLibrary: () => void;
}) {
  const [type, setType] = useState(day.type === "empty" ? "workout" : day.type);
  const [title, setTitle] = useState(day.title);
  const [bodyTags, setBodyTags] = useState(day.bodyTags || []);
  const [lifts, setLifts] = useState<LiftEntry[]>(day.lifts && day.lifts.length ? day.lifts : []);
  const [notes, setNotes] = useState(day.notes || "");

  useEffect(() => {
    setType(day.type === "empty" ? "workout" : day.type);
    setTitle(day.title || "");
    setBodyTags(day.bodyTags || []);
    setLifts(day.lifts && day.lifts.length ? day.lifts : []);
    setNotes(day.notes || "");
  }, [day]);

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
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ "--phase": phaseColor } as React.CSSProperties}>
        <div className="modal-header">
          <div>
            <div className="modal-date">{fmtDateFull(day.date)}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
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
                  >
                    {v.label}
                  </button>
                ))}
            </div>
          </div>

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
        </div>

        <div className="modal-footer">
          {day.type !== "empty" && (
            <button className="btn-ghost" onClick={() => onDelete(day.id)}>Clear day</button>
          )}
          <div className="spacer" />
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save entry</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Day card ---------------- */

function DayCard({ day, phaseColor, isToday, onClick }: {
  day: DayEntry; phaseColor: string; isToday: boolean; onClick: () => void;
}) {
  const meta = DAY_TYPES[day.type] || DAY_TYPES.empty;
  const hasPR = day.lifts && day.lifts.some((l) => Array.isArray(l.sets) && l.sets.some((s) => s.isPR));
  return (
    <button
      className={`day-card ${day.type === "empty" ? "day-empty" : ""} ${isToday ? "day-today" : ""}`}
      style={{
        "--day-color": day.type === "workout" ? phaseColor : meta.color,
      } as React.CSSProperties}
      onClick={onClick}
    >
      <div className="day-card-top">
        <span className="day-weekday">{fmtDate(day.date).split(" ")[0]}</span>
        <span className="day-num">{fmtDate(day.date).split(" ")[2]}</span>
        {hasPR && <span className="pr-flag">PR</span>}
      </div>
      <div className="day-title">{day.title || (day.type === "empty" ? "" : meta.label)}</div>
      {day.bodyTags && day.bodyTags.length > 0 && (
        <div className="day-tags">{day.bodyTags.slice(0, 2).join(" · ")}</div>
      )}
    </button>
  );
}

/* ---------------- Microcycle row ---------------- */

function MicrocycleRow({ mic, phaseColor, onDayClick, today, onDeleteMicrocycle, onRenameMicrocycle }: {
  mic: Microcycle; phaseColor: string; onDayClick: (d: DayEntry) => void; today: string;
  onDeleteMicrocycle: (id: string) => void; onRenameMicrocycle: (id: string, newLabel: string) => void;
}) {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [tempLabel, setTempLabel] = useState(mic.label || "");

  useEffect(() => {
    setTempLabel(mic.label || "");
  }, [mic.id, mic.label]);

  const handleSave = () => {
    setIsEditingLabel(false);
    onRenameMicrocycle(mic.id, tempLabel.trim());
  };

  return (
    <div className="microcycle-row">
      <div className="microcycle-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="mc-index">MC{mic.index}</span>
          {isEditingLabel ? (
            <input
              className="text-input"
              value={tempLabel}
              onChange={(e) => setTempLabel(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                else if (e.key === "Escape") {
                  setIsEditingLabel(false);
                  setTempLabel(mic.label || "");
                }
              }}
              autoFocus
              placeholder="Label"
              style={{ width: "100px", padding: "2px 6px", fontSize: "11px", height: "22px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "4px" }}
            />
          ) : (
            mic.label && <span className="mc-tag">{mic.label}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            className="action-icon-btn"
            onClick={() => setIsEditingLabel(true)}
            title="Rename Microcycle"
            type="button"
          >
            <Pencil size={11} />
          </button>
          <button
            className="action-icon-btn action-icon-btn-danger"
            onClick={() => onDeleteMicrocycle(mic.id)}
            title="Delete Microcycle"
            type="button"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <div className="day-grid">
        {mic.days.map((day) => (
          <DayCard
            key={day.id}
            day={day}
            phaseColor={phaseColor}
            isToday={day.date === today}
            onClick={() => onDayClick(day)}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------- Add microcycle inline ---------------- */

function AddMicrocycleButton({ meso, onAdd }: { meso: Mesocycle; onAdd: (mic: Microcycle) => void }) {
  const [open, setOpen] = useState(false);
  const [length, setLength] = useState<number | "">(7);
  const [label, setLabel] = useState("");

  const lastDay = meso.microcycles.length
    ? meso.microcycles[meso.microcycles.length - 1].days.slice(-1)[0].date
    : meso.start;
  const nextStart = meso.microcycles.length ? addDays(lastDay, 1) : meso.start;
  const nextIndex = meso.microcycles.length
    ? meso.microcycles[meso.microcycles.length - 1].index + 1
    : parseInt(meso.micRange.split(/[–-]/)[0], 10) || 1;

  if (!open) {
    return (
      <button className="add-mc-btn" onClick={() => setOpen(true)}>
        + Add microcycle
      </button>
    );
  }

  return (
    <div className="add-mc-form">
      <span className="add-mc-hint">MC{nextIndex} starts {fmtDateShort(nextStart)}</span>
      <input
        className="text-input lift-num"
        type="number"
        min={1}
        max={21}
        value={length}
        onChange={(e) => {
          const val = e.target.value;
          setLength(val === "" ? "" : parseInt(val, 10));
        }}
      />
      <span className="add-mc-hint">days</span>
      <input
        className="text-input"
        style={{ width: 120 }}
        placeholder="Label (optional)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <button
        className="btn-primary btn-sm"
        onClick={() => {
          const finalLength = length === "" ? 7 : Number(length);
          const [built] = buildMicrocycles(nextStart, [{ index: nextIndex, length: finalLength, label: label || null }]);
          onAdd(built);
          setOpen(false);
          setLength(7);
          setLabel("");
        }}
      >
        Add
      </button>
      <button className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}

/* ---------------- Edit mesocycle modal ---------------- */

function EditMesocycleModal({
  meso,
  macrocycles,
  onClose,
  onSave,
}: {
  meso: Mesocycle;
  macrocycles: Macrocycle[];
  onClose: () => void;
  onSave: (updates: { name: string; phaseKey: string; start: string; macroId: string }) => void;
}) {
  const [name, setName] = useState(meso.name);
  const [phaseKey, setPhaseKey] = useState(meso.phaseKey);
  const [start, setStart] = useState(meso.start);
  const [macroId, setMacroId] = useState(meso.macroId);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ "--phase": PHASES[phaseKey]?.color || "#C1432E" } as React.CSSProperties}
      >
        <div className="modal-header">
          <div className="modal-date">Edit Mesocycle — {meso.name}</div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="field-row">
            <label className="field-label">Mesocycle Name</label>
            <input
              className="text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Peaking Block 1"
            />
          </div>

          <div className="field-row">
            <label className="field-label">Phase</label>
            <div className="type-pills">
              {Object.entries(PHASES).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  className={`pill ${phaseKey === k ? "pill-active" : ""}`}
                  style={phaseKey === k ? { borderColor: v.color, color: "#fff" } : {}}
                  onClick={() => setPhaseKey(k)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <label className="field-label">Start Date</label>
            <input
              type="date"
              className="text-input"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>

          <div className="field-row">
            <label className="field-label">Macrocycle</label>
            <div className="type-pills">
              {macrocycles.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`pill ${macroId === m.id ? "pill-active" : ""}`}
                  onClick={() => setMacroId(m.id)}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => {
              if (!name.trim()) return;
              onSave({ name: name.trim(), phaseKey, start, macroId });
              onClose();
            }}
          >
            Save Mesocycle
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Mesocycle detail ---------------- */

function MesoDetail({ meso, macrocycles, onDayClick, onAddMicrocycle, today, onDeleteMeso, onDeleteMicrocycle, onUpdateMeso, onRenameMicrocycle }: {
  meso: Mesocycle; macrocycles: Macrocycle[]; onDayClick: (d: DayEntry) => void; onAddMicrocycle: (mic: Microcycle) => void; today: string;
  onDeleteMeso: (id: string) => void; onDeleteMicrocycle: (micId: string) => void;
  onUpdateMeso: (id: string, updates: { name: string; phaseKey: string; start: string; macroId: string }) => void;
  onRenameMicrocycle: (id: string, newLabel: string) => void;
}) {
  const phase = PHASES[meso.phaseKey] || PHASES.Peaking;
  const [editingMeso, setEditingMeso] = useState(false);

  return (
    <div className="meso-detail" style={{ "--phase": phase.color } as React.CSSProperties}>
      <div className="meso-detail-header">
        <div>
          <div className="meso-eyebrow">
            Mesocycle {meso.index} · MC {meso.micRange} · {phase.label}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
            <h2 className="meso-title">{meso.name}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                className="action-icon-btn"
                onClick={() => setEditingMeso(true)}
                title="Edit Mesocycle (Name, Phase, Dates, Macrocycle)"
                type="button"
              >
                <Pencil size={13} />
              </button>
              <button
                className="action-icon-btn action-icon-btn-danger"
                onClick={() => onDeleteMeso(meso.id)}
                title="Delete Mesocycle"
                type="button"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <div className="meso-dates">
            {fmtDateShort(meso.start)} — {fmtDateShort(meso.end)}
            <span className={`status-badge status-${meso.status}`}>{meso.status}</span>
          </div>
        </div>
      </div>

      {meso.microcycles.length === 0 ? (
        <div className="meso-empty">
          No microcycles logged for this block yet.
        </div>
      ) : (
        meso.microcycles.map((mic) => (
          <MicrocycleRow key={mic.id} mic={mic} phaseColor={phase.color} onDayClick={onDayClick} today={today} onDeleteMicrocycle={onDeleteMicrocycle} onRenameMicrocycle={onRenameMicrocycle} />
        ))
      )}

      <AddMicrocycleButton meso={meso} onAdd={onAddMicrocycle} />

      {editingMeso && (
        <EditMesocycleModal
          meso={meso}
          macrocycles={macrocycles}
          onClose={() => setEditingMeso(false)}
          onSave={(updates) => onUpdateMeso(meso.id, updates)}
        />
      )}
    </div>
  );
}

/* ---------------- Macrocycle timeline (sidebar) ---------------- */

function MacroTimeline({ macrocycles, mesocycles, selectedId, onSelect, onAddMacro, onAddMeso, onDeleteMacro, onRenameMacro }: {
  macrocycles: Macrocycle[]; mesocycles: Mesocycle[]; selectedId: string | null;
  onSelect: (id: string) => void; onAddMacro: () => void; onAddMeso: (macroId: string) => void;
  onDeleteMacro: (id: string) => void; onRenameMacro: (id: string, name: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedMeso = mesocycles.find((m) => m.id === selectedId);
  const [editingMacroId, setEditingMacroId] = useState<string | null>(null);
  const [tempMacroName, setTempMacroName] = useState("");

  const handleSaveMacroName = (macroId: string) => {
    setEditingMacroId(null);
    if (tempMacroName.trim() && tempMacroName.trim() !== (macrocycles.find((m) => m.id === macroId)?.name || "")) {
      onRenameMacro(macroId, tempMacroName.trim());
    }
  };

  return (
    <div className={`timeline ${isOpen ? "timeline-open" : "timeline-collapsed"}`}>
      <button
        className="timeline-mobile-toggle"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span>
          {isOpen ? "Hide Timeline & Blocks ✕" : `📋 Show Timeline & Blocks (Selected: ${selectedMeso ? selectedMeso.name : "None"}) ▾`}
        </span>
      </button>
      <div className="timeline-content">
        {macrocycles.map((macro) => {
          const group = mesocycles.filter((m) => m.macroId === macro.id);
          const isEditing = editingMacroId === macro.id;

          return (
            <div className="macro-group" key={macro.id}>
              <div className="timeline-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {isEditing ? (
                  <input
                    className="text-input"
                    value={tempMacroName}
                    onChange={(e) => setTempMacroName(e.target.value)}
                    onBlur={() => handleSaveMacroName(macro.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveMacroName(macro.id);
                      else if (e.key === "Escape") setEditingMacroId(null);
                    }}
                    autoFocus
                    style={{ fontSize: "12px", padding: "2px 6px", width: "140px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "4px" }}
                  />
                ) : (
                  <div>
                    {macro.name}
                    <span className="macro-heading-range"> · from {fmtDateShort(macro.start)}</span>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <button
                    className="action-icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingMacroId(macro.id);
                      setTempMacroName(macro.name);
                    }}
                    title="Rename Macrocycle"
                    type="button"
                    style={{ padding: "4px" }}
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    className="action-icon-btn action-icon-btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteMacro(macro.id);
                    }}
                    title="Delete Macrocycle"
                    type="button"
                    style={{ padding: "4px" }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <div className="timeline-list">
                {group.map((m) => {
                  const phase = PHASES[m.phaseKey];
                  const active = m.id === selectedId;
                  return (
                    <button
                      key={m.id}
                      className={`timeline-item ${active ? "timeline-item-active" : ""}`}
                      style={{ "--phase": phase.color } as React.CSSProperties}
                      onClick={() => {
                        onSelect(m.id);
                        setIsOpen(false);
                      }}
                    >
                      <span className="timeline-dot" />
                      <span className="timeline-item-body">
                        <span className="timeline-index">MS{m.index}</span>
                        <span className="timeline-name">{m.name}</span>
                        <span className="timeline-range">{fmtDateShort(m.start)} – {fmtDateShort(m.end)}</span>
                      </span>
                      {m.status === "active" && <span className="live-dot" aria-label="Active" />}
                    </button>
                  );
                })}
                {group.length === 0 && <div className="macro-empty-hint">No mesocycles yet</div>}
              </div>
              <button className="add-meso-inline-btn" onClick={() => onAddMeso(macro.id)}>
                + Add mesocycle to {macro.name}
              </button>
            </div>
          );
        })}
        <button className="add-macro-btn" onClick={onAddMacro}>+ Add macrocycle</button>
      </div>
    </div>
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
  const [activeDay, setActiveDay] = useState<{ mesoId: string; micId: string; day: DayEntry } | null>(null);
  const [addingMeso, setAddingMeso] = useState(false);
  const [addingMesoMacroId, setAddingMesoMacroId] = useState<string | null>(null);
  const [addingMacro, setAddingMacro] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('library');
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

  const openDay = (mesoId: string, micId: string, day: DayEntry) => {
    setActiveDay({ mesoId, micId, day });
    setIsDayModalMinimized(false);
  };

  const handleStartWorkoutClick = () => {
    if (activeDay !== null) {
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
        setActiveDay({ mesoId: meso.id, micId: mc.id, day: todayDay });
        return;
      }
    }
    
    // Fallback: pick the first day of the active microcycle
    if (meso.microcycles.length > 0 && meso.microcycles[0].days.length > 0) {
      const mc = meso.microcycles[0];
      setActiveDay({ mesoId: meso.id, micId: mc.id, day: mc.days[0] });
      setIsDayModalMinimized(false);
    }
  };

  const saveDay = (updatedDay: DayEntry) => {
    setMesocycles((prev) =>
      prev.map((m) =>
        m.id !== activeDay!.mesoId
          ? m
          : {
              ...m,
              microcycles: m.microcycles.map((mc) =>
                mc.id !== activeDay!.micId
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
  };

  const handleAddExerciseToActiveDay = (name: string, gifUrl?: string) => {
    let currentActive = activeDay;
    if (!currentActive) {
      const meso = selectedMeso || mesocycles.find((m) => m.status === "active") || mesocycles[mesocycles.length - 1];
      if (meso && meso.microcycles.length > 0 && meso.microcycles[0].days.length > 0) {
        const mc = meso.microcycles[0];
        const day = mc.days[0];
        currentActive = { mesoId: meso.id, micId: mc.id, day };
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
    setActiveDay({ ...currentActive, day: updatedDay });
  };

  const handleAddExercisesToActiveDay = (exercisesList: { name: string; gifUrl?: string }[]) => {
    if (!exercisesList || exercisesList.length === 0) return;
    let currentActive = activeDay;
    if (!currentActive) {
      const meso = selectedMeso || mesocycles.find((m) => m.status === "active") || mesocycles[mesocycles.length - 1];
      if (meso && meso.microcycles.length > 0 && meso.microcycles[0].days.length > 0) {
        const mc = meso.microcycles[0];
        const day = mc.days[0];
        currentActive = { mesoId: meso.id, micId: mc.id, day };
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
    setActiveDay({ ...currentActive, day: updatedDay });
    setIsDayModalMinimized(false);
  };

  const clearDay = (dayId: string) => {
    setMesocycles((prev) =>
      prev.map((m) =>
        m.id !== activeDay!.mesoId
          ? m
          : {
              ...m,
              microcycles: m.microcycles.map((mc) =>
                mc.id !== activeDay!.micId
                  ? mc
                  : {
                      ...mc,
                      days: mc.days.map((d) =>
                        d.id === dayId
                          ? { ...d, type: "empty", title: "", bodyTags: [], lifts: [], notes: "" }
                          : d
                      ),
                    }
              ),
            }
      )
    );
    setActiveDay(null);
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
    const macroMesos = mesocycles.filter((m) => m.macroId === targetMacroId);
    const lastIndex = macroMesos.length;
    const totalDays = weeks * micLen;
    const end = addDays(start, totalDays - 1);
    const micCount = weeks;

    let lastMicIndex = 0;
    macroMesos.forEach((m) => {
      if (m.microcycles.length > 0) {
        const highest = Math.max(...m.microcycles.map((mc) => mc.index));
        if (highest > lastMicIndex) lastMicIndex = highest;
      } else if (m.micRange) {
        const parts = m.micRange.split(/[–-]/);
        const endRange = parseInt(parts[1] || parts[0], 10);
        if (!isNaN(endRange) && endRange > lastMicIndex) lastMicIndex = endRange;
      }
    });

    const startMicIndex = lastMicIndex + 1;
    const endMicIndex = lastMicIndex + micCount;
    const ranges = Array.from({ length: micCount }, (_, i) => ({
      index: startMicIndex + i,
      length: micLen,
    }));
    const microcycles = buildMicrocycles(start, ranges);
    const newMeso: Mesocycle = {
      id: uid(),
      macroId: targetMacroId,
      index: lastIndex + 1,
      name,
      phaseKey,
      micRange: `${startMicIndex}–${endMicIndex}`,
      start,
      end,
      status: today < start ? "upcoming" : today > end ? "completed" : "active",
      microcycles,
    };
    setMesocycles((prev) => [...prev, newMeso]);
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

  const sessionsLogged = mesocycles.reduce(
    (acc, m) =>
      acc +
      m.microcycles.reduce(
        (a2, mc) => a2 + mc.days.filter((d) => d.type !== "empty").length,
        0
      ),
    0
  );

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
             activeTab === 'library' ? 'Iron Ledger' :
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
          onDayClick={(mesoId, micId, day) => openDay(mesoId, micId, day)}
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

      {activeTab === 'library' && (
        <>
          <div className="header">
            <div>
              <div className="header-title">Periodization Overview</div>
              <div className="header-sub">Macrocycle & Mesocycle Blocks</div>
            </div>
            <div className="header-stats">
              <div className="stat">
                <div className="stat-num">{sessionsLogged}</div>
                <div className="stat-label">Sessions logged</div>
              </div>
              <div className="stat">
                <div className="stat-num">{prLog.length}</div>
                <div className="stat-label">PRs on record</div>
              </div>
            </div>
          </div>

          <PRShelf prLog={prLog} />

          <div className="layout">
            <div>
              <MacroTimeline
                macrocycles={macrocycles}
                mesocycles={mesocycles}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onAddMacro={() => setAddingMacro(true)}
                onAddMeso={(macroId) => {
                  setAddingMesoMacroId(macroId);
                  setAddingMeso(true);
                }}
                onDeleteMacro={deleteMacrocycle}
                onRenameMacro={renameMacrocycle}
              />
            </div>

            {selectedMeso && (
              <MesoDetail
                meso={selectedMeso}
                macrocycles={macrocycles}
                today={today}
                onDayClick={(day) => {
                  const mic = selectedMeso.microcycles.find((mc) => mc.days.some((d) => d.id === day.id));
                  if (mic) openDay(selectedMeso.id, mic.id, day);
                }}
                onAddMicrocycle={(built) => addMicrocycleTo(selectedMeso.id, built)}
                onDeleteMeso={deleteMesocycle}
                onDeleteMicrocycle={(micId) => deleteMicrocycle(selectedMeso.id, micId)}
                onUpdateMeso={updateMesocycle}
                onRenameMicrocycle={renameMicrocycle}
              />
            )}
          </div>
        </>
      )}

      {activeDay && selectedMeso && !isDayModalMinimized && (
        <DayModal
          day={activeDay.day}
          phaseColor={PHASES[selectedMeso.phaseKey]?.color || "#C1432E"}
          onClose={() => setIsDayModalMinimized(true)}
          onSave={(updatedDay) => {
            saveDay(updatedDay);
            setIsDayModalMinimized(false);
          }}
          onDelete={(dayId) => {
            clearDay(dayId);
            setIsDayModalMinimized(false);
          }}
          onUpdateDraft={(updatedDay) => {
            updateDayDraft(updatedDay);
          }}
          onGoToExerciseLibrary={() => {
            setIsDayModalMinimized(true);
            setActiveTab('exercises');
          }}
        />
      )}

      {showResumeDiscardPrompt && activeDay && (
        <ResumeOrDiscardModal
          activeDayTitle={activeDay.day.title}
          activeDayDate={activeDay.day.date}
          onClose={() => setShowResumeDiscardPrompt(false)}
          onResume={() => {
            setShowResumeDiscardPrompt(false);
            setIsDayModalMinimized(false);
          }}
          onDiscard={() => {
            setShowResumeDiscardPrompt(false);
            setActiveDay(null);
            setIsDayModalMinimized(false);
            handleStartNewWorkout();
          }}
        />
      )}

      {addingMeso && (
        <AddMesocycleModal
          lastEnd={mesocycles[mesocycles.length - 1]?.end || today}
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
        isWorkoutMinimized={activeDay !== null && isDayModalMinimized}
        activeWorkoutTitle={activeDay?.day.title || "Workout Session"}
        onResumeWorkout={() => setIsDayModalMinimized(false)}
        isOpen={isNavDrawerOpen}
        onClose={() => setIsNavDrawerOpen(false)}
      />
    </div>
  );
}
