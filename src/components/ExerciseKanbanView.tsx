import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Dumbbell, RefreshCw, Info, Check, Layers, X, Bookmark } from 'lucide-react';
import { FALLBACK_EXERCISES } from '../data/exerciseLibraryData';

export interface ExerciseDBItem {
  exerciseId: string;
  name: string;
  gifUrl: string;
  bodyParts: string[];
  equipments: string[];
  targetMuscles: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
}

const BODY_PART_OPTIONS = [
  { value: 'all', label: 'All Body Parts' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'upper arms', label: 'Upper Arms (Biceps/Triceps)' },
  { value: 'lower arms', label: 'Forearms / Lower Arms' },
  { value: 'upper legs', label: 'Quads & Hamstrings' },
  { value: 'lower legs', label: 'Calves / Lower Legs' },
  { value: 'waist', label: 'Core / Waist' },
  { value: 'cardio', label: 'Cardio' },
];

const EQUIPMENT_OPTIONS = [
  { value: 'all', label: 'All Equipment' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'cable', label: 'Cable' },
  { value: 'body weight', label: 'Body Weight' },
  { value: 'lever machine', label: 'Lever Machine' },
  { value: 'assisted', label: 'Assisted' },
  { value: 'band', label: 'Resistance Band' },
  { value: 'smith machine', label: 'Smith Machine' },
  { value: 'ez barbell', label: 'EZ Barbell' },
  { value: 'kettlebell', label: 'Kettlebell' },
];

interface ExerciseKanbanViewProps {
  onSelectExercise?: (exerciseName: string, gifUrl?: string) => void;
  onSelectExercises?: (exercises: { name: string; gifUrl?: string }[]) => void;
  onClose?: () => void;
  onResumeWorkout?: () => void;
}

