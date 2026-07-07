/**
 * GenesisTimeline — the live narration of the Orchestrator's genesis engine.
 *
 * SSOT: there is only ONE input surface in the whole OS (MetaChatDock).
 * Genesis is triggered by talking to the Orchestrateur/LLM Général there;
 * this component only RENDERS the resulting events, inside the
 * Orchestrateur's own « Travail en direct » tab — same pattern as the
 * Curateur's proposals living only in its own tab.
 */
import React from 'react';
import { CheckCircle2, Loader2, Sparkles, Workflow } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import type { GenesisEvent } from '@/core/genesis';

const KIND_ICON: Record<GenesisEvent['kind'], React.ReactNode> = {
  intent: <Sparkles size={14} aria-hidden />,
  'agent-created': <Sparkles size={14} aria-hidden />,
  'agent-verified': <CheckCircle2 size={14} aria-hidden />,
  'flow-designed': <Workflow size={14} aria-hidden />,
  run: <Loader2 size={14} className="animate-spin" aria-hidden />,
  done: <CheckCircle2 size={14} aria-hidden />,
};

const GenesisTimeline: React.FC<{ events: GenesisEvent[] }> = ({ events }) => {
  const { theme, t, setView, agents } = useApp();
  if (events.length === 0) return null;

  return (
    <ol className="space-y-1.5" aria-live="polite">
      {events.map((ev) => {
        const agent = ev.agentId ? agents.find((a) => a.id === ev.agentId) : null;
        return (
          <li key={ev.id} className="flex items-start gap-2.5 animate-fade-up">
            <span
              className={`mt-0.5 shrink-0 ${
                ev.kind === 'agent-verified' || ev.kind === 'done' ? 'text-emerald-500' : theme.mutedText
              }`}
            >
              {KIND_ICON[ev.kind]}
            </span>
            <p className={`text-sm leading-snug ${theme.secondaryText}`}>
              {agent ? (
                <button
                  onClick={() => setView({ kind: 'agent', agentId: agent.id })}
                  className={`font-semibold underline-offset-2 hover:underline ${theme.primaryText}`}
                >
                  {ev.label}
                </button>
              ) : (
                <span className={`font-semibold ${theme.primaryText}`}>{ev.label}</span>
              )}{' '}
              <span className={theme.mutedText}>{ev.detail}</span>
              {ev.kind === 'flow-designed' && (
                <>
                  {' '}
                  <button
                    onClick={() => setView({ kind: 'tab', tab: 'FLUX' })}
                    className="text-blue-600 hover:underline underline-offset-2 font-medium"
                  >
                    {t.genesisSeeFlow}
                  </button>
                </>
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
};

export default GenesisTimeline;
