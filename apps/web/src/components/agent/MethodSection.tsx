/**
 * MethodSection — renders an agent's mandatory computation descriptor:
 *   1. the input-data → output-data algorithm graph (Mermaid);
 *   2. the explained chain of mathematical formulas (for non-specialists);
 *   3. the web links to the SOTA source of each part of the computation;
 *   4. the numeric self-checks (known input → expected output) proving the
 *      agent gives the right result.
 * A conformity badge signals whether the three mandatory parts are present.
 */
import React from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Panel, MicroLabel, CodeBlock } from '@/components/ui/Glass';
import type { AgentProfile } from '@/core/types';

/** True when the agent carries the 3 mandatory parts (graph + formulas + sources). */
export function isMethodConform(agent: AgentProfile): boolean {
  const m = agent.method;
  return Boolean(m && m.graph && m.formulas.length > 0 && m.sources.length > 0);
}

const MethodSection: React.FC<{ agent: AgentProfile }> = ({ agent }) => {
  const { theme, t } = useApp();
  const m = agent.method;

  if (!m) {
    return (
      <Panel className="p-5 flex items-center gap-3">
        <AlertTriangle size={18} className="text-amber-500 shrink-0" aria-hidden />
        <p className={`text-sm ${theme.secondaryText}`}>{t.methodMissing}</p>
      </Panel>
    );
  }

  const conform = isMethodConform(agent);
  const relTol = (tol?: number) => tol ?? 1e-3;
  const checkOk = (got: number, expected: number, tol?: number) =>
    Math.abs(got - expected) <= relTol(tol) * Math.max(Math.abs(expected), 1e-12);

  return (
    <Panel className="p-5 space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <MicroLabel>{t.method}</MicroLabel>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            conform ? 'bg-emerald-600/15 text-emerald-700' : 'bg-amber-600/15 text-amber-700'
          }`}
        >
          {conform ? <CheckCircle2 size={12} aria-hidden /> : <AlertTriangle size={12} aria-hidden />}
          {conform ? t.methodConform : t.methodPartial}
        </span>
      </div>

      {/* 1 — Input→output algorithm graph */}
      <CodeBlock label={t.methodGraph}>{m.graph}</CodeBlock>

      {/* 2 — Explained formula chain */}
      <div className="space-y-2">
        <MicroLabel>{t.methodFormulas}</MicroLabel>
        <ol className="space-y-2">
          {m.formulas.map((f, i) => (
            <li key={i} className={`rounded-2xl p-3 ${theme.iconBg}`}>
              <p className={`text-sm font-semibold ${theme.primaryText}`}>{f.name}</p>
              <p className={`font-mono text-sm my-1 ${theme.secondaryText}`}>{f.formula}</p>
              <p className={`text-xs ${theme.mutedText}`}>{f.explanation}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* 4 — Numeric self-checks (proves the right result) */}
      {m.checks && m.checks.length > 0 && (
        <div className="space-y-2">
          <MicroLabel>{t.methodChecks}</MicroLabel>
          <ul className="space-y-1">
            {m.checks.map((c, i) => {
              const ok = checkOk(c.got, c.expected, c.tol);
              return (
                <li key={i} className="flex items-start gap-2 text-xs">
                  {ok ? (
                    <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" aria-hidden />
                  ) : (
                    <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" aria-hidden />
                  )}
                  <span className={theme.secondaryText}>
                    <span className="font-medium">{c.label}</span> —{' '}
                    <span className="font-mono">
                      {c.got.toPrecision(5)} {c.unit ?? ''}
                    </span>{' '}
                    <span className={theme.mutedText}>
                      (attendu {c.expected.toPrecision(5)} {c.unit ?? ''})
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 3 — SOTA source links */}
      <div className="space-y-2">
        <MicroLabel>{t.methodSources}</MicroLabel>
        <ul className="space-y-1.5">
          {m.sources.map((s) => (
            <li key={s.url} className="text-sm">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-600 hover:underline break-all"
              >
                <ExternalLink size={13} className="shrink-0" aria-hidden />
                {s.label}
              </a>
              <span className={`block text-xs ${theme.mutedText}`}>{s.covers}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
};

export default MethodSection;
