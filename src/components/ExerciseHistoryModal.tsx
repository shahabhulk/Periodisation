import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  MoreVertical,
  Dumbbell,
  TrendingUp,
  Trophy,
  ChevronRight,
} from 'lucide-react';
import { findExerciseDetails } from '../services/lyftaApi';
import type { Mesocycle, DayEntry, LiftEntry, SetEntry, Macrocycle } from './PeriodisationAnalysisView';
import { formatDateDMY } from '../utils/workoutUtils';

const PHASES: Record<string, { color: string; label: string }> = {
  Hypertrophy: { color: "#f59e0b", label: "Hypertrophy" },
  Strength: { color: "#3b82f6", label: "Strength" },
  Peaking: { color: "#f43f5e", label: "Peaking" },
  Accumulation: { color: "#10b981", label: "Accumulation" },
  Base: { color: "#a855f7", label: "Base Building" },
  Deload: { color: "#06b6d4", label: "Deload" },
};

export interface ExerciseHistoryModalProps {
  exerciseName: string;
  gifUrl?: string;
  mesocycles: Mesocycle[];
  macrocycles?: Macrocycle[];
  onClose: () => void;
  onOpenSession?: (mesoId: string, micId: string, day: DayEntry) => void;
}

export const ExerciseHistoryModal: React.FC<ExerciseHistoryModalProps> = ({
  exerciseName,
  gifUrl,
  mesocycles,
  macrocycles = [],
  onClose,
  onOpenSession,
}) => {
  const [activeTab, setActiveTab] = useState<'about' | 'history' | 'progress' | 'records' | 'leaderboard'>('history');
  const [progressMetric, setProgressMetric] = useState<'1rm' | 'weight'>('1rm');

  // Exercise details from Lyfta library
  const exerciseInfo = useMemo(() => {
    return findExerciseDetails(exerciseName);
  }, [exerciseName]);

  const displayGif = gifUrl || exerciseInfo?.gifUrl;

  // Collect all workout sessions where this exercise was performed
  const historySessions = useMemo(() => {
    const sessions: Array<{
      mesoId: string;
      mesoName: string;
      mesoIndex?: number;
      phaseKey: string;
      macroId?: string;
      macroName?: string;
      micId: string;
      micIndex?: number;
      day: DayEntry;
      date: string;
      title: string;
      lift: LiftEntry;
      sets: SetEntry[];
      bestWeight: number;
      best1RM: number;
      totalVol: number;
      topReps: number;
    }> = [];

    const targetLow = (exerciseName || '').trim().toLowerCase();
    const macroMap = new Map<string, Macrocycle>();
    (macrocycles || []).forEach((m) => macroMap.set(m.id, m));

    for (const meso of mesocycles || []) {
      const parentMacro = meso.macroId ? macroMap.get(meso.macroId) : undefined;
      const macroLabel = parentMacro ? (parentMacro.name || `Macrocycle ${parentMacro.index}`) : undefined;
      const mesoLabel = meso.name || `Mesocycle ${meso.index || 1}`;
      const phaseLabel = meso.phaseKey || 'Strength';

      for (const mic of meso.microcycles || []) {
        for (const day of mic.days || []) {
          for (const lift of day.lifts || []) {
            const lName = (lift.name || '').trim().toLowerCase();
            // Strict match for this specific lift
            if (lName === targetLow || (targetLow.length > 5 && lName.includes(targetLow))) {
              const sets = Array.isArray(lift.sets) ? lift.sets : [];
              let bestW = 0;
              let bestRM = 0;
              let vol = 0;
              let maxR = 0;

              sets.forEach((s) => {
                const w = parseFloat(String(s.weight)) || 0;
                const r = parseFloat(String(s.reps)) || 0;
                if (w > bestW) bestW = w;
                if (r > maxR) maxR = r;
                vol += w * r;

                if (w > 0 && r > 0) {
                  const rm = Math.round(w * (1 + r / 30));
                  if (rm > bestRM) bestRM = rm;
                }
              });

              sessions.push({
                mesoId: meso.id,
                mesoName: mesoLabel,
                mesoIndex: meso.index,
                phaseKey: phaseLabel,
                macroId: meso.macroId,
                macroName: macroLabel,
                micId: mic.id,
                micIndex: mic.index,
                day,
                date: day.date,
                title: day.title || 'Workout Session',
                lift,
                sets,
                bestWeight: bestW,
                best1RM: bestRM,
                totalVol: vol,
                topReps: maxR,
              });
            }
          }
        }
      }
    }

    // Sort reverse-chronologically (latest workout session on top)
    sessions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return sessions;
  }, [exerciseName, mesocycles, macrocycles]);

  // Overall PR records
  const records = useMemo(() => {
    let peakWeight = 0;
    let peakWeightReps = 0;
    let peak1RM = 0;
    let maxSessionVol = 0;
    let maxRepsInSet = 0;
    let maxRepsWeight = 0;

    historySessions.forEach((s) => {
      if (s.totalVol > maxSessionVol) maxSessionVol = s.totalVol;
      s.sets.forEach((set) => {
        const w = parseFloat(String(set.weight)) || 0;
        const r = parseFloat(String(set.reps)) || 0;
        if (w > peakWeight) {
          peakWeight = w;
          peakWeightReps = r;
        }
        if (r > maxRepsInSet) {
          maxRepsInSet = r;
          maxRepsWeight = w;
        }
        if (w > 0 && r > 0) {
          const rm = Math.round(w * (1 + r / 30));
          if (rm > peak1RM) peak1RM = rm;
        }
      });
    });

    return {
      peakWeight,
      peakWeightReps,
      peak1RM,
      maxSessionVol,
      maxRepsInSet,
      maxRepsWeight,
    };
  }, [historySessions]);

  // Helper for set badge colors
  const getBadgeStyle = (type: string) => {
    const t = (type || '1').toUpperCase();
    if (t === 'W') return { color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)' };
    if (t === 'T') return { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.3)' };
    if (t === 'F') return { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.3)' };
    if (t === 'D') return { color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.3)' };
    return { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.3)' };
  };

  const formatSessionDate = (dStr: string) => {
    if (!dStr) return '';
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      }
    } catch {}
    return formatDateDMY(dStr);
  };

  return (
    <div className="exercise-history-overlay">
      <style>{`
        .exercise-history-overlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          background: #000000;
          display: flex;
          flex-direction: column;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
        }

        /* Top App Bar */
        .ex-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: #0a0a0a;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          gap: 12px;
          flex-shrink: 0;
        }
        .ex-topbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }
        .ex-back-btn {
          background: transparent;
          border: none;
          color: #ffffff;
          cursor: pointer;
          padding: 6px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
        }
        .ex-back-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .ex-title {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Tabs Bar */
        .ex-tabs-bar {
          display: flex;
          align-items: center;
          background: #0a0a0a;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          overflow-x: auto;
          scrollbar-width: none;
          flex-shrink: 0;
        }
        .ex-tabs-bar::-webkit-scrollbar {
          display: none;
        }
        .ex-tab-btn {
          flex: 1;
          min-width: 80px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: #94a3b8;
          font-size: 13.5px;
          font-weight: 600;
          padding: 11px 12px;
          cursor: pointer;
          text-align: center;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .ex-tab-btn:hover {
          color: #ffffff;
        }
        .ex-tab-btn-active {
          color: #ffffff !important;
          border-bottom-color: #ffffff !important;
          font-weight: 700;
        }

        /* Scrollable Content Body */
        .ex-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: #000000;
        }

        /* History Session Card matching Image 2 */
        .session-card {
          background: #0a0b0d;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .session-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .session-icon-box {
          width: 38px;
          height: 38px;
          background: #1c1c1e;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9ca3af;
          flex-shrink: 0;
        }
        .session-meta-title {
          font-size: 14.5px;
          font-weight: 700;
          color: #ffffff;
        }
        .session-meta-date {
          font-size: 11.5px;
          color: #9ca3af;
          margin-top: 1px;
        }

        /* Column Headers */
        .session-cols-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 11.5px;
          color: #9ca3af;
          font-weight: 500;
        }

        /* Set Row */
        .session-set-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 13.5px;
        }
        .session-set-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .set-badge {
          width: 22px;
          height: 22px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
        }
        .set-text {
          color: #ffffff;
          font-weight: 600;
        }
        .set-gear-badge {
          font-size: 9px;
          font-weight: 800;
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.35);
          padding: 1px 5px;
          border-radius: 4px;
          letter-spacing: 0.5px;
        }
        .set-1rm-val {
          font-size: 14px;
          font-weight: 700;
          color: #cbd5e1;
        }

        /* About Tab Styles */
        .about-card {
          background: #0d1117;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .about-gif-wrap {
          width: 100%;
          max-height: 220px;
          border-radius: 12px;
          overflow: hidden;
          background: #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        /* Records Tab Grid */
        .records-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        .record-card {
          background: #0d1117;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
      `}</style>

      {/* Top Navigation Bar */}
      <div className="ex-topbar">
        <div className="ex-topbar-left">
          <button
            type="button"
            className="ex-back-btn"
            onClick={onClose}
            aria-label="Back"
          >
            <ArrowLeft size={22} />
          </button>
          <span className="ex-title">{exerciseName}</span>
        </div>

        <button
          type="button"
          className="ex-back-btn"
          aria-label="Options"
          style={{ opacity: 0.8 }}
        >
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Five Navigation Tabs */}
      <div className="ex-tabs-bar">
        <button
          type="button"
          className={`ex-tab-btn ${activeTab === 'about' ? 'ex-tab-btn-active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          About
        </button>

        <button
          type="button"
          className={`ex-tab-btn ${activeTab === 'history' ? 'ex-tab-btn-active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>

        <button
          type="button"
          className={`ex-tab-btn ${activeTab === 'progress' ? 'ex-tab-btn-active' : ''}`}
          onClick={() => setActiveTab('progress')}
        >
          Progress
        </button>

        <button
          type="button"
          className={`ex-tab-btn ${activeTab === 'records' ? 'ex-tab-btn-active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          Records
        </button>

        <button
          type="button"
          className={`ex-tab-btn ${activeTab === 'leaderboard' ? 'ex-tab-btn-active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          Leaderboard
        </button>
      </div>

      {/* Tab Contents */}
      <div className="ex-body">
        {/* ============================================================
            TAB 1: HISTORY (MATCHING IMAGE 2 REVERSE-CHRONOLOGICAL LIST)
            ============================================================ */}
        {activeTab === 'history' && (
          <>
            {historySessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <Dumbbell className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#94a3b8' }}>
                  No History Recorded Yet
                </div>
                <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px' }}>
                  Complete a workout session with {exerciseName} to track performance history.
                </div>
              </div>
            ) : (
              historySessions.map((session, sIdx) => (
                <div key={`${session.day.id}-${sIdx}`} className="session-card">
                  {/* Workout Header */}
                  <div className="session-card-header" style={{ alignItems: "flex-start" }}>
                    <div className="session-icon-box" style={{ marginTop: "2px" }}>
                      <Dumbbell size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="session-meta-title">{session.title}</div>
                      <div className="session-meta-date">{formatSessionDate(session.date)}</div>

                      {/* Mesocycle, Phase, and Macrocycle details */}
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap", marginTop: "6px" }}>
                        {session.macroName && (
                          <span
                            style={{
                              fontSize: "10.5px",
                              fontWeight: 700,
                              color: "#cbd5e1",
                              background: "rgba(255, 255, 255, 0.06)",
                              border: "1px solid rgba(255, 255, 255, 0.12)",
                              padding: "2px 7px",
                              borderRadius: "5px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <span style={{ color: "#94a3b8", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.4px" }}>Macro</span>
                            <span>{session.macroName.replace(/^macrocycle\s*/i, "Macro ")}</span>
                          </span>
                        )}

                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 700,
                            color: "#e2e8f0",
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            padding: "2px 7px",
                            borderRadius: "5px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          <span style={{ color: "#94a3b8", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.4px" }}>Meso</span>
                          <span>{session.mesoName}</span>
                        </span>

                        {session.phaseKey && (() => {
                          const phaseColor = PHASES[session.phaseKey]?.color || "#3b82f6";
                          return (
                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: 700,
                                color: phaseColor,
                                background: `${phaseColor}1a`,
                                border: `1px solid ${phaseColor}44`,
                                padding: "2px 7px",
                                borderRadius: "5px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: phaseColor }} />
                              <span>{session.phaseKey} Phase</span>
                            </span>
                          );
                        })()}

                        {session.micIndex !== undefined && (
                          <span
                            style={{
                              fontSize: "10.5px",
                              fontWeight: 600,
                              color: "#94a3b8",
                              background: "rgba(255, 255, 255, 0.04)",
                              border: "1px solid rgba(255, 255, 255, 0.08)",
                              padding: "2px 6px",
                              borderRadius: "5px",
                            }}
                          >
                            Micro {session.micIndex}
                          </span>
                        )}
                      </div>
                    </div>

                    {onOpenSession && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenSession(session.mesoId, session.micId, session.day);
                        }}
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: 'none',
                          color: '#38bdf8',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        Open <ChevronRight size={12} />
                      </button>
                    )}
                  </div>

                  {/* Sets Performed & 1RM Header */}
                  <div className="session-cols-header">
                    <span>Sets Performed</span>
                    <span>1RM</span>
                  </div>

                  {/* List of sets */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {session.sets.map((set, setIdx) => {
                      const badgeStyle = getBadgeStyle(set.type);
                      const w = parseFloat(String(set.weight)) || 0;
                      const r = parseFloat(String(set.reps)) || 0;
                      const est1RM = w > 0 && r > 0 ? Math.round(w * (1 + r / 30)) : 0;
                      const isGear = String(set.equipment || '').toLowerCase() === 'gear';

                      return (
                        <div key={set.id || setIdx} className="session-set-row">
                          <div className="session-set-left">
                            <span
                              className="set-badge"
                              style={{
                                color: badgeStyle.color,
                                background: badgeStyle.bg,
                                border: `1px solid ${badgeStyle.border}`,
                              }}
                            >
                              {set.type || setIdx + 1}
                            </span>

                            <span className="set-text">
                              {w}kg × {r} reps
                              {(set as any).rpe ? ` @ ${(set as any).rpe}rpe` : ''}
                            </span>

                            {isGear && <span className="set-gear-badge">GEAR</span>}
                          </div>

                          <span className="set-1rm-val">
                            {est1RM > 0 ? est1RM : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ============================================================
            TAB 2: ABOUT (ILLUSTRATION, TARGET MUSCLES, INSTRUCTIONS)
            ============================================================ */}
        {activeTab === 'about' && (
          <div className="about-card">
            {displayGif ? (
              <div className="about-gif-wrap">
                <img
                  src={displayGif}
                  alt={exerciseName}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
            ) : (
              <div className="about-gif-wrap" style={{ height: '140px', color: '#64748b' }}>
                <Dumbbell size={40} className="text-slate-700" />
              </div>
            )}

            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px', color: '#ffffff' }}>
                {exerciseName}
              </h3>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                {exerciseInfo?.equipments?.join(', ') || 'Barbell / Free Weights'} · {exerciseInfo?.bodyParts?.join(', ') || 'Chest'}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
              <div>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Target Muscle: </span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                  {exerciseInfo?.targetMuscles?.join(', ') || 'Pectoralis Major'}
                </span>
              </div>

              {exerciseInfo?.secondaryMuscles && exerciseInfo.secondaryMuscles.length > 0 && (
                <div>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Secondary: </span>
                  <span style={{ color: '#cbd5e1' }}>
                    {exerciseInfo.secondaryMuscles.join(', ')}
                  </span>
                </div>
              )}
            </div>

            {exerciseInfo?.instructions && exerciseInfo.instructions.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#f59e0b', margin: '0 0 8px', textTransform: 'uppercase' }}>
                  Execution Guide
                </h4>
                <ol style={{ margin: 0, paddingLeft: '18px', color: '#cbd5e1', fontSize: '12.5px', lineHeight: 1.6 }}>
                  {exerciseInfo.instructions.map((step, idx) => (
                    <li key={idx} style={{ marginBottom: '6px' }}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            TAB 3: PROGRESS (TRAJECTORY CHART & KPIS)
            ============================================================ */}
        {activeTab === 'progress' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Quick Metrics (Clickable to switch active graph) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <div
                onClick={() => setProgressMetric('1rm')}
                style={{
                  background: progressMetric === '1rm' ? 'rgba(56, 189, 248, 0.12)' : '#0d1117',
                  border: progressMetric === '1rm' ? '1.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  padding: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: progressMetric === '1rm' ? '#38bdf8' : '#94a3b8', fontWeight: 700 }}>Peak 1RM</span>
                  {progressMetric === '1rm' && (
                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.2)', padding: '1px 5px', borderRadius: '4px', letterSpacing: '0.4px' }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#38bdf8', marginTop: '3px' }}>
                  {records.peak1RM} <span style={{ fontSize: '11px' }}>kg</span>
                </div>
              </div>

              <div
                onClick={() => setProgressMetric('weight')}
                style={{
                  background: progressMetric === 'weight' ? 'rgba(245, 158, 11, 0.12)' : '#0d1117',
                  border: progressMetric === 'weight' ? '1.5px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  padding: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: progressMetric === 'weight' ? '#f59e0b' : '#94a3b8', fontWeight: 700 }}>Best Weight</span>
                  {progressMetric === 'weight' && (
                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.2)', padding: '1px 5px', borderRadius: '4px', letterSpacing: '0.4px' }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#f59e0b', marginTop: '3px' }}>
                  {records.peakWeight} <span style={{ fontSize: '11px' }}>kg</span>
                </div>
              </div>
            </div>

            {/* Progression Chart Card */}
            <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={15} style={{ color: progressMetric === '1rm' ? '#38bdf8' : '#f59e0b' }} />
                  <span>
                    {progressMetric === '1rm' ? 'Estimated 1RM' : 'Best Weight'} Progression ({historySessions.length} sessions)
                  </span>
                </div>

                {/* Graph metric toggle pills */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <button
                    type="button"
                    onClick={() => setProgressMetric('1rm')}
                    style={{
                      background: progressMetric === '1rm' ? '#38bdf8' : 'transparent',
                      color: progressMetric === '1rm' ? '#000000' : '#94a3b8',
                      border: 'none',
                      padding: '3px 9px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    1RM
                  </button>
                  <button
                    type="button"
                    onClick={() => setProgressMetric('weight')}
                    style={{
                      background: progressMetric === 'weight' ? '#f59e0b' : 'transparent',
                      color: progressMetric === 'weight' ? '#000000' : '#94a3b8',
                      border: 'none',
                      padding: '3px 9px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Best Weight
                  </button>
                </div>
              </div>

              {historySessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: '12px' }}>
                  No sessions logged for graph.
                </div>
              ) : (() => {
                const is1RM = progressMetric === '1rm';
                const activeColor = is1RM ? '#38bdf8' : '#f59e0b';
                const chronSessions = [...historySessions].reverse();
                const sessionVals = chronSessions.map((s) => is1RM ? s.best1RM : s.bestWeight);
                const maxVal = Math.max(...sessionVals, 50);

                return (
                  <div style={{ width: '100%', height: '180px', position: 'relative' }}>
                    <svg viewBox="0 0 500 160" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      <line x1="20" y1="20" x2="480" y2="20" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                      <line x1="20" y1="70" x2="480" y2="70" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                      <line x1="20" y1="120" x2="480" y2="120" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                      <line x1="20" y1="140" x2="480" y2="140" stroke="rgba(255,255,255,0.15)" />

                      {/* Polyline */}
                      {chronSessions.length > 1 && (
                        <polyline
                          fill="none"
                          stroke={activeColor}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={chronSessions
                            .map((s, idx) => {
                              const val = is1RM ? s.best1RM : s.bestWeight;
                              const step = 440 / Math.max(chronSessions.length - 1, 1);
                              const x = 30 + idx * step;
                              const y = 140 - (val / maxVal) * 110;
                              return `${x},${y}`;
                            })
                            .join(' ')}
                        />
                      )}

                      {/* Dots */}
                      {chronSessions.map((s, idx) => {
                        const val = is1RM ? s.best1RM : s.bestWeight;
                        const step = 440 / Math.max(chronSessions.length - 1, 1);
                        const x = 30 + idx * step;
                        const y = 140 - (val / maxVal) * 110;

                        return (
                          <g key={idx}>
                            <circle cx={x} cy={y} r="4" fill={activeColor} stroke="#ffffff" strokeWidth="1.5" />
                            <text x={x} y={y - 8} fill={activeColor} fontSize="9" fontWeight="800" textAnchor="middle">
                              {val}
                            </text>
                            <text x={x} y="154" fill="#64748b" fontSize="8" fontWeight="600" textAnchor="middle">
                              {formatDateDMY(s.date).slice(0, 5)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 4: RECORDS (ALL-TIME PRs)
            ============================================================ */}
        {activeTab === 'records' && (
          <div className="records-grid">
            <div className="record-card">
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>Estimated 1RM</span>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#38bdf8' }}>
                {records.peak1RM} <span style={{ fontSize: '11px' }}>kg</span>
              </div>
              <span style={{ fontSize: '10px', color: '#64748b' }}>Highest calculated 1RM</span>
            </div>

            <div className="record-card">
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>Max Weight</span>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#f59e0b' }}>
                {records.peakWeight} <span style={{ fontSize: '11px' }}>kg</span>
              </div>
              <span style={{ fontSize: '10px', color: '#64748b' }}>for {records.peakWeightReps} reps</span>
            </div>

            <div className="record-card">
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>Max Reps (Set)</span>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#10b981' }}>
                {records.maxRepsInSet} <span style={{ fontSize: '11px' }}>reps</span>
              </div>
              <span style={{ fontSize: '10px', color: '#64748b' }}>at {records.maxRepsWeight} kg</span>
            </div>

            <div className="record-card">
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>Workout Volume</span>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#ec4899' }}>
                {records.maxSessionVol.toLocaleString()} <span style={{ fontSize: '11px' }}>kg</span>
              </div>
              <span style={{ fontSize: '10px', color: '#64748b' }}>Single session volume</span>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 5: LEADERBOARD / STRENGTH CLASSIFICATION
            ============================================================ */}
        {activeTab === 'leaderboard' && (
          <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy size={18} className="text-amber-400" />
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>Strength Standard</span>
            </div>

            <div style={{ fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.5 }}>
              Your current estimated 1RM for <strong>{exerciseName}</strong> is <strong style={{ color: '#38bdf8' }}>{records.peak1RM} kg</strong>.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
              {[
                { level: 'Novice', weight: Math.round(records.peak1RM * 0.65), color: '#94a3b8' },
                { level: 'Intermediate', weight: Math.round(records.peak1RM * 0.85), color: '#38bdf8' },
                { level: 'Proficient', weight: Math.round(records.peak1RM * 1.0), color: '#10b981' },
                { level: 'Advanced', weight: Math.round(records.peak1RM * 1.15), color: '#f59e0b' },
                { level: 'Elite', weight: Math.round(records.peak1RM * 1.3), color: '#f43f5e' },
              ].map((tier) => (
                <div key={tier.level} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: tier.color }}>{tier.level}</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>{tier.weight} kg</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
