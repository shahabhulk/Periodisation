import React from 'react';
import { Home, Search, PlusCircle, CalendarRange, User, Play } from 'lucide-react';
import type { TabType } from './SidebarNav';

interface BottomFooterNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onStartWorkout: () => void;
  hideFloatingButton?: boolean;
  isWorkoutMinimized?: boolean;
  activeWorkoutTitle?: string;
  onResumeWorkout?: () => void;
}

export const BottomFooterNav: React.FC<BottomFooterNavProps> = ({
  activeTab,
  onSelectTab,
  onStartWorkout,
  hideFloatingButton = false,
  isWorkoutMinimized = false,
}) => {
  return (
    <>
      <style>{`
        .custom-footer-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          background: rgba(12, 16, 26, 0.96);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid #1e293b;
          padding: 8px 12px 10px;
          display: flex;
          align-items: center;
          justify-content: space-around;
          box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.7);
        }

        .custom-footer-inner {
          max-width: 480px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-around;
        }

        .footer-tab-btn {
          background: none;
          border: none;
          outline: none;
          color: #94a3b8;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          padding: 4px 10px;
          border-radius: 12px;
          transition: all 0.2s ease;
          user-select: none;
        }

        .footer-tab-btn:hover {
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.05);
        }

        .footer-tab-btn-active {
          color: #f43f5e !important;
          font-weight: 700 !important;
        }

        .floating-workout-pill {
          position: fixed;
          bottom: 72px;
          right: 20px;
          z-index: 10000;
          background: #ffffff;
          color: #0f172a;
          border: 1px solid #e2e8f0;
          border-radius: 9999px;
          padding: 10px 18px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: -0.2px;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.7), 0 2px 8px rgba(255, 255, 255, 0.3);
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
        }

        .floating-workout-pill:hover {
          transform: translateY(-2px) scale(1.02);
          background: #f8fafc;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.8), 0 4px 12px rgba(255, 255, 255, 0.4);
        }

        .floating-workout-pill:active {
          transform: translateY(0) scale(0.97);
        }

        .floating-workout-pill-live {
          background: linear-gradient(135deg, #1e1b4b, #0f172a);
          color: #38bdf8;
          border: 1px solid #6366f1;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(99, 102, 241, 0.3);
        }

        .floating-workout-pill-live:hover {
          background: linear-gradient(135deg, #2e2a72, #1e1b4b);
          color: #7dd3fc;
        }

        .pill-play-icon {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #0f172a;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media (max-width: 480px) {
          .floating-workout-pill {
            bottom: 68px;
            right: 14px;
            padding: 9px 15px;
            font-size: 12px;
          }
        }
      `}</style>

      {/* Floating Pill Action Button: Start new workout */}
      {!hideFloatingButton && !isWorkoutMinimized && (
        <button onClick={onStartWorkout} className="floating-workout-pill">
          <div className="pill-play-icon">
            <Play className="w-2.5 h-2.5 fill-white text-white ml-0.5" />
          </div>
          <span>Start new workout</span>
        </button>
      )}

      {/* Bottom Navigation Bar */}
      <footer className="custom-footer-nav">
        <div className="custom-footer-inner">
          
          {/* 1. Home Tab */}
          <button
            onClick={() => onSelectTab('home')}
            className={`footer-tab-btn ${activeTab === 'home' ? 'footer-tab-btn-active' : ''}`}
          >
            <Home className="w-5 h-5 stroke-[1.8px]" />
            <span>Home</span>
          </button>

          {/* 2. Explore Tab */}
          <button
            onClick={() => onSelectTab('explore')}
            className={`footer-tab-btn ${activeTab === 'explore' ? 'footer-tab-btn-active' : ''}`}
          >
            <Search className="w-5 h-5 stroke-[1.8px]" />
            <span>Explore</span>
          </button>

          {/* 3. Workout Tab */}
          <button onClick={onStartWorkout} className="footer-tab-btn">
            <PlusCircle className="w-5 h-5 stroke-[2.2px]" />
            <span>Workout</span>
          </button>

          {/* 4. Periodisation Tab */}
          <button
            onClick={() => onSelectTab('periodisation')}
            className={`footer-tab-btn ${activeTab === 'periodisation' ? 'footer-tab-btn-active' : ''}`}
          >
            <CalendarRange className="w-5 h-5 stroke-[1.8px]" />
            <span>Periodisation</span>
          </button>

          {/* 5. You Tab -> Opens Profile Page & PR Shelf */}
          <button
            onClick={() => onSelectTab('you')}
            className={`footer-tab-btn ${activeTab === 'you' ? 'footer-tab-btn-active' : ''}`}
          >
            <User className="w-5 h-5 stroke-[1.8px]" />
            <span>You</span>
          </button>

        </div>
      </footer>
    </>
  );
};
