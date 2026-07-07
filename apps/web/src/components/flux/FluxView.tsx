/**
 * FluxView — the end-to-end agent flow of the selected project, rendered as
 * a PERT graph: left → right, one node per contracted task, parallel
 * branches stacked vertically. Clicking a node opens the detail panel
 * (contract, input, output, conformity). Double-clicking the node of a
 * META-AGENT expands its sub-flow in place, inside a rounded outline.
 *
 * PERIMETERS: tasks outside the current user's perimeter are rendered as
 * META-TASKS — anonymous structural placeholders that reveal only the shape
 * of the project before/after/between the tasks the user owns.
 */
import React, { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Panel, MicroLabel, StatusPill, CodeBlock } from '@/components/ui/Glass';
import PertGraph from './PertGraph';
import type { TaskNode } from '@/core/types';

const TaskDetail: React.FC<{ task: TaskNode }> = ({ task }) => {
  const { theme, t, agents } = useApp();
  const agent = agents.find((a) => a.id === task.agentId);
  const verdictLabel = {
    conform: t.verdictConform,
    'non-conform': t.verdictNonConform,
    pending: t.verdictPending,
  };
  return (
    <Panel className="p-5 space-y-4 animate-fade-up">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className={`font-bold text-sm uppercase tracking-wide ${theme.primaryText}`}>{task.title}</h3>
        <StatusPill status={task.status} />
      </div>

      <div>
        <MicroLabel className="mb-1">{t.taskSpec}</MicroLabel>
        <p className={`text-sm leading-relaxed ${theme.secondaryText}`}>{task.spec.objective}</p>
        <ul className={`list-disc pl-5 mt-1 text-xs space-y-0.5 ${theme.mutedText}`}>
          {task.spec.constraints.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p className={`text-xs mt-1 font-mono ${theme.mutedText}`}>
          {t.deliverable}: {task.spec.deliverableFormat} · {agent?.name}
        </p>
      </div>

      <div>
        <MicroLabel className="mb-1">{t.taskInput}</MicroLabel>
        <p className={`text-sm ${theme.secondaryText}`}>{task.input}</p>
      </div>

      {task.output && (
        <div>
          <MicroLabel className="mb-1">{t.taskOutput}</MicroLabel>
          <p className={`text-sm leading-relaxed ${theme.secondaryText}`}>{task.output.summary}</p>
          <p className={`text-xs mt-1 font-mono ${theme.mutedText}`}>
            {t.artifacts}: {task.output.artifacts.join(', ')} · {task.output.tokensUsed.toLocaleString()} {t.tokens}
          </p>
        </div>
      )}

      {task.conformity && (
        <div className="space-y-2">
          <MicroLabel>{t.conformityReport}</MicroLabel>
          <p className={`text-sm font-semibold ${theme.primaryText}`}>
            {verdictLabel[task.conformity.verdict]}
            {task.conformity.verdict !== 'pending' && ` — ${t.score}: ${task.conformity.score}/100`}
            <span className={`ml-2 text-xs font-mono font-normal ${theme.mutedText}`}>
              {t.judge}: {task.conformity.judgeModel}
            </span>
          </p>
          {task.conformity.criteria.length > 0 && (
            <CodeBlock label={t.criteria}>
              {task.conformity.criteria
                .map((c) => `${c.passed ? '✔' : '✘'} ${c.name} — ${c.comment}`)
                .join('\n')}
            </CodeBlock>
          )}
          {task.conformity.recommendations.length > 0 && (
            <ul className={`list-disc pl-5 text-xs space-y-0.5 ${theme.mutedText}`}>
              {task.conformity.recommendations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
};

const FluxView: React.FC = () => {
  const { theme, t, visibleTasks, tasks, selectedProjectId, runProjectFlow, isFlowRunning } = useApp();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (!selectedProjectId) {
    return <p className={`text-center py-16 text-sm ${theme.mutedText}`}>{t.createProjectFirst}</p>;
  }

  // The MAIN flow never contains sub-flow tasks: those live inside their
  // meta-agent (its « Flux » tab / the expanded outline in this PERT).
  const rootTasks = visibleTasks.filter((task) => !task.parentAgentId);
  const subFlowOf = (agentId: string) => tasks.filter((task) => task.parentAgentId === agentId);

  // An empty flow is the normal state of a fresh project: nothing has been
  // asked yet. The flow appears once a goal is described to the orchestrator.
  if (rootTasks.length === 0) {
    return (
      <p className={`text-center py-16 px-6 text-sm max-w-xl mx-auto leading-relaxed ${theme.mutedText}`}>
        {t.fluxEmpty}
      </p>
    );
  }

  const selectedTask = visibleTasks.find((task) => task.id === selectedTaskId && task.accessible);

  return (
    <section aria-label={t.flux} className="w-full max-w-6xl mx-auto px-4 py-6 animate-fade-up">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <MicroLabel>{t.flux} — PERT</MicroLabel>
        <button
          onClick={runProjectFlow}
          disabled={isFlowRunning}
          className={`flex items-center gap-2 px-4 min-h-[40px] rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${theme.accentBtn} disabled:opacity-50`}
        >
          {isFlowRunning ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Play size={14} aria-hidden />}
          {isFlowRunning ? t.flowRunning : t.runFlow}
        </button>
      </div>
      <p className={`text-xs mb-4 ${theme.mutedText}`}>{t.pertHint}</p>

      {/* The PERT graph (left → right, parallel branches stacked) */}
      <PertGraph
        tasks={rootTasks}
        selectedId={selectedTaskId}
        onSelect={setSelectedTaskId}
        onToggleExpand={(taskId) =>
          setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
          })
        }
        expandedIds={expandedIds}
        subFlowOf={subFlowOf}
      />

      {/* Selected task detail below the graph */}
      <div className="mt-6 max-w-3xl">
        {selectedTask ? (
          <TaskDetail task={selectedTask} />
        ) : (
          <p className={`text-sm py-6 text-center ${theme.mutedText}`}>{t.selectTask}</p>
        )}
      </div>
    </section>
  );
};

export default FluxView;
