/**
 * AgentDesktop — the OS home screen.
 *
 * Shows the agents of the SELECTED PROJECT as icons in a bento grid, with
 * folders (iOS-style) opening inline (FolderView). No action buttons here:
 * per the SSOT principle, everything goes through the agents themselves —
 * folder proposals are requested by chatting with the CURATOR (its results
 * appear in its « Travail en direct » tab), and flows by chatting with the
 * ORCHESTRATEUR.
 */
import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { MicroLabel } from '@/components/ui/Glass';
import { AgentCard, FolderTile } from './AgentTiles';
import GenesisHero from '@/components/genesis/GenesisHero';

const AgentDesktop: React.FC = () => {
  const { t, visibleAgents, visibleFolders } = useApp();

  // Agents inside any visible folder are not repeated at top level; only
  // ROOT folders (no parentId) tile the desktop.
  const folderedIds = new Set(visibleFolders.flatMap((f) => f.agentIds));
  const topLevelAgents = visibleAgents.filter((a) => !folderedIds.has(a.id));
  const rootFolders = visibleFolders.filter((f) => !f.parentId);

  return (
    <section aria-label={t.agents} className="w-full max-w-5xl mx-auto px-4 py-6 animate-fade-up">
      {/* The generative prompt of the Orchestrator (Genesis engine). */}
      <GenesisHero />
      <MicroLabel className="mb-4">{t.agents}</MicroLabel>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {rootFolders.map((folder) => (
          <FolderTile key={folder.id} folder={folder} />
        ))}
        {topLevelAgents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </section>
  );
};

export default AgentDesktop;
