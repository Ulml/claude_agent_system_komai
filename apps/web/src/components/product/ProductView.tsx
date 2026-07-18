/**
 * ProductView — le modèle systématique du produit demandé, conforme aux
 * notebooks de référence (Eart_House + Canopy) :
 *
 * Sections : Planning général → Planning détaillé (hiérarchie étape ←
 * détail ← sous-détail) → PRD/TRD → Conception (inputs → composants →
 * atelier) → Assemblage (quantités + unités sur les arêtes) → Prix unitaires
 * (diagonale) → CUMUL TEMPOREL (Gantt chemin critique + courbes cumulées
 * coût/masse/distance, panneaux alignés sur le même axe temps — petits
 * multiples plutôt que triple axe, pour la lisibilité) → Recyclage.
 *
 * Chaque étape montre ses représentations systématiques : graphe (dérivé),
 * matrice d'adjacence, matrice de quantités (si portée), matrice des unités,
 * listes des désignations.
 */
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { MicroLabel, Panel } from '@/components/ui/Glass';
import { Markdown } from '@/components/ui/Markdown';
import DagGraph, { TYPE_COLORS } from './DagGraph';
import { fmtValue, type MatrixModel } from '@/core/tensor';

type Section = 'planning' | 'planningDetail' | 'prd' | 'conception' | 'assembly' | 'prices' | 'cumul' | 'recycling';

const SECTIONS: { id: Section; labelKey: string }[] = [
  { id: 'planning', labelKey: 'secPlanning' },
  { id: 'planningDetail', labelKey: 'secPlanningDetail' },
  { id: 'prd', labelKey: 'secPrd' },
  { id: 'conception', labelKey: 'secConception' },
  { id: 'assembly', labelKey: 'secAssembly' },
  { id: 'prices', labelKey: 'secPrices' },
  { id: 'cumul', labelKey: 'secCumulTime' },
  { id: 'recycling', labelKey: 'secRecycling' },
];

