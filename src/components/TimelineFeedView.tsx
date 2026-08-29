import React, { useState, useRef } from 'react';
import { Trophy, Dumbbell, Calendar, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { ExerciseIllustration } from './ExerciseIllustration';

const PHASES: Record<string, { color: string; label: string }> = {
  Hypertrophy: { color: "#B08D57", label: "Hypertrophy Phase" },
  Strength: { color: "#5C7A8A", label: "Strength Phase" },
  Peaking: { color: "#C1432E", label: "Peaking Phase" },
  Accumulation: { color: "#7A8B6F", label: "Accumulation Phase" },
  Base: { color: "#6B6F76", label: "Base Building" },
};

function formatDateCustom(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr + "T00:00:00Z");
  if (isNaN(d.getTime())) return dateStr;
  const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

function todayStr() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().slice(0, 10);
}

interface SetEntry {
  id: string;
  type: string;
  weight: string | number;
  reps: string | number;
  isPR: boolean;
}

interface LiftEntry {
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

interface TimelineFeedViewProps {
  mesocycles: Mesocycle[];
  selectedMesoId: string | null;
  onSelectMeso: (id: string) => void;
  onDayClick: (mesoId: string, micId: string, day: DayEntry) => void;
}

export const TimelineFeedView: React.FC<TimelineFeedViewProps> = ({
  mesocycles,
  selectedMesoId,
  onSelectMeso,
  onDayClick,
}) => {
  const [selectedMesoDropdown, setSelectedMesoDropdown] = useState(false);
  const [expandedMcs, setExpandedMcs] = useState<Record<string, boolean>>({});
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  const clickTimeoutRef = useRef<Record<string, any>>({});

  const toggleMcExpand = (mcId: string) => {
    setExpandedMcs((prev) => ({ ...prev, [mcId]: !prev[mcId] }));
  };

  const handleSessionClick = (mesoId: string, mcId: string, day: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const dayId = day.id;

    if (clickTimeoutRef.current[dayId]) {
      clearTimeout(clickTimeoutRef.current[dayId]);
      clickTimeoutRef.current[dayId] = null;
      onDayClick(mesoId, mcId, day);
    } else {
      clickTimeoutRef.current[dayId] = setTimeout(() => {
        clickTimeoutRef.current[dayId] = null;
        setExpandedSessions((prev) => ({ ...prev, [dayId]: prev[dayId] === false ? true : false }));
      }, 250);
    }
  };

  // Find active or selected mesocycle
  const activeMeso = mesocycles.find((m) => m.id === selectedMesoId) ||
    mesocycles.find((m) => m.status === 'active') ||
    mesocycles[mesocycles.length - 1] ||
    null;

  if (!activeMeso) {
    return (
      <div className="feed-view-container">
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          No mesocycles found. Create one in Library.
        </div>
      </div>
    );
  }

  const phaseInfo = PHASES[activeMeso.phaseKey] || { color: '#C1432E', label: activeMeso.phaseKey };

  // Calculate live statistics for the current mesocycle
  let totalWorkoutsLogged = 0;
  let totalVolumeKg = 0;
  let totalPRsCount = 0;

  activeMeso.microcycles.forEach((mc) => {
    mc.days.forEach((day) => {
      if (day.type !== 'empty' && day.lifts && day.lifts.length > 0) {
        totalWorkoutsLogged++;
        day.lifts.forEach((lift) => {
          (lift.sets || []).forEach((set) => {
            const w = parseFloat(String(set.weight)) || 0;
            const r = parseFloat(String(set.reps)) || 0;
            totalVolumeKg += w * r;
            if (set.isPR) totalPRsCount++;
          });
        });
      }
    });
  });

  // Find the CURRENT active microcycle only
  const today = todayStr();
  let currentActiveMc = activeMeso.microcycles.find((mc) =>
    mc.days.some((d) => d.date === today)
  );

  if (!currentActiveMc) {
    const withLogs = activeMeso.microcycles.filter((mc) => mc.days.some((d) => d.type !== 'empty'));
    currentActiveMc = withLogs[withLogs.length - 1] || activeMeso.microcycles[0] || null;
  }

  // Sort logged sessions inside the active microcycle REVERSE-CHRONOLOGICALLY (latest sessions on top!)
  const loggedDays = (currentActiveMc?.days || [])
    .filter((d) => d.type !== 'empty')
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // Identify previous microcycles in the current mesocycle
  const previousMicrocycles = currentActiveMc
    ? activeMeso.microcycles.filter((mc) => mc.index < currentActiveMc.index).sort((a, b) => b.index - a.index)
    : [];

  return (
    <div className="feed-view-container">
      <style>{`
        .feed-view-container {
          max-width: 720px;
          margin: 0 auto;
          padding: 12px 10px 80px;
          font-family: 'Inter', sans-serif;
          color: #edeae2;
        }

        .feed-header-banner {
          background: linear-gradient(135deg, #181d28 0%, #111520 100%);
          border: 1px solid #2a3142;
          border-left: 5px solid ${phaseInfo.color};
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 14px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
          position: relative;
        }

        .meso-dropdown-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid #2c3548;
          color: #ffffff;
          padding: 5px 10px;
          border-radius: 8px;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 8px;
          transition: all 0.2s ease;
        }

        .meso-dropdown-btn:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        .current-phase-title {
          font-family: 'Oswald', sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          line-height: 1.2;
        }

        .phase-meta-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 8px;
          flex-wrap: wrap;
        }

        .phase-tag {
          background: ${phaseInfo.color}25;
          border: 1px solid ${phaseInfo.color}60;
          color: ${phaseInfo.color};
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 10.5px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .phase-date-range {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .summary-stats-bar {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 16px;
        }

        .stat-card-box {
          background: #181d28;
          border: 1px solid #293042;
          border-radius: 12px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-val {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 17px;
          font-weight: 700;
          color: #ffffff;
        }

        .stat-lbl {
          font-size: 9.5px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        .microcycles-feed-heading {
          font-family: 'Oswald', sans-serif;
          font-size: 15px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #ffffff;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .microcycle-feed-block {
          background: #151a24;
          border: 1px solid #282f40;
          border-radius: 14px;
          padding: 14px;
          margin-bottom: 14px;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
        }

        .mc-block-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 10px;
          border-bottom: 1px solid #242c3d;
          margin-bottom: 12px;
        }

        .mc-badge-title {
          font-family: 'Oswald', sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #ffffff;
          text-transform: uppercase;
        }

        .mc-tag-label {
          background: #202738;
          border: 1px solid #2e374c;
          color: #b08d57;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 16px;
          text-transform: uppercase;
        }

        .day-cards-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .logged-day-card {
          background: #1c2230;
          border: 1px solid #2d364a;
          border-radius: 12px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .logged-day-card:hover {
          border-color: ${phaseInfo.color};
          transform: translateY(-1px);
        }

        .day-card-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .day-card-date {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          color: #60a5fa;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        .session-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          cursor: pointer;
          user-select: none;
        }

        .session-card-header:hover {
          opacity: 0.95;
        }

        .session-log-btn {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid #2e384e;
          color: #e2e8f0;
          font-size: 10.5px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .session-log-btn:hover {
          background: #3b82f6;
          border-color: #3b82f6;
          color: #ffffff;
        }

        .day-card-title {
          font-size: 14px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 0;
        }

        .lifts-thumb-flex {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 8px;
        }

        @media (max-width: 520px) {
          .lifts-thumb-flex {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
        }

        .lift-mini-chip {
          background: linear-gradient(135deg, #161c28 0%, #111520 100%);
          border: 1px solid #252e42;
          border-radius: 10px;
          padding: 7px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          transition: all 0.2s ease;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
          min-width: 0;
        }

        .lift-mini-chip:hover {
          border-color: #3b82f6;
          transform: translateY(-1px);
        }

        .lift-icon-box {
          width: 100%;
          height: 75px;
          border-radius: 7px;
          background: #05070a;
          border: 1px solid #1c2434;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
        }

        .lift-chip-name {
          font-size: 11px;
          font-weight: 600;
          color: #f8fafc;
          text-transform: capitalize;
          letter-spacing: 0.1px;
          line-height: 1.25;
          text-align: center;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          height: 27px;
        }

        .lift-chip-badge {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          font-weight: 700;
          color: #60a5fa;
          background: rgba(59, 130, 246, 0.14);
          border: 1px solid rgba(59, 130, 246, 0.28);
          padding: 2px 6px;
          border-radius: 5px;
          white-space: nowrap;
          text-align: center;
          align-self: center;
        }

        .pr-trophy-badge {
          background: rgba(193, 67, 46, 0.2);
          border: 1px solid #c1432e;
          color: #f87171;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .empty-mc-text {
          font-size: 12px;
          color: #64748b;
          font-style: italic;
          padding: 6px 0;
        }

        .retractable-mc-header {
          cursor: pointer;
          user-select: none;
          transition: background 0.15s ease;
          border-bottom: none !important;
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
        }

        .retractable-mc-header:hover {
          opacity: 0.9;
        }

        .previous-mc-block {
          background: #151a24;
          border: 1px solid #282f40;
          border-radius: 18px;
          padding: 16px 18px;
          margin-bottom: 12px;
          transition: border-color 0.2s ease;
        }

        .previous-mc-block:hover {
          border-color: #3b465e;
        }

        .mc-session-count-badge {
          background: #1e2638;
          border: 1px solid #2e3952;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 12px;
        }

        @media (max-width: 600px) {
          .feed-view-container {
            padding: 12px 10px 90px;
          }
          .current-phase-title {
            font-size: 20px;
          }
          .summary-stats-bar {
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }
          .stat-val {
            font-size: 17px;
          }
          .stat-lbl {
            font-size: 9.5px;
          }
          .lift-mini-chip {
            flex: 1 1 100%;
            min-width: 100%;
          }
        }
      `}</style>

      {/* Top Banner: Current Mesocycle & Phase Information */}
      <div className="feed-header-banner">
        
        {/* Mesocycle Dropdown Selector */}
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <button
            onClick={() => setSelectedMesoDropdown(!selectedMesoDropdown)}
            className="meso-dropdown-btn"
          >
            <span>Mesocycle {activeMeso.index} ({activeMeso.name})</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {selectedMesoDropdown && (
            <div className="meso-selector-list">
              {mesocycles.map((m) => (
                <div
                  key={m.id}
                  className="meso-selector-item"
                  onClick={() => {
                    onSelectMeso(m.id);
                    setSelectedMesoDropdown(false);
                  }}
                >
                  <span>Mesocycle {m.index} ({m.name})</span>
                  {m.status === 'active' && (
                    <span style={{ fontSize: '9px', background: '#c1432e', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>
                      ACTIVE
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <h1 className="current-phase-title">
          Mesocycle {activeMeso.index} ({activeMeso.name})
        </h1>

        <div className="phase-meta-row">
          <span className="phase-tag">{phaseInfo.label}</span>
          <div className="phase-date-range">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDateCustom(activeMeso.start)} – {formatDateCustom(activeMeso.end)}</span>
          </div>
          <span className="phase-date-range">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Microcycles {activeMeso.micRange}</span>
          </span>
        </div>
      </div>

      {/* Live Phase Summary Bar */}
      <div className="summary-stats-bar">
        <div className="stat-card-box">
          <div className="stat-val">{totalWorkoutsLogged}</div>
          <div className="stat-lbl">Workouts Done</div>
        </div>

        <div className="stat-card-box">
          <div className="stat-val">{Math.round(totalVolumeKg).toLocaleString()} kg</div>
          <div className="stat-lbl">Phase Volume</div>
        </div>

        <div className="stat-card-box">
          <div className="stat-val" style={{ color: '#fbbf24' }}>
            <Trophy className="w-4 h-4 text-amber-400 inline mr-1" />
            {totalPRsCount}
          </div>
          <div className="stat-lbl">PR Records</div>
        </div>
      </div>

      {/* Single Active Microcycle Section */}
      <h2 className="microcycles-feed-heading">
        <Dumbbell className="w-5 h-5 text-rose-500" />
        Current Active Microcycle
      </h2>

      {currentActiveMc ? (
        <div className="microcycle-feed-block">
          
          <div className="mc-block-header">
            <div className="mc-badge-title">
              Microcycle {currentActiveMc.index}
            </div>
            {currentActiveMc.label && (
              <div className="mc-tag-label">{currentActiveMc.label}</div>
            )}
          </div>

          {loggedDays.length > 0 ? (
            <div className="day-cards-list">
              {loggedDays.map((day) => {
                let hasPR = false;
                (day.lifts || []).forEach((l) => {
                  (l.sets || []).forEach((s) => {
                    if (s.isPR) hasPR = true;
                  });
                });

                const isSessionExpanded = expandedSessions[day.id] !== false;

                return (
                  <div key={day.id} className="logged-day-card">
                    <div
                      className="session-card-header"
                      onClick={(e) => handleSessionClick(activeMeso.id, currentActiveMc!.id, day, e)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {isSessionExpanded ? (
                            <ChevronDown className="w-4 h-4 text-blue-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <span className="day-card-date">
                            {formatDateCustom(day.date)}
                          </span>
                          <div className="day-card-title">
                            {day.title || 'Workout Session'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {hasPR && (
                          <span className="pr-trophy-badge">
                            <Trophy className="w-3 h-3 text-amber-400" />
                            PR RECORD
                          </span>
                        )}
                        <span className="mc-session-count-badge" style={{ fontSize: '10px' }}>
                          {day.lifts?.length || 0} {day.lifts?.length === 1 ? 'exercise' : 'exercises'}
                        </span>
                      </div>
                    </div>

                    {isSessionExpanded && day.lifts && day.lifts.length > 0 && (
                      <div className="lifts-thumb-flex">
                        {day.lifts.map((lift) => {
                          const sets = Array.isArray(lift.sets) ? lift.sets : [];
                          const topSet = sets.reduce((max, s) => {
                            const w = parseFloat(String(s.weight)) || 0;
                            return w > max ? w : max;
                          }, 0);

                          return (
                            <div
                              key={lift.id}
                              className="lift-mini-chip"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDayClick(activeMeso.id, currentActiveMc!.id, day);
                              }}
                            >
                              <div className="lift-icon-box">
                                <ExerciseIllustration name={lift.name} gifUrl={lift.gifUrl} className="w-full h-full" />
                              </div>
                              <span className="lift-chip-name" title={lift.name}>{lift.name}</span>
                              <span className="lift-chip-badge">
                                {sets.length} {sets.length === 1 ? 'set' : 'sets'} {topSet > 0 ? `· ${topSet}kg` : ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-mc-text">No workouts logged yet for Microcycle {currentActiveMc.index}. Click Workout to log.</div>
          )}

        </div>
      ) : (
        <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: '12px' }}>
          No active microcycle found.
        </div>
      )}

      {/* Previous Microcycles Section */}
      {previousMicrocycles.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h2 className="microcycles-feed-heading">
            <Clock className="w-5 h-5 text-indigo-400" />
            Previous Microcycles
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {previousMicrocycles.map((mc) => {
              const isExpanded = !!expandedMcs[mc.id];
              const mcLoggedDays = (mc.days || [])
                .filter((d) => d.type !== 'empty' || (d.lifts && d.lifts.length > 0))
                .slice()
                .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

              return (
                <div key={mc.id} className="microcycle-feed-block previous-mc-block">
                  <div
                    className="mc-block-header retractable-mc-header"
                    onClick={() => toggleMcExpand(mc.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="expand-chevron-icon" style={{ display: 'flex', alignItems: 'center' }}>
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-indigo-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="mc-badge-title">
                        Microcycle {mc.index}
                      </div>
                      {mc.label && (
                        <div className="mc-tag-label">{mc.label}</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="mc-session-count-badge">
                        {mcLoggedDays.length} {mcLoggedDays.length === 1 ? 'session' : 'sessions'}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="retractable-mc-content" style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #242c3d' }}>
                      {mcLoggedDays.length > 0 ? (
                        <div className="day-cards-list">
                          {mcLoggedDays.map((day) => {
                            let hasPR = false;
                            (day.lifts || []).forEach((l) => {
                              (l.sets || []).forEach((s) => {
                                if (s.isPR) hasPR = true;
                              });
                            });

                            const isSessionExpanded = expandedSessions[day.id] !== false;

                            return (
                              <div key={day.id} className="logged-day-card">
                                <div
                                  className="session-card-header"
                                  onClick={(e) => handleSessionClick(activeMeso.id, mc.id, day, e)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                      {isSessionExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-blue-400" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-slate-400" />
                                      )}
                                    </div>
                                    <div>
                                      <span className="day-card-date">
                                        {formatDateCustom(day.date)}
                                      </span>
                                      <div className="day-card-title">
                                        {day.title || 'Workout Session'}
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {hasPR && (
                                      <span className="pr-trophy-badge">
                                        <Trophy className="w-3 h-3 text-amber-400" />
                                        PR RECORD
                                      </span>
                                    )}
                                    <span className="mc-session-count-badge" style={{ fontSize: '10px' }}>
                                      {day.lifts?.length || 0} {day.lifts?.length === 1 ? 'exercise' : 'exercises'}
                                    </span>
                                  </div>
                                </div>

                                {isSessionExpanded && day.lifts && day.lifts.length > 0 && (
                                  <div className="lifts-thumb-flex">
                                    {day.lifts.map((lift) => {
                                      const sets = Array.isArray(lift.sets) ? lift.sets : [];
                                      const topSet = sets.reduce((max, s) => {
                                        const w = parseFloat(String(s.weight)) || 0;
                                        return w > max ? w : max;
                                      }, 0);

                                      return (
                                        <div
                                          key={lift.id}
                                          className="lift-mini-chip"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onDayClick(activeMeso.id, mc.id, day);
                                          }}
                                        >
                                          <div className="lift-icon-box">
                                            <ExerciseIllustration name={lift.name} gifUrl={lift.gifUrl} className="w-full h-full" />
                                          </div>
                                          <span className="lift-chip-name" title={lift.name}>{lift.name}</span>
                                          <span className="lift-chip-badge">
                                            {sets.length} {sets.length === 1 ? 'set' : 'sets'} {topSet > 0 ? `· ${topSet}kg` : ''}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="empty-mc-text">
                          No workouts logged yet for Microcycle {mc.index}.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
