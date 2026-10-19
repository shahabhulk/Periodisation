import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  RotateCw,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import {
  designWorkoutSession,
  type DesignedWorkoutSession,
} from '../services/geminiService';

interface AISessionDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  previousWorkouts: any[];
  currentPhase?: string;
  onApplyWorkout: (session: {
    title: string;
    bodyTags: string[];
    lifts: any[];
    notes: string;
  }) => void;
}

export const AISessionDesignerModal: React.FC<AISessionDesignerModalProps> = ({
  isOpen,
  onClose,
  previousWorkouts,
  currentPhase = 'Hypertrophy',
  onApplyWorkout,
}) => {
  const [userNeed, setUserNeed] = useState('');
  const [duration, setDuration] = useState<number>(60);
  const [intensity, setIntensity] = useState<'heavy' | 'moderate' | 'light'>('moderate');
  const [isLoading, setIsLoading] = useState(false);
  const [designedSession, setDesignedSession] = useState<DesignedWorkoutSession | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Extract memory summary of recent workouts
  const memorySummary = useMemo(() => {
    if (!previousWorkouts || previousWorkouts.length === 0) {
      return 'No past workouts logged yet. Coach will program a foundational session.';
    }

    const recentLifts: Record<string, number> = {};
    previousWorkouts.slice(0, 4).forEach((w) => {
      (w.lifts || []).forEach((l: any) => {
        const name = l.name || '';
        (l.sets || []).forEach((s: any) => {
          const wt = parseFloat(String(s.weight)) || 0;
          if (wt > (recentLifts[name] || 0)) {
            recentLifts[name] = wt;
          }
        });
      });
    });

    const liftParts = Object.entries(recentLifts)
      .slice(0, 3)
      .map(([name, wt]) => `${name}: ~${wt}kg`);

    return `Analyzed your last ${Math.min(previousWorkouts.length, 4)} workouts${liftParts.length > 0 ? ` (${liftParts.join(', ')})` : ''} in ${currentPhase} phase.`;
  }, [previousWorkouts, currentPhase]);

  const quickChips = [
    { label: '🔥 Heavy Bench Strength', need: 'Heavy bench press strength session with chest & triceps assistance' },
    { label: '🦵 Squat Strength & Quads', need: 'Squat strength workout with quad hypertrophy and knee-friendly accessories' },
    { label: '🏋️ Deadlift & Upper Back', need: 'Deadlift power session with barbell rows and lat pull assistance' },
    { label: '⚡ Deload / Active Recovery', need: 'Easy deload recovery session to let joints heal and clear muscle fatigue' },
    { label: '💪 Chest & Arms (Fast 45m)', need: 'High-energy chest, shoulders, and triceps pump workout in 45 minutes' },
  ];

  const handleGenerate = async (customNeed?: string) => {
    const needToUse = (customNeed || userNeed).trim() || 'General strength and muscle building workout';
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await designWorkoutSession({
        previousWorkouts,
        currentPhase,
        userNeed: needToUse,
        targetDurationMinutes: duration,
        targetIntensity: intensity,
      });
      setDesignedSession(result);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not generate workout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!designedSession) return;

    // Convert designed lifts to app LiftEntry format
    const formattedLifts = designedSession.lifts.map((dl, idx) => ({
      id: `lift_ai_${Date.now()}_${idx}`,
      name: dl.name,
      unit: dl.unit || 'kg',
      sets: dl.sets.map((s, sIdx) => ({
        id: `set_ai_${Date.now()}_${idx}_${sIdx}`,
        type: s.type || `${sIdx + 1}`,
        weight: s.weight,
        reps: s.reps,
        isPR: false,
        equipment: 'raw' as const,
      })),
    }));

    const fullNotes = [
      designedSession.rationale ? `Coach Note: ${designedSession.rationale}` : '',
      designedSession.coachingTips && designedSession.coachingTips.length > 0
        ? `Tips:\n${designedSession.coachingTips.map((t) => `• ${t}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    onApplyWorkout({
      title: designedSession.title,
      bodyTags: designedSession.bodyTags || [],
      lifts: formattedLifts,
      notes: fullNotes,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="ai-designer-backdrop" onClick={onClose}>
      <style>{`
        .ai-designer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(10, 14, 23, 0.82);
          backdrop-filter: blur(8px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .ai-designer-modal {
          background: linear-gradient(135deg, #131722 0%, #1a2030 100%);
          border: 1px solid rgba(139, 92, 246, 0.35);
          border-radius: 18px;
          width: 100%;
          max-width: 580px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(139, 92, 246, 0.15);
          display: flex;
          flex-direction: column;
          font-family: inherit;
          color: #f1f5f9;
        }

        .ai-designer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ai-designer-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ai-designer-icon-badge {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }

        .ai-designer-body {
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ai-designer-memory-card {
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: 12px;
          padding: 10px 14px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 12.5px;
          color: #c4b5fd;
          line-height: 1.45;
        }

        .ai-designer-chips-scroll {
          display: flex;
          gap: 7px;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 4px;
        }

        .ai-designer-chip-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          padding: 5px 12px;
          color: #e2e8f0;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .ai-designer-chip-btn:hover {
          background: rgba(139, 92, 246, 0.25);
          border-color: #8b5cf6;
          color: #fff;
        }

        .ai-designer-input {
          width: 100%;
          background: #0b0f19;
          border: 1px solid #334155;
          border-radius: 10px;
          padding: 10px 14px;
          color: #fff;
          font-size: 13.5px;
          outline: none;
          transition: border-color 0.2s ease;
        }

        .ai-designer-input:focus {
          border-color: #8b5cf6;
        }

        .ai-designer-options-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .ai-designer-opt-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
          min-width: 140px;
        }

        .ai-designer-opt-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #94a3b8;
          letter-spacing: 0.5px;
        }

        .ai-designer-btn-generate {
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          border: none;
          border-radius: 10px;
          padding: 12px;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
          transition: opacity 0.2s ease, transform 0.15s ease;
        }

        .ai-designer-btn-generate:hover:not(:disabled) {
          opacity: 0.95;
          transform: translateY(-1px);
        }

        .ai-designer-btn-generate:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Result View */
        .ai-designer-result-box {
          background: rgba(15, 23, 42, 0.65);
          border: 1px solid rgba(139, 92, 246, 0.35);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          animation: fadeInResult 0.25s ease;
        }

        @keyframes fadeInResult {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ai-designer-rationale-box {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          color: #a7f3d0;
          line-height: 1.45;
        }

        .ai-designer-lift-card {
          background: rgba(30, 41, 59, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 10px 12px;
        }

        .ai-designer-sets-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 6px;
        }

        .ai-designer-set-badge {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 11.5px;
          font-weight: 600;
          color: #f1f5f9;
        }

        .ai-designer-btn-apply {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border: none;
          border-radius: 10px;
          padding: 12px;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);
        }

        .ai-designer-btn-apply:hover {
          opacity: 0.95;
        }

        .spin-anim {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="ai-designer-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ai-designer-header">
          <div className="ai-designer-title-row">
            <div className="ai-designer-icon-badge">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                AI Session Designer
              </h3>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Tailored to your past workouts & {currentPhase} phase
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="ai-designer-body">
          {/* Lifter memory banner */}
          <div className="ai-designer-memory-card">
            <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: '#a78bfa' }} />
            <div>
              <strong style={{ color: '#fff' }}>Lifter Memory: </strong>
              {memorySummary}
            </div>
          </div>

          {/* Quick chips */}
          <div>
            <label className="ai-designer-opt-label" style={{ marginBottom: 6, display: 'block' }}>
              Quick Target Focus
            </label>
            <div className="ai-designer-chips-scroll">
              {quickChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="ai-designer-chip-btn"
                  onClick={() => {
                    setUserNeed(chip.need);
                    handleGenerate(chip.need);
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom need prompt */}
          <div>
            <label className="ai-designer-opt-label" style={{ marginBottom: 6, display: 'block' }}>
              Or describe what you want today:
            </label>
            <input
              type="text"
              className="ai-designer-input"
              placeholder="e.g. Heavy bench press + triceps, or 45-min squat hypertrophy, or easy recovery..."
              value={userNeed}
              onChange={(e) => setUserNeed(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />
          </div>

          {/* Options: Duration & Intensity */}
          <div className="ai-designer-options-row">
            <div className="ai-designer-opt-group">
              <label className="ai-designer-opt-label">Session Length</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[45, 60, 75].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="ai-designer-chip-btn"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      borderColor: duration === m ? '#8b5cf6' : undefined,
                      background: duration === m ? 'rgba(139, 92, 246, 0.25)' : undefined,
                    }}
                    onClick={() => setDuration(m)}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </div>

            <div className="ai-designer-opt-group">
              <label className="ai-designer-opt-label">Target Intensity</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'heavy', label: 'Heavy (RPE 9)' },
                  { key: 'moderate', label: 'Hypertrophy' },
                  { key: 'light', label: 'Deload / Light' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className="ai-designer-chip-btn"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      borderColor: intensity === opt.key ? '#8b5cf6' : undefined,
                      background: intensity === opt.key ? 'rgba(139, 92, 246, 0.25)' : undefined,
                    }}
                    onClick={() => setIntensity(opt.key as any)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            type="button"
            className="ai-designer-btn-generate"
            onClick={() => handleGenerate()}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RotateCw size={16} className="spin-anim" />
                <span>Coach is analyzing past lifts and designing workout...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>{designedSession ? 'Re-Design Workout' : 'Design Workout with AI'}</span>
              </>
            )}
          </button>

          {errorMessage && (
            <div style={{ color: '#f87171', fontSize: '12.5px', textAlign: 'center' }}>
              {errorMessage}
            </div>
          )}

          {/* Designed Result Preview */}
          {designedSession && !isLoading && (
            <div className="ai-designer-result-box">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                  {designedSession.title}
                </h4>
                <div style={{ display: 'flex', gap: 4 }}>
                  {designedSession.bodyTags?.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: 'rgba(56, 189, 248, 0.2)',
                        color: '#38bdf8',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Layman Explanation */}
              <div className="ai-designer-rationale-box">
                <strong style={{ color: '#34d399' }}>Coach's Plan: </strong>
                {designedSession.rationale}
              </div>

              {/* Lifts list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {designedSession.lifts.map((lift, lIdx) => (
                  <div key={lIdx} className="ai-designer-lift-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#f1f5f9' }}>
                        {lift.name}
                      </span>
                      {lift.notes && (
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                          {lift.notes}
                        </span>
                      )}
                    </div>

                    <div className="ai-designer-sets-row">
                      {lift.sets.map((s, sIdx) => (
                        <div
                          key={sIdx}
                          className="ai-designer-set-badge"
                          style={{
                            borderColor: s.type === 'W' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.3)',
                          }}
                        >
                          <span style={{ color: s.type === 'W' ? '#f59e0b' : '#38bdf8', marginRight: 4 }}>
                            {s.type === 'W' ? 'Warmup' : `Set ${sIdx + 1}`}:
                          </span>
                          <span>
                            {s.weight}kg × {s.reps}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Coaching tips */}
              {designedSession.coachingTips && designedSession.coachingTips.length > 0 && (
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {designedSession.coachingTips.map((tip, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                      <span style={{ color: '#10b981' }}>✓</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Apply Button */}
              <button
                type="button"
                className="ai-designer-btn-apply"
                onClick={handleApply}
              >
                <CheckCircle2 size={16} />
                <span>Apply to This Workout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
