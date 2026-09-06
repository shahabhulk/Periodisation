import React, { useState } from 'react';
import Body, { type ExtendedBodyPart, type Slug } from 'react-muscle-highlighter';
import { RotateCcw, User, Flame, Sparkles } from 'lucide-react';

export interface MuscleMapping {
  bodyPart: string;
  targetMuscle?: string;
  label: string;
  sideDefault: 'front' | 'back';
}

export const SLUG_TO_LYFTA_MAP: Record<string, MuscleMapping> = {
  chest: { bodyPart: 'Chest', targetMuscle: 'Pectoralis Major Sternal Head', label: 'Chest (Pectorals)', sideDefault: 'front' },
  biceps: { bodyPart: 'Biceps', targetMuscle: 'Biceps Brachii', label: 'Biceps', sideDefault: 'front' },
  triceps: { bodyPart: 'Triceps', targetMuscle: 'Triceps Brachii', label: 'Triceps', sideDefault: 'back' },
  deltoids: { bodyPart: 'Shoulders', targetMuscle: 'Deltoid Anterior', label: 'Shoulders (Deltoids)', sideDefault: 'front' },
  'upper-back': { bodyPart: 'Back', targetMuscle: 'Latissimus Dorsi', label: 'Lats & Upper Back', sideDefault: 'back' },
  'lower-back': { bodyPart: 'Back', targetMuscle: 'Erector Spinae', label: 'Lower Back', sideDefault: 'back' },
  trapezius: { bodyPart: 'Back', targetMuscle: 'Trapezius Upper Fibers', label: 'Traps (Trapezius)', sideDefault: 'back' },
  abs: { bodyPart: 'Waist', targetMuscle: 'Rectus Abdominis', label: 'Abs (Abdominals)', sideDefault: 'front' },
  obliques: { bodyPart: 'Waist', targetMuscle: 'Obliques', label: 'Obliques', sideDefault: 'front' },
  quadriceps: { bodyPart: 'Quadriceps', targetMuscle: 'Quadriceps', label: 'Quads (Quadriceps)', sideDefault: 'front' },
  hamstring: { bodyPart: 'Hamstrings', targetMuscle: 'Hamstrings', label: 'Hamstrings', sideDefault: 'back' },
  calves: { bodyPart: 'Calves', targetMuscle: 'Gastrocnemius', label: 'Calves (Gastrocnemius)', sideDefault: 'back' },
  gluteal: { bodyPart: 'Hips', targetMuscle: 'Gluteus Maximus', label: 'Glutes (Gluteal)', sideDefault: 'back' },
  adductors: { bodyPart: 'Adductors', targetMuscle: 'Adductors', label: 'Inner Thighs (Adductors)', sideDefault: 'front' },
  forearm: { bodyPart: 'Forearms', targetMuscle: 'Brachioradialis', label: 'Forearms', sideDefault: 'front' },
  neck: { bodyPart: 'Neck', targetMuscle: 'Sternocleidomastoid', label: 'Neck', sideDefault: 'front' },
  tibialis: { bodyPart: 'Calves', targetMuscle: 'Tibialis Anterior', label: 'Tibialis (Shins)', sideDefault: 'front' },
};

interface BodyAnatomyViewProps {
  selectedSlug: Slug | null;
  onSelectMuscle: (slug: Slug | null, lyftaBodyPart: string, targetMuscle?: string) => void;
  onClear: () => void;
}

