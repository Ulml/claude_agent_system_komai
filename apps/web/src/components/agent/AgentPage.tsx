/**
 * AgentPage — the dedicated page of ONE agent. The tab BAR lives in the
 * bottom dock (contextual); this component renders only the active tab's
 * content, FRAMELESS (no rounded cards), like a classic web page.
 *
 * Tab order (from the dock): Entrées · Travail en direct · Conformité ·
 * Apprentissage · Compétences · Logs · Présentation. Default = Entrées;
 * once the agent runs, the dock auto-switches to Travail en direct.
 */
import React, { useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { MicroLabel, StatusPill } from '@/components/ui/Glass';
import { Markdown } from '@/components/ui/Markdown';
import MermaidFlow from '@/components/ui/MermaidFlow';
import MethodSection from './MethodSection';
import type { AgentProfile } from '@/core/types';

/* -------------------- derived / demo data helpers -------------------- */

/** Deterministic end-of-run conformity history for the agent's demo task. */
function conformityHistory(agentId: string): { label: string; score: number; trigger: 'learning' | 'user' }[] {
  let seed = [...agentId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const points: { label: string; score: number; trigger: 'learning' | 'user' }[] = [];
  let score = 58 + Math.floor(rnd() * 10);
  for (let i = 0; i < 5; i++) {
    score = Math.min(97, score + 6 + Math.floor(rnd() * 7));
    points.push({ label: `Run ${i + 1}`, score, trigger: i % 2 === 0 ? 'learning' : 'user' });
  }
  return points;
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------- empty-state helper ------------------------ */

const EmptyDef: React.FC<{ text: string }> = ({ text }) => {
  const { theme } = useApp();
  return <p className={`text-sm leading-relaxed ${theme.mutedText}`}>{text}</p>;
};

/* ----------------------- conformity score curve ---------------------- */

const ScoreCurve: React.FC<{ points: { label: string; score: number; trigger: 'learning' | 'user' }[] }> = ({
  points,
}) => {
  const { theme, t } = useApp();
  const W = 520;
  const H = 180;
  const pad = 32;
  const xs = (i: number) => pad + (i * (W - 2 * pad)) / Math.max(points.length - 1, 1);
  const ys = (s: number) => H - pad - ((s - 40) / 60) * (H - 2 * pad); // scale 40..100
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(p.score)}`).join(' ');
  const stroke = theme.isDark ? '#60a5fa' : '#2563eb';
  const grid = theme.isDark ? '#334155' : '#e2e8f0';
  const txt = theme.isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="w-full overflow-x-auto custom-scrollbar">
      <svg viewBox={`0 0 ${W} ${H}`} className="max-w-full h-auto" role="img" aria-label={t.conformityCurve}>
        {[95, 80, 60, 40].map((g) => (
          <g key={g}>
            <line x1={pad} y1={ys(g)} x2={W - pad} y2={ys(g)} stroke={grid} strokeWidth={1} strokeDasharray={g === 95 ? '4 3' : ''} />
            <text x={4} y={ys(g) + 3} fontSize="9" fill={g === 95 ? stroke : txt}>
              {g}
            </text>
          </g>
        ))}
        <path d={line} fill="none" stroke={stroke} strokeWidth={2} />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={xs(i)} cy={ys(p.score)} r={4} fill={p.trigger === 'user' ? '#f59e0b' : stroke} />
            <text x={xs(i)} y={H - 10} fontSize="9" fill={txt} textAnchor="middle">
              {p.label}
            </text>
            <text x={xs(i)} y={ys(p.score) - 9} fontSize="9" fill={theme.isDark ? '#e2e8f0' : '#0f172a'} textAnchor="middle">
              {p.score}
            </text>
          </g>
        ))}
      </svg>
      <p className={`text-xs mt-1 ${theme.mutedText}`}>
        <span className="inline-block w-2 h-2 rounded-full align-middle mr-1" style={{ background: stroke }} />
        {t.triggerLearning}
        <span className="inline-block w-2 h-2 rounded-full align-middle ml-3 mr-1" style={{ background: '#f59e0b' }} />
        {t.triggerUser}
      </p>
    </div>
  );
};

/* ------------------------------ page --------------------------------- */

const AgentPage: React.FC<{ agent: AgentProfile }> = ({ agent }) => {
  const { theme, t, tasks, workEvents, learning, providers, messages, agentTab, logsFilter, setAgentTitleHidden } =
    useApp();

  const agentTasks = tasks.filter((task) => task.agentId === agent.id);
  const agentEvents = workEvents.filter((e) => e.agentId === agent.id);
  const agentLearning = learning.filter((l) => l.agentId === agent.id);
  const provider = providers.find((p) => p.id === agent.llmBinding.providerId);
  const Icon = agent.icon;

  // Scroll-aware header: observe the in-page title; when it leaves the area
  // just below the fixed TopBar, reveal the agent name in the bar.
  const titleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setAgentTitleHidden(false);
    const el = titleRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setAgentTitleHidden(!entry.isIntersecting),
      { root: null, rootMargin: '-72px 0px 0px 0px', threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [agent.id, setAgentTitleHidden]);

  // Synthesized skills = base skills + those applied through learning.
  const synthesizedSkills = [...new Set([...agent.skills, ...agentLearning.map((l) => l.appliedToSkill)])];

  // Logs = user remarks (chat) + judge feedback + learnings, filtered.
  const userRemarks = messages
    .filter((m) => m.role === 'user' && m.targetId === agent.id)
    .map((m) => ({ category: 'user' as const, text: m.text, ts: m.timestamp }));
  const judgeLogs = agentLearning
    .filter((l) => l.mode === 'judge-feedback')
    .map((l) => ({ category: 'judge' as const, text: l.summary, ts: l.timestamp }));
  const learnLogs = agentLearning.map((l) => ({ category: 'learning' as const, text: l.summary, ts: l.timestamp }));
  const allLogs = [...userRemarks, ...judgeLogs, ...learnLogs].sort((a, b) => b.ts - a.ts);
  const logs = logsFilter === 'all' ? allLogs : allLogs.filter((l) => l.category === logsFilter);

  const history = conformityHistory(agent.id);

  return (
    <section aria-label={agent.name} className="w-full max-w-3xl mx-auto px-4 py-6 space-y-6 animate-fade-up">
      {/* Agent identity header (scroll sentinel) */}
      <div ref={titleRef} className="flex items-center gap-4">
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

      <div role="tabpanel" aria-label={t[`tab${agentTab[0].toUpperCase()}${agentTab.slice(1)}`] ?? agentTab} className="space-y-5">
        {/* 1 — Entrées */}
        {agentTab === 'inputs' &&
          (agentTasks.length === 0 ? (
            <EmptyDef text={t.defInputs} />
          ) : (
            agentTasks.map((task) => (
              <div key={task.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`text-sm font-semibold ${theme.primaryText}`}>{task.title}</h3>
                  <StatusPill status={task.status} />
                </div>
                <MicroLabel>{t.taskSpec}</MicroLabel>
                <p className={`text-sm ${theme.secondaryText}`}>{task.spec.objective}</p>
                <ul className={`list-disc pl-5 text-xs space-y-0.5 ${theme.mutedText}`}>
                  {task.spec.constraints.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <MicroLabel>{t.taskInput}</MicroLabel>
                <p className={`text-sm ${theme.secondaryText}`}>{task.input}</p>
              </div>
            ))
          ))}

        {/* 2 — Travail en direct */}
        {agentTab === 'work' &&
          (agentEvents.length === 0 ? (
            <EmptyDef text={t.defWork} />
          ) : (
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
          ))}

        {/* 3 — Conformité (latest report + score-evolution curve) */}
        {agentTab === 'conformity' && (
          <div className="space-y-5">
            <div>
              <MicroLabel className="mb-1">{t.conformityCurve}</MicroLabel>
              <p className={`text-xs mb-2 ${theme.mutedText}`}>{t.runTarget}</p>
              <ScoreCurve points={history} />
            </div>
            {agentTasks.filter((task) => task.conformity && task.conformity.criteria.length > 0).length === 0 ? (
              <EmptyDef text={t.defConformity} />
            ) : (
              agentTasks
                .filter((task) => task.conformity && task.conformity.criteria.length > 0)
                .map((task) => (
                  <div key={task.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`text-sm font-semibold ${theme.primaryText}`}>{task.title}</h3>
                      <span className={`text-xs font-bold ${theme.primaryText}`}>
                        {t.score} {task.conformity!.score}/100
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {task.conformity!.criteria.map((c) => (
                        <li key={c.name} className={`text-xs ${theme.secondaryText}`}>
                          {c.passed ? '✔' : '✘'} <span className="font-medium">{c.name}</span> — {c.comment}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
            )}
          </div>
        )}

        {/* 4 — Apprentissage (downloadable learning files: replay + expected) */}
        {agentTab === 'learning' && (
          <div className="space-y-4">
            <EmptyDef text={t.defLearning} />
            <MicroLabel>{t.learningFiles}</MicroLabel>
            {[
              {
                icon: '↺',
                label: t.fileReplay,
                filename: `${agent.id}_rejeu.md`,
                content: `# Rejeu — ${agent.name}\n\n## Entrées\n${agentTasks[0]?.input ?? '(entrées de la tâche)'}\n\n## Résultat obtenu\n${agentTasks[0]?.output?.summary ?? '(résultat accompli)'}\n`,
              },
              {
                icon: '→',
                label: t.fileExpected,
                filename: `${agent.id}_exemple_attendu.md`,
                content: `# Exemple entrée → sortie attendue — ${agent.name}\n\n## Entrée\n${agentTasks[0]?.spec.objective ?? '(objectif)'}\n\n## Sortie attendue\n${agentTasks[0]?.spec.deliverableFormat ?? '(livrable attendu)'}\n`,
              },
            ].map((f) => (
              <button
                key={f.filename}
                onClick={() => downloadFile(f.filename, f.content)}
                className={`w-full flex items-center gap-3 py-3 text-left ${theme.glassHover} rounded-2xl px-3`}
              >
                <span className={`p-2.5 rounded-xl ${theme.iconBg} ${theme.primaryText} font-mono`} aria-hidden>
                  {f.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${theme.primaryText}`}>{f.label}</span>
                  <span className={`block text-xs font-mono ${theme.mutedText}`}>{f.filename}</span>
                </span>
                <Download size={16} className={theme.mutedText} aria-hidden />
              </button>
            ))}
          </div>
        )}

        {/* 5 — Compétences (synthesized over iterations) */}
        {agentTab === 'skills' &&
          (synthesizedSkills.length === 0 ? (
            <EmptyDef text={t.defSkills} />
          ) : (
            <>
              <EmptyDef text={t.defSkills} />
              <ul className="flex flex-wrap gap-2">
                {synthesizedSkills.map((s) => (
                  <li key={s} className={`px-3 py-1.5 rounded-full text-xs font-medium ${theme.iconBg} ${theme.secondaryText}`}>
                    {s}
                  </li>
                ))}
              </ul>
            </>
          ))}

        {/* 6 — Logs (traced iterations, filtered by the dock hover menu) */}
        {agentTab === 'logs' && (
          <div className="space-y-3">
            <MicroLabel>
              {logsFilter === 'all'
                ? t.tabLogs
                : logsFilter === 'user'
                ? t.logsUser
                : logsFilter === 'judge'
                ? t.logsJudge
                : t.logsLearning}
            </MicroLabel>
            {logs.length === 0 ? (
              <EmptyDef text={t.defLogs} />
            ) : (
              <ol className="space-y-2">
                {logs.map((l, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span
                      className={`shrink-0 w-24 text-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${theme.iconBg} ${theme.mutedText}`}
                    >
                      {l.category === 'user' ? t.logsUser : l.category === 'judge' ? t.logsJudge : t.logsLearning}
                    </span>
                    <p className={`text-sm ${theme.secondaryText}`}>{l.text}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* 7 — Présentation (README + real diagram + computation method) */}
        {agentTab === 'readme' && (
          <div className="space-y-6">
            <Markdown source={agent.readme} />
            <div>
              <MicroLabel className="mb-2">{t.algorithm}</MicroLabel>
              <MermaidFlow source={agent.mermaidAlgorithm} ariaLabel={`${t.algorithm} — ${agent.name}`} />
            </div>
            <MethodSection agent={agent} />
            <div>
              <MicroLabel className="mb-2">{t.skills}</MicroLabel>
              <ul className="flex flex-wrap gap-2">
                {agent.skills.map((s) => (
                  <li key={s} className={`px-3 py-1 rounded-full text-xs font-medium ${theme.iconBg} ${theme.secondaryText}`}>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default AgentPage;
