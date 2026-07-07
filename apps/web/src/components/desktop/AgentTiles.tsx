/**
 * Shared desktop tiles (SSOT) used by both the root desktop and the inline
 * FolderView: the full AgentCard and the FolderTile (with up to 10 member
 * miniatures, the 10th becoming a "+n" chip when the folder holds more).
 */
import React from 'react';
import { Check } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Panel, StatusPill } from '@/components/ui/Glass';
import type { AgentFolder, AgentProfile } from '@/core/types';

/** Full agent card. In selection mode, clicking designates the agent. */
export const AgentCard: React.FC<{ agent: AgentProfile }> = ({ agent }) => {
  const { theme, t, setView, tasks, isSelectionMode, selectedAgentIds, toggleAgentSelection, isMetaAgent } = useApp();
  const Icon = agent.icon;
  const runningTask = tasks.find((task) => task.agentId === agent.id && task.status === 'running');
  const status = runningTask ? 'working' : agent.status;
  const isSelected = selectedAgentIds.includes(agent.id);

  // Opening an agent keeps the current folder context so the back arrow
  // returns to the folder the agent was opened from.
  const openAgent = () => setView({ kind: 'agent', agentId: agent.id });

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
        <span className="flex items-center gap-1.5 flex-wrap">
          <StatusPill status={status} />
          {isMetaAgent(agent.id) && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${theme.glassBorder} ${theme.secondaryText}`}
            >
              ▣ {t.metaAgent}
            </span>
          )}
        </span>
      </button>
    </Panel>
  );
};

/**
 * Folder tile — same rounded square as an agent tile; previews up to 10
 * member miniatures. If the folder holds more than 10, the 10th slot becomes
 * a "+n" chip counting the remainder.
 */
export const FolderTile: React.FC<{ folder: AgentFolder }> = ({ folder }) => {
  const { theme, t, visibleAgents: agents, visibleFolders: folders, setOpenFolderId } = useApp();

  // Effective members include agents of nested sub-folders.
  const collectAgentIds = (f: AgentFolder): string[] => [
    ...f.agentIds,
    ...folders.filter((child) => child.parentId === f.id).flatMap(collectAgentIds),
  ];
  const subFolderCount = folders.filter((child) => child.parentId === folder.id).length;
  const members = collectAgentIds(folder)
    .map((id) => agents.find((a) => a.id === id))
    .filter((a): a is AgentProfile => Boolean(a));

  // Up to 10 previewed; if more, show 9 icons + a "+n" chip (10th slot).
  const MAX = 10;
  const showChip = members.length > MAX;
  const iconCount = showChip ? MAX - 1 : Math.min(members.length, MAX);
  const preview = members.slice(0, iconCount);
  const remainder = members.length - iconCount;

  return (
    <Panel className={`${theme.glassHover} transition-transform hover:scale-[1.02]`}>
      <button
        onClick={() => setOpenFolderId(folder.id)}
        aria-label={`${t.openFolder}: ${folder.name} (${members.length})`}
        className="w-full h-full p-4 sm:p-5 flex flex-col items-start gap-3 text-left"
      >
        {/* Miniature grid (2 rows × 5) — the visual signature of a folder */}
        <span className={`p-2 rounded-2xl ${theme.iconBg} grid grid-cols-5 gap-1`} aria-hidden>
          {preview.map((agent) => {
            const MiniIcon = agent.icon;
            return (
              <span key={agent.id} className={`w-5 h-5 rounded-md flex items-center justify-center ${theme.glassBg}`}>
                <MiniIcon size={11} strokeWidth={1.5} className={theme.primaryText} />
              </span>
            );
          })}
          {showChip && (
            <span
              className={`w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold ${theme.glassBg} ${theme.mutedText}`}
            >
              +{remainder}
            </span>
          )}
          {/* Pad so short folders still read as a folder (keep at least one row). */}
          {!showChip &&
            preview.length < 5 &&
            Array.from({ length: 5 - preview.length }).map((_, i) => (
              <span key={`pad-${i}`} className={`w-5 h-5 rounded-md ${theme.glassBg} opacity-30`} />
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
