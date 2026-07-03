/**
 * AgentPage — the dedicated web page of ONE agent, identical for every agent
 * (humans included). Five tabs, as required by the product spec:
 *
 *   1. Présentation  — the agent's README (needs / method / deliverables)
 *                      plus its Mermaid algorithm and bound LLM.
 *   2. Entrées       — the inputs and TaskSpecifications it received.
 *   3. Travail direct— the live SENSE / PLAN / ACT / OBSERVE work stream.
 *   4. Conformité    — the judge's conformity reports on its outputs.
 *   5. Apprentissage — the 4 learning modes and applied skill updates.
 */
import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Panel, MicroLabel, StatusPill, CodeBlock } from '@/components/ui/Glass';
import { Markdown } from '@/components/ui/Markdown';
import type { AgentProfile, LearningMode } from '@/core/types';

type AgentTab = 'readme' | 'inputs' | 'work' | 'conformity' | 'learning';

const LEARNING_MODE_KEY: Record<LearningMode, string> = {
  'judge-feedback': 'modeJudge',
  'user-feedback': 'modeUser',
  'task-replay': 'modeReplay',
  'expected-example': 'modeExample',
};

const AgentPage: React.FC<{ agent: AgentProfile }> = ({ agent }) => {
  const { theme, t, tasks, workEvents, learning, providers } = useApp();
  const [tab, setTab] = useState<AgentTab>('readme');

  const agentTasks = tasks.filter((task) => task.agentId === agent.id);
  const agentEvents = workEvents.filter((e) => e.agentId === agent.id);
  const agentLearning = learning.filter((l) => l.agentId === agent.id);
  const provider = providers.find((p) => p.id === agent.llmBinding.providerId);

  const tabs: { id: AgentTab; label: string }[] = [
    { id: 'readme', label: t.tabReadme },
    { id: 'inputs', label: t.tabInputs },
    { id: 'work', label: t.tabWork },
    { id: 'conformity', label: t.tabConformity },
    { id: 'learning', label: t.tabLearning },
  ];

  const Icon = agent.icon;

  return (
    <section aria-label={agent.name} className="w-full max-w-4xl mx-auto px-4 py-6 space-y-5 animate-fade-up">
      {/* Agent identity header */}
      <div className="flex items-center gap-4">
        <span className={`p-4 rounded-3xl ${theme.iconBg}`}>
          <Icon size={28} strokeWidth={1.5} className={theme.primaryText} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className={`text-xl font-bold tracking-tight ${theme.primaryText}`}>{agent.name}</h2>
          <p className={`text-sm ${theme.mutedText}`}>{agent.tagline}</p>
          <p className={`text-xs font-mono mt-0.5 ${theme.mutedText}`}>
            {t.boundModel}: {provider?.name ?? '?'} · {agent.llmBinding.model}
          </p>
        </div>
        <span className="ml-auto">
          <StatusPill status={agent.status} />
        </span>
      </div>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label={agent.name}
        className={`flex gap-1 p-1 rounded-full backdrop-blur-xl border overflow-x-auto custom-scrollbar ${theme.glassBg} ${theme.glassBorder}`}
      >
        {tabs.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            id={`agent-tab-${tb.id}`}
            aria-selected={tab === tb.id}
            aria-controls={`agent-panel-${tb.id}`}
            onClick={() => setTab(tb.id)}
            className={`px-4 min-h-[40px] rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
              tab === tb.id ? theme.userBubble : `${theme.secondaryText} ${theme.glassHover}`
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`agent-panel-${tab}`} aria-labelledby={`agent-tab-${tab}`} className="space-y-4">
        {/* 1 — Présentation */}
        {tab === 'readme' && (
          <>
            <Panel className="p-5">
              <Markdown source={agent.readme} />
            </Panel>
            <CodeBlock label={t.algorithm}>{agent.mermaidAlgorithm}</CodeBlock>
            <Panel className="p-5">
              <MicroLabel className="mb-2">{t.skills}</MicroLabel>
              <ul className="flex flex-wrap gap-2">
                {agent.skills.map((s) => (
                  <li
                    key={s}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${theme.iconBg} ${theme.secondaryText}`}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </Panel>
          </>
        )}

        {/* 2 — Entrées */}
        {tab === 'inputs' &&
          (agentTasks.length === 0 ? (
            <p className={`text-sm text-center py-8 ${theme.mutedText}`}>—</p>
          ) : (
            agentTasks.map((task) => (
              <Panel key={task.id} className="p-5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`text-sm font-semibold ${theme.primaryText}`}>{task.title}</h3>
                  <StatusPill status={task.status} />
                </div>
                <MicroLabel>{t.taskSpec}</MicroLabel>
                <p className={`text-sm ${theme.secondaryText}`}>{task.spec.objective}</p>
                <MicroLabel>{t.taskInput}</MicroLabel>
                <p className={`text-sm ${theme.secondaryText}`}>{task.input}</p>
              </Panel>
            ))
          ))}

        {/* 3 — Travail en direct */}
        {tab === 'work' &&
          (agentEvents.length === 0 ? (
            <p className={`text-sm text-center py-8 ${theme.mutedText}`}>—</p>
          ) : (
            <Panel className="p-5">
              <ol className="space-y-3" aria-live="polite">
                {agentEvents.map((e) => (
                  <li key={e.id} className="flex gap-3 items-start">
                    <span
                      className={`shrink-0 w-20 text-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider ${theme.iconBg} ${theme.secondaryText}`}
                    >
                      {e.phase}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${theme.primaryText}`}>{e.label}</p>
                      <p className={`text-xs ${theme.mutedText}`}>{e.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          ))}

        {/* 4 — Conformité */}
        {tab === 'conformity' &&
          (agentTasks.filter((task) => task.conformity).length === 0 ? (
            <p className={`text-sm text-center py-8 ${theme.mutedText}`}>—</p>
          ) : (
            agentTasks
              .filter((task) => task.conformity)
              .map((task) => (
                <Panel key={task.id} className="p-5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-sm font-semibold ${theme.primaryText}`}>{task.title}</h3>
                    <span className={`text-xs font-bold ${theme.primaryText}`}>
                      {task.conformity!.verdict === 'pending'
                        ? t.verdictPending
                        : `${t.score} ${task.conformity!.score}/100`}
                    </span>
                  </div>
                  {task.conformity!.criteria.length > 0 && (
                    <CodeBlock label={t.criteria}>
                      {task.conformity!.criteria
                        .map((c) => `${c.passed ? '✔' : '✘'} ${c.name} — ${c.comment}`)
                        .join('\n')}
                    </CodeBlock>
                  )}
                </Panel>
              ))
          ))}

        {/* 5 — Apprentissage */}
        {tab === 'learning' && (
          <>
            <Panel className="p-5">
              <MicroLabel className="mb-2">{t.learningModes}</MicroLabel>
              <ol className={`list-decimal pl-5 text-sm space-y-1 ${theme.secondaryText}`}>
                <li>{t.modeJudge}</li>
                <li>{t.modeUser}</li>
                <li>{t.modeReplay}</li>
                <li>{t.modeExample}</li>
              </ol>
            </Panel>
            {agentLearning.map((l) => (
              <Panel key={l.id} className="p-5 space-y-1">
                <MicroLabel>{t[LEARNING_MODE_KEY[l.mode]]}</MicroLabel>
                <p className={`text-sm ${theme.secondaryText}`}>{l.summary}</p>
                <p className={`text-xs font-mono ${theme.mutedText}`}>→ {l.appliedToSkill}</p>
              </Panel>
            ))}
          </>
        )}
      </div>
    </section>
  );
};

export default AgentPage;
