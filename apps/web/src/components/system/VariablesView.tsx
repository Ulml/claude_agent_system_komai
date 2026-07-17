/**
 * VariablesView — l'ESPACE DE VARIABLES du système rendu comme TENSEUR NOMMÉ,
 * DE BOUT EN BOUT : des environnants sourcés jusqu'aux CRITÈRES DE CONFORT DE
 * L'UTILISATEUR HUMAIN. Vues (réduction de la dette de compréhension) :
 *
 *   A — GRAPHE PORTÉ (métaphore Grasshopper / Blueprints) : les variables en
 *       nœuds, colonnes par rôle (environnant → compromis → état →
 *       performance → CONFORT HUMAIN), fils = dépendances de calcul.
 *       Cliquer une variable surligne sa chaîne amont.
 *   CALCUL PAS À PAS — aucune boîte noire : la chaîne de la variable
 *       sélectionnée, formule symbolique + substitution numérique du
 *       scénario, de l'environnant au critère humain.
 *   B — JAUGES BULLET (Stephen Few) : les CRITÈRES HUMAINS d'abord, puis les
 *       exigences déduites (performances), contre leurs zones de conformité.
 *   C — MATRICE variables × scénarios : le tenseur rendu tel quel — couleur
 *       séquentielle (une teinte) normalisée PAR LIGNE, valeurs visibles.
 *   D — CONCLUSIONS POUR L'OPTIMISEUR : critères hors zone, scénarios
 *       concernés, leviers de compromis — l'arbitrage à expliquer.
 *
 * Le sélecteur de scénario (rangée de filtres) pilote toutes les vues.
 * Couleur toujours doublée de texte/icône (accessibilité). Les données
 * viennent de core/variables.ts (SSOT du tenseur).
 */
import React, { useMemo, useState } from 'react';
import { CheckCircle2, Wrench, XCircle } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { MicroLabel, Panel } from '@/components/ui/Glass';
import {
  buildVariableSpace,
  fmtValue as fmt,
  isConform,
  ROLE_COLORS,
  ROLE_LABEL_KEYS,
  ROLE_ORDER,
  type NamedVariable,
  type ScenarioId,
  type VariableRole,
} from '@/core/variables';

/* ---- View A layout constants ---- */
const NODE_W = 162;
const COL_GAP = 42;
const NODE_GAP = 16;
const LINE_H = 13;

/** The default selected variable: the FIRST HUMAN CRITERION — the step-by-step
 *  chain down to the occupant is visible without any click (no black box). */
const DEFAULT_TARGET = 'T_op';

const wrap = (text: string, maxChars: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > maxChars) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
};

