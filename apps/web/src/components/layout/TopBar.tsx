/**
 * TopBar — fixed glass header (h-16, z-50) present on every page.
 * Brand identity, contextual back arrow (top-left), the signed-in user with
 * an Invite action, and settings. When the in-page agent title scrolls out
 * of view, the agent's name appears here.
 */
import React, { useState } from 'react';
import { ChevronLeft, Settings, UserPlus } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import InviteModal from '@/components/modals/InviteModal';

const TopBar: React.FC = () => {
  const {
    theme,
    t,
    view,
    agents,
    projects,
    selectedProjectId,
    currentUserId,
    goBack,
    canGoBack,
    agentTitleHidden,
    accessRequests,
    setIsSettingsOpen,
  } = useApp();
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const activeProject = projects.find((p) => p.id === selectedProjectId);
  const openAgent = view.kind === 'agent' ? agents.find((a) => a.id === view.agentId) : null;
  const currentUser = agents.find((a) => a.id === currentUserId);

  // The agent name shows in the bar only once its in-page title scrolled away.
  const centerTitle = openAgent && agentTitleHidden ? openAgent.name : activeProject && !openAgent ? activeProject.title : '';

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 h-16 z-50 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 ${theme.glassBg} border-b ${theme.glassBorder}`}
      >
        <div className="flex items-center gap-3">
          {canGoBack && (
            <button
              onClick={goBack}
              aria-label={t.back}
              className={`p-2 rounded-full ${theme.glassHover} ${theme.primaryText} transition-colors`}
            >
              <ChevronLeft size={18} strokeWidth={2} />
            </button>
          )}
          <h1 className={`text-xl font-bold tracking-tight ${theme.primaryText}`}>{t.appName}</h1>
        </div>

        {/* Center: scroll-revealed agent name / active project */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none hidden md:block">
          <p className={`text-sm font-bold uppercase tracking-wide transition-opacity ${theme.primaryText} ${centerTitle ? 'opacity-100' : 'opacity-0'}`}>
            {centerTitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`hidden sm:inline text-xs font-medium ${theme.mutedText}`}>
            {t.loggedInAs} <span className={theme.primaryText}>{currentUser?.name}</span>
          </span>
          <button
            onClick={() => setIsInviteOpen(true)}
            aria-label={t.invite}
            title={t.invite}
            className={`relative p-2.5 rounded-full ${theme.glassHover} ${theme.primaryText} transition-colors`}
          >
            <UserPlus size={17} strokeWidth={2} />
            {accessRequests.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {accessRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            aria-label={t.settings}
            className={`p-2.5 rounded-full ${theme.glassHover} ${theme.primaryText} transition-colors`}
          >
            <Settings size={17} strokeWidth={2} />
          </button>
        </div>
      </header>

      <InviteModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} />
    </>
  );
};

export default TopBar;
