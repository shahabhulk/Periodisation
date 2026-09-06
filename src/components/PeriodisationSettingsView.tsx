import React, { useState } from 'react';
import {
  Plus,
  Calendar,
  Pencil,
  Trash2,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  BatteryCharging,
  AlertCircle,
} from 'lucide-react';

const PHASES: Record<string, { color: string; label: string; description: string }> = {
  Hypertrophy: {
    color: "#f59e0b",
    label: "Hypertrophy Phase",
    description: "High volume training focused on muscle cross-sectional area growth.",
  },
  Strength: {
    color: "#3b82f6",
    label: "Strength Phase",
    description: "Progressive overload with moderate volume and high intensity.",
  },
  Peaking: {
    color: "#f43f5e",
    label: "Peaking Phase",
    description: "Maximum intensity low-rep singles/triples for competition readiness.",
  },
  Accumulation: {
    color: "#10b981",
    label: "Accumulation Phase",
    description: "Building foundational capacity and work tolerance.",
  },
  Base: {
    color: "#a855f7",
    label: "Base Building",
    description: "Technique mastery, general physical preparation, and conditioning.",
  },
  Deload: {
    color: "#06b6d4",
    label: "Deload Phase",
    description: "Active recovery and fatigue dissipation.",
  },
};

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function fmtDateShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" });
}

export interface SetEntry {
  id: string;
  type: string;
  weight: string | number;
  reps: string | number;
  isPR: boolean;
  equipment?: 'raw' | 'gear';
}

export interface LiftEntry {
  id: string;
  name: string;
  gifUrl?: string;
  unit: string;
  sets: SetEntry[];
}

export interface DayEntry {
  id: string;
  date: string;
  type: string;
  title: string;
  bodyTags: string[];
  lifts: LiftEntry[];
  notes: string;
  durationSeconds?: number;
}

export interface Microcycle {
  id: string;
  index: number;
  label: string | null;
  days: DayEntry[];
}

export interface Mesocycle {
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

export interface Macrocycle {
  id: string;
  index: number;
  name: string;
  start: string;
}

interface PeriodisationSettingsViewProps {
  macrocycles: Macrocycle[];
  mesocycles: Mesocycle[];
  today: string;
  onDayClick: (mesoId: string, micId: string, day: DayEntry) => void;
  onAddMacro: () => void;
  onAddMeso: (macroId?: string) => void;
  onAddMicrocycle: (mesoId: string, built: Microcycle) => void;
  onUpdateMeso: (mesoId: string, updates: { name: string; phaseKey: string; start: string; macroId: string }) => void;
  onDeleteMeso: (mesoId: string) => void;
  onDeleteMicrocycle: (mesoId: string, micId: string) => void;
  onRenameMicrocycle: (mesoId: string, micId: string, newLabel: string) => void;
  onSetActiveMeso?: (mesoId: string) => void;
  onRenameMacro?: (macroId: string, newName: string) => void;
  onDeleteMacro?: (macroId: string) => void;
}

export const PeriodisationSettingsView: React.FC<PeriodisationSettingsViewProps> = ({
  macrocycles,
  mesocycles,
  today,
  onDayClick,
  onAddMacro,
  onAddMeso,
  onAddMicrocycle,
  onUpdateMeso,
  onDeleteMeso,
  onDeleteMicrocycle,
  onRenameMicrocycle,
  onSetActiveMeso: _onSetActiveMeso,
  onRenameMacro,
  onDeleteMacro,
}) => {
  // Active macrocycle and mesocycle resolution
  const [selectedMacroId, setSelectedMacroId] = useState<string | null>(null);
  const [selectedMesoId, setSelectedMesoId] = useState<string | null>(null);
  const [selectionLevel, setSelectionLevel] = useState<'none' | 'macrocycle' | 'mesocycle'>('mesocycle');

  // Date-synced status calculation
  const getPhaseStatus = (start: string, end: string) => {
    if (today < start) return "upcoming";
    if (today > end) return "completed";
    return "active";
  };

  const activeMesoGlobal = mesocycles.find((m) => getPhaseStatus(m.start, m.end) === "active") || mesocycles[0] || null;
  const initialMacroId = activeMesoGlobal?.macroId || macrocycles[0]?.id || null;

  const currentMacro = selectionLevel === 'none'
    ? null
    : (selectedMacroId ? macrocycles.find((mc) => mc.id === selectedMacroId) : null)
      || (initialMacroId ? macrocycles.find((mc) => mc.id === initialMacroId) : null)
      || macrocycles[0]
      || null;

  // Mesocycles belonging STRICTLY to the currently selected macrocycle (chronologically ordered by start date)
  const currentMacroMesos = currentMacro
    ? [...mesocycles.filter((m) => m.macroId === currentMacro.id)].sort((a, b) => {
        const dateA = a.start || "";
        const dateB = b.start || "";
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.index || 0) - (b.index || 0);
      })
    : [];

  // Active mesocycle strictly within this specific macrocycle:
  // Strictly checks whether any mesocycle in this macrocycle currently includes today.
  // If none is active today, falls back to the upcoming phase or first phase (tagged as UPCOMING, never active).
  const activeMesoInCurrentMacro = currentMacroMesos.find((m) => getPhaseStatus(m.start, m.end) === "active");

  const activeMeso = (selectedMesoId && currentMacroMesos.find((m) => m.id === selectedMesoId))
    || activeMesoInCurrentMacro
    || currentMacroMesos.find((m) => getPhaseStatus(m.start, m.end) === "upcoming")
    || currentMacroMesos[0]
    || null;

  const mesoStatus = activeMeso ? getPhaseStatus(activeMeso.start, activeMeso.end) : "upcoming";
  const parentMacro = activeMeso ? macrocycles.find((mc) => mc.id === activeMeso.macroId) : currentMacro;
  const phaseInfo = activeMeso ? (PHASES[activeMeso.phaseKey] || PHASES.Peaking) : PHASES.Peaking;

  // Local state
  const [isMacroDropdownOpen, setIsMacroDropdownOpen] = useState(false);
  const currentMacroIndex = currentMacro ? macrocycles.findIndex((m) => m.id === currentMacro.id) : -1;
  const canGoPrevMacro = currentMacroIndex > 0;
  const canGoNextMacro = currentMacroIndex >= 0 && currentMacroIndex < macrocycles.length - 1;

  const [isPhaseDropdownOpen, setIsPhaseDropdownOpen] = useState(false);
  const currentMesoIndex = activeMeso ? currentMacroMesos.findIndex((m) => m.id === activeMeso.id) : -1;
  const canGoPrev = currentMesoIndex > 0;
  const canGoNext = currentMesoIndex >= 0 && currentMesoIndex < currentMacroMesos.length - 1;

