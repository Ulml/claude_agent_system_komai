/**
 * App — the shell of the AI Operating System.
 *
 * Layout (identical on every page, per the product spec):
 *   - TopBar (fixed glass header)
 *   - Auto-retracting project Sidebar
 *   - Center: the active view (agent desktop / task flow / agent page / KOMAÏ)
 *   - Bottom: the MetaChatDock — navigation tabs + the single chat window
 *     through which the user talks to every element of the system.
 */
import React from 'react';
import { AppProvider, useApp } from '@/contexts/AppContext';
import TopBar from '@/components/layout/TopBar';
import Sidebar from '@/components/layout/Sidebar';
import MetaChatDock from '@/components/chat/MetaChatDock';
import AgentDesktop from '@/components/desktop/AgentDesktop';
import FolderView from '@/components/desktop/FolderView';
import FluxView from '@/components/flux/FluxView';
import SystemView from '@/components/system/SystemView';
import VariablesView from '@/components/system/VariablesView';
import AgentPage from '@/components/agent/AgentPage';
import KomaCodingView from '@/components/koma/KomaCodingView';
import SettingsModal from '@/components/modals/SettingsModal';
import ProjectModal from '@/components/modals/ProjectModal';

const ActiveView: React.FC = () => {
  const { view, agents, openFolderId } = useApp();
  if (view.kind === 'agent') {
    const agent = agents.find((a) => a.id === view.agentId);
    // KOMAÏ Coding keeps its dedicated IDE architecture; every other agent
    // uses the standard tabbed page (tabs live in the dock).
    if (agent?.kind === 'coding') return <KomaCodingView />;
    if (agent) return <AgentPage agent={agent} />;
  }
  if (view.kind === 'tab' && view.tab === 'FLUX') return <FluxView />;
  if (view.kind === 'tab' && view.tab === 'SYSTEM') return <SystemView />;
  if (view.kind === 'tab' && view.tab === 'VARIABLES') return <VariablesView />;
  // HOME: a folder opened inline replaces the desktop (no visible difference);
  // the top-left arrow navigates back up.
  return openFolderId ? <FolderView /> : <AgentDesktop />;
};

const Shell: React.FC = () => {
  const { theme, t } = useApp();
  return (
    <div
      className="flex flex-col h-[100dvh] overflow-hidden transition-colors duration-500"
      style={{
        backgroundColor: theme.hex,
        backgroundImage: theme.gradient,
        backgroundSize: '100% 100%',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Accessibility: keyboard users can jump straight to the content. */}
      <a href="#main-content" className="skip-link">
        {t.skipToContent}
      </a>

      {/* Organic glow blob behind the glass layers */}
      <div
        aria-hidden
        className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] bg-white/10 rounded-full blur-[100px] pointer-events-none mix-blend-overlay"
      />

      <TopBar />
      <Sidebar />
      <SettingsModal />
      <ProjectModal />

      <main id="main-content" className="flex-1 flex flex-col pt-16 min-h-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar pl-5">
          <ActiveView />
        </div>
        <MetaChatDock />
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <AppProvider>
    <Shell />
  </AppProvider>
);

export default App;
