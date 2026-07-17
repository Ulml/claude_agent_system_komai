/**
 * ProductView — l'onglet « Produit » : le modèle systématique du produit
 * demandé, construit par le système agentique du pipeline (voir
 * core/productPipeline.ts).
 *
 * CHAQUE étape (planning général, planning détaillé, graphe produit,
 * assemblage, grandeurs) est montrée sous ses 4 REPRÉSENTATIONS :
 *   ① le GRAPHE (dérivé de la matrice), ② la MATRICE D'ADJACENCE,
 *   ③ la MATRICE DES UNITÉS, ④ les LISTES DE DÉSIGNATIONS.
 *
 * La section CUMUL montre les couches du tenseur (coût, masse, …) propagées
 * le long du graphe d'assemblage : le graphe des grandeurs cumulées, couche
 * par couche (sélecteur), plus la matrice cumulée nœuds × couches.
 */
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { MicroLabel, Panel } from '@/components/ui/Glass';
import { Markdown } from '@/components/ui/Markdown';
import DagGraph from './DagGraph';
import { fmtValue, type MatrixModel } from '@/core/tensor';

type Section = 'prd' | 'planning' | 'planningDetail' | 'product' | 'assembly' | 'quantities' | 'cumul';

const SECTIONS: { id: Section; labelKey: string }[] = [
  { id: 'planning', labelKey: 'secPlanning' },
  { id: 'planningDetail', labelKey: 'secPlanningDetail' },
  { id: 'prd', labelKey: 'secPrd' },
  { id: 'product', labelKey: 'secProduct' },
  { id: 'assembly', labelKey: 'secAssembly' },
  { id: 'quantities', labelKey: 'secQuantities' },
  { id: 'cumul', labelKey: 'secCumul' },
];

