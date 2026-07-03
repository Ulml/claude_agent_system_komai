/**
 * TopBar — fixed glass header (h-16, z-50) present on every page.
 * Brand identity, back navigation from agent pages, active project title,
 * current-user switcher (perimeter demo) and settings trigger.
 */
import React from 'react';
import { ChevronLeft, Settings, UserRound } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

const TopBar: React.FC = () => {
  const { theme, t, view, setView, projects, selectedProjectId, agents, currentUserId, setCurrentUserId, setIsSettingsOpen } =
    useApp();

  const activeProject = projects.find((p) => p.id === selectedProjectId);
  const openAgent = view.kind === 'agent' ? agents.find((a) => a.id === view.agentId) : null;
  const humans = agents.filter((a) => a.kind === 'human');
  const currentUser = humans.find((h) => h.id === currentUserId);

  return (
    <header
      className={`fixed top-0 inset-x-0 h-16 z-50 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 ${theme.glassBg} border-b ${theme.glassBorder}`}
    >
      <div className="flex items-center gap-3">
        {openAgent && (
          <button
            onClick={() => setView({ kind: 'tab', tab: 'HOME' })}
            aria-label={t.back}
            className={`p-2 rounded-full ${theme.glassHover} ${theme.primaryText} transition-colors`}
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
        )}
        <h1 className={`text-xl font-bold tracking-tight ${theme.primaryText}`}>
          {t.appName}
          <span className={`hidden sm:inline ml-2 text-[11px] font-bold uppercase tracking-wider ${theme.mutedText}`}>
            {t.appTagline}
          </span>
        </h1>
      </div>

      {/* Center: active project / open agent */}
      <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none hidden md:block">
        <p className={`text-sm font-bold uppercase tracking-wide ${theme.primaryText}`}>
          {openAgent ? openAgent.name : activeProject?.title ?? ''}
        </p>
        <p className={`text-[11px] uppercase tracking-wider ${theme.mutedText}`}>
          {openAgent ? openAgent.tagline : activeProject?.description.slice(0, 60) ?? ''}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* Perimeter demo: switch the current human (each human is an agent). */}
        <label className="flex items-center gap-1.5">
          <UserRound size={14} className={theme.mutedText} aria-hidden />
          <span className="sr-only">{t.members}</span>
          <select
            value={currentUserId}
            onChange={(e) => setCurrentUserId(e.target.value)}
            aria-label={t.members}
            className={`text-xs font-medium bg-transparent rounded-lg px-1 py-1.5 cursor-pointer ${theme.primaryText}`}
          >
            {humans.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => setIsSettingsOpen(true)}
          aria-label={t.settings}
          title={currentUser ? `${t.settings} — ${currentUser.name}` : t.settings}
          className={`p-2.5 rounded-full ${theme.glassHover} ${theme.primaryText} transition-colors`}
        >
          <Settings size={17} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
};

export default TopBar;
