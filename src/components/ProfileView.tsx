import React, { useState } from 'react';
import { Trophy, Download, Flame, Dumbbell } from 'lucide-react';
import type { WorkoutEntry } from '../types/workout';
import { DisciplineTracker } from './DisciplineTracker';
import { DataExportImport } from './DataExportImport';

export interface PREntry {
  id: string;
  lift: string;
  weight: number;
  unit: string;
  reps: number;
  date: string;
  note?: string;
}

interface ProfileViewProps {
  prLog: PREntry[];
  workoutEntries: WorkoutEntry[];
  onImportData: (entries: WorkoutEntry[]) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  prLog,
  workoutEntries,
  onImportData,
}) => {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const lifts = ['Squat', 'Bench Press', 'Deadlift', 'Dumbbell Bench Press'];

  return (
    <div className="profile-view-container">
      <style>{`
        .profile-view-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 16px 14px 100px;
          font-family: 'Inter', sans-serif;
          color: #edeae2;
        }

        .profile-card {
          background: #181c24;
          border: 1px solid #2a303c;
          border-radius: 18px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .profile-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }

        .profile-user-info {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .athlete-avatar-badge {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: linear-gradient(135deg, #c1432e, #8f2b1b);
          border: 2px solid #e2553b;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Oswald', sans-serif;
          font-weight: 700;
          font-size: 20px;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(193, 67, 46, 0.4);
          flex-shrink: 0;
        }

        .profile-name {
          font-family: 'Oswald', sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .profile-sub {
          font-size: 13px;
          color: #94a3b8;
          margin-top: 2px;
        }

        .profile-badges {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
          flex-wrap: wrap;
        }

        .badge-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .badge-streak {
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: #fbbf24;
        }

        .badge-micro {
          background: rgba(193, 67, 46, 0.15);
          border: 1px solid rgba(193, 67, 46, 0.3);
          color: #f87171;
        }

        .backup-btn {
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #34d399;
          padding: 8px 16px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
          font-family: 'Inter', sans-serif;
        }

        .backup-btn:hover {
          background: rgba(16, 185, 129, 0.22);
          color: #6ee7b7;
        }

        .section-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .section-title {
          font-family: 'Oswald', sans-serif;
          font-size: 16px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
        }

        .pr-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
        }

        .pr-item-card {
          background: #202634;
          border: 1px solid #2c3446;
          border-radius: 14px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .pr-item-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #94a3b8;
        }

        .pr-item-weight {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 26px;
          font-weight: 700;
          color: #fbbf24;
          line-height: 1;
        }

        .pr-item-unit {
          font-size: 13px;
          color: #94a3b8;
          font-weight: 400;
        }

        .pr-item-details {
          font-size: 11px;
          color: #64748b;
          font-family: 'IBM Plex Mono', monospace;
        }

        .pr-empty-text {
          font-size: 12px;
          color: #64748b;
          font-style: italic;
          padding: 4px 0;
        }

        @media (max-width: 600px) {
          .profile-view-container {
            padding: 12px 10px 90px;
          }
          .profile-card {
            padding: 16px;
          }
          .pr-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .pr-item-weight {
            font-size: 22px;
          }
        }
      `}</style>

      {/* Profile Card Header */}
      <div className="profile-card">
        <div className="profile-header-row">
          <div className="profile-user-info">
            {/* Athletic Initial Avatar Badge (NO GIRL PHOTO) */}
            <div className="athlete-avatar-badge">
              MPB
            </div>

            <div>
              <h1 className="profile-name">Project MPB</h1>
              <div className="profile-sub">Powerlifting & Hypertrophy Athlete</div>
              
              <div className="profile-badges">
                <span className="badge-pill badge-streak">
                  <Flame className="w-3.5 h-3.5 fill-amber-400" />
                  12 Day Streak
                </span>
                <span className="badge-pill badge-micro">
                  <Dumbbell className="w-3.5 h-3.5" />
                  Microcycle 37 Active
                </span>
              </div>
            </div>
          </div>

          <button onClick={() => setIsExportOpen(true)} className="backup-btn">
            <Download className="w-4 h-4" />
            Backup / Import Data
          </button>
        </div>
      </div>

      {/* PR Records Shelf Section */}
      <div className="profile-card">
        <div className="section-title-row">
          <h2 className="section-title">
            <Trophy className="w-5 h-5 text-amber-400" />
            Personal Record Shelf ({prLog.length} PRs)
          </h2>
          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>
            1RM Records
          </span>
        </div>

        <div className="pr-grid">
          {lifts.map((lift) => {
            const entries = prLog.filter((p) => p.lift === lift);
            const best = entries.reduce<PREntry | null>(
              (acc, e) => (!acc || e.weight >= acc.weight ? e : acc),
              null
            );

            return (
              <div key={lift} className="pr-item-card">
                <div className="pr-item-label">{lift}</div>
                {best ? (
                  <>
                    <div className="pr-item-weight">
                      {best.weight} <span className="pr-item-unit">{best.unit}</span>
                    </div>
                    <div className="pr-item-details">
                      ×{best.reps} reps · {best.date}
                    </div>
                  </>
                ) : (
                  <div className="pr-empty-text">No PR logged</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Discipline Tracker Focus */}
      <div className="profile-card">
        <DisciplineTracker />
      </div>

      {/* Data Backup Modal */}
      <DataExportImport
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        entries={workoutEntries}
        onImportData={onImportData}
      />

    </div>
  );
};