/** Table générique d'une matrice (adjacence ou unités) avec désignations. */
const MatrixTable: React.FC<{ m: MatrixModel; content: 'values' | 'units' }> = ({ m, content }) => {
  const { theme } = useApp();
  return (
    <div className="w-full overflow-x-auto custom-scrollbar">
      <table className="border-separate" style={{ borderSpacing: '2px' }}>
        <thead>
          <tr>
            <th />
            {m.cols.map((c, j) => (
              <th key={j} className={`px-1.5 py-1 text-[10px] font-bold align-bottom ${theme.mutedText}`} style={{ maxWidth: 90 }}>
                <span className="block truncate" title={c}>
                  {c}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {m.rows.map((r, i) => (
            <tr key={i}>
              <th className={`px-1.5 py-1 text-left text-[10px] font-bold whitespace-nowrap ${theme.secondaryText}`}>{r}</th>
              {m.cols.map((_, j) => {
                const v = content === 'values' ? m.adjacency[i][j] : undefined;
                const cell = content === 'values' ? fmtValue(m.adjacency[i][j]) : m.units[i][j];
                const on = content === 'values' && v !== 0;
                return (
                  <td
                    key={j}
                    title={`${r} × ${m.cols[j]} = ${cell}`}
                    className={`px-1.5 py-1 rounded text-center text-[10px] font-mono ${
                      on ? `font-bold ${theme.primaryText}` : theme.mutedText
                    } ${on ? (theme.isDark ? 'bg-sky-400/25' : 'bg-sky-600/15') : theme.isDark ? 'bg-slate-700/25' : 'bg-slate-400/10'}`}
                  >
                    {cell}
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

/** Une étape complète : les 4 représentations systématiques. */
const StepModelSection: React.FC<{ m: MatrixModel }> = ({ m }) => {
  const { theme, t } = useApp();
  const isGraph = m.kind !== 'quantities'; // grandeurs = matrice rectangulaire, pas un graphe
  return (
    <div className="space-y-4">
      {isGraph && (
        <div className="space-y-1.5">
          <MicroLabel>{t.repGraph}</MicroLabel>
          <DagGraph model={m} ariaLabel={`${t.repGraph} — ${m.title}`} />
        </div>
      )}
      <div className="space-y-1.5">
        <MicroLabel>{t.repAdjacency}</MicroLabel>
        <MatrixTable m={m} content="values" />
      </div>
      <div className="space-y-1.5">
        <MicroLabel>{t.repUnits}</MicroLabel>
        <MatrixTable m={m} content="units" />
      </div>
      <div className="space-y-1.5">
        <MicroLabel>{t.repDesignations}</MicroLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Panel className="p-3">
            <p className={`text-[10px] font-bold uppercase tracking-wider pb-1 ${theme.mutedText}`}>{t.repRows}</p>
            <ol className={`list-decimal pl-5 text-xs space-y-0.5 ${theme.secondaryText}`}>
              {m.rows.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ol>
          </Panel>
          <Panel className="p-3">
            <p className={`text-[10px] font-bold uppercase tracking-wider pb-1 ${theme.mutedText}`}>{t.repCols}</p>
            <ol className={`list-decimal pl-5 text-xs space-y-0.5 ${theme.secondaryText}`}>
              {m.cols.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
};

const ProductView: React.FC = () => {
  const { theme, t, productModel, pipelineProgress } = useApp();
  const [section, setSection] = useState<Section>('planning');
  const [layerId, setLayerId] = useState<string | null>(null);

  if (!productModel) {
    return (
      <div className="text-center py-16 px-6 max-w-xl mx-auto space-y-4">
        {pipelineProgress ? (
          <>
            <Loader2 size={22} className={`mx-auto animate-spin ${theme.secondaryText}`} aria-hidden />
            <p className={`text-sm leading-relaxed ${theme.secondaryText}`}>
              {t.pipelineStep} {pipelineProgress.step}/7 — {pipelineProgress.label}
            </p>
            <p className={`text-xs ${theme.mutedText}`}>
              {t.pipelineAgent} : {pipelineProgress.agentName}
            </p>
          </>
        ) : (
          <p className={`text-sm leading-relaxed ${theme.mutedText}`}>{t.productEmpty}</p>
        )}
      </div>
    );
  }

  const layers = productModel.layers;
  const layer = layers.find((l) => l.id === layerId) ?? layers[0];
  const cumul = productModel.cumulated.find((c) => c.layerId === layer?.id);

  return (
    <section aria-label={t.product} className="w-full max-w-6xl mx-auto px-4 py-6 animate-fade-up space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <MicroLabel>
          {t.product} — {productModel.request}
        </MicroLabel>
        {productModel.simulated && <span className={`text-[11px] ${theme.mutedText}`}>{t.simulatedModelNote}</span>}
      </div>

      {/* Sélecteur d'étape */}
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

      {section === 'prd' && (
        <div className="max-w-3xl">
          <Markdown source={productModel.prd} />
        </div>
      )}
      {section === 'planning' && <StepModelSection m={productModel.planning} />}
      {section === 'planningDetail' && <StepModelSection m={productModel.planningDetail} />}
      {section === 'product' && <StepModelSection m={productModel.product} />}
      {section === 'assembly' && <StepModelSection m={productModel.assembly} />}
      {section === 'quantities' && <StepModelSection m={productModel.quantities} />}

      {section === 'cumul' && cumul && layer && (
        <div className="space-y-4">
          {/* Sélecteur de couche du tenseur */}
          <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label={t.layersLabel}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${theme.mutedText}`}>{t.layersLabel}</span>
            {layers.map((l) => (
              <button
                key={l.id}
                role="radio"
                aria-checked={layer.id === l.id}
                onClick={() => setLayerId(l.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  layer.id === l.id ? theme.userBubble : `${theme.secondaryText} ${theme.glassHover} border ${theme.glassBorder}`
                }`}
              >
                {l.name} ({l.unit})
              </button>
            ))}
          </div>

          {/* Le graphe d'assemblage annoté des valeurs cumulées de la couche */}
          <div className="space-y-1.5">
            <MicroLabel>
              {t.cumulGraphLabel} — {layer.name}
            </MicroLabel>
            <p className={`text-[11px] ${theme.mutedText}`}>{t.cumulHint}</p>
            <DagGraph model={productModel.assembly} values={cumul.values} valueUnit={layer.unit} ariaLabel={`${t.cumulGraphLabel} — ${layer.name}`} />
          </div>

          {/* La matrice cumulée : nœuds d'assemblage × couches */}
          <div className="space-y-1.5">
            <MicroLabel>{t.cumulMatrixLabel}</MicroLabel>
            <div className="w-full overflow-x-auto custom-scrollbar">
              <table className="border-separate" style={{ borderSpacing: '2px' }}>
                <thead>
                  <tr>
                    <th />
                    {layers.map((l) => (
                      <th key={l.id} className={`px-2 py-1 text-[10px] font-bold ${theme.mutedText}`}>
                        {l.name} ({l.unit})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productModel.assembly.rows.map((r, i) => (
                    <tr key={i}>
                      <th className={`px-2 py-1 text-left text-[10px] font-bold whitespace-nowrap ${theme.secondaryText}`}>{r}</th>
                      {layers.map((l) => {
                        const c = productModel.cumulated.find((x) => x.layerId === l.id)!;
                        const max = Math.max(...c.values, 1e-9);
                        const tt = c.values[i] / max;
                        const alpha = theme.isDark ? 0.1 + 0.55 * tt : 0.07 + 0.6 * tt;
                        const hue = theme.isDark ? '56,189,248' : '2,132,199';
                        const darkText = theme.isDark ? alpha > 0.48 : alpha < 0.42;
                        return (
                          <td
                            key={l.id}
                            title={`${r} · ${l.name} = ${fmtValue(c.values[i])} ${l.unit}`}
                            style={{ backgroundColor: `rgba(${hue},${alpha.toFixed(2)})` }}
                            className={`px-2 py-1 rounded text-center text-[10px] font-mono font-semibold ${
                              darkText ? 'text-slate-900' : theme.isDark ? 'text-slate-100' : 'text-slate-900'
                            }`}
                          >
                            {fmtValue(c.values[i])}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProductView;
