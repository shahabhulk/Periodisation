import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Key,
  Check,
  AlertCircle,
  X,
  ExternalLink,
  ShieldCheck,
  Trash2,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import {
  getGeminiApiKey,
  setGeminiApiKey,
  getSelectedGeminiModel,
  setSelectedGeminiModel,
  validateGeminiApiKey,
  clearAnalysisCache,
} from '../services/geminiService';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: () => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose,
  onKeySaved,
}) => {
  const [apiKey, setApiKeyInput] = useState<string>('');
  const [model, setModel] = useState<string>('gemini-3.8-flash');
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [clearedCache, setClearedCache] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setApiKeyInput(getGeminiApiKey());
      setModel(getSelectedGeminiModel());
      setTestResult(null);
      setClearedCache(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    setGeminiApiKey(apiKey.trim());
    setSelectedGeminiModel(model);
    if (onKeySaved) onKeySaved();
    onClose();
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter an API key first.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const res = await validateGeminiApiKey(apiKey.trim(), model);
    setTesting(false);
    if (res.valid) {
      if (res.resolvedModel && res.resolvedModel !== model) {
        setModel(res.resolvedModel);
      }
      setTestResult({ success: true, message: `Connected successfully to Google Gemini (${res.resolvedModel || model})!` });
    } else {
      setTestResult({ success: false, message: res.error || 'Connection failed. Please check the key.' });
    }
  };

  const handleClearCache = () => {
    clearAnalysisCache();
    setClearedCache(true);
    setTimeout(() => setClearedCache(false), 2500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 30px rgba(139, 92, 246, 0.2)',
          color: '#f8fafc',
          fontFamily: 'inherit',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>AI Coach Intelligence Settings</h3>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Periodisation Analysis & Model Configuration</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Info Box */}
        <div
          style={{
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '18px',
            fontSize: '12px',
            lineHeight: 1.5,
            color: '#cbd5e1',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#c4b5fd', marginBottom: '4px' }}>
            <ShieldCheck size={14} />
            <span>Hybrid Architecture Active</span>
          </div>
          Without an API key, the app runs the <strong>Deterministic Offline S&C Engine</strong>. Adding a free Google Gemini key unlocks personalized coaching synthesis, target generation, and physiological trend diagnostics.
        </div>

        {/* API Key Input */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={13} style={{ color: '#a78bfa' }} />
              Google Gemini API Key
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '11px',
                color: '#38bdf8',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              Get Free Key <ExternalLink size={10} />
            </a>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              style={{
                flex: 1,
                background: '#090d16',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '9px 12px',
                color: '#fff',
                fontSize: '13px',
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
            <button
              onClick={handleTestKey}
              disabled={testing || !apiKey.trim()}
              style={{
                background: '#1e293b',
                border: '1px solid #475569',
                color: '#cbd5e1',
                padding: '0 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: testing || !apiKey.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
              }}
            >
              <RefreshCw size={12} className={testing ? 'spin-anim' : ''} />
              {testing ? 'Testing...' : 'Test'}
            </button>
          </div>

          {testResult && (
            <div
              style={{
                marginTop: '8px',
                padding: '8px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                background: testResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: testResult.success ? '#34d399' : '#f87171',
                border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {testResult.success ? <Check size={14} /> : <AlertCircle size={14} />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Model Selection */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Cpu size={13} style={{ color: '#38bdf8' }} />
            Gemini Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{
              width: '100%',
              background: '#090d16',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '9px 12px',
              color: '#fff',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="gemini-3.8-flash">Gemini 3.8 Flash (Recommended - Smart & Fast)</option>
            <option value="gemini-3.7-flash">Gemini 3.7 Flash (High Performance)</option>
            <option value="gemini-3.5-flash">Gemini 3.5 Flash (Balanced)</option>
            <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (High Quota)</option>
          </select>
        </div>

        {/* Cache Clear Option */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            marginBottom: '20px',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>AI Analysis Local Cache</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Clear stored reports to force fresh recalculation</div>
          </div>
          <button
            onClick={handleClearCache}
            style={{
              background: 'transparent',
              border: '1px solid #475569',
              color: clearedCache ? '#34d399' : '#cbd5e1',
              padding: '5px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {clearedCache ? <Check size={12} /> : <Trash2 size={12} />}
            {clearedCache ? 'Cleared!' : 'Clear Cache'}
          </button>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #475569',
              color: '#94a3b8',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              border: 'none',
              color: '#ffffff',
              padding: '8px 20px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
            }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
