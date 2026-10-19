import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Sparkles,
  Zap,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Cpu,
  ChevronDown,
  ChevronUp,
  Key,
  ShieldCheck,
  Flame,
  MessageSquare,
  Send,
  User,
  Bot,
  Dumbbell,
} from 'lucide-react';
import {
  requestPeriodisationAnalysis,
  hasGeminiApiKey,
  sendAICoachChatMessage,
  type ChatMessage,
} from '../services/geminiService';
import type { AIAnalysisReport } from '../services/periodisationMetrics';
import {
  buildComprehensiveTrainingContext,
  type ComprehensiveTrainingContext,
} from '../services/appDataService';

interface AICoachCardProps {
  level: 'session' | 'microcycle' | 'mesocycle' | 'macrocycle';
  targetId: string;
  targetName: string;
  selectedLift?: string;
  metrics: any;
  meta?: {
    phaseKey?: string;
    strategyNotes?: string;
    targets?: any[];
    dietNote?: string;
    statusNote?: string;
    selectedLift?: string;
    equipmentFilter?: string;
    allMesocycles?: any[];
    allPrs?: any[];
    workoutEntries?: any[];
    trainingContext?: ComprehensiveTrainingContext;
  };
  allMesocycles?: any[];
  allPrs?: any[];
  workoutEntries?: any[];
  trainingContext?: ComprehensiveTrainingContext;
  onOpenSettings?: () => void;
  defaultExpanded?: boolean;
}