const MatrixTable: React.FC<{ m: MatrixModel; content: 'values' | 'units' | 'quantities' }> = ({ m, content }) => {
  const { theme } = useApp();
  const cellOf = (i: number, j: number) =>
    content === 'units' ? m.units[i][j] : content === 'quantities' ? (m.values![i][j] ? fmtValue(m.values![i][j]) : '0') : fmtValue(m.adjacency[i][j]);
  const onOf = (i: number, j: number) =>
    content === 'units' ? m.units[i][j] !== '' && m.units[i][j] !== m.units[0]?.[0] : content === 'quantities' ? m.values![i][j] !== 0 : m.adjacency[i][j] !== 0;
  return (
    <div className="w-full overflow-x-auto custom-scrollbar" style={{ maxHeight: 420, overflowY: 'auto' }}>
      <table className="border-separate" style={{ borderSpacing: '2px' }}>
        <thead>
          <tr>
            <th />
            {m.cols.map((c, j) => (
              <th key={j} className={`px-1.5 py-1 text-[10px] font-bold align-bottom ${theme.mutedText}`} style={{ maxWidth: 80 }}>
                <span className="block truncate" title={c}>{c}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {m.rows.map((r, i) => (
            <tr key={i}>
              <th className={`px-1.5 py-1 text-left text-[10px] font-bold whitespace-nowrap ${theme.secondaryText}`}>{r}</th>
              {m.cols.map((_, j) => {
                const on = onOf(i, j);
                return (
                  <td
                    key={j}
                    title={`${r} × ${m.cols[j]} = ${cellOf(i, j)}`}
                    className={`px-1.5 py-1 rounded text-center text-[10px] font-mono ${on ? `font-bold ${theme.primaryText}` : theme.mutedText} ${
                      on ? (theme.isDark ? 'bg-sky-400/25' : 'bg-sky-600/15') : theme.isDark ? 'bg-slate-700/25' : 'bg-slate-400/10'
                    }`}
                  >
                    {on || content !== 'units' ? cellOf(i, j) : '·'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** Une étape : graphe + matrices + désignations (+ légende des types). */
const StepModelSection: React.FC<{ m: MatrixModel }> = ({ m }) => {
  const { theme, t } = useApp();
  const types = m.nodeTypes ? [...new Set(m.nodeTypes)] : [];
  return (
    <div className="space-y-4">
      {types.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {types.map((ty, k) => (
            <li key={ty} className={`flex items-center gap-1.5 text-xs ${theme.secondaryText}`}>
              <span className="w-3 h-3 rounded-full" style={{ background: TYPE_COLORS[k % TYPE_COLORS.length] }} aria-hidden />
              {ty}
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-1.5">
        <MicroLabel>{t.repGraph}</MicroLabel>
        <DagGraph model={m} ariaLabel={`${t.repGraph} — ${m.title}`} />
      </div>
      <div className="space-y-1.5">
        <MicroLabel>{t.repAdjacency}</MicroLabel>
        <MatrixTable m={m} content="values" />
      </div>
      {m.values && (
        <div className="space-y-1.5">
          <MicroLabel>{t.repValues}</MicroLabel>
          <MatrixTable m={m} content="quantities" />
        </div>
      )}
      <div className="space-y-1.5">
        <MicroLabel>{t.repUnits}</MicroLabel>
        <MatrixTable m={m} content="units" />
      </div>
      <div className="space-y-1.5">
        <MicroLabel>{t.repDesignations}</MicroLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(['rows', 'cols'] as const).map((side) => (
            <Panel key={side} className="p-3">
              <p className={`text-[10px] font-bold uppercase tracking-wider pb-1 ${theme.mutedText}`}>
                {side === 'rows' ? t.repRows : t.repCols}
              </p>
              <ol className={`list-decimal pl-5 text-xs space-y-0.5 ${theme.secondaryText}`}>
                {(side === 'rows' ? m.rows : m.cols).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ol>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  );
};

const ProductView: React.FC = () => {
  const { theme, t, productModel, pipelineProgress } = useApp();
  const [section, setSection] = useState<Section>('planning');

  if (!productModel) {
    return (
      <div className="text-center py-16 px-6 max-w-xl mx-auto space-y-4">
        {pipelineProgress ? (
          <>
            <Loader2 size={22} className={`mx-auto animate-spin ${theme.secondaryText}`} aria-hidden />
            <p className={`text-sm leading-relaxed ${theme.secondaryText}`}>
              {t.pipelineStep} {pipelineProgress.step}/7 — {pipelineProgress.label}
            </p>
            <p className={`text-xs ${theme.mutedText}`}>{t.pipelineAgent} : {pipelineProgress.agentName}</p>
          </>
        ) : (
          <p className={`text-sm leading-relaxed ${theme.mutedText}`}>{t.productEmpty}</p>
        )}
      </div>
    );
  }

  const M = productModel;
  const stepOf: Record<Exclude<Section, 'prd' | 'cumul'>, MatrixModel> = {
    planning: M.planning,
    planningDetail: M.planningDetail,
    conception: M.conception,
    assembly: M.assembly,
    prices: M.prices,
    recycling: M.recycling,
  };

  /* ---- Cumul temporel : Gantt + courbes (axe temps partagé) ---- */
  const { nodeDelays, ef, ls, deadline } = M.schedule;
  const n = M.assembly.rows.length;
  const es = ef.map((e, i) => e - nodeDelays[i]);
  const CHART_W = 860;
  const LBL_W = 210;
  const ROW_H = 18;
  const tScale = (tt: number) => LBL_W + (tt / deadline) * (CHART_W - LBL_W - 16);
  const ganttH = n * ROW_H + 30;
  const strokeC = theme.isDark ? '#64748b' : '#94a3b8';
  const textC = theme.isDark ? '#e2e8f0' : '#0f172a';
  const subC = theme.isDark ? '#94a3b8' : '#64748b';

  return (
    <section aria-label={t.product} className="w-full max-w-6xl mx-auto px-4 py-6 animate-fade-up space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <MicroLabel>{t.product} — {M.request}</MicroLabel>
        {M.simulated && <span className={`text-[11px] ${theme.mutedText}`}>{t.simulatedModelNote}</span>}
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label={t.product}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            aria-pressed={section === s.id}
            onClick={() => setSection(s.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              section === s.id ? theme.userBubble : `${theme.secondaryText} ${theme.glassHover} border ${theme.glassBorder}`
            }`}
          >
            {t[s.labelKey]}
          </button>
        ))}
      </nav>

      {section === 'prd' && <div className="max-w-3xl"><Markdown source={M.prd} /></div>}
      {section !== 'prd' && section !== 'cumul' && <StepModelSection m={stepOf[section]} />}

      {section === 'cumul' && (
        <div className="space-y-4">
          {/* Quantités totales (Leontief) */}
          <div className="space-y-1.5">
            <MicroLabel>{t.qTotalLabel}</MicroLabel>
            <ul className="flex flex-wrap gap-1.5">
              {M.assembly.rows.map((r, i) => (
                <li key={i} className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${theme.iconBg} ${theme.secondaryText}`}>
                  {r} = {fmtValue(M.qTotal[i])}
                </li>
              ))}
            </ul>
          </div>

          {/* Gantt (chemin critique) */}
          <div className="space-y-1.5">
            <MicroLabel>{t.ganttLabel}</MicroLabel>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              <li className={`flex items-center gap-1.5 text-xs ${theme.secondaryText}`}>
                <span className="w-4 h-2 rounded-sm bg-rose-500" aria-hidden /> {t.criticalLabel}
              </li>
              <li className={`flex items-center gap-1.5 text-xs ${theme.secondaryText}`}>
                <span className="w-4 h-2 rounded-sm bg-sky-500" aria-hidden /> {t.nonCriticalLabel}
              </li>
            </ul>
            <div className="w-full overflow-x-auto custom-scrollbar">
              <svg viewBox={`0 0 ${CHART_W} ${ganttH}`} width={CHART_W} className="max-w-none h-auto" role="img" aria-label={t.ganttLabel}>
                {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                  <g key={f}>
                    <line x1={tScale(f * deadline)} y1={14} x2={tScale(f * deadline)} y2={ganttH - 14} stroke={strokeC} strokeDasharray="2 4" opacity={0.4} />
                    <text x={tScale(f * deadline)} y={10} fontSize="8.5" fill={subC} textAnchor="middle">{fmtValue(f * deadline)} j</text>
                  </g>
                ))}
                {M.assembly.rows.map((r, i) => {
                  const critical = ls[i] > -900 && Math.abs(ls[i] - es[i]) < 1e-6;
                  const y = 18 + i * ROW_H;
                  return (
                    <g key={i}>
                      <title>{`${r} : ${fmtValue(es[i])} → ${fmtValue(ef[i])} j${critical ? ' — chemin critique' : ''}`}</title>
                      <text x={LBL_W - 8} y={y + 9} fontSize="8.5" fill={textC} textAnchor="end">{r.length > 34 ? r.slice(0, 33) + '…' : r}</text>
                      {ls[i] > -900 && ls[i] - es[i] > 1e-6 && (
                        <rect x={tScale(es[i])} y={y + 3} width={Math.max(1, tScale(es[i] + (ls[i] - es[i])) - tScale(es[i]))} height={5} rx={2} fill={strokeC} opacity={0.35} />
                      )}
                      <rect x={tScale(es[i])} y={y} width={Math.max(2, tScale(ef[i]) - tScale(es[i]))} height={11} rx={3} fill={critical ? '#f43f5e' : '#0ea5e9'} opacity={0.85} />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Courbes cumulées — petits multiples (un panneau par couche) */}
          <div className="space-y-1.5">
            <MicroLabel>{t.cumulCurvesLabel}</MicroLabel>
            <p className={`text-[11px] ${theme.mutedText}`}>{t.cumulTimeHint}</p>
            {M.layers.map((l) => {
              const curve = M.curves.find((c) => c.layerId === l.id)!;
              const vMax = Math.max(...curve.cum, 1e-9);
              const PH = 90;
              const yS = (v: number) => 14 + (1 - v / vMax) * (PH - 28);
              const path = curve.time.map((tt, k) => `${k === 0 ? 'M' : 'L'}${tScale(tt).toFixed(1)},${yS(curve.cum[k]).toFixed(1)}`).join(' ');
              return (
                <div key={l.id} className="w-full overflow-x-auto custom-scrollbar">
                  <svg viewBox={`0 0 ${CHART_W} ${PH}`} width={CHART_W} className="max-w-none h-auto" role="img" aria-label={`${l.name} (${l.unit})`}>
                    <text x={LBL_W - 8} y={PH / 2} fontSize="10" fontWeight={700} fill={textC} textAnchor="end">{l.name} ({l.unit})</text>
                    <line x1={LBL_W} y1={PH - 14} x2={CHART_W - 16} y2={PH - 14} stroke={strokeC} opacity={0.5} />
                    <path d={path} fill="none" stroke={theme.isDark ? '#38bdf8' : '#0284c7'} strokeWidth={2} strokeLinejoin="round" />
                    <text x={CHART_W - 16} y={yS(curve.cum[curve.cum.length - 1]) - 4} fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight={700} fill={textC} textAnchor="end">
                      {fmtValue(curve.cum[curve.cum.length - 1])} {l.unit}
                    </text>
                  </svg>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

export default ProductView;