  const [editingLabelMicId, setEditingLabelMicId] = useState<string | null>(null);
  const [tempLabel, setTempLabel] = useState("");
  const [isInlineAddMcOpen, setIsInlineAddMcOpen] = useState(false);
  const [newMcDays, setNewMcDays] = useState<number>(7);
  const [newMcLabel, setNewMcLabel] = useState("");
  const [isEditingActiveMeso, setIsEditingActiveMeso] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhaseKey, setEditPhaseKey] = useState("Peaking");
  const [editStart, setEditStart] = useState("");
  const [editMacroId, setEditMacroId] = useState("");

  // Metrics for active phase
  let totalPhaseWorkouts = 0;
  let totalPhaseVolume = 0;
  if (activeMeso) {
    activeMeso.microcycles.forEach((mc) => {
      mc.days.forEach((d) => {
        if (d.type === "workout" || (d.lifts && d.lifts.length > 0)) {
          totalPhaseWorkouts += 1;
          (d.lifts || []).forEach((l) => {
            (l.sets || []).forEach((s) => {
              const w = parseFloat(String(s.weight)) || 0;
              const r = parseFloat(String(s.reps)) || 0;
              totalPhaseVolume += w * r;
            });
          });
        }
      });
    });
  }

  // Calculate days remaining
  let daysRemaining = 0;
  if (activeMeso && activeMeso.start && activeMeso.end) {
    const e = new Date(activeMeso.end + "T00:00:00Z").getTime();
    const t = new Date(today + "T00:00:00Z").getTime();
    daysRemaining = Math.max(0, Math.ceil((e - t) / (1000 * 60 * 60 * 24)));
  }

  const handleOpenEditMeso = () => {
    if (!activeMeso) return;
    setEditName(activeMeso.name);
    setEditPhaseKey(activeMeso.phaseKey);
    setEditStart(activeMeso.start);
    setEditMacroId(activeMeso.macroId);
    setIsEditingActiveMeso(true);
  };

  const handleSaveEditMeso = () => {
    if (!activeMeso || !editName.trim()) return;
    onUpdateMeso(activeMeso.id, {
      name: editName.trim(),
      phaseKey: editPhaseKey,
      start: editStart,
      macroId: editMacroId,
    });
    setIsEditingActiveMeso(false);
  };

  const handleAddInlineMicrocycle = () => {
    if (!activeMeso) return;
    const lastDay = activeMeso.microcycles.length
      ? activeMeso.microcycles[activeMeso.microcycles.length - 1].days.slice(-1)[0].date
      : activeMeso.start;
    const nextStart = activeMeso.microcycles.length ? addDays(lastDay, 1) : activeMeso.start;
    const nextIndex = activeMeso.microcycles.length
      ? activeMeso.microcycles[activeMeso.microcycles.length - 1].index + 1
      : 1;

    const days: DayEntry[] = [];
    for (let i = 0; i < newMcDays; i++) {
      days.push({
        id: Math.random().toString(36).slice(2, 10),
        date: addDays(nextStart, i),
        type: "empty",
        title: "",
        bodyTags: [],
        lifts: [],
        notes: "",
      });
    }

    const built: Microcycle = {
      id: Math.random().toString(36).slice(2, 10),
      index: nextIndex,
      label: newMcLabel.trim() || null,
      days,
    };

    onAddMicrocycle(activeMeso.id, built);
    setIsInlineAddMcOpen(false);
    setNewMcDays(7);
    setNewMcLabel("");
  };

  return (
    <div className="periodisation-settings-container">
      <style>{`
        .periodisation-settings-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 18px 16px 100px;
          font-family: 'Inter', sans-serif;
          color: #edeae2;
        }

        /* Top Action Header */
        .settings-header-card {
          background: linear-gradient(135deg, #171c26 0%, #10141e 100%);
          border: 1px solid #283347;
          border-radius: 18px;
          padding: 20px 22px;
          margin-bottom: 20px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
        }

        .settings-header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          margin-bottom: 18px;
        }

        .settings-title-group h1 {
          font-family: 'Oswald', sans-serif;
          font-size: 26px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: #ffffff;
          margin: 0 0 4px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .settings-sub {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }

        /* Action Buttons Row */
        .settings-action-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .settings-action-btn {
          background: #1e2638;
          border: 1px solid #2f3b52;
          color: #ffffff;
          padding: 9px 14px;
          border-radius: 10px;
          font-family: 'Inter', sans-serif;
          font-size: 12.5px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          user-select: none;
        }

        .settings-action-btn:hover {
          background: #28334b;
          border-color: #3b82f6;
          transform: translateY(-1px);
        }

        .settings-action-btn-primary {
          background: linear-gradient(135deg, #f43f5e, #e11d48);
          border-color: #f43f5e;
          box-shadow: 0 4px 14px rgba(244, 63, 94, 0.35);
        }

        .settings-action-btn-primary:hover {
          background: linear-gradient(135deg, #fb7185, #f43f5e);
          border-color: #fb7185;
          box-shadow: 0 6px 18px rgba(244, 63, 94, 0.5);
        }

        /* Active Phase Banner */
        .active-phase-card {
          background: #141824;
          border: 1px solid #283248;
          border-left: 6px solid var(--phase-color, #C1432E);
          border-radius: 16px;
          padding: 22px;
          margin-bottom: 24px;
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
          position: relative;
        }

        .phase-card-top-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .phase-badge-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid var(--phase-color, #C1432E);
          color: var(--phase-color, #C1432E);
          margin-bottom: 8px;
        }

        .phase-title-text {
          font-family: 'Oswald', sans-serif;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: #ffffff;
          margin: 0 0 6px;
        }

        .phase-meta-line {
          font-size: 12.5px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .phase-status-live {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 6px;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.4);
          color: #34d399;
          letter-spacing: 0.5px;
        }

        /* Stats in Active Phase */
        .phase-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid #232c3d;
        }

        .phase-stat-box {
          background: #181e2b;
          border: 1px solid #252e40;
          border-radius: 10px;
          padding: 10px 12px;
          text-align: center;
        }

        .phase-stat-val {
          font-size: 17px;
          font-weight: 800;
          color: #ffffff;
          font-family: 'IBM Plex Mono', monospace;
        }

        .phase-stat-lbl {
          font-size: 10.5px;
          color: #94a3b8;
          text-transform: uppercase;
          margin-top: 2px;
          font-weight: 600;
        }

        /* Active Phase Calendar Grid */
        .calendar-section-title {
          font-family: 'Oswald', sans-serif;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 14px;
        }

        .microcycle-card-block {
          background: #161b26;
          border: 1px solid #263042;
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 16px;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
        }

        .mc-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #222b3b;
        }

        .mc-title-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .mc-index-badge {
          background: #222a3a;
          border: 1px solid #334057;
          color: #e2e8f0;
          font-size: 11.5px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 6px;
        }

        .mc-custom-tag {
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.35);
          color: #93c5fd;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 6px;
        }

        /* Days Grid inside Microcycle */
        .days-grid-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
          gap: 8px;
        }

        .interactive-day-card {
          background: #1c2333;
          border: 1px solid #2a354a;
          border-radius: 10px;
          padding: 10px 8px;
          cursor: pointer;
          transition: all 0.18s ease;
          text-align: left;
          display: flex;
          flex-direction: column;
          min-height: 85px;
          justify-content: space-between;
          position: relative;
        }

        .interactive-day-card:hover {
          border-color: #3b82f6;
          background: #232c3f;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
        }

        .day-card-today-glow {
          border-color: #f43f5e !important;
          box-shadow: 0 0 12px rgba(244, 63, 94, 0.25) !important;
        }

        .day-card-date-sub {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          color: #60a5fa;
          font-weight: 700;
        }

        .day-card-workout-title {
          font-size: 12px;
          font-weight: 700;
          color: #ffffff;
          margin: 4px 0 2px;
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .day-card-workout {
          border-color: rgba(16, 185, 129, 0.45) !important;
          background: linear-gradient(180deg, rgba(16, 185, 129, 0.1) 0%, #1c2333 100%) !important;
        }
        .day-card-workout:hover {
          border-color: #10b981 !important;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25) !important;
        }
        .date-workout {
          color: #34d399 !important;
        }
        .title-workout {
          color: #f1f5f9 !important;
        }

        .day-card-recovery {
          border-color: rgba(56, 189, 248, 0.45) !important;
          background: linear-gradient(180deg, rgba(56, 189, 248, 0.1) 0%, #1c2333 100%) !important;
        }
        .day-card-recovery:hover {
          border-color: #38bdf8 !important;
          box-shadow: 0 4px 14px rgba(56, 189, 248, 0.25) !important;
        }
        .date-recovery {
          color: #38bdf8 !important;
        }
        .title-recovery {
          color: #bae6fd !important;
        }

        .day-card-other-tag {
          border-color: rgba(239, 68, 68, 0.5) !important;
          background: linear-gradient(180deg, rgba(239, 68, 68, 0.12) 0%, #1c2333 100%) !important;
        }
        .day-card-other-tag:hover {
          border-color: #ef4444 !important;
          box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3) !important;
        }
        .date-other-tag {
          color: #f87171 !important;
        }
        .title-other-tag {
          color: #fecdd3 !important;
        }

        .day-card-future {
          border-color: #21293a !important;
          background: #141824 !important;
          opacity: 0.85;
        }
        .day-card-future:hover {
          border-color: #334155 !important;
          background: #182030 !important;
          opacity: 1;
        }
        .date-future {
          color: #64748b !important;
        }
        .title-future {
          color: #94a3b8 !important;
        }
        .label-future {
          color: #475569 !important;
        }

        .meso-overview-card {
          position: relative;
          background: #161b26;
          border: 1px solid #263042;
          border-left: 4px solid var(--phase-accent, #38bdf8);
          border-radius: 14px;
          padding: 16px 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          transition: all 0.18s ease;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), -2px 0 10px var(--phase-accent-glow, rgba(56, 189, 248, 0.2));
        }

        .meso-overview-card:hover {
          border-color: #38455e;
          border-left-color: var(--phase-accent, #38bdf8);
          background: #1a202e;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), -3px 0 14px var(--phase-accent-glow, rgba(56, 189, 248, 0.35));
        }

        .day-card-empty-label {
          font-size: 11px;
          color: #64748b;
          font-style: italic;
          margin-top: 4px;
        }

        /* Inline Add Microcycle Form */
        .inline-add-mc-box {
          background: #141824;
          border: 1px dashed #2e3a50;
          border-radius: 14px;
          padding: 14px;
          text-align: center;
          margin-top: 14px;
        }

        .inline-add-btn-trigger {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #293448;
          color: #cbd5e1;
          padding: 10px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .inline-add-btn-trigger:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          border-color: #3b82f6;
        }

        @media (max-width: 640px) {
          .periodisation-settings-container {
            padding: 12px 10px 90px;
          }
          .phase-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .days-grid-list {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>

      {/* 1. Header & Global Actions */}
      <div className="settings-header-card">
        <div className="settings-header-top" style={{ alignItems: "center" }}>
          <div className="settings-title-group">
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748b", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  setSelectionLevel('none');
                  setSelectedMacroId(null);
                  setSelectedMesoId(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: selectionLevel === 'none' ? "#38bdf8" : "#94a3b8",
                  fontWeight: selectionLevel === 'none' ? 700 : 500,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Macrocycles
              </button>
              {currentMacro && (
                <>
                  <span style={{ opacity: 0.5 }}>/</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMacroId(currentMacro.id);
                      setSelectedMesoId(null);
                      setSelectionLevel('macrocycle');
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: selectionLevel === 'macrocycle' ? "#38bdf8" : "#94a3b8",
                      fontWeight: selectionLevel === 'macrocycle' ? 700 : 500,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {currentMacro.name}
                  </button>
                </>
              )}
              {activeMeso && selectionLevel === 'mesocycle' && (
                <>
                  <span style={{ opacity: 0.5 }}>/</span>
                  <span style={{ color: "#ffffff", fontWeight: 700 }}>
                    {activeMeso.name}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Interactive Contextual Action Buttons */}
          <div className="settings-action-bar">
            {/* When NO macrocycle is selected: ONLY Add Macrocycle */}
            {selectionLevel === 'none' && (
              <button
                type="button"
                className="settings-action-btn settings-action-btn-primary"
                onClick={onAddMacro}
                title="Create a new annual / macro plan block"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>Add Macrocycle</span>
              </button>
            )}

            {/* When a macrocycle is selected: ONLY Add Mesocycle */}
            {selectionLevel === 'macrocycle' && (
              <button
                type="button"
                className="settings-action-btn settings-action-btn-primary"
                onClick={() => onAddMeso(currentMacro?.id)}
                title={`Add a new training phase / mesocycle to ${currentMacro?.name || 'Macrocycle'}`}
              >
                <Plus className="w-4 h-4 text-white" />
                <span>Add Mesocycle</span>
              </button>
            )}
          </div>
        </div>

        {/* Organized Macrocycle Switcher Dropdown & Stepper */}
        <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #232d40", width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Macrocycle Plan:</span>
            </div>
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              {macrocycles.length} macrocycle{macrocycles.length === 1 ? "" : "s"} configured
            </span>
          </div>

          {/* Stepper + Dropdown Bar - 100% width, fully bounded inside card */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", boxSizing: "border-box", minWidth: 0 }}>
            
            {/* Previous Macro Stepper Arrow */}
            {selectionLevel !== 'none' && (
              <button
                type="button"
                disabled={!canGoPrevMacro}
                onClick={() => {
                  if (canGoPrevMacro) {
                    const prevMacro = macrocycles[currentMacroIndex - 1];
                    setSelectedMacroId(prevMacro.id);
                    setSelectedMesoId(null);
                    setSelectionLevel('macrocycle');
                  }
                }}
                style={{
                  background: canGoPrevMacro ? "#1e2638" : "#131824",
                  border: "1px solid #2b384e",
                  borderRadius: "8px",
                  color: canGoPrevMacro ? "#ffffff" : "#475569",
                  padding: 0,
                  width: "34px",
                  height: "36px",
                  cursor: canGoPrevMacro ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
                title={canGoPrevMacro ? `Previous: ${macrocycles[currentMacroIndex - 1]?.name}` : "No earlier macrocycle"}
              >
                <ChevronLeft size={16} />
              </button>
            )}

            {/* Main Macro Dropdown Button */}
            <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
              <button
                type="button"
                onClick={() => setIsMacroDropdownOpen(!isMacroDropdownOpen)}
                style={{
                  width: "100%",
                  background: selectionLevel !== 'none' && currentMacro 
                    ? "linear-gradient(135deg, rgba(20, 36, 32, 0.95), rgba(14, 26, 24, 0.95))"
                    : "#161b26",
                  border: `1px solid ${selectionLevel !== 'none' && currentMacro ? "#10b981" : "#2d374d"}`,
                  borderRadius: "10px",
                  padding: "7px 10px",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                  boxShadow: isMacroDropdownOpen ? "0 0 14px rgba(16, 185, 129, 0.3)" : "none",
                  transition: "all 0.15s ease",
                  boxSizing: "border-box",
                  minWidth: 0,
                  height: "36px",
                }}
              >
                {selectionLevel !== 'none' && currentMacro ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, overflow: "hidden" }}>
                    <span
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: "#10b981",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: "12px" }}>
                      {currentMacro.name}
                    </span>
                    <span style={{ fontSize: "10px", color: "#64748b", background: "rgba(255, 255, 255, 0.05)", padding: "1px 5px", borderRadius: "4px", flexShrink: 0 }}>
                      {mesocycles.filter((m) => m.macroId === currentMacro.id).length} phases
                    </span>
                    {mesocycles.some((m) => m.macroId === currentMacro.id && getPhaseStatus(m.start, m.end) === "active") && (
                      <span style={{ fontSize: "8.5px", background: "rgba(16, 185, 129, 0.25)", color: "#34d399", fontWeight: 800, padding: "1px 4px", borderRadius: "3px", flexShrink: 0 }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#94a3b8", minWidth: 0, overflow: "hidden" }}>
                    <Layers size={13} className="text-emerald-400" />
                    <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: "12px" }}>
                      All Macrocycles ({macrocycles.length}) — Overview
                    </span>
                  </div>
                )}
                <ChevronDown
                  size={14}
                  style={{
                    color: "#94a3b8",
                    flexShrink: 0,
                    transform: isMacroDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>

              {/* Dropdown Menu Popup */}
              {isMacroDropdownOpen && (
                <>
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 90 }}
                    onClick={() => setIsMacroDropdownOpen(false)}
                  />

                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: 0,
                      right: 0,
                      background: "#141925",
                      border: "1px solid #2b384e",
                      borderRadius: "12px",
                      boxShadow: "0 14px 34px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.1)",
                      zIndex: 95,
                      maxHeight: "280px",
                      overflowY: "auto",
                      padding: "6px",
                    }}
                  >
                    {/* Option: All Macrocycles Overview */}
                    <div
                      onClick={() => {
                        setSelectedMacroId(null);
                        setSelectedMesoId(null);
                        setSelectionLevel('none');
                        setIsMacroDropdownOpen(false);
                      }}
                      style={{
                        padding: "9px 12px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: selectionLevel === 'none' ? "rgba(16, 185, 129, 0.15)" : "transparent",
                        color: selectionLevel === 'none' ? "#34d399" : "#cbd5e1",
                        fontSize: "12px",
                        fontWeight: selectionLevel === 'none' ? 700 : 500,
                        transition: "background 0.12s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (selectionLevel !== 'none') e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                      }}
                      onMouseLeave={(e) => {
                        if (selectionLevel !== 'none') e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Layers size={13} className="text-emerald-400" />
                        <span>All Macrocycles Overview ({macrocycles.length} plans)</span>
                      </div>
                      {selectionLevel === 'none' && <Check size={14} className="text-emerald-400" />}
                    </div>

                    <div style={{ height: "1px", background: "#232d40", margin: "4px 6px" }} />

                    {/* List of all Macrocycles */}
                    {macrocycles.map((macro) => {
                      const isCur = selectionLevel !== 'none' && currentMacro?.id === macro.id;
                      const macroMesos = mesocycles.filter((m) => m.macroId === macro.id);
                      const hasActive = macroMesos.some((m) => getPhaseStatus(m.start, m.end) === "active");

                      return (
                        <div
                          key={macro.id}
                          onClick={() => {
                            setSelectedMacroId(macro.id);
                            setSelectedMesoId(null);
                            setSelectionLevel('macrocycle');
                            setIsMacroDropdownOpen(false);
                          }}
                          style={{
                            padding: "9px 12px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                            background: isCur ? "rgba(16, 185, 129, 0.15)" : "transparent",
                            borderLeft: isCur ? "3px solid #10b981" : "3px solid transparent",
                            color: isCur ? "#ffffff" : "#cbd5e1",
                            fontSize: "12px",
                            fontWeight: isCur ? 700 : 500,
                            transition: "all 0.12s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!isCur) e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                          }}
                          onMouseLeave={(e) => {
                            if (!isCur) e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {macro.name}
                            </span>
                            <span style={{ fontSize: "10px", color: "#64748b" }}>
                              ({macroMesos.length} phases)
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                            {hasActive && (
                              <span style={{
                                fontSize: "8.5px",
                                fontWeight: 800,
                                padding: "1px 5px",
                                borderRadius: "4px",
                                background: "rgba(16, 185, 129, 0.2)",
                                color: "#34d399",
                              }}>
                                ACTIVE
                              </span>
                            )}
                            
                            {/* Inline Rename */}
                            {onRenameMacro && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsMacroDropdownOpen(false);
                                  const newName = window.prompt("Rename Macrocycle:", macro.name);
                                  if (newName && newName.trim() && newName.trim() !== macro.name) {
                                    onRenameMacro(macro.id, newName.trim());
                                  }
                                }}
                                title="Rename Macrocycle"
                                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "2px" }}
                              >
                                <Pencil size={11} />
                              </button>
                            )}

                            {/* Inline Delete */}
                            {macrocycles.length > 1 && onDeleteMacro && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Are you sure you want to delete "${macro.name}"?`)) {
                                    onDeleteMacro(macro.id);
                                  }
                                }}
                                title="Delete Macrocycle"
                                style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "2px" }}
                              >
                                <Trash2 size={11} />
                              </button>
                            )}

                            {isCur && <Check size={14} className="text-emerald-400" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Next Macro Stepper Arrow */}
            {selectionLevel !== 'none' && (
              <button
                type="button"
                disabled={!canGoNextMacro}
                onClick={() => {
                  if (canGoNextMacro) {
                    const nextMacro = macrocycles[currentMacroIndex + 1];
                    setSelectedMacroId(nextMacro.id);
                    setSelectedMesoId(null);
                    setSelectionLevel('macrocycle');
                  }
                }}
                style={{
                  background: canGoNextMacro ? "#1e2638" : "#131824",
                  border: "1px solid #2b384e",
                  borderRadius: "8px",
                  color: canGoNextMacro ? "#ffffff" : "#475569",
                  padding: 0,
                  width: "34px",
                  height: "36px",
                  cursor: canGoNextMacro ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
                title={canGoNextMacro ? `Next: ${macrocycles[currentMacroIndex + 1]?.name}` : "No later macrocycle"}
              >
                <ChevronRight size={16} />
              </button>
            )}

          </div>
        </div>

        {/* Organized Phase Switcher Dropdown & Stepper (Replaces clustered wrapped pills) */}
        {currentMacroMesos.length > 0 && (
          <div style={{ position: "relative", paddingTop: "12px", marginTop: "12px", borderTop: "1px solid #232d40", width: "100%", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>Mesocycle Phase:</span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                {currentMacroMesos.length} phase{currentMacroMesos.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* Stepper + Dropdown Bar - 100% width, fully bounded inside card */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", boxSizing: "border-box", minWidth: 0 }}>
              
              {/* Previous Phase Stepper Arrow */}
              {selectionLevel === 'mesocycle' && (
                <button
                  type="button"
                  disabled={!canGoPrev}
                  onClick={() => {
                    if (canGoPrev) {
                      const prevMeso = currentMacroMesos[currentMesoIndex - 1];
                      setSelectedMesoId(prevMeso.id);
                      setSelectionLevel('mesocycle');
                    }
                  }}
                  style={{
                    background: canGoPrev ? "#1e2638" : "#131824",
                    border: "1px solid #2b384e",
                    borderRadius: "8px",
                    color: canGoPrev ? "#ffffff" : "#475569",
                    padding: 0,
                    width: "34px",
                    height: "36px",
                    cursor: canGoPrev ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s ease",
                    flexShrink: 0,
                  }}
                  title={canGoPrev ? `Previous: ${currentMacroMesos[currentMesoIndex - 1]?.name}` : "No earlier phase"}
                >
                  <ChevronLeft size={16} />
                </button>
              )}

              {/* Main Dropdown Button */}
              <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => setIsPhaseDropdownOpen(!isPhaseDropdownOpen)}
                  style={{
                    width: "100%",
                    background: selectionLevel === 'mesocycle' && activeMeso 
                      ? "linear-gradient(135deg, rgba(26, 32, 48, 0.95), rgba(16, 21, 33, 0.95))"
                      : "#161b26",
                    border: `1px solid ${selectionLevel === 'mesocycle' && activeMeso ? "#3b82f6" : "#2d374d"}`,
                    borderRadius: "10px",
                    padding: "7px 10px",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "6px",
                    cursor: "pointer",
                    fontSize: "12px",
                    boxShadow: isPhaseDropdownOpen ? "0 0 14px rgba(59, 130, 246, 0.3)" : "none",
                    transition: "all 0.15s ease",
                    boxSizing: "border-box",
                    minWidth: 0,
                    height: "36px",
                  }}
                >
                    {selectionLevel === 'mesocycle' && activeMeso ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, overflow: "hidden" }}>
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: PHASES[activeMeso.phaseKey]?.color || "#C1432E",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {activeMeso.name}
                        </span>
                        <span style={{
                          fontSize: "9.5px",
                          fontWeight: 800,
                          padding: "1.5px 6px",
                          borderRadius: "4px",
                          flexShrink: 0,
                          background: mesoStatus === "active" ? "rgba(16, 185, 129, 0.2)" : mesoStatus === "upcoming" ? "rgba(234, 179, 8, 0.15)" : "rgba(148, 163, 184, 0.15)",
                          color: mesoStatus === "active" ? "#34d399" : mesoStatus === "upcoming" ? "#facc15" : "#94a3b8",
                        }}>
                          {mesoStatus.toUpperCase()}
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", minWidth: 0, overflow: "hidden" }}>
                        <Layers size={14} className="text-sky-400" />
                        <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          All Phases ({currentMacroMesos.length}) — Overview
                        </span>
                      </div>
                    )}
                    <ChevronDown
                      size={15}
                      style={{
                        color: "#94a3b8",
                        flexShrink: 0,
                        transform: isPhaseDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                      }}
                    />
                  </button>

                  {/* Dropdown Menu Popup */}
                  {isPhaseDropdownOpen && (
                    <>
                      {/* Invisible backdrop to dismiss on click outside */}
                      <div
                        style={{ position: "fixed", inset: 0, zIndex: 90 }}
                        onClick={() => setIsPhaseDropdownOpen(false)}
                      />

                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          left: 0,
                          right: 0,
                          background: "#141925",
                          border: "1px solid #2b384e",
                          borderRadius: "12px",
                          boxShadow: "0 14px 34px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.1)",
                          zIndex: 95,
                          maxHeight: "280px",
                          overflowY: "auto",
                          padding: "6px",
                        }}
                      >
                        {/* Option 1: All Mesocycles Overview */}
                        <div
                          onClick={() => {
                            setSelectedMesoId(null);
                            setSelectionLevel('macrocycle');
                            setIsPhaseDropdownOpen(false);
                          }}
                          style={{
                            padding: "9px 12px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background: selectionLevel === 'macrocycle' ? "rgba(56, 189, 248, 0.15)" : "transparent",
                            color: selectionLevel === 'macrocycle' ? "#38bdf8" : "#cbd5e1",
                            fontSize: "12px",
                            fontWeight: selectionLevel === 'macrocycle' ? 700 : 500,
                            transition: "background 0.12s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (selectionLevel !== 'macrocycle') e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                          }}
                          onMouseLeave={(e) => {
                            if (selectionLevel !== 'macrocycle') e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Layers size={13} className="text-sky-400" />
                            <span>All Phases Overview ({currentMacroMesos.length} phases)</span>
                          </div>
                          {selectionLevel === 'macrocycle' && <Check size={14} className="text-sky-400" />}
                        </div>

                        <div style={{ height: "1px", background: "#232d40", margin: "4px 6px" }} />

                        {/* List of all Mesocycles */}
                        {currentMacroMesos.map((m) => {
                          const isCur = selectionLevel === 'mesocycle' && activeMeso?.id === m.id;
                          const st = getPhaseStatus(m.start, m.end);
                          const col = PHASES[m.phaseKey]?.color || "#C1432E";

                          return (
                            <div
                              key={m.id}
                              onClick={() => {
                                setSelectedMesoId(m.id);
                                setSelectionLevel('mesocycle');
                                setIsPhaseDropdownOpen(false);
                              }}
                              style={{
                                padding: "9px 12px",
                                borderRadius: "8px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                                background: isCur ? `${col}20` : "transparent",
                                borderLeft: isCur ? `3px solid ${col}` : "3px solid transparent",
                                color: isCur ? "#ffffff" : "#cbd5e1",
                                fontSize: "12px",
                                fontWeight: isCur ? 700 : 500,
                                transition: "all 0.12s ease",
                              }}
                              onMouseEnter={(e) => {
                                if (!isCur) e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                              }}
                              onMouseLeave={(e) => {
                                if (!isCur) e.currentTarget.style.background = "transparent";
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: col, flexShrink: 0 }} />
                                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {m.name}
                                </span>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                                <span style={{
                                  fontSize: "9px",
                                  fontWeight: 800,
                                  padding: "1.5px 5px",
                                  borderRadius: "4px",
                                  background: st === "active" ? "rgba(16, 185, 129, 0.2)" : st === "upcoming" ? "rgba(234, 179, 8, 0.15)" : "rgba(148, 163, 184, 0.15)",
                                  color: st === "active" ? "#34d399" : st === "upcoming" ? "#facc15" : "#94a3b8",
                                }}>
                                  {st.toUpperCase()}
                                </span>
                                {isCur && <Check size={14} style={{ color: col }} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Next Phase Stepper Arrow */}
                {selectionLevel === 'mesocycle' && (
                  <button
                    type="button"
                    disabled={!canGoNext}
                    onClick={() => {
                      if (canGoNext) {
                        const nextMeso = currentMacroMesos[currentMesoIndex + 1];
                        setSelectedMesoId(nextMeso.id);
                        setSelectionLevel('mesocycle');
                      }
                    }}
                    style={{
                      background: canGoNext ? "#1e2638" : "#131824",
                      border: "1px solid #2b384e",
                      borderRadius: "8px",
                      color: canGoNext ? "#ffffff" : "#475569",
                      padding: 0,
                      width: "34px",
                      height: "36px",
                      cursor: canGoNext ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s ease",
                      flexShrink: 0,
                    }}
                    title={canGoNext ? `Next: ${currentMacroMesos[currentMesoIndex + 1]?.name}` : "No later phase"}
                  >
                    <ChevronRight size={16} />
                  </button>
                )}

              </div>
            </div>
        )}
      </div>

      {/* 2. When selectionLevel === 'none': show Macrocycle Architecture */}
      {selectionLevel === 'none' && (
        <div style={{ marginTop: "12px", marginBottom: "30px" }}>
          <div className="calendar-section-title">
            <Layers className="w-5 h-5 text-emerald-400" />
            Macrocycle Plans
          </div>
          <div style={{ display: "grid", gap: "12px" }}>
            {macrocycles.map((macro) => {
              const macroMesos = mesocycles.filter((m) => m.macroId === macro.id);
              const hasActive = macroMesos.some((m) => getPhaseStatus(m.start, m.end) === "active");

              return (
                <div
                  key={macro.id}
                  onClick={() => {
                    setSelectedMacroId(macro.id);
                    setSelectedMesoId(null);
                    setSelectionLevel('macrocycle');
                  }}
                  style={{
                    background: "#161b26",
                    border: "1px solid #263042",
                    borderRadius: "14px",
                    padding: "18px 20px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "16px", fontWeight: 700, color: "#fff" }}>{macro.name}</span>
                      {hasActive && (
                        <span style={{ fontSize: "9.5px", background: "rgba(16, 185, 129, 0.2)", color: "#34d399", fontWeight: 800, padding: "2px 6px", borderRadius: "4px" }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                      Starts {fmtDateShort(macro.start)} · {macroMesos.length} mesocycle phase{macroMesos.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <span style={{ fontSize: "12.5px", color: "#38bdf8", fontWeight: 600 }}>Select Macrocycle →</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. When selectionLevel === 'macrocycle': show Mesocycles in this selected Macrocycle */}
      {selectionLevel === 'macrocycle' && currentMacro && (
        <div style={{ marginTop: "12px", marginBottom: "30px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
            <div className="calendar-section-title" style={{ margin: 0 }}>
              <Layers className="w-5 h-5 text-sky-400" />
              Mesocycles in {currentMacro.name}
            </div>
            <button
              type="button"
              className="settings-action-btn settings-action-btn-primary"
              onClick={() => onAddMeso(currentMacro.id)}
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              <Plus size={14} />
              <span>+ Add Mesocycle to {currentMacro.name}</span>
            </button>
          </div>

          {currentMacroMesos.length === 0 ? (
            <div style={{ background: "#141824", border: "1px dashed #2e3a50", borderRadius: "14px", padding: "34px 20px", textAlign: "center" }}>
              <p style={{ color: "#ffffff", fontSize: "15px", fontWeight: 700, margin: "0 0 6px" }}>
                No Mesocycles in {currentMacro.name}
              </p>
              <p style={{ color: "#94a3b8", fontSize: "12.5px", margin: "0 0 16px" }}>
                This macrocycle currently has no training blocks. Click below to add your first mesocycle.
              </p>
              <button
                type="button"
                className="settings-action-btn settings-action-btn-primary"
                onClick={() => onAddMeso(currentMacro.id)}
              >
                <Plus size={16} />
                <span>+ Add Mesocycle to {currentMacro.name}</span>
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {currentMacroMesos.map((m) => {
                const status = getPhaseStatus(m.start, m.end);
                const pColor = PHASES[m.phaseKey]?.color || (m.name.toLowerCase().includes("deload") ? "#06b6d4" : "#f43f5e");
                const pLabel = PHASES[m.phaseKey]?.label || m.phaseKey || "Training Phase";

                return (
                  <div
                    key={m.id}
                    className="meso-overview-card"
                    onClick={() => {
                      setSelectedMesoId(m.id);
                      setSelectionLevel('mesocycle');
                    }}
                    style={{
                      "--phase-accent": pColor,
                      "--phase-accent-glow": `${pColor}35`,
                      borderLeftColor: pColor,
                    } as React.CSSProperties}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>{m.name}</span>
                        <span style={{
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "2px 7px",
                          borderRadius: "4px",
                          background: status === "active" ? "rgba(16, 185, 129, 0.18)" : status === "upcoming" ? "rgba(234, 179, 8, 0.15)" : "rgba(148, 163, 184, 0.15)",
                          color: status === "active" ? "#34d399" : status === "upcoming" ? "#facc15" : "#94a3b8",
                          border: status === "active" ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid transparent",
                        }}>
                          {status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: pColor, fontWeight: 800 }}>●</span>
                        <span style={{ color: pColor, fontWeight: 600 }}>{pLabel}</span>
                        <span>·</span>
                        <span>{fmtDateShort(m.start)} — {fmtDateShort(m.end)}</span>
                        <span>·</span>
                        <span>{m.microcycles.length} Microcycle{m.microcycles.length === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: "12.5px", color: "#38bdf8", fontWeight: 600 }}>Select Mesocycle →</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. When selectionLevel === 'mesocycle': show Active/Selected Mesocycle Hero Card & Schedule */}
      {selectionLevel === 'mesocycle' && activeMeso && (
        <>
          <div style={{ marginBottom: "12px" }}>
            <button
              type="button"
              onClick={() => {
                setSelectionLevel('macrocycle');
                setSelectedMesoId(null);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#38bdf8",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                padding: "2px 0",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              ← Back to {currentMacro?.name || "Macrocycle"} Mesocycles
            </button>
          </div>
          <div
            className="active-phase-card"
            style={{ "--phase-color": phaseInfo.color } as React.CSSProperties}
          >
          <div className="phase-card-top-row">
            <div>
              <div className="phase-badge-pill">
                <Sparkles className="w-3 h-3" />
                {phaseInfo.label}
              </div>

              <h2 className="phase-title-text">{activeMeso.name}</h2>

              <div className="phase-meta-line">
                <span>{fmtDateShort(activeMeso.start)} — {fmtDateShort(activeMeso.end)}</span>
                <span>•</span>
                <span>{parentMacro ? parentMacro.name : `Macrocycle ${activeMeso.macroId}`}</span>
                <span>•</span>
                {mesoStatus === "active" ? (
                  <span className="phase-status-live">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    ACTIVE PHASE
                  </span>
                ) : mesoStatus === "completed" ? (
                  <span style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    padding: "2px 7px",
                    borderRadius: "6px",
                    background: "rgba(148, 163, 184, 0.15)",
                    border: "1px solid rgba(148, 163, 184, 0.4)",
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}>
                    COMPLETED PHASE
                  </span>
                ) : (
                  <span style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    padding: "2px 7px",
                    borderRadius: "6px",
                    background: "rgba(234, 179, 8, 0.15)",
                    border: "1px solid rgba(234, 179, 8, 0.4)",
                    color: "#facc15",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}>
                    UPCOMING PHASE
                  </span>
                )}
              </div>
            </div>

            {/* Actions for this specific mesocycle */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="settings-action-btn settings-action-btn-primary"
                onClick={() => setIsInlineAddMcOpen(true)}
                title={`Add a new training microcycle week to ${activeMeso.name}`}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  borderRadius: "8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Plus size={14} />
                <span>Add Microcycle</span>
              </button>

              <button
                type="button"
                className="action-icon-btn"
                onClick={handleOpenEditMeso}
                title="Edit Phase Metadata (Name, Phase Type, Dates)"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                className="action-icon-btn action-icon-btn-danger"
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete "${activeMeso.name}"?`)) {
                    onDeleteMeso(activeMeso.id);
                  }
                }}
                title="Delete Mesocycle"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Active Phase Metrics */}
          <div className="phase-stats-grid">
            <div className="phase-stat-box">
              <div className="phase-stat-val">{activeMeso.microcycles.length}</div>
              <div className="phase-stat-lbl">Microcycles (Weeks)</div>
            </div>
            <div className="phase-stat-box">
              <div className="phase-stat-val">{totalPhaseWorkouts}</div>
              <div className="phase-stat-lbl">Workouts Scheduled</div>
            </div>
            <div className="phase-stat-box">
              <div className="phase-stat-val">{daysRemaining}</div>
              <div className="phase-stat-lbl">Days Remaining</div>
            </div>
            <div className="phase-stat-box">
              <div className="phase-stat-val">
                {totalPhaseVolume > 0 ? `${(totalPhaseVolume / 1000).toFixed(1)}k` : "0"} kg
              </div>
              <div className="phase-stat-lbl">Phase Volume</div>
            </div>
          </div>
        </div>

        {/* 3. Calendar Phase Schedule */}
        <div>
          <div className="calendar-section-title">
            <Calendar className="w-5 h-5 text-sky-400" />
            Active Calendar Phase Schedule
          </div>

          {activeMeso.microcycles.length === 0 ? (
            <div style={{ background: "#161b26", border: "1px dashed #263042", borderRadius: "12px", padding: "24px", textAlign: "center", color: "#64748b" }}>
              No microcycles scheduled in this phase yet. Click "+ Add Microcycle" below to add your first week!
            </div>
          ) : (
            activeMeso.microcycles.map((mic) => {
              const isEditing = editingLabelMicId === mic.id;

              return (
                <div key={mic.id} className="microcycle-card-block">
                  <div className="mc-header-row">
                    <div className="mc-title-left">
                      <span className="mc-index-badge">Microcycle {mic.index}</span>

                      {isEditing ? (
                        <input
                          type="text"
                          value={tempLabel}
                          onChange={(e) => setTempLabel(e.target.value)}
                          onBlur={() => {
                            setEditingLabelMicId(null);
                            if (tempLabel.trim() !== (mic.label || "")) {
                              onRenameMicrocycle(activeMeso.id, mic.id, tempLabel.trim());
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              setEditingLabelMicId(null);
                              onRenameMicrocycle(activeMeso.id, mic.id, tempLabel.trim());
                            } else if (e.key === "Escape") {
                              setEditingLabelMicId(null);
                            }
                          }}
                          autoFocus
                          style={{
                            background: "#0d111a",
                            border: "1px solid #3b82f6",
                            color: "#fff",
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "6px",
                          }}
                        />
                      ) : (
                        mic.label && <span className="mc-custom-tag">{mic.label}</span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <button
                        type="button"
                        className="action-icon-btn"
                        onClick={() => {
                          setEditingLabelMicId(mic.id);
                          setTempLabel(mic.label || "");
                        }}
                        title="Rename week tag (e.g. Deload, Accumulation)"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        type="button"
                        className="action-icon-btn action-icon-btn-danger"
                        onClick={() => {
                          if (window.confirm(`Delete Microcycle ${mic.index}?`)) {
                            onDeleteMicrocycle(activeMeso.id, mic.id);
                          }
                        }}
                        title="Delete Microcycle"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Days in Microcycle */}
                  <div className="days-grid-list">
                    {mic.days.map((day) => {
                      const isToday = day.date === today;
                      const isFuture = day.date > today;
                      const hasLifts = Boolean(day.lifts && day.lifts.length > 0);
                      const titleLower = (day.title || "").toLowerCase();
                      const isRecovery = !isFuture && (day.type === "recovery" || (!hasLifts && (titleLower.includes("recovery") || titleLower === "rest")));
                      const isWorkout = !isFuture && (day.type === "workout" || hasLifts);
                      const isOtherTag = !isFuture && !isWorkout && !isRecovery && (["event", "illness", "note"].includes(day.type) || Boolean(day.title?.trim()));

                      const cardStatusClass = isFuture
                        ? "day-card-future"
                        : isWorkout
                        ? "day-card-workout"
                        : isRecovery
                        ? "day-card-recovery"
                        : isOtherTag
                        ? "day-card-other-tag"
                        : "day-card-future";

                      const dateClass = isFuture
                        ? "date-future"
                        : isWorkout
                        ? "date-workout"
                        : isRecovery
                        ? "date-recovery"
                        : isOtherTag
                        ? "date-other-tag"
                        : "date-future";

                      return (
                        <div
                          key={day.id}
                          className={`interactive-day-card ${isToday ? "day-card-today-glow" : ""} ${cardStatusClass}`}
                          onClick={() => onDayClick(activeMeso.id, mic.id, day)}
                          title="Click to view/edit session"
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0 }}>
                                <span className={`day-card-date-sub ${dateClass}`}>
                                  {fmtDate(day.date)}
                                </span>
                                {isRecovery && (
                                  <BatteryCharging size={11} className="text-sky-400" style={{ flexShrink: 0, color: "#38bdf8" }} />
                                )}
                                {isOtherTag && (
                                  <AlertCircle size={11} className="text-rose-400" style={{ flexShrink: 0, color: "#ef4444" }} />
                                )}
                              </div>
                              {isToday && (
                                <span style={{ fontSize: "8.5px", background: "#f43f5e", color: "#fff", padding: "1px 4px", borderRadius: "3px", fontWeight: 800, flexShrink: 0 }}>
                                  TODAY
                                </span>
                              )}
                            </div>

                            {day.title ? (
                              <div className={`day-card-workout-title ${isFuture ? "title-future" : isWorkout ? "title-workout" : isOtherTag ? "title-other-tag" : isRecovery ? "title-recovery" : ""}`}>
                                {day.title}
                              </div>
                            ) : isWorkout ? (
                              <div className="day-card-workout-title title-workout">Workout</div>
                            ) : isRecovery ? (
                              <div className="day-card-workout-title title-recovery" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <span>Recovery</span>
                              </div>
                            ) : isOtherTag ? (
                              <div className="day-card-workout-title title-other-tag">
                                {day.type ? day.type.charAt(0).toUpperCase() + day.type.slice(1) : "Note"}
                              </div>
                            ) : (
                              <div className={`day-card-empty-label ${isFuture ? "label-future" : ""}`}>Rest / Empty</div>
                            )}
                          </div>

                          {day.bodyTags && day.bodyTags.length > 0 && (
                            <div style={{ fontSize: "9px", color: isFuture ? "#64748b" : isWorkout ? "#86efac" : isOtherTag ? "#fca5a5" : "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {day.bodyTags.slice(0, 2).join(" · ")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* Inline Add Microcycle Form at Bottom */}
          <div className="inline-add-mc-box">
            {isInlineAddMcOpen ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>Days:</span>
                <input
                  type="number"
                  min={1}
                  max={21}
                  value={newMcDays}
                  onChange={(e) => setNewMcDays(Math.max(1, parseInt(e.target.value, 10) || 7))}
                  style={{
                    width: "55px",
                    background: "#1e2638",
                    border: "1px solid #334155",
                    color: "#fff",
                    padding: "6px 8px",
                    borderRadius: "8px",
                    textAlign: "center",
                    fontWeight: 700,
                  }}
                />
                <input
                  type="text"
                  placeholder="Week Label (e.g. Deload, Peak)"
                  value={newMcLabel}
                  onChange={(e) => setNewMcLabel(e.target.value)}
                  style={{
                    background: "#1e2638",
                    border: "1px solid #334155",
                    color: "#fff",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    width: "180px",
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddInlineMicrocycle}
                  className="settings-action-btn settings-action-btn-primary"
                  style={{ padding: "6px 14px", fontSize: "12px" }}
                >
                  Confirm Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsInlineAddMcOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="inline-add-btn-trigger"
                onClick={() => setIsInlineAddMcOpen(true)}
              >
                <Plus size={16} className="text-rose-400" />
                <span>+ Add Microcycle to {activeMeso.name}</span>
              </button>
            )}
          </div>
        </div>
        </>
      )}

      {/* Edit Active Mesocycle Modal */}
      {isEditingActiveMeso && activeMeso && (
        <div className="modal-backdrop" onClick={() => setIsEditingActiveMeso(false)}>
          <div className="modal modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-date">Edit Active Phase — {activeMeso.name}</div>
              <button className="icon-btn" onClick={() => setIsEditingActiveMeso(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field-row">
                <label className="field-label">Mesocycle Name</label>
                <input
                  className="text-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Bench press + Squat specific"
                />
              </div>

              <div className="field-row">
                <label className="field-label">Phase Category</label>
                <div className="type-pills">
                  {Object.entries(PHASES).map(([k, v]) => (
                    <button
                      key={k}
                      type="button"
                      className={`pill ${editPhaseKey === k ? "pill-active" : ""}`}
                      onClick={() => setEditPhaseKey(k)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-row">
                <label className="field-label">Start Date</label>
                <input
                  className="text-input"
                  type="date"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                />
              </div>

              {macrocycles.length > 1 && (
                <div className="field-row">
                  <label className="field-label">Parent Macrocycle</label>
                  <div className="type-pills">
                    {macrocycles.map((mc) => (
                      <button
                        key={mc.id}
                        type="button"
                        className={`pill ${editMacroId === mc.id ? "pill-active" : ""}`}
                        onClick={() => setEditMacroId(mc.id)}
                      >
                        {mc.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setIsEditingActiveMeso(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveEditMeso}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
