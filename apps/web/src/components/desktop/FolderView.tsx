/**
 * FolderView — an opened folder rendered INLINE, in place of the desktop.
 * Visually indistinguishable from the home page (same grid, same tiles): it
 * shows the folder's sub-folders and agents. Navigation back up the tree is
 * done with the top-left back arrow (see TopBar / AppContext.goBack).
 */
import React from 'react';
import { Trash2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { MicroLabel } from '@/components/ui/Glass';
import { AgentCard, FolderTile } from './AgentTiles';
import type { AgentProfile } from '@/core/types';

const FolderView: React.FC = () => {
  const { theme, t, agents, folders, openFolderId, deleteFolder } = useApp();
  const folder = folders.find((f) => f.id === openFolderId);
  if (!folder) return null;

  const subFolders = folders.filter((f) => f.parentId === folder.id);
  const members = folder.agentIds
    .map((id) => agents.find((a) => a.id === id))
    .filter((a): a is AgentProfile => Boolean(a));

  return (
    <section aria-label={folder.name} className="w-full max-w-5xl mx-auto px-4 py-6 animate-fade-up">
      <div className="flex items-center justify-between gap-3 mb-4">
        <MicroLabel>{folder.name}</MicroLabel>
        <button
          onClick={() => deleteFolder(folder.id)}
          aria-label={`${t.deleteFolder}: ${folder.name}`}
          className={`flex items-center gap-1.5 px-3 min-h-[36px] rounded-full text-xs font-bold uppercase tracking-wider ${theme.secondaryText} ${theme.glassHover}`}
        >
          <Trash2 size={13} aria-hidden /> {t.deleteFolder}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {subFolders.map((sub) => (
          <FolderTile key={sub.id} folder={sub} />
        ))}
        {members.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </section>
  );
};

export default FolderView;
