import React from 'react';
import { Home, Dumbbell, Search, User, Menu, X, Play, Clock, CalendarRange } from 'lucide-react';

export type TabType = 'home' | 'periodisation' | 'exercises' | 'explore' | 'you';

interface SidebarNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onStartWorkout: () => void;
  isWorkoutMinimized?: boolean;
  activeWorkoutTitle?: string;
  onResumeWorkout?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const NavHeaderButton: React.FC<{ onClick: () => void; className?: string }> = ({ onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-nav-hamburger-btn ${className}`}
    title="Open Navigation Menu"
    aria-label="Open Navigation Menu"
  >
    <Menu className="w-5 h-5 text-white" />
  </button>
);

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onSelectTab,
  onStartWorkout,
  isWorkoutMinimized = false,
  onResumeWorkout,
  isOpen,
  onClose,
}) => {
  const handleTabClick = (tab: TabType) => {
    onSelectTab(tab);
    onClose(); // Auto-retract menu drawer on selection
  };

  return (
    <>
      <style>{`
        /* Embedded inline hamburger menu button style */
        .inline-nav-hamburger-btn {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid #2d374e;
          color: #ffffff;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .inline-nav-hamburger-btn:hover {
          background: #f43f5e;
          border-color: #f43f5e;
          transform: scale(1.04);
        }

        /* Dark Backdrop overlay when drawer is open */
        .sidebar-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9998;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.25s ease;
        }

        .sidebar-backdrop-open {
          opacity: 1;
          pointer-events: auto;
        }

        /* Retractable Sidebar Drawer */
        .sidebar-drawer {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 280px;
          z-index: 9999;
          background: #0f1420;
          border-right: 1px solid #232c3d;
          display: flex;
          flex-direction: column;
          box-shadow: 10px 0 36px rgba(0, 0, 0, 0.85);
          transform: translateX(-100%);
          transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .sidebar-drawer-open {
          transform: translateX(0);
        }

        .drawer-header {
          padding: 20px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #1c2434;
        }

        .drawer-brand {
          font-family: 'Oswald', sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .drawer-close-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid #2a344a;
          color: #94a3b8;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .drawer-close-btn:hover {
          background: rgba(244, 63, 94, 0.2);
          color: #f43f5e;
          border-color: #f43f5e;
        }

        .drawer-menu-list {
          padding: 18px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
          overflow-y: auto;
        }

        .drawer-nav-item {
          background: none;
          border: 1px solid transparent;
          outline: none;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 16px;
          border-radius: 14px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
          width: 100%;
        }

        .drawer-nav-item:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #ffffff;
        }

        .drawer-nav-item-active {
          background: rgba(244, 63, 94, 0.15) !important;
          color: #f43f5e !important;
          font-weight: 700 !important;
          border-color: rgba(244, 63, 94, 0.3) !important;
        }

        .drawer-footer-action {
          padding: 18px;
          border-top: 1px solid #1c2434;
        }

        .drawer-start-btn {
          width: 100%;
          background: #ffffff;
          color: #0f172a;
          border: none;
          border-radius: 14px;
          padding: 12px;
          font-family: 'Inter', sans-serif;
          font-size: 13.5px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 16px rgba(255, 255, 255, 0.2);
        }

        .drawer-start-btn:hover {
          background: #f8fafc;
          transform: translateY(-1px);
        }

        /* Floating Minimized Live Session Pill Button */
        .minimized-live-pill {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 9990;
          background: linear-gradient(135deg, #1e1b4b, #0f172a);
          color: #38bdf8;
          border: 1px solid #6366f1;
          border-radius: 9999px;
          padding: 10px 18px;
          font-family: 'Inter', sans-serif;
          font-size: 12.5px;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(99, 102, 241, 0.3);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .minimized-live-pill:hover {
          transform: translateY(-2px);
          background: linear-gradient(135deg, #2e2a72, #1e1b4b);
          color: #7dd3fc;
        }

        @media (max-width: 480px) {
          .minimized-live-pill {
            bottom: 16px;
            right: 14px;
            padding: 9px 14px;
            font-size: 11.5px;
          }
        }
      `}</style>

      {/* Backdrop overlay */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'sidebar-backdrop-open' : ''}`}
        onClick={onClose}
      />

      {/* Retractable Sidebar Drawer Menu */}
      <aside className={`sidebar-drawer ${isOpen ? 'sidebar-drawer-open' : ''}`}>
        
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-brand">
            <Dumbbell className="w-6 h-6 text-rose-500" />
            <span>Iron Ledger</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="drawer-close-btn"
            title="Retract Menu"
            aria-label="Retract Menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items List */}
        <nav className="drawer-menu-list">
          
          {/* 1. Home */}
          <button
            type="button"
            onClick={() => handleTabClick('home')}
            className={`drawer-nav-item ${activeTab === 'home' ? 'drawer-nav-item-active' : ''}`}
          >
            <Home className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <span>Home</span>
          </button>

          {/* 2. Periodisation Settings */}
          <button
            type="button"
            onClick={() => handleTabClick('periodisation')}
            className={`drawer-nav-item ${activeTab === 'periodisation' ? 'drawer-nav-item-active' : ''}`}
          >
            <CalendarRange className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span>Periodisation Settings</span>
          </button>

          {/* 3. Exercise Library (Kanban Board) */}
          <button
            type="button"
            onClick={() => handleTabClick('exercises')}
            className={`drawer-nav-item ${activeTab === 'exercises' ? 'drawer-nav-item-active' : ''}`}
          >
            <Dumbbell className="w-5 h-5 text-sky-400 flex-shrink-0" />
            <span>Exercise Kanban Library</span>
          </button>

          {/* 4. Explore (Analytics) */}
          <button
            type="button"
            onClick={() => handleTabClick('explore')}
            className={`drawer-nav-item ${activeTab === 'explore' ? 'drawer-nav-item-active' : ''}`}
          >
            <Search className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>Explore & Analytics</span>
          </button>

          {/* 5. You (Profile & PRs) */}
          <button
            type="button"
            onClick={() => handleTabClick('you')}
            className={`drawer-nav-item ${activeTab === 'you' ? 'drawer-nav-item-active' : ''}`}
          >
            <User className="w-5 h-5 text-indigo-400 flex-shrink-0" />
            <span>Athlete Profile & PRs</span>
          </button>

        </nav>

        {/* Start / Resume Live Workout Action inside Drawer */}
        <div className="drawer-footer-action">
          {isWorkoutMinimized ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onResumeWorkout) onResumeWorkout();
              }}
              className="drawer-start-btn"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#ffffff' }}
            >
              <Clock className="w-4 h-4 text-white animate-spin flex-shrink-0" style={{ animationDuration: '4s' }} />
              <span>Resume Live Workout</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartWorkout();
              }}
              className="drawer-start-btn"
            >
              <Play className="w-3.5 h-3.5 fill-slate-900 text-slate-900 flex-shrink-0" />
              <span>Start New Workout</span>
            </button>
          )}
        </div>

      </aside>
    </>
  );
};
