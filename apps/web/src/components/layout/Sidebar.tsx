/**
 * Sidebar — auto-retracting project drawer along the left edge.
 * A narrow touchpoint expands to w-72 on hover/focus; on touch devices it is
 * toggled by the handle button (hover is not available). Lists projects,
 * lock toggles and the "new project" trigger.
 */
import React, { useState } from 'react';
import { FolderKanban, Lock, LockOpen, PanelLeft, Plus } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { MicroLabel } from '@/components/ui/Glass';

const Sidebar: React.FC = () => {
  const {
    theme,
    t,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    toggleProjectLock,
    setIsProjectModalOpen,
    setView,
  } = useApp();
  const [pinnedOpen, setPinnedOpen] = useState(false);

  /** Collapse the drawer: unpin AND drop focus so :focus-within releases. */
  const collapse = () => {
    setPinnedOpen(false);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const selectProject = (id: string, isLocked: boolean) => {
    if (isLocked) {
      // Simple access-code gate (biometric simulation from the prototype).
      const code = window.prompt(t.enterCode);
      if (!code) return;
    }
    setSelectedProjectId(id);
    // A selected project lands on its HOME desktop; the drawer retracts.
    setView({ kind: 'tab', tab: 'HOME' });
    collapse();
  };

  return (
    <div className={`group fixed left-0 top-16 bottom-0 z-40 flex ${pinnedOpen ? 'w-72' : 'w-5 hover:w-72 focus-within:w-72'} transition-all duration-300`}>
      {/* Toggle handle: keeps the drawer usable on touch screens. */}
      <button
        onClick={() => setPinnedOpen((v) => !v)}
        aria-label={t.projects}
        aria-expanded={pinnedOpen}
        className={`absolute top-3 left-1 z-10 p-1.5 rounded-full ${theme.glassHover} ${theme.mutedText}`}
      >
        <PanelLeft size={14} aria-hidden />
      </button>

      <aside
        aria-label={t.projects}
        className={`w-72 h-full backdrop-blur-xl ${theme.glassBg} border-r ${theme.glassBorder} p-4 pt-12 flex flex-col gap-3 transition-transform duration-300 ${
          pinnedOpen ? 'translate-x-0' : '-translate-x-full group-hover:translate-x-0 group-focus-within:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between">
          <MicroLabel>{t.projects}</MicroLabel>
          <button
            onClick={() => {
              setIsProjectModalOpen(true);
              collapse();
            }}
            aria-label={t.newProject}
            className={`p-1.5 rounded-full ${theme.glassHover} ${theme.primaryText}`}
          >
            <Plus size={15} aria-hidden />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5" aria-label={t.projects}>
          {projects.map((p) => (
            <div
              key={p.id}
              className={`flex items-start gap-2 rounded-2xl p-3 transition-colors ${
                p.id === selectedProjectId ? theme.iconBg : theme.glassHover
              }`}
            >
              <FolderKanban size={16} className={`mt-0.5 shrink-0 ${theme.mutedText}`} aria-hidden />
              <button onClick={() => selectProject(p.id, p.isLocked)} className="flex-1 text-left min-w-0">
                <p className={`text-sm font-semibold truncate ${theme.primaryText}`}>{p.title}</p>
                <p className={`text-xs truncate ${theme.mutedText}`}>{p.description}</p>
              </button>
              <button
                onClick={() => toggleProjectLock(p.id)}
                aria-label={`${t.lockedProject}: ${p.title}`}
                aria-pressed={p.isLocked}
                className={`p-1.5 rounded-full ${theme.glassHover} ${theme.mutedText}`}
              >
                {p.isLocked ? <Lock size={13} aria-hidden /> : <LockOpen size={13} aria-hidden />}
              </button>
            </div>
          ))}
        </nav>
      </aside>
    </div>
  );
};

export default Sidebar;