const VariablesView: React.FC = () => {
  const { theme, t, systemComponents, selectedProjectId } = useApp();
  const [scenario, setScenario] = useState<ScenarioId>('hiver-nuit');
  const [selectedVar, setSelectedVar] = useState<string | null>(null);

  const space = useMemo(
    () => buildVariableSpace(systemComponents.filter((c) => c.projectId === selectedProjectId)),
    [systemComponents, selectedProjectId]
  );

  if (!space) {
    return (
      <p className={`text-center py-16 px-6 text-sm max-w-xl mx-auto leading-relaxed ${theme.mutedText}`}>
        {t.variablesEmpty}
      </p>
    );
  }

  const mode = theme.isDark ? 'dark' : 'light';
  const roleColor = (r: VariableRole) => ROLE_COLORS[r][mode];
  const byId = new Map(space.variables.map((v) => [v.id, v]));
  const target = selectedVar && byId.has(selectedVar) ? selectedVar : DEFAULT_TARGET;

  /* ---- View A geometry: 5 role columns, wrapped labels, dynamic heights ---- */
  const cols = ROLE_ORDER.map((role) => space.variables.filter((v) => v.role === role));
  const nodeLines = new Map(space.variables.map((v) => [v.id, wrap(v.name, 22)]));
  const nodeH = (v: NamedVariable) => 12 + nodeLines.get(v.id)!.length * LINE_H + 18 + 8;
  const colHeights = cols.map((vs) => vs.reduce((s, v) => s + nodeH(v), 0) + Math.max(0, vs.length - 1) * NODE_GAP);
  const H = Math.max(...colHeights) + 40;
  const W = ROLE_ORDER.length * NODE_W + (ROLE_ORDER.length - 1) * COL_GAP + 32;
  const colX = (ci: number) => 16 + ci * (NODE_W + COL_GAP);
  const nodePos = new Map<string, { x: number; y: number; h: number }>();
  cols.forEach((vs, ci) => {
    let y = (H - colHeights[ci]) / 2;
    vs.forEach((v) => {
      nodePos.set(v.id, { x: colX(ci), y, h: nodeH(v) });
      y += nodeH(v) + NODE_GAP;
    });
  });

  // Upstream chain of the target variable, in CALCULATION ORDER (topological:
  // dependencies first) — it feeds both the highlight and the step-by-step.
  const chainIds: string[] = [];
  {
    const seen = new Set<string>();
    const visit = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      byId.get(id)?.dependsOn.forEach(visit);
      chainIds.push(id);
    };
    visit(target);
  }
  const upstream = new Set(chainIds);

  const stroke = theme.isDark ? '#64748b' : '#94a3b8';
  const textColor = theme.isDark ? '#e2e8f0' : '#0f172a';
  const subColor = theme.isDark ? '#94a3b8' : '#64748b';
  const nodeFill = theme.isDark ? '#1e293b' : '#ffffff';
  const highlight = roleColor(byId.get(target)!.role);

  /* ---- Sequential fill for the matrix (one hue, normalised PER ROW) ---- */
  const cellStyle = (v: NamedVariable, s: ScenarioId): { style: React.CSSProperties; darkText: boolean } => {
    const vals = space.scenarios.map((sc) => v.values[sc.id]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const tt = max > min ? (v.values[s] - min) / (max - min) : 0;
    const alpha = theme.isDark ? 0.1 + 0.58 * tt : 0.07 + 0.68 * tt;
    const hue = theme.isDark ? '56,189,248' : '2,132,199';
    return {
      style: { backgroundColor: `rgba(${hue},${alpha.toFixed(2)})` },
      darkText: theme.isDark ? alpha > 0.5 : alpha < 0.45,
    };
  };

  const scLabel = (id: ScenarioId) => t[space.scenarios.find((s) => s.id === id)!.labelKey];
  /** Requirement-carrying vars, HUMAN criteria first (they are the end of the
   *  chain), then the deduced performance requirements. */
  const judgedGroups: { role: VariableRole; note?: string; vars: NamedVariable[] }[] = [
    { role: 'confort', vars: space.variables.filter((v) => v.role === 'confort' && v.requirement) },
    { role: 'performance', note: t.deducedPerfNote, vars: space.variables.filter((v) => v.role === 'performance' && v.requirement) },
  ];
  const nonConform = space.variables
    .filter((v) => v.requirement)
    .map((v) => ({ v, bad: space.scenarios.filter((s) => isConform(v, s.id) === false) }))
    .filter((x) => x.bad.length > 0);

  /* ---- Bullet domain: show the zone without letting an open range flatten it ---- */
  const bulletDomain = (v: NamedVariable): number => {
    const maxVal = Math.max(...space.scenarios.map((s) => v.values[s.id]));
    const r = v.requirement!;
    return Math.max(Math.min(r.max, maxVal * 2.5), maxVal * 1.15, r.min * 1.3, 1e-9);
  };

  return (
    <section aria-label={t.variablesTitle} className="w-full max-w-6xl mx-auto px-4 py-6 animate-fade-up space-y-5">
      <div className="space-y-1">
        <MicroLabel>{t.variablesTitle}</MicroLabel>
        <p className={`text-xs max-w-3xl leading-relaxed ${theme.mutedText}`}>{t.tensorNote}</p>
      </div>

      {/* Filter row: the SCENARIO axis of the tensor (drives all views) */}
      <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label={t.scenarioLabel}>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${theme.mutedText}`}>{t.scenarioLabel}</span>
        {space.scenarios.map((s) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={scenario === s.id}
            onClick={() => setScenario(s.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              scenario === s.id ? theme.userBubble : `${theme.secondaryText} ${theme.glassHover} border ${theme.glassBorder}`
            }`}
          >
            {t[s.labelKey]}
          </button>
        ))}
      </div>

      {/* Role legend: chip + WRITTEN role name (never color alone) */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {ROLE_ORDER.map((r) => (
          <li key={r} className={`flex items-center gap-1.5 text-xs ${theme.secondaryText}`}>
            <span className="w-3 h-3 rounded-full" style={{ background: roleColor(r) }} aria-hidden />
            {t[ROLE_LABEL_KEYS[r]]}
          </li>
        ))}
      </ul>

      {/* ---------- A — ported node graph (down to the HUMAN column) ---------- */}
      <div className="space-y-2">
        <MicroLabel>{t.viewGraphLabel}</MicroLabel>
        <p className={`text-[11px] ${theme.mutedText}`}>{t.viewGraphHint}</p>
        <div className="w-full overflow-x-auto custom-scrollbar">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} className="max-w-none h-auto" style={{ minWidth: 1020 }} role="img" aria-label={t.viewGraphLabel}>
            {/* wires (under the nodes) */}
            {space.variables.flatMap((v) =>
              v.dependsOn.map((dep) => {
                const a = nodePos.get(dep);
                const b = nodePos.get(v.id);
                if (!a || !b) return null;
                const x1 = a.x + NODE_W;
                const y1 = a.y + a.h / 2;
                const x2 = b.x;
                const y2 = b.y + b.h / 2;
                const hot = upstream.has(v.id) && upstream.has(dep);
                return (
                  <path
                    key={`${dep}-${v.id}`}
                    d={`M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke={hot ? highlight : stroke}
                    strokeWidth={hot ? 2.5 : 1.3}
                    opacity={hot ? 0.95 : 0.4}
                  />
                );
              })
            )}
            {/* variable nodes */}
            {space.variables.map((v) => {
              const p = nodePos.get(v.id)!;
              const lines = nodeLines.get(v.id)!;
              const hot = upstream.has(v.id);
              const conform = isConform(v, scenario);
              return (
                <g
                  key={v.id}
                  onClick={() => setSelectedVar(v.id === target ? null : v.id)}
                  style={{ cursor: 'pointer' }}
                  role="button"
                  aria-label={`${v.name} ${v.symbol} = ${fmt(v.values[scenario])} ${v.unit}`}
                >
                  <title>{`${v.name} — ${v.symbol} = ${fmt(v.values[scenario])} ${v.unit} (${scLabel(scenario)})`}</title>
                  <rect
                    x={p.x}
                    y={p.y}
                    width={NODE_W}
                    height={p.h}
                    rx={12}
                    fill={nodeFill}
                    stroke={hot ? highlight : stroke}
                    strokeWidth={hot ? 2.2 : 1.2}
                    opacity={hot ? 1 : 0.6}
                  />
                  <rect x={p.x} y={p.y + 6} width={4} height={p.h - 12} rx={2} fill={roleColor(v.role)} />
                  <text x={p.x + 14} y={p.y + 12 + LINE_H - 3} fontSize="10.5" fontWeight={700} fill={textColor}>
                    {lines.map((ln, i) => (
                      <tspan key={i} x={p.x + 14} dy={i === 0 ? 0 : LINE_H}>
                        {ln}
                      </tspan>
                    ))}
                  </text>
                  <text
                    x={p.x + 14}
                    y={p.y + 12 + lines.length * LINE_H + 12}
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={600}
                    fill={conform === false ? '#e11d48' : subColor}
                  >
                    {v.symbol} = {fmt(v.values[scenario])} {v.unit}
                    {conform !== undefined ? (conform ? ' ✓' : ' ✗') : ''}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ---------- Step-by-step calculation of the selected chain ---------- */}
      <div className="space-y-2">
        <MicroLabel>{t.viewChainLabel}</MicroLabel>
        <p className={`text-[11px] ${theme.mutedText}`}>{t.viewChainHint}</p>
        <Panel className="p-4">
          <p className={`text-xs font-bold pb-2 ${theme.primaryText}`}>
            {byId.get(target)!.name} — {scLabel(scenario)}
          </p>
          <ol className="space-y-2">
            {chainIds.map((id, i) => {
              const v = byId.get(id)!;
              const conform = isConform(v, scenario);
              return (
                <li key={id} className="flex gap-3 items-start">
                  <span className={`shrink-0 w-6 text-center text-[11px] font-bold ${theme.mutedText}`}>{i + 1}.</span>
                  <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: roleColor(v.role) }} aria-hidden />
                  <div className="min-w-0">
                    <p className={`text-xs ${theme.secondaryText}`}>
                      <span className={`font-semibold ${theme.primaryText}`}>{v.name}</span>
                      {v.formula && <span className={`ml-2 ${theme.mutedText}`}>{v.formula}</span>}
                    </p>
                    <p className={`text-xs font-mono ${conform === false ? 'text-rose-600 font-bold' : theme.secondaryText}`}>
                      {v.calc
                        ? v.calc(scenario)
                        : `${v.symbol} = ${fmt(v.values[scenario])} ${v.unit}${
                            v.role === 'environnant' ? '  (recherché, sourcé — environnant)' : v.role === 'compromis' ? '  (compromis — à optimiser)' : ''
                          }`}
                      {v.requirement && (
                        <span className={`ml-2 font-sans font-semibold ${conform ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {conform ? (
                            <>
                              <CheckCircle2 size={11} className="inline mr-0.5 -mt-0.5" aria-hidden />
                              {t.conformOk}
                            </>
                          ) : (
                            <>
                              <XCircle size={11} className="inline mr-0.5 -mt-0.5" aria-hidden />
                              {t.conformKo}
                            </>
                          )}{' '}
                          ({t.requiredLabel} {fmt(v.requirement.min)}–{fmt(v.requirement.max)} {v.requirement.unit})
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>

      {/* ---------- B — bullet gauges: HUMAN criteria first ---------- */}
      <div className="space-y-2">
        <MicroLabel>{t.viewBulletsLabel}</MicroLabel>
        <p className={`text-[11px] ${theme.mutedText}`}>{t.viewBulletsHint}</p>
        {judgedGroups.map((group) => (
          <div key={group.role} className="space-y-2">
            <p className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider pt-1 ${theme.mutedText}`}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: roleColor(group.role) }} aria-hidden />
              {t[ROLE_LABEL_KEYS[group.role]]}
              {group.note && <span className="normal-case font-medium tracking-normal">— {group.note}</span>}
            </p>
            {group.vars.map((v) => {
              const r = v.requirement!;
              const domain = bulletDomain(v);
              const pct = (x: number) => `${Math.min(100, Math.max(0, (x / domain) * 100)).toFixed(1)}%`;
              const bad = space.scenarios.filter((s) => isConform(v, s.id) === false);
              const vals = space.scenarios.map((s) => v.values[s.id]);
              const vMin = Math.min(...vals);
              const vMax = Math.max(...vals);
              const sparkY = (x: number) => (vMax > vMin ? 17 - ((x - vMin) / (vMax - vMin)) * 14 : 10);
              return (
                <Panel key={v.id} className="p-3 space-y-2">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className={`text-xs font-bold ${theme.primaryText}`}>
                      {v.name} <span className={`font-mono font-semibold ${theme.mutedText}`}>({v.symbol}, {v.unit})</span>
                    </span>
                    <span className={`text-[11px] font-mono ${theme.mutedText}`}>
                      {t.requiredLabel} {fmt(r.min)}–{fmt(r.max)} {r.unit}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* the bullet: track + conformity band + one dot per scenario */}
                    <div className={`relative flex-1 h-6 rounded-full overflow-hidden ${theme.isDark ? 'bg-slate-700/40' : 'bg-slate-300/40'}`}>
                      <div
                        className={`absolute inset-y-0 ${theme.isDark ? 'bg-emerald-400/25' : 'bg-emerald-500/20'}`}
                        style={{ left: pct(r.min), width: `calc(${pct(Math.min(r.max, domain))} - ${pct(r.min)})` }}
                        aria-hidden
                      />
                      {space.scenarios.map((s) => {
                        const ok = isConform(v, s.id) !== false;
                        return (
                          <span
                            key={s.id}
                            title={`${t[s.labelKey]} : ${fmt(v.values[s.id])} ${v.unit}`}
                            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full ring-2 ${
                              ok ? 'bg-emerald-600' : 'bg-rose-600'
                            } ${scenario === s.id ? 'ring-white scale-125' : theme.isDark ? 'ring-slate-900/70' : 'ring-white/80'}`}
                            style={{ left: pct(v.values[s.id]) }}
                          />
                        );
                      })}
                    </div>
                    {/* sparkline across the 4 scenarios (the row of the tensor) */}
                    <svg width={64} height={20} aria-hidden className={theme.secondaryText}>
                      <polyline
                        points={vals.map((x, i) => `${4 + i * 18},${sparkY(x)}`).join(' ')}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {/* verdict: icon + WRITTEN text */}
                    {bad.length === 0 ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 shrink-0">
                        <CheckCircle2 size={13} aria-hidden /> {t.conformOk}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 shrink-0">
                        <XCircle size={13} aria-hidden /> {t.conformKo} : {bad.map((s) => t[s.labelKey]).join(', ')}
                      </span>
                    )}
                  </div>
                </Panel>
              );
            })}
          </div>
        ))}
      </div>

      {/* ---------- C — the rendered tensor: variables × scenarios matrix ---------- */}
      <div className="space-y-2">
        <MicroLabel>{t.viewMatrixLabel}</MicroLabel>
        <p className={`text-[11px] ${theme.mutedText}`}>{t.viewMatrixHint}</p>
        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="w-full border-separate" style={{ borderSpacing: '2px', minWidth: 640 }}>
            <thead>
              <tr>
                <th className={`text-left text-[10px] font-bold uppercase tracking-wider px-2 py-1 ${theme.mutedText}`}>
                  {t.variables}
                </th>
                {space.scenarios.map((s) => (
                  <th key={s.id} className="px-1 py-1">
                    <button
                      onClick={() => setScenario(s.id)}
                      aria-pressed={scenario === s.id}
                      className={`w-full px-2 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                        scenario === s.id ? theme.userBubble : `${theme.secondaryText} ${theme.glassHover}`
                      }`}
                    >
                      {t[s.labelKey]}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLE_ORDER.map((role) => (
                <React.Fragment key={role}>
                  <tr>
                    <td colSpan={5} className="pt-2 pb-0.5 px-2">
                      <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${theme.mutedText}`}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: roleColor(role) }} aria-hidden />
                        {t[ROLE_LABEL_KEYS[role]]}
                      </span>
                    </td>
                  </tr>
                  {space.variables
                    .filter((v) => v.role === role)
                    .map((v) => (
                      <tr key={v.id}>
                        <td className={`px-2 py-1 text-xs whitespace-nowrap ${theme.secondaryText}`}>
                          <span className="font-mono font-bold">{v.symbol}</span> · {v.name}{' '}
                          <span className={theme.mutedText}>({v.unit})</span>
                        </td>
                        {space.scenarios.map((s) => {
                          const { style, darkText } = cellStyle(v, s.id);
                          const conform = isConform(v, s.id);
                          return (
                            <td
                              key={s.id}
                              style={style}
                              title={`${v.name} · ${t[s.labelKey]} = ${fmt(v.values[s.id])} ${v.unit}`}
                              className={`px-2 py-1.5 rounded-md text-center text-[11px] font-mono font-semibold ${
                                scenario === s.id ? 'outline outline-2 -outline-offset-1 outline-current' : ''
                              } ${darkText ? 'text-slate-900' : theme.isDark ? 'text-slate-100' : 'text-slate-900'}`}
                            >
                              {fmt(v.values[s.id])}
                              {conform !== undefined &&
                                (conform ? (
                                  <CheckCircle2 size={11} className="inline ml-1 -mt-0.5 text-emerald-600" aria-label={t.conformOk} />
                                ) : (
                                  <XCircle size={11} className="inline ml-1 -mt-0.5 text-rose-600" aria-label={t.conformKo} />
                                ))}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- D — conclusions for the optimizer ---------- */}
      <div className="space-y-2">
        <MicroLabel>{t.viewOptimLabel}</MicroLabel>
        <p className={`text-[11px] ${theme.mutedText}`}>{t.viewOptimHint}</p>
        {nonConform.length === 0 ? (
          <Panel className="p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
              <CheckCircle2 size={15} aria-hidden /> {t.allConformMsg}
            </p>
          </Panel>
        ) : (
          <div className="space-y-2">
            {nonConform.map(({ v, bad }) => {
              const compromisLevers = chainLevers(v, byId);
              return (
                <Panel key={v.id} className="p-4 space-y-1.5">
                  <p className="flex items-center gap-2 text-sm font-bold text-rose-600">
                    <XCircle size={15} aria-hidden />
                    {v.name} — {t.conformKo} : {bad.map((s) => t[s.labelKey]).join(', ')}
                  </p>
                  <p className={`text-xs font-mono ${theme.secondaryText}`}>
                    {bad.map((s) => `${t[s.labelKey]} : ${v.symbol} = ${fmt(v.values[s.id])} ${v.unit}`).join(' · ')}{' '}
                    ({t.requiredLabel} {fmt(v.requirement!.min)}–{fmt(v.requirement!.max)} {v.requirement!.unit})
                  </p>
                  <p className={`flex items-start gap-1.5 text-xs leading-relaxed ${theme.secondaryText}`}>
                    <Wrench size={13} className="mt-0.5 shrink-0" aria-hidden />
                    <span>
                      <span className="font-bold">{t.leversLabel}</span>
                      {compromisLevers.length > 0 && (
                        <span className="font-mono"> [{compromisLevers.join(', ')}]</span>
                      )}{' '}
                      : {v.levers ?? '—'}
                    </span>
                  </p>
                </Panel>
              );
            })}
            <p className={`text-xs max-w-3xl leading-relaxed ${theme.mutedText}`}>{t.optimConflictNote}</p>
          </div>
        )}
      </div>
    </section>
  );
};

/** The compromis variables present in the upstream chain of `v` — computed
 *  from the dependency graph itself (never hard-coded). */
function chainLevers(v: NamedVariable, byId: Map<string, NamedVariable>): string[] {
  const seen = new Set<string>();
  const levers: string[] = [];
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = byId.get(id);
    if (!node) return;
    if (node.role === 'compromis') levers.push(node.symbol);
    node.dependsOn.forEach(visit);
  };
  visit(v.id);
  return levers;
}

export default VariablesView;
