/**
 * GenesisHero — the SOTA centrepiece of the home page.
 *
 * One prominent prompt: describe ANY goal, and the Orchestrator's genesis
 * engine creates the missing specialist agents (verified, conform to
 * AGENT_STANDARD), designs the task DAG and runs it — while the timeline
 * below narrates every step live and the new agent icons materialise on
 * the desktop.
 */
import React, { useState } from 'react';
import { CheckCircle2, Loader2, Sparkles, Workflow } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { MicroLabel } from '@/components/ui/Glass';
import type { GenesisEvent } from '@/core/genesis';

const KIND_ICON: Record<GenesisEvent['kind'], React.ReactNode> = {
  intent: <Sparkles size={14} aria-hidden />,
  'agent-created': <Sparkles size={14} aria-hidden />,
  'agent-verified': <CheckCircle2 size={14} aria-hidden />,
  'flow-designed': <Workflow size={14} aria-hidden />,
  run: <Loader2 size={14} className="animate-spin" aria-hidden />,
  done: <CheckCircle2 size={14} aria-hidden />,
};

const GenesisHero: React.FC = () => {
  const { theme, t, runGenesis, genesisEvents, isGenesisRunning, setView, agents } = useApp();
  const [text, setText] = useState('');

  const submit = () => {
    if (!text.trim() || isGenesisRunning) return;
    runGenesis(text.trim());
    setText('');
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-8 space-y-4">
      {/* The prompt */}
      <div className="text-center space-y-1 pt-2">
        <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight ${theme.primaryText}`}>{t.genesisTitle}</h2>
        <p className={`text-sm ${theme.mutedText}`}>{t.genesisSubtitle}</p>
      </div>
      <div
        className={`flex items-end gap-2 rounded-[2rem] p-2 pl-5 backdrop-blur-xl border ${theme.glassBg} ${theme.glassBorder} shadow-[0_8px_32px_rgba(0,0,0,0.06)]`}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={t.genesisPlaceholder}
          aria-label={t.genesisPlaceholder}
          className={`flex-1 resize-none bg-transparent text-base leading-relaxed py-2.5 outline-none placeholder:opacity-50 ${theme.primaryText}`}
        />
        <button
          onClick={submit}
          disabled={isGenesisRunning || !text.trim()}
          aria-label={t.genesisLaunch}
          className={`flex items-center gap-2 px-5 min-h-[44px] rounded-full text-sm font-semibold transition-all ${theme.userBubble} disabled:opacity-40`}
        >
          {isGenesisRunning ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />}
          {t.genesisLaunch}
        </button>
      </div>

      {/* Live creation timeline */}
      {genesisEvents.length > 0 && (
        <div className="space-y-2 animate-fade-up" aria-live="polite">
          <MicroLabel>{t.genesisTimeline}</MicroLabel>
          <ol className="space-y-1.5">
            {genesisEvents.map((ev) => {
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
        </div>
      )}
    </div>
  );
};

export default GenesisHero;