export const BodyAnatomyView: React.FC<BodyAnatomyViewProps> = ({
  selectedSlug,
  onSelectMuscle,
  onClear,
}) => {
  const [gender, setGender] = useState<'male' | 'female'>('male');

  const HIGHLIGHT_COLOR = '#f43f5e'; // Vibrant Rose glow
  const DEFAULT_FILL = '#18202f';
  const DEFAULT_STROKE = '#2a364d';

  // Highlight data
  const highlightedData: readonly ExtendedBodyPart[] = selectedSlug
    ? [
        {
          slug: selectedSlug,
          color: HIGHLIGHT_COLOR,
          styles: {
            fill: HIGHLIGHT_COLOR,
            stroke: '#fda4af',
            strokeWidth: 1.5,
          },
        },
      ]
    : [];

  const handleBodyPartPress = (part: ExtendedBodyPart) => {
    if (!part.slug) return;
    const slug = part.slug as Slug;

    // Toggle off if already selected
    if (selectedSlug === slug) {
      onClear();
      return;
    }

    const mapping = SLUG_TO_LYFTA_MAP[slug];
    if (mapping) {
      if (slug === 'adductors') {
        onSelectMuscle(slug, mapping.bodyPart, mapping.targetMuscle || 'Adductor Longus');
      } else {
        onSelectMuscle(slug, mapping.bodyPart, 'all');
      }
    } else {
      onSelectMuscle(slug, 'all', 'all');
    }
  };

  const currentMapping = selectedSlug ? SLUG_TO_LYFTA_MAP[selectedSlug] : null;

  return (
    <div className="anatomy-container">
      <style>{`
        .anatomy-container {
          background: radial-gradient(circle at 50% 20%, #151c2c 0%, #0d121c 100%);
          border: 1px solid rgba(244, 63, 94, 0.2);
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 16px;
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6);
        }

        .anatomy-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 14px;
          padding-bottom: 10px;
          border-bottom: 1px solid #1f2a3e;
        }

        .anatomy-title-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .anatomy-title {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .anatomy-badge {
          background: rgba(244, 63, 94, 0.15);
          border: 1px solid rgba(244, 63, 94, 0.35);
          color: #fda4af;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 20px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .anatomy-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .anatomy-toggle-btn {
          background: #192233;
          border: 1px solid #2a374f;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 600;
          padding: 5px 10px;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s ease;
        }

        .anatomy-toggle-btn:hover {
          background: #232f46;
          color: #ffffff;
          border-color: #3b4d6e;
        }

        .anatomy-toggle-btn.active {
          background: #f43f5e;
          border-color: #f43f5e;
          color: #ffffff;
        }

        .anatomy-models-grid {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 24px;
          padding: 6px 0;
        }

        .anatomy-model-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: rgba(13, 18, 28, 0.65);
          border: 1px solid #1f2a3f;
          border-radius: 12px;
          padding: 10px 14px;
          position: relative;
          cursor: pointer;
          transition: border-color 0.2s ease;
        }

        .anatomy-model-card:hover {
          border-color: rgba(244, 63, 94, 0.4);
        }

        .anatomy-card-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
          color: #64748b;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .anatomy-hint-bar {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid #1a2336;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: #94a3b8;
          flex-wrap: wrap;
          gap: 8px;
        }

        .anatomy-hint-text {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        @media (max-width: 620px) {
          .anatomy-models-grid {
            gap: 12px;
          }
          .anatomy-model-card {
            padding: 6px 8px;
          }
        }
      `}</style>

      {/* Header with Title & Toggles */}
      <div className="anatomy-header">
        <div className="anatomy-title-group">
          <div className="anatomy-title">
            <Flame className="w-4 h-4 text-rose-500 fill-rose-500/30" />
            Interactive Muscle Anatomy
          </div>

          {currentMapping ? (
            <div className="anatomy-badge">
              <Sparkles className="w-3 h-3" />
              <span>{currentMapping.label}</span>
            </div>
          ) : (
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Tap any muscle to view exercises
            </span>
          )}
        </div>

        <div className="anatomy-controls">
          {/* Gender toggle */}
          <button
            type="button"
            className="anatomy-toggle-btn"
            onClick={() => setGender(gender === 'male' ? 'female' : 'male')}
            title="Toggle Body Silhouette"
          >
            <User className="w-3 h-3" />
            <span>{gender === 'male' ? 'Male' : 'Female'}</span>
          </button>

          {/* Clear button if muscle is selected */}
          {selectedSlug && (
            <button
              type="button"
              className="anatomy-toggle-btn"
              onClick={onClear}
              title="Clear Anatomy Selection"
              style={{ color: '#fda4af', borderColor: 'rgba(244, 63, 94, 0.4)' }}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Front & Back Anatomical Bodies Side by Side */}
      <div className="anatomy-models-grid">
        {/* Front View */}
        <div className="anatomy-model-card">
          <div className="anatomy-card-label">Anterior (Front)</div>
          <div style={{ width: 140, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Body
              data={highlightedData}
              side="front"
              gender={gender}
              scale={0.78}
              onBodyPartPress={handleBodyPartPress}
              defaultFill={DEFAULT_FILL}
              defaultStroke={DEFAULT_STROKE}
              defaultStrokeWidth={0.8}
              border="#334155"
            />
          </div>
        </div>

        {/* Back View */}
        <div className="anatomy-model-card">
          <div className="anatomy-card-label">Posterior (Back)</div>
          <div style={{ width: 140, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Body
              data={highlightedData}
              side="back"
              gender={gender}
              scale={0.78}
              onBodyPartPress={handleBodyPartPress}
              defaultFill={DEFAULT_FILL}
              defaultStroke={DEFAULT_STROKE}
              defaultStrokeWidth={0.8}
              border="#334155"
            />
          </div>
        </div>
      </div>

      {/* Footer Info & Active Target Feedback */}
      <div className="anatomy-hint-bar">
        <div className="anatomy-hint-text">
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: selectedSlug ? '#f43f5e' : '#64748b' }} />
          <span>
            {currentMapping
              ? `Filtering by: ${currentMapping.label} (${currentMapping.bodyPart})`
              : 'Click Chest, Biceps, Quads, Lats, etc., on either silhouette'}
          </span>
        </div>

        {selectedSlug && (
          <button
            type="button"
            onClick={onClear}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f43f5e',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '11px',
              textDecoration: 'underline',
            }}
          >
            Show All 7,640+ Exercises
          </button>
        )}
      </div>
    </div>
  );
};