export const AICoachCard: React.FC<AICoachCardProps> = ({
  level,
  targetId,
  targetName,
  selectedLift = 'all',
  metrics,
  meta,
  allMesocycles,
  allPrs,
  workoutEntries,
  trainingContext: passedTrainingContext,
  onOpenSettings,
  defaultExpanded = true,
}) => {
  const [report, setReport] = useState<AIAnalysisReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [hasKey, setHasKey] = useState<boolean>(hasGeminiApiKey());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Conversational Chat State
  const [showChat, setShowChat] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const activeLift = selectedLift && selectedLift !== 'all' ? selectedLift : meta?.selectedLift && meta.selectedLift !== 'all' ? meta.selectedLift : null;

  // Build unified training context across all 12 phases
  const trainingContext = useMemo(() => {
    if (passedTrainingContext) return passedTrainingContext;
    if (meta?.trainingContext) return meta.trainingContext;
    return buildComprehensiveTrainingContext({
      mesocycles: allMesocycles || meta?.allMesocycles,
      prLog: allPrs || meta?.allPrs,
      workoutEntries: workoutEntries || meta?.workoutEntries,
      selectedLift: activeLift || undefined,
    });
  }, [passedTrainingContext, meta, allMesocycles, allPrs, workoutEntries, activeLift]);

  const fetchAnalysis = useCallback(
    async (forceRefresh = false) => {
      if (!targetId || !metrics) return;
      setLoading(true);
      setErrorMsg(null);
      try {
        const result = await requestPeriodisationAnalysis({
          level,
          targetId: `${targetId}_${activeLift || 'all'}`,
          targetName,
          metrics,
          meta: {
            ...meta,
            selectedLift: activeLift || undefined,
            trainingContext,
            allMesocycles: allMesocycles || meta?.allMesocycles,
            allPrs: allPrs || meta?.allPrs,
            workoutEntries: workoutEntries || meta?.workoutEntries,
          },
          forceRefresh,
        });
        setReport(result);
      } catch (err: any) {
        console.error('Failed to run AI analysis:', err);
        setErrorMsg(err?.message || 'Analysis generation failed.');
      } finally {
        setLoading(false);
        setHasKey(hasGeminiApiKey());
      }
    },
    [level, targetId, targetName, activeLift, metrics, meta, trainingContext, allMesocycles, allPrs, workoutEntries]
  );

  useEffect(() => {
    fetchAnalysis(false);
  }, [fetchAnalysis]);

  useEffect(() => {
    if (showChat) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || chatInput).trim();
    if (!textToSend || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const replyText = await sendAICoachChatMessage(
        nextHistory,
        textToSend,
        {
          level,
          targetName,
          selectedLift: activeLift || 'All Lifts',
          phaseKey: meta?.phaseKey,
          metrics,
          strategyNotes: meta?.strategyNotes,
          trainingContext,
          allMesocycles: allMesocycles || meta?.allMesocycles,
          allPrs: allPrs || meta?.allPrs,
          workoutEntries: workoutEntries || meta?.workoutEntries,
        }
      );

      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        role: 'model',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'model',
        text: `Coach note: ${err?.message || 'Failed to connect. Please check your API key in Settings.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const levelLabels = {
    session: 'Workout Session Analysis',
    microcycle: 'Microcycle Workload Analysis',
    mesocycle: 'Mesocycle Adaptation Audit',
    macrocycle: 'Macrocycle Architecture Audit',
  };

  const suggestedQuestions = [
    'How does my volume compare to previous phases?',
    'What were my peak lifts in previous phases vs now?',
    'Review my progression across all phases so far',
    activeLift ? `How should I adjust my ${activeLift} sets next week?` : 'How should I adjust volume next week?',
    meta?.phaseKey ? `Is my volume appropriate for this ${meta.phaseKey} phase?` : 'Is my fatigue level safe?',
    activeLift ? `What warm-ups and top sets do you recommend for ${activeLift}?` : 'When should I schedule my next deload?',
  ];

  return (
    <div className="ai-coach-card-root">
      <style>{`
        .ai-coach-card-root {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.96) 0%, rgba(24, 24, 37, 0.96) 100%);
          border: 1px solid rgba(139, 92, 246, 0.28);
          border-radius: 16px;
          padding: 18px 20px;
          margin-bottom: 24px;
          box-shadow: 0 10px 28px -6px rgba(0, 0, 0, 0.4), 0 0 20px -4px rgba(139, 92, 246, 0.12);
          position: relative;
          overflow: hidden;
          font-family: inherit;
          backdrop-filter: blur(12px);
          transition: border-color 0.25s ease;
        }

        .ai-coach-card-root:hover {
          border-color: rgba(139, 92, 246, 0.45);
        }

        .ai-coach-glow-accent {
          position: absolute;
          top: -40px;
          right: -40px;
          width: 140px;
          height: 140px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%);
          pointer-events: none;
        }

        .ai-coach-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .ai-coach-title-area {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ai-coach-icon-badge {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.35);
        }

        .ai-coach-headline {
          display: flex;
          flex-direction: column;
        }

        .ai-coach-name-row {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }

        .ai-coach-title {
          font-size: 15px;
          font-weight: 700;
          color: #f8fafc;
          letter-spacing: -0.01em;
          margin: 0;
        }

        .ai-coach-level-tag {
          font-size: 10.5px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 6px;
          background: rgba(139, 92, 246, 0.15);
          color: #c4b5fd;
          border: 1px solid rgba(139, 92, 246, 0.28);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .ai-coach-lift-tag {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 6px;
          background: rgba(56, 189, 248, 0.18);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.35);
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .ai-coach-subtext {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 1px;
        }

        .ai-coach-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ai-coach-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .ai-coach-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .ai-coach-btn-refresh {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #cbd5e1;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .ai-coach-btn-refresh:hover:not(:disabled) {
          background: rgba(139, 92, 246, 0.2);
          border-color: rgba(139, 92, 246, 0.4);
          color: #f1f5f9;
        }

        .ai-coach-btn-refresh:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ai-coach-btn-expand {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 6px;
          transition: color 0.2s ease;
        }

        .ai-coach-score-container {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
        }

        .ai-coach-score-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .ai-coach-score-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94a3b8;
        }

        .ai-coach-score-val {
          font-size: 13px;
          font-weight: 700;
          color: #f8fafc;
        }

        .ai-coach-bar-track {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .ai-coach-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .ai-coach-summary-box {
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 10px 14px;
          margin-bottom: 14px;
        }

        .ai-coach-summary-text {
          font-size: 13.5px;
          color: #e2e8f0;
          line-height: 1.5;
          margin: 0;
        }

        .ai-coach-highlights-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
          gap: 8px;
          margin-bottom: 14px;
        }

        .ai-coach-stat-pill {
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
        }

        .ai-coach-stat-lbl {
          font-size: 10.5px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .ai-coach-stat-num {
          font-size: 14px;
          font-weight: 700;
          color: #f8fafc;
          margin-top: 2px;
        }

        .ai-coach-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 14px;
        }

        @media (max-width: 720px) {
          .ai-coach-two-col {
            grid-template-columns: 1fr;
          }
        }

        .ai-coach-section {
          background: rgba(15, 23, 42, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 12px 14px;
        }

        .ai-coach-sec-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 10px;
        }

        .ai-coach-sec-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ai-coach-list-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12.5px;
          line-height: 1.45;
          color: #cbd5e1;
        }

        .ai-coach-bullet-icon {
          flex-shrink: 0;
          margin-top: 2px;
        }

        /* Interactive Chat Section */
        .ai-coach-chat-toggle-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: rgba(139, 92, 246, 0.12);
          border: 1px solid rgba(139, 92, 246, 0.28);
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .ai-coach-chat-toggle-bar:hover {
          background: rgba(139, 92, 246, 0.2);
        }

        .ai-coach-chat-drawer {
          margin-top: 10px;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .ai-coach-quick-chips {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 4px;
        }

        .ai-coach-chip {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #c4b5fd;
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 14px;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ai-coach-chip:hover {
          background: rgba(139, 92, 246, 0.25);
          border-color: rgba(139, 92, 246, 0.4);
          color: #f1f5f9;
        }

        .ai-coach-messages-box {
          max-height: 240px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-right: 4px;
        }

        .ai-coach-msg-row {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .ai-coach-msg-user {
          flex-direction: row-reverse;
        }

        .ai-coach-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 10px;
        }

        .ai-coach-avatar-bot {
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          color: #fff;
        }

        .ai-coach-avatar-user {
          background: #334155;
          color: #94a3b8;
        }

        .ai-coach-bubble {
          max-width: 82%;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.45;
        }

        .ai-coach-bubble-bot {
          background: rgba(30, 41, 59, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #e2e8f0;
        }

        .ai-coach-bubble-user {
          background: #6366f1;
          color: #ffffff;
        }

        .ai-coach-chat-input-row {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }

        .ai-coach-chat-input {
          flex: 1;
          background: #090d16;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 8px 12px;
          color: #fff;
          font-size: 12.5px;
          outline: none;
        }

        .ai-coach-chat-input:focus {
          border-color: #8b5cf6;
        }

        .ai-coach-chat-send-btn {
          background: #8b5cf6;
          border: none;
          color: #fff;
          padding: 0 14px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
        }

        .ai-coach-chat-send-btn:hover:not(:disabled) {
          background: #7c3aed;
        }

        .ai-coach-chat-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ai-coach-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 14px;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 11px;
          color: #64748b;
        }

        .ai-coach-engine-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-weight: 600;
        }

        .ai-coach-tip-btn {
          color: #a78bfa;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 11px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .ai-coach-tip-btn:hover {
          color: #c4b5fd;
          text-decoration: underline;
        }

        .ai-coach-loading-shimmer {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px 0;
          gap: 10px;
          color: #a78bfa;
          font-size: 13px;
          font-weight: 600;
        }

        .spin-anim {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="ai-coach-glow-accent" />

      {/* Header */}
      <div className="ai-coach-header">
        <div className="ai-coach-title-area">
          <div className="ai-coach-icon-badge">
            <Sparkles size={18} />
          </div>
          <div className="ai-coach-headline">
            <div className="ai-coach-name-row">
              <h4 className="ai-coach-title">AI Sports Scientist</h4>
              <span className="ai-coach-level-tag">{level}</span>
              {meta?.phaseKey && (
                <span
                  className="ai-coach-level-tag"
                  style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#93c5fd',
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                  }}
                >
                  {meta.phaseKey}
                </span>
              )}
              {activeLift && (
                <span className="ai-coach-lift-tag">
                  <Dumbbell size={11} />
                  {activeLift} Specific
                </span>
              )}
              <span
                className="ai-coach-level-tag"
                title="AI has direct live access to all 12 mesocycle phases, 377+ workouts, and historical PRs"
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.16)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ShieldCheck size={11} /> All Phases Connected
              </span>
            </div>
            <span className="ai-coach-subtext">{levelLabels[level]} · {targetName}</span>
          </div>
        </div>

        <div className="ai-coach-header-actions">
          {report && (
            <div
              className="ai-coach-status-pill"
              style={{
                color: report.statusColor,
                borderColor: `${report.statusColor}40`,
              }}
            >
              <div
                className="ai-coach-dot"
                style={{
                  backgroundColor: report.statusColor,
                  boxShadow: `0 0 8px ${report.statusColor}`,
                }}
              />
              <span>{report.status}</span>
            </div>
          )}

          <button
            className="ai-coach-btn-refresh"
            onClick={() => fetchAnalysis(true)}
            disabled={loading}
            title="Re-run genuine periodisation analysis"
          >
            <RotateCw size={13} className={loading ? 'spin-anim' : ''} />
            <span>{loading ? 'Analyzing...' : 'Re-Analyze'}</span>
          </button>

          <button
            className="ai-coach-btn-expand"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Body */}
      {isExpanded && (
        <>
          {loading && !report ? (
            <div className="ai-coach-loading-shimmer">
              <RotateCw size={18} className="spin-anim" />
              <span>Analyzing {activeLift ? `${activeLift} metrics` : 'periodisation data'}...</span>
            </div>
          ) : report ? (
            <div className="ai-coach-score-container">
              {/* Score Bar */}
              <div className="ai-coach-score-row">
                <span className="ai-coach-score-label">Adaptation & Execution Score</span>
                <span className="ai-coach-score-val" style={{ color: report.statusColor }}>
                  {report.score}/100
                </span>
              </div>
              <div className="ai-coach-bar-track">
                <div
                  className="ai-coach-bar-fill"
                  style={{
                    width: `${report.score}%`,
                    backgroundColor: report.statusColor,
                    boxShadow: `0 0 10px ${report.statusColor}80`,
                  }}
                />
              </div>

              {/* Executive Summary */}
              <div className="ai-coach-summary-box">
                <p className="ai-coach-summary-text">{report.summary}</p>
              </div>

              {/* Metric Highlights */}
              {report.metricsHighlights && report.metricsHighlights.length > 0 && (
                <div className="ai-coach-highlights-grid">
                  {report.metricsHighlights.map((m, idx) => (
                    <div key={idx} className="ai-coach-stat-pill">
                      <span className="ai-coach-stat-lbl">{m.label}</span>
                      <span className="ai-coach-stat-num">{m.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Diagnostics & Prescriptions */}
              <div className="ai-coach-two-col">
                {/* Diagnostics */}
                <div className="ai-coach-section">
                  <div className="ai-coach-sec-header" style={{ color: '#38bdf8' }}>
                    <Zap size={14} />
                    <span>Diagnostic Findings</span>
                  </div>
                  <ul className="ai-coach-sec-list">
                    {report.diagnostics.map((d, i) => (
                      <li key={i} className="ai-coach-list-item">
                        <Flame size={14} color="#38bdf8" className="ai-coach-bullet-icon" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Prescriptions */}
                <div className="ai-coach-section">
                  <div className="ai-coach-sec-header" style={{ color: '#10b981' }}>
                    <CheckCircle2 size={14} />
                    <span>Prescriptive Action Items</span>
                  </div>
                  <ul className="ai-coach-sec-list">
                    {report.prescriptions.map((p, i) => (
                      <li key={i} className="ai-coach-list-item">
                        <TrendingUp size={14} color="#10b981" className="ai-coach-bullet-icon" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Interactive Coach Conversation Drawer */}
              <div
                className="ai-coach-chat-toggle-bar"
                onClick={() => setShowChat(!showChat)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={14} style={{ color: '#c4b5fd' }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                    Ask Coach about {activeLift ? activeLift : targetName}
                  </span>
                  {chatMessages.length > 0 && (
                    <span style={{ fontSize: '10.5px', background: '#8b5cf6', color: '#fff', padding: '1px 6px', borderRadius: '10px' }}>
                      {chatMessages.length}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#c4b5fd', fontSize: '11px', fontWeight: 600 }}>
                  <span>{showChat ? 'Hide Chat' : 'Open Chat'}</span>
                  {showChat ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>

              {showChat && (
                <div className="ai-coach-chat-drawer">
                  {/* Suggested quick chips */}
                  <div className="ai-coach-quick-chips">
                    {suggestedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="ai-coach-chip"
                        onClick={() => handleSendMessage(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>

                  {/* Messages container */}
                  <div className="ai-coach-messages-box">
                    {chatMessages.length === 0 ? (
                      <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', padding: '14px 0' }}>
                        Have a question about your {activeLift || 'training'} volume, loads, or recovery? Ask Coach below.
                      </div>
                    ) : (
                      chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`ai-coach-msg-row ${msg.role === 'user' ? 'ai-coach-msg-user' : ''}`}
                        >
                          <div className={`ai-coach-avatar ${msg.role === 'user' ? 'ai-coach-avatar-user' : 'ai-coach-avatar-bot'}`}>
                            {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                          </div>
                          <div className={`ai-coach-bubble ${msg.role === 'user' ? 'ai-coach-bubble-user' : 'ai-coach-bubble-bot'}`}>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                            <div style={{ fontSize: '9.5px', opacity: 0.6, marginTop: '4px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                              {msg.timestamp}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    {isChatLoading && (
                      <div className="ai-coach-msg-row">
                        <div className="ai-coach-avatar ai-coach-avatar-bot">
                          <Bot size={12} />
                        </div>
                        <div className="ai-coach-bubble ai-coach-bubble-bot" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <RotateCw size={12} className="spin-anim" />
                          <span>Coach is formulating moderate scientific recommendations...</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Input row */}
                  <div className="ai-coach-chat-input-row">
                    <input
                      type="text"
                      className="ai-coach-chat-input"
                      placeholder={`Ask about ${activeLift || 'this cycle'} (e.g. "What should my warm-up and top sets be?")...`}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="ai-coach-chat-send-btn"
                      onClick={() => handleSendMessage()}
                      disabled={isChatLoading || !chatInput.trim()}
                    >
                      <Send size={13} />
                    </button>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="ai-coach-footer">
                <div className="ai-coach-engine-badge">
                  {report.isOfflineHeuristic ? (
                    <>
                      <Cpu size={13} color="#06b6d4" />
                      <span style={{ color: '#06b6d4' }}>Offline S&C Engine</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={13} color="#a78bfa" />
                      <span style={{ color: '#c4b5fd' }}>Gemini 3.8 Flash Verified Coach</span>
                    </>
                  )}
                </div>

                {!hasKey && (
                  <button
                    className="ai-coach-tip-btn"
                    onClick={() => onOpenSettings && onOpenSettings()}
                  >
                    <Key size={12} />
                    <span>Add Gemini API key in Settings for deeper LLM insights</span>
                  </button>
                )}
              </div>
            </div>
          ) : errorMsg ? (
            <div style={{ color: '#f87171', padding: '12px 0', fontSize: '13px' }}>
              <AlertTriangle size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {errorMsg}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
