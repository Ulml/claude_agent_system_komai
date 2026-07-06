/**
 * AgentDesktop — the OS home screen.
 *
 * Every persistent autonomous agent (and every human user) appears as an icon
 * in a bento grid; agents can be grouped into FOLDERS (iOS-style). Opening a
 * folder navigates INTO it inline (see FolderView) — no modal overlay.
 *
 * The user can create their own folders, designate any group with SELECTION
 * mode, and ask the CURATOR agent for grouping proposals (meta-nodes).
 */
import React, { useState } from 'react';
import { Check, FolderPlus, FolderTree, MousePointer2, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Panel, MicroLabel } from '@/components/ui/Glass';
import FolderModal from '@/components/modals/FolderModal';
import { AgentCard, FolderTile } from './AgentTiles';
import type { AgentProfile } from '@/core/types';

/** Curator proposal cards: one per meta-node, with accept/reject actions. */
const ProposalsPanel: React.FC = () => {
  const { theme, t, agents, proposals, acceptProposal, rejectProposal, resolveProposalName } = useApp();
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
  const { theme, t, agents, folders, isSelectionMode, setIsSelectionMode, selectedAgentIds, requestCuratorProposals } =
    useApp();
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  // Agents inside any folder are not repeated at top level; only ROOT folders
  // (no parentId) tile the desktop.
  const folderedIds = new Set(folders.flatMap((f) => f.agentIds));
  const topLevelAgents = agents.filter((a) => !folderedIds.has(a.id));
  const rootFolders = folders.filter((f) => !f.parentId);
  const enoughSelected = selectedAgentIds.length >= 2;

  const actionBtn = `flex items-center gap-1.5 px-3 sm:px-4 min-h-[40px] rounded-full text-xs font-bold uppercase tracking-wider transition-colors`;

  return (
    <section aria-label={t.agents} className="w-full max-w-5xl mx-auto px-4 py-6 animate-fade-up">
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
              <button onClick={() => requestCuratorProposals(selectedAgentIds)} className={`${actionBtn} ${theme.accentBtn}`}>
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

      <FolderModal isOpen={isFolderModalOpen} onClose={() => setIsFolderModalOpen(false)} initialAgentIds={selectedAgentIds} />
    </section>
  );
};

export default AgentDesktop;
