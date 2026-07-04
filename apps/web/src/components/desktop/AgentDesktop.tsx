/**
 * AgentDesktop — the OS home screen.
 *
 * Every persistent autonomous agent (and every human user, rendered with the
 * exact same card) appears as an icon in a bento grid. Agents can be grouped
 * into FOLDERS (iOS-style): a folder tile has the SAME rounded-square shape
 * as an agent tile, with its member agents rendered as miniatures inside.
 * Opening a folder reveals the full agent cards; clicking an agent opens its
 * dedicated page.
 */
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Panel, MicroLabel, StatusPill } from '@/components/ui/Glass';
import type { AgentFolder, AgentProfile } from '@/core/types';

/** Full agent card — used at top level AND inside an open folder (SSOT). */
const AgentCard: React.FC<{ agent: AgentProfile }> = ({ agent }) => {
  const { theme, t, setView, tasks } = useApp();
  const Icon = agent.icon;
  const runningTask = tasks.find((task) => task.agentId === agent.id && task.status === 'running');
  const status = runningTask ? 'working' : agent.status;
  return (
    <Panel className={`${theme.glassHover} transition-transform hover:scale-[1.02]`}>
      <button
        onClick={() => setView({ kind: 'agent', agentId: agent.id })}
        aria-label={`${t.openAgent}: ${agent.name}`}
        className="w-full h-full p-4 sm:p-5 flex flex-col items-start gap-3 text-left"
      >
        <span className={`p-3 rounded-2xl ${theme.iconBg}`}>
          <Icon size={22} strokeWidth={1.5} className={theme.primaryText} aria-hidden />
        </span>
        <span className="space-y-1 min-w-0 w-full">
          <span className={`block font-bold text-sm tracking-wide uppercase truncate ${theme.primaryText}`}>
            {agent.name}
          </span>
          <span className={`block text-xs leading-snug ${theme.mutedText}`}>{agent.tagline}</span>
        </span>
        <StatusPill status={status} />
      </button>
    </Panel>
  );
};

/**
 * Folder tile — same rounded square as an agent tile; the member agents
 * appear as a 2×2 grid of miniatures inside (max 4, then a "+n" chip).
 */
const FolderTile: React.FC<{ folder: AgentFolder }> = ({ folder }) => {
  const { theme, t, agents, setOpenFolderId } = useApp();
  const members = folder.agentIds
    .map((id) => agents.find((a) => a.id === id))
    .filter((a): a is AgentProfile => Boolean(a));
  const preview = members.slice(0, 4);
  const overflow = members.length - preview.length;

  return (
    <Panel className={`${theme.glassHover} transition-transform hover:scale-[1.02]`}>
      <button
        onClick={() => setOpenFolderId(folder.id)}
        aria-label={`${t.openFolder}: ${folder.name} (${members.length})`}
        aria-haspopup="dialog"
        className="w-full h-full p-4 sm:p-5 flex flex-col items-start gap-3 text-left"
      >
        {/* Miniature grid — the visual signature of a folder */}
        <span className={`p-2 rounded-2xl ${theme.iconBg} grid grid-cols-2 gap-1.5`} aria-hidden>
          {preview.map((agent, i) => {
            const MiniIcon = agent.icon;
            // The 4th slot shows "+n" when the folder holds more agents.
            if (i === 3 && overflow > 0) {
              return (
                <span
                  key="overflow"
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold ${theme.glassBg} ${theme.mutedText}`}
                >
                  +{overflow + 1}
                </span>
              );
            }
            return (
              <span key={agent.id} className={`w-6 h-6 rounded-lg flex items-center justify-center ${theme.glassBg}`}>
                <MiniIcon size={13} strokeWidth={1.5} className={theme.primaryText} />
              </span>
            );
          })}
          {/* Pad the mini-grid so lone agents still read as a folder */}
          {preview.length < 4 &&
            overflow === 0 &&
            Array.from({ length: 4 - preview.length }).map((_, i) => (
              <span key={`pad-${i}`} className={`w-6 h-6 rounded-lg ${theme.glassBg} opacity-40`} />
            ))}
        </span>
        <span className="space-y-1 min-w-0 w-full">
          <span className={`block font-bold text-sm tracking-wide uppercase truncate ${theme.primaryText}`}>
            {folder.name}
          </span>
          <span className={`block text-xs leading-snug ${theme.mutedText}`}>
            {t.folder} · {members.length} {t.agents.toLowerCase()}
          </span>
        </span>
      </button>
    </Panel>
  );
};

/** Open-folder overlay: full agent cards of the folder, dialog semantics. */
const FolderOverlay: React.FC<{ folder: AgentFolder }> = ({ folder }) => {
  const { theme, t, agents, setOpenFolderId } = useApp();
  const dialogRef = useRef<HTMLDivElement>(null);
  const members = folder.agentIds
    .map((id) => agents.find((a) => a.id === id))
    .filter((a): a is AgentProfile => Boolean(a));

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenFolderId(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setOpenFolderId]);

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={() => setOpenFolderId(null)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${t.folder}: ${folder.name}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[80vh] overflow-y-auto custom-scrollbar rounded-[2rem] p-5 space-y-4 backdrop-blur-2xl border ${theme.glassBorder} animate-fade-up`}
        style={{ backgroundColor: theme.isDark ? 'rgba(2,6,23,0.85)' : 'rgba(255,255,255,0.85)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-bold uppercase tracking-wide ${theme.primaryText}`}>{folder.name}</h3>
          <button
            onClick={() => setOpenFolderId(null)}
            aria-label={t.closeFolder}
            className={`p-2 rounded-full ${theme.glassHover} ${theme.primaryText}`}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {members.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
};

const AgentDesktop: React.FC = () => {
  const { t, agents, folders, openFolderId } = useApp();

  // Agents living inside a folder are not repeated at top level.
  const folderedIds = new Set(folders.flatMap((f) => f.agentIds));
  const topLevelAgents = agents.filter((a) => !folderedIds.has(a.id));
  const openFolder = folders.find((f) => f.id === openFolderId);

  return (
    <section aria-label={t.agents} className="w-full max-w-5xl mx-auto px-4 py-6 animate-fade-up">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <MicroLabel>{t.agents}</MicroLabel>
        <MicroLabel className="hidden sm:block text-right">{t.emptyDesktopHint}</MicroLabel>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {folders.map((folder) => (
          <FolderTile key={folder.id} folder={folder} />
        ))}
        {topLevelAgents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {openFolder && <FolderOverlay folder={openFolder} />}
    </section>
  );
};

export default AgentDesktop;