export const ExerciseKanbanView: React.FC<ExerciseKanbanViewProps> = ({
  onSelectExercise,
  onSelectExercises,
  onClose,
  onResumeWorkout,
}) => {
  const filterFallbackExercises = (s: string, bp: string, eq: string): ExerciseDBItem[] => {
    return FALLBACK_EXERCISES.filter((ex) => {
      const matchSearch = !s.trim() || ex.name.toLowerCase().includes(s.toLowerCase());
      const matchBp = bp === 'all' || ex.bodyParts.includes(bp);
      const matchEq = eq === 'all' || ex.equipments.includes(eq);
      return matchSearch && matchBp && matchEq;
    });
  };

  const [exercises, setExercises] = useState<ExerciseDBItem[]>(() => filterFallbackExercises('', 'all', 'all'));
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [bodyPart, setBodyPart] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [selectedExerciseModal, setSelectedExerciseModal] = useState<ExerciseDBItem | null>(null);
  const [addedSuccessName, setAddedSuccessName] = useState<string | null>(null);

  const [selectedExercisesMap, setSelectedExercisesMap] = useState<Record<string, ExerciseDBItem>>({});
  const [bookmarkedIds, setBookmarkedIds] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('bookmarked_exercises') || '{}');
    } catch (e) {
      return {};
    }
  });

  const [selectCounts, setSelectCounts] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('exercise_select_counts') || '{}');
    } catch (e) {
      return {};
    }
  });

  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarkedIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem('bookmarked_exercises', JSON.stringify(next));
      return next;
    });
  };

  const toggleCardSelect = (ex: ExerciseDBItem) => {
    const id = ex.exerciseId;
    setSelectedExercisesMap((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = ex;
      }
      return next;
    });
  };

  const selectedList = useMemo(() => {
    return Object.values(selectedExercisesMap);
  }, [selectedExercisesMap]);

  const handleConfirmAddExercises = () => {
    if (selectedList.length === 0) return;

    // Increment selection count for frequency ranking
    setSelectCounts((prev) => {
      const next = { ...prev };
      selectedList.forEach((ex) => {
        next[ex.exerciseId] = (next[ex.exerciseId] || 0) + 1;
      });
      localStorage.setItem('exercise_select_counts', JSON.stringify(next));
      return next;
    });

    // Invoke parent addition callback
    if (onSelectExercises) {
      onSelectExercises(selectedList.map((ex) => ({ name: ex.name, gifUrl: ex.gifUrl })));
    } else if (onSelectExercise) {
      selectedList.forEach((ex) => onSelectExercise(ex.name, ex.gifUrl));
    }

    setAddedSuccessName(`${selectedList.length} ${selectedList.length === 1 ? 'exercise' : 'exercises'}`);
    setTimeout(() => setAddedSuccessName(null), 2500);

    // Clear selection
    setSelectedExercisesMap({});

    // Return to workout form
    if (onResumeWorkout) {
      onResumeWorkout();
    } else if (onClose) {
      onClose();
    }
  };

  // Sort exercises: Bookmarked on top, then most frequently selected on top
  const sortedExercises = useMemo(() => {
    return [...exercises].sort((a, b) => {
      const aBookmarked = bookmarkedIds[a.exerciseId] ? 1 : 0;
      const bBookmarked = bookmarkedIds[b.exerciseId] ? 1 : 0;
      if (aBookmarked !== bBookmarked) return bBookmarked - aBookmarked;

      const aCount = selectCounts[a.exerciseId] || 0;
      const bCount = selectCounts[b.exerciseId] || 0;
      if (aCount !== bCount) return bCount - aCount;

      return 0;
    });
  }, [exercises, bookmarkedIds, selectCounts]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchExerciseDB = async (reset: boolean = false, nextCursor: string | null = null) => {
    setLoading(true);
    try {
      let url = `https://oss.exercisedb.dev/api/v1/exercises?limit=40`;
      const params: string[] = [];
      if (search.trim()) params.push(`name=${encodeURIComponent(search.trim())}`);
      if (bodyPart !== 'all') params.push(`bodyParts=${encodeURIComponent(bodyPart)}`);
      if (equipment !== 'all') params.push(`equipments=${encodeURIComponent(equipment)}`);
      if (nextCursor) params.push(`after=${nextCursor}`);

      if (params.length > 0) {
        url += `&${params.join('&')}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          if (reset) {
            setExercises(json.data);
          } else {
            setExercises((prev) => [...prev, ...json.data]);
          }
          setCursor(json.meta?.nextCursor || null);
          setHasNextPage(!!json.meta?.hasNextPage);
          if (json.meta?.total !== undefined) {
            setTotalCount(json.meta.total);
          }
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Error fetching exercises from ExerciseDB API:', err);
    }

    // Fallback if API fails or returns no data
    const fallbackList = filterFallbackExercises(search, bodyPart, equipment);
    if (reset) {
      setExercises(fallbackList);
    } else {
      setExercises((prev) => {
        const existingIds = new Set(prev.map(p => p.exerciseId));
        const newItems = fallbackList.filter(f => !existingIds.has(f.exerciseId));
        return [...prev, ...newItems];
      });
    }
    setHasNextPage(false);
    setLoading(false);
  };

  useEffect(() => {
    // Immediately filter local exercises for crisp UI responsiveness
    setExercises(filterFallbackExercises(search, bodyPart, equipment));

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchExerciseDB(true, null);
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, bodyPart, equipment]);

  const loadMore = () => {
    if (cursor && !loading) {
      fetchExerciseDB(false, cursor);
    }
  };

  const handleSelect = (ex: ExerciseDBItem) => {
    if (onSelectExercise) {
      onSelectExercise(ex.name, ex.gifUrl);
      setAddedSuccessName(ex.name);
      setTimeout(() => setAddedSuccessName(null), 2500);
    }
  };

  return (
    <div className="exercise-n2-container">
      <style>{`
        .exercise-n2-container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 16px 12px 100px;
          font-family: 'Inter', sans-serif;
          color: #edeae2;
        }

        .n2-top-header {
          margin-bottom: 20px;
          border-bottom: 1px solid #232c3d;
          padding-bottom: 16px;
        }

        .n2-main-title {
          font-family: 'Oswald', sans-serif;
          font-size: 24px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #ffffff;
          margin: 0 0 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .n2-filter-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          gap: 10px;
        }

        .n2-search-box {
          position: relative;
        }

        .n2-input-field {
          background: #151a24;
          border: 1px solid #293246;
          border-radius: 12px;
          padding: 9px 12px 9px 36px;
          font-size: 13px;
          color: #ffffff;
          outline: none;
          width: 100%;
          transition: border-color 0.2s ease;
        }

        .n2-input-field:focus {
          border-color: #f43f5e;
        }

        .n2-select-dropdown {
          background: #151a24;
          border: 1px solid #293246;
          border-radius: 12px;
          padding: 9px 12px;
          font-size: 12px;
          font-weight: 600;
          color: #ffffff;
          outline: none;
          cursor: pointer;
          width: 100%;
        }

        /* N x 2 Grid Layout: 2 Columns Wide */
        .exercise-grid-n2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

        .n2-exercise-card {
          background: #151a24;
          border: 1px solid #283248;
          border-radius: 16px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: all 0.2s ease;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          cursor: pointer;
          position: relative;
        }

        .n2-exercise-card.is-selected {
          border-color: #3b82f6;
          background: linear-gradient(135deg, #182438 0%, #111a2a 100%);
          box-shadow: 0 0 18px rgba(59, 130, 246, 0.35);
        }

        .n2-exercise-card:hover {
          border-color: #3b82f6;
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.6);
        }

        .n2-card-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .n2-bookmark-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #283248;
          padding: 5px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .n2-bookmark-btn:hover {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.4);
        }

        .n2-selected-badge {
          font-size: 10.5px;
          font-weight: 800;
          color: #60a5fa;
          background: rgba(59, 130, 246, 0.18);
          border: 1px solid rgba(59, 130, 246, 0.4);
          padding: 2px 8px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .n2-bottom-confirm-bar {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          background: #141924;
          border: 1px solid #3b82f6;
          border-radius: 16px;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          box-shadow: 0 10px 32px rgba(0, 0, 0, 0.7), 0 0 20px rgba(59, 130, 246, 0.35);
          animation: slideUpFade 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          width: calc(100% - 32px);
          max-width: 540px;
        }

        @keyframes slideUpFade {
          from {
            transform: translate(-50%, 20px);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }

        .n2-confirm-info {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1;
        }

        .n2-count-pill {
          background: #3b82f6;
          color: #ffffff;
          font-weight: 800;
          font-size: 13px;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .n2-confirm-text {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .n2-confirm-add-btn {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: 1px solid #60a5fa;
          color: #ffffff;
          font-size: 13px;
          font-weight: 800;
          padding: 9px 18px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .n2-confirm-add-btn:hover {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(59, 130, 246, 0.5);
        }

        .n2-gif-frame {
          width: 100%;
          height: 140px;
          background: #000000;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #222b3e;
        }

        .n2-gif-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #000000;
        }

        .n2-card-name {
          font-size: 13.5px;
          font-weight: 700;
          color: #ffffff;
          text-transform: capitalize;
          line-height: 1.3;
          height: 36px;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .n2-card-tags {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .tag-pill-part {
          background: rgba(244, 63, 94, 0.14);
          border: 1px solid rgba(244, 63, 94, 0.35);
          color: #fb7185;
          font-size: 9.5px;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 6px;
          text-transform: uppercase;
        }

        .tag-pill-eq {
          background: #252e42;
          border: 1px solid #33405c;
          color: #38bdf8;
          font-size: 9.5px;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 6px;
          text-transform: uppercase;
        }

        .n2-btn-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 2px;
        }

        .n2-info-btn {
          background: #1e2536;
          border: 1px solid #2b364e;
          color: #94a3b8;
          padding: 6px 9px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s ease;
        }

        .n2-info-btn:hover {
          color: #ffffff;
          background: #273146;
        }

        .n2-select-btn {
          flex: 1;
          background: rgba(244, 63, 94, 0.15);
          border: 1px solid rgba(244, 63, 94, 0.35);
          color: #f43f5e;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: all 0.2s ease;
        }

        .n2-select-btn:hover {
          background: #f43f5e;
          color: #ffffff;
        }

        .load-more-btn {
          width: 100%;
          background: linear-gradient(135deg, #1e2638, #161c2b);
          border: 1px solid #2e3952;
          color: #ffffff;
          padding: 14px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .load-more-btn:hover {
          background: #f43f5e;
          border-color: #f43f5e;
        }

        .success-toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10000;
          background: #10b981;
          color: #ffffff;
          padding: 10px 20px;
          border-radius: 9999px;
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.7);
        }

        @media (max-width: 540px) {
          .n2-filter-grid {
            grid-template-columns: 1fr;
          }
          .n2-gif-frame {
            height: 120px;
          }
        }
      `}</style>

      {/* Added success notification banner */}
      {addedSuccessName && (
        <div className="success-toast">
          <Check className="w-4 h-4 text-white" />
          <span>Added "{addedSuccessName}" to workout!</span>
          {onResumeWorkout && (
            <button
              onClick={onResumeWorkout}
              style={{
                marginLeft: '8px',
                background: '#ffffff',
                color: '#065f46',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Open Workout ➔
            </button>
          )}
        </div>
      )}

      {/* Top Controls Header & Filters */}
      <div className="n2-top-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h1 className="n2-main-title" style={{ margin: 0 }}>
            <Dumbbell className="w-6 h-6 text-rose-500" />
            Exercise Library {totalCount !== null ? `(${totalCount.toLocaleString()} Exercises)` : ''}
          </h1>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid #2d374e',
                color: '#ffffff',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Close Exercise Library"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        <div className="n2-filter-grid">
          
          {/* Search Field */}
          <div className="n2-search-box">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search exercise name (e.g. squat, bench)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="n2-input-field"
            />
          </div>

          {/* Body Part Selector */}
          <select
            value={bodyPart}
            onChange={(e) => setBodyPart(e.target.value)}
            className="n2-select-dropdown"
          >
            {BODY_PART_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Equipment Selector */}
          <select
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            className="n2-select-dropdown"
          >
            {EQUIPMENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

        </div>
      </div>

      {/* Loading state indicator */}
      {loading && exercises.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
          <RefreshCw className="w-6 h-6 text-rose-500 animate-spin inline mb-2" />
          <div>Fetching exercises from ExerciseDB...</div>
        </div>
      )}

      {/* N x 2 Grid Layout (2 Columns Wide) */}
      <div className="exercise-grid-n2">
        {sortedExercises.map((ex) => {
          const isSel = !!selectedExercisesMap[ex.exerciseId];
          const isBookmarked = !!bookmarkedIds[ex.exerciseId];

          return (
            <div
              key={ex.exerciseId}
              className={`n2-exercise-card ${isSel ? 'is-selected' : ''}`}
              onClick={() => toggleCardSelect(ex)}
            >
              {/* Top Header: Bookmark Icon & Selected Badge */}
              <div className="n2-card-top-bar">
                <button
                  type="button"
                  className="n2-bookmark-btn"
                  onClick={(e) => toggleBookmark(ex.exerciseId, e)}
                  title={isBookmarked ? 'Bookmarked' : 'Bookmark Exercise'}
                >
                  <Bookmark
                    className={`w-4 h-4 ${
                      isBookmarked ? 'text-amber-400 fill-amber-400' : 'text-slate-500 hover:text-amber-400'
                    }`}
                  />
                </button>

                {isSel && (
                  <span className="n2-selected-badge">
                    <Check className="w-3.5 h-3.5" /> Selected
                  </span>
                )}
              </div>

              {/* Animated GIF Preview graphics */}
              <div className="n2-gif-frame">
                <img
                  src={ex.gifUrl}
                  alt={ex.name}
                  className="n2-gif-img"
                  loading="lazy"
                />
              </div>

              {/* Exercise Name */}
              <div className="n2-card-name">{ex.name}</div>

              {/* Body Part & Equipment Badges */}
              <div className="n2-card-tags">
                {ex.bodyParts && ex.bodyParts[0] && (
                  <span className="tag-pill-part">{ex.bodyParts[0]}</span>
                )}
                {ex.equipments && ex.equipments[0] && (
                  <span className="tag-pill-eq">{ex.equipments[0]}</span>
                )}
              </div>

              {/* Form Steps Info Button */}
              <div className="n2-btn-row">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedExerciseModal(ex);
                  }}
                  className="n2-info-btn"
                  style={{ width: '100%', justifyContent: 'center' }}
                  title="View Steps & Form Instructions"
                >
                  <Info className="w-3.5 h-3.5" /> Form Steps & Instructions
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Load More Exercises Button (Fetches all 1,500+ from ExerciseDB API) */}
      {hasNextPage && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="load-more-btn"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
              Loading More Exercises...
            </>
          ) : (
            <>
              <Layers className="w-4 h-4 text-rose-400" />
              Load More Exercises (1,500+ Total DB)
            </>
          )}
        </button>
      )}

      {!loading && exercises.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontStyle: 'italic' }}>
          No exercises found matching your filter criteria.
        </div>
      )}

      {/* Floating Bottom Confirm Bar (Appears when N exercises are selected) */}
      {selectedList.length > 0 && (
        <div className="n2-bottom-confirm-bar">
          <div className="n2-confirm-info">
            <span className="n2-count-pill">{selectedList.length}</span>
            <span className="n2-confirm-text">
              {selectedList.length === 1 ? '1 Exercise Selected' : `${selectedList.length} Exercises Selected`}
            </span>
          </div>

          <button
            type="button"
            onClick={handleConfirmAddExercises}
            className="n2-confirm-add-btn"
          >
            Add {selectedList.length} {selectedList.length === 1 ? 'Exercise' : 'Exercises'}
          </button>
        </div>
      )}

      {/* Exercise Instructions Details Modal */}
      {selectedExerciseModal && (
        <div className="modal-backdrop" onClick={() => setSelectedExerciseModal(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '600px', background: '#121622', border: '1px solid #283248' }}
          >
            <div className="modal-header">
              <div className="modal-date" style={{ color: '#ffffff', textTransform: 'capitalize', fontSize: '18px' }}>
                {selectedExerciseModal.name}
              </div>
              <button className="icon-btn" onClick={() => setSelectedExerciseModal(null)}>✕</button>
            </div>

            <div className="modal-body" style={{ gap: '14px' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <img
                  src={selectedExerciseModal.gifUrl}
                  alt={selectedExerciseModal.name}
                  style={{ width: '140px', height: '140px', borderRadius: '12px', background: '#000', objectFit: 'cover' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    <strong>Body Parts:</strong> {selectedExerciseModal.bodyParts?.join(', ') || 'N/A'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    <strong>Equipment:</strong> {selectedExerciseModal.equipments?.join(', ') || 'N/A'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    <strong>Target Muscle:</strong> {selectedExerciseModal.targetMuscles?.join(', ') || 'N/A'}
                  </div>
                  {selectedExerciseModal.secondaryMuscles && selectedExerciseModal.secondaryMuscles.length > 0 && (
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      <strong>Secondary:</strong> {selectedExerciseModal.secondaryMuscles.join(', ')}
                    </div>
                  )}
                </div>
              </div>

              {selectedExerciseModal.instructions && selectedExerciseModal.instructions.length > 0 && (
                <div>
                  <h4 style={{ color: '#ffffff', fontSize: '14px', margin: '0 0 8px', textTransform: 'uppercase' }}>
                    Instructions & Form Steps:
                  </h4>
                  <ol style={{ margin: 0, paddingLeft: '20px', color: '#cbd5e1', fontSize: '12.5px', lineHeight: 1.6 }}>
                    {selectedExerciseModal.instructions.map((step, idx) => (
                      <li key={idx} style={{ marginBottom: '6px' }}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setSelectedExerciseModal(null)}>Close</button>
              <button
                className="btn-primary"
                onClick={() => {
                  handleSelect(selectedExerciseModal);
                  setSelectedExerciseModal(null);
                }}
              >
                Select Exercise for Workout
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
