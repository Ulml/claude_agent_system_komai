/**
 * AgentDesktop — the OS home screen.
 *
 * Every persistent autonomous agent (and every human user, rendered with the
 * exact same card) appears as an icon in a bento grid. Agents can be grouped
 * into FOLDERS (iOS-style): a folder tile has the SAME rounded-square shape
 * as an agent tile, with its member agents rendered as miniatures inside.
 *
 * The user can:
 *   - create their own folders (name + any agents) via the FolderModal;
 *   - designate any group of agents with the SELECTION mode, then either
 *     create a folder directly or ask the CURATOR agent for a meta-node;
 *   - ask the Curator for OS-wide grouping proposals (role / LLM platform /
 *     project activity logics) and accept or reject each meta-node.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, Folder, FolderPlus, FolderTree, MousePointer2, Trash2, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Panel, MicroLabel, StatusPill } from '@/components/ui/Glass';
import FolderModal from '@/components/modals/FolderModal';
import type { AgentFolder, AgentProfile } from '@/core/types';

/**
 * Full agent card — used at top level AND inside an open folder (SSOT).
 * In selection mode, clicking designates/undesignates the agent instead of
 * opening its page.
 */
const AgentCard: React.FC<{ agent: AgentProfile }> = ({ agent }) => {
  const { theme, t, setView, setOpenFolderId, tasks, isSelectionMode, selectedAgentIds, toggleAgentSelection } =
    useApp();
  const Icon = agent.icon;
  const runningTask = tasks.find((task) => task.agentId === agent.id && task.status === 'running');
  const status = runningTask ? 'working' : agent.status;
  const isSelected = selectedAgentIds.includes(agent.id);

  const openAgent = () => {
    // Close any open folder overlay so it doesn't sit above the agent page.
    setOpenFolderId(null);
    setView({ kind: 'agent', agentId: agent.id });
  };

  return (
    <Panel
      className={`${theme.glassHover} transition-transform hover:scale-[1.02] ${
        isSelectionMode && isSelected ? 'ring-2 ring-blue-500/70' : ''
      }`}
    >
      <button
        onClick={() => (isSelectionMode ? toggleAgentSelection(agent.id) : openAgent())}
        aria-label={isSelectionMode ? `${t.selectionMode}: ${agent.name}` : `${t.openAgent}: ${agent.name}`}
        aria-pressed={isSelectionMode ? isSelected : undefined}
        className="w-full h-full p-4 sm:p-5 flex flex-col items-start gap-3 text-left relative"
      >
        {isSelectionMode && (
          <span
            aria-hidden
            className={`absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center border ${
              isSelected ? 'bg-blue-600 border-blue-600 text-white' : `${theme.glassBorder} ${theme.glassBg}`
            }`}
          >
            {isSelected && <Check size={12} />}
          </span>
        )}
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
  const { theme, t, agents, folders, setOpenFolderId } = useApp();
  // Effective members include agents of nested sub-folders, so a parent
  // folder's tile previews everything it contains.
  const collectAgentIds = (f: AgentFolder): string[] => [
    ...f.agentIds,
    ...folders.filter((child) => child.parentId === f.id).flatMap(collectAgentIds),
  ];
  const subFolderCount = folders.filter((child) => child.parentId === folder.id).length;
  const members = collectAgentIds(folder)
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
            {subFolderCount > 0 && ` · ${subFolderCount} ${t.subFolders}`}
          </span>
        </span>
      </button>
    </Panel>
  );
};

/**
 * Open-folder overlay: sub-folder tiles first, then full agent cards.
 * Opening a sub-folder navigates within the overlay; the back chevron
 * returns to the parent folder.
 */
