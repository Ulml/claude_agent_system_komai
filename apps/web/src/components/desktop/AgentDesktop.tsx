/**
 * AgentDesktop — the OS home screen.
 * Every persistent autonomous agent (and every human user, rendered with the
 * exact same card) appears as an icon in a bento grid. Clicking an icon
 * opens the agent's dedicated page.
 */
import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { Panel, MicroLabel, StatusPill } from '@/components/ui/Glass';

const AgentDesktop: React.FC = () => {
  const { theme, t, agents, setView, tasks } = useApp();

  return (
    <section aria-label={t.agents} className="w-full max-w-5xl mx-auto px-4 py-6 animate-fade-up">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <MicroLabel>{t.agents}</MicroLabel>
        <MicroLabel className="hidden sm:block text-right">{t.emptyDesktopHint}</MicroLabel>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {agents.map((agent) => {
          const Icon = agent.icon;
          const runningTask = tasks.find((task) => task.agentId === agent.id && task.status === 'running');
          const status = runningTask ? 'working' : agent.status;
          return (
            <Panel key={agent.id} className={`${theme.glassHover} transition-transform hover:scale-[1.02]`}>
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
        })}
      </div>
    </section>
  );
};

export default AgentDesktop;