const FolderOverlay: React.FC<{ folder: AgentFolder }> = ({ folder }) => {
  const { theme, t, agents, folders, setOpenFolderId, deleteFolder } = useApp();
  const dialogRef = useRef<HTMLDivElement>(null);
  const members = folder.agentIds
    .map((id) => agents.find((a) => a.id === id))
    .filter((a): a is AgentProfile => Boolean(a));
  const subFolders = folders.filter((f) => f.parentId === folder.id);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenFolderId(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setOpenFolderId, folder.id]);

  // Portaled to <body> so the fixed overlay escapes the scroll container's
  // containing block and reliably layers above the fixed TopBar.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
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
        {/* Sticky so the back/delete/close controls stay reachable even when
            the folder holds many agents and the content scrolls. */}
        <div
          className="flex items-center justify-between gap-2 sticky top-0 -mx-5 -mt-5 px-5 py-3 z-10 rounded-t-[2rem] backdrop-blur-2xl"
          style={{ backgroundColor: theme.isDark ? 'rgba(2,6,23,0.85)' : 'rgba(255,255,255,0.85)' }}
        >
          <div className="flex items-center gap-1 min-w-0">
            {folder.parentId && (
              <button
                onClick={() => setOpenFolderId(folder.parentId!)}
                aria-label={t.back}
                className={`p-2 rounded-full shrink-0 ${theme.glassHover} ${theme.primaryText}`}
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
            )}
            <h3 className={`text-sm font-bold uppercase tracking-wide truncate ${theme.primaryText}`}>
              {folder.name}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => deleteFolder(folder.id)}
              aria-label={`${t.deleteFolder}: ${folder.name}`}
              className={`p-2 rounded-full ${theme.glassHover} ${theme.mutedText}`}
            >
              <Trash2 size={15} aria-hidden />
            </button>
            <button
              onClick={() => setOpenFolderId(null)}
              aria-label={t.closeFolder}
              className={`p-2 rounded-full ${theme.glassHover} ${theme.primaryText}`}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        </div>

        {subFolders.length > 0 && (
          <nav aria-label={t.subFolders} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {subFolders.map((sub) => {
              const count =
                sub.agentIds.length +
                folders.filter((f) => f.parentId === sub.id).reduce((n, f) => n + f.agentIds.length, 0);
              return (
                <Panel key={sub.id} className={theme.glassHover}>
                  <button
                    onClick={() => setOpenFolderId(sub.id)}
                    aria-label={`${t.openFolder}: ${sub.name} (${count})`}
                    className="w-full p-4 flex flex-col items-start gap-2 text-left"
                  >
                    <span className={`p-2.5 rounded-2xl ${theme.iconBg}`}>
                      <Folder size={18} strokeWidth={1.5} className={theme.primaryText} aria-hidden />
                    </span>
                    <span className={`block font-bold text-sm tracking-wide uppercase truncate w-full ${theme.primaryText}`}>
                      {sub.name}
                    </span>
                    <span className={`text-xs ${theme.mutedText}`}>
                      {count} {t.agents.toLowerCase()}
                    </span>
                  </button>
                </Panel>
              );
            })}
          </nav>
        )}

        {members.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {members.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

/** Curator proposal cards: one per meta-node, with accept/reject actions. */
const ProposalsPanel: React.FC = () => {
  const { theme, t, agents, proposals, acceptProposal, rejectProposal, resolveProposalName } =
    useApp();
  if (proposals.length === 0) return null;

  return (
    <section aria-label={t.curatorProposals} className="mb-5 space-y-3">
      <MicroLabel className="flex items-center gap-1.5">
        <FolderTree size={12} aria-hidden /> {t.curatorProposals}
      </MicroLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {proposals.map((p) => {
          const members = p.agentIds
            .map((id) => agents.find((a) => a.id === id))
            .filter((a): a is AgentProfile => Boolean(a));
          return (
            <Panel key={p.id} className="p-4 space-y-3">
              <div>
                <p className={`text-sm font-bold uppercase tracking-wide ${theme.primaryText}`}>
                  {resolveProposalName(p)}
                </p>
                <p className={`text-xs ${theme.mutedText}`}>{t[p.rationaleKey]}</p>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const MiniIcon = m.icon;
                  return (
                    <li
                      key={m.id}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${theme.iconBg} ${theme.secondaryText}`}
                    >
                      <MiniIcon size={12} strokeWidth={1.5} aria-hidden />
                      {m.name}
                    </li>
                  );
                })}
              </ul>
              <div className="flex gap-2">
                <button
                  onClick={() => acceptProposal(p.id)}
                  className={`flex items-center gap-1.5 px-4 min-h-[40px] rounded-full text-xs font-bold uppercase tracking-wider ${theme.userBubble}`}
                >
                  <Check size={13} aria-hidden /> {t.accept}
                </button>
                <button
                  onClick={() => rejectProposal(p.id)}
                  className={`flex items-center gap-1.5 px-4 min-h-[40px] rounded-full text-xs font-bold uppercase tracking-wider ${theme.secondaryText} ${theme.glassHover}`}
                >
                  <X size={13} aria-hidden /> {t.reject}
                </button>
              </div>
            </Panel>
          );
        })}
      </div>
    </section>
  );
};

const AgentDesktop: React.FC = () => {
  const {
    theme,
    t,
    agents,
    folders,
    openFolderId,
    isSelectionMode,
    setIsSelectionMode,
    selectedAgentIds,
    requestCuratorProposals,
  } = useApp();
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  // Agents living inside any folder (any depth) are not repeated at top
  // level, and only ROOT folders (no parentId) tile the desktop.
  const folderedIds = new Set(folders.flatMap((f) => f.agentIds));
  const topLevelAgents = agents.filter((a) => !folderedIds.has(a.id));
  const rootFolders = folders.filter((f) => !f.parentId);
  const openFolder = folders.find((f) => f.id === openFolderId);
  const enoughSelected = selectedAgentIds.length >= 2;

  const actionBtn = `flex items-center gap-1.5 px-3 sm:px-4 min-h-[40px] rounded-full text-xs font-bold uppercase tracking-wider transition-colors`;

  return (
    <section aria-label={t.agents} className="w-full max-w-5xl mx-auto px-4 py-6 animate-fade-up">
      {/* Desktop actions: own folders, selection mode, Curator */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <MicroLabel>{t.agents}</MicroLabel>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setIsFolderModalOpen(true)} className={`${actionBtn} ${theme.accentBtn}`}>
            <FolderPlus size={14} aria-hidden /> {t.newFolder}
          </button>
          <button
            onClick={() => setIsSelectionMode(!isSelectionMode)}
            aria-pressed={isSelectionMode}
            className={`${actionBtn} ${isSelectionMode ? theme.userBubble : `${theme.secondaryText} ${theme.glassHover}`}`}
          >
            <MousePointer2 size={14} aria-hidden /> {t.selectionMode}
            {selectedAgentIds.length > 0 && ` (${selectedAgentIds.length})`}
          </button>
          {isSelectionMode && enoughSelected && (
            <>
              <button onClick={() => setIsFolderModalOpen(true)} className={`${actionBtn} ${theme.accentBtn}`}>
                <FolderPlus size={14} aria-hidden /> {t.createFolderFromSelection}
              </button>
              <button
                onClick={() => requestCuratorProposals(selectedAgentIds)}
                className={`${actionBtn} ${theme.accentBtn}`}
              >
                <FolderTree size={14} aria-hidden /> {t.proposeMetaNode}
              </button>
            </>
          )}
          {!isSelectionMode && (
            <button onClick={() => requestCuratorProposals()} className={`${actionBtn} ${theme.accentBtn}`}>
              <FolderTree size={14} aria-hidden /> {t.curatorProposeAll}
            </button>
          )}
        </div>
      </div>

      {isSelectionMode && (
        <p className={`text-xs mb-4 ${theme.mutedText}`} role="status">
          {t.selectionHint}
        </p>
      )}

      <ProposalsPanel />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {rootFolders.map((folder) => (
          <FolderTile key={folder.id} folder={folder} />
        ))}
        {topLevelAgents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {openFolder && <FolderOverlay folder={openFolder} />}
      <FolderModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        initialAgentIds={selectedAgentIds}
      />
    </section>
  );
};

export default AgentDesktop;
