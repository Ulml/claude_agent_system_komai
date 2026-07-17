/**
 * DagGraph — rendu SVG GÉNÉRIQUE d'un MatrixModel (représentation « graphe »,
 * DÉRIVÉE de la matrice d'adjacence — SSOT : aucune géométrie stockée).
 *
 *  - graphe ORIENTÉ  → layout en couches (rang = plus long chemin), flèches ;
 *  - graphe NON ORIENTÉ → layout circulaire, arêtes simples.
 *
 * Textes des nœuds ENROULÉS (jamais tronqués), hauteur de nœud dynamique.
 * `values` (optionnel) affiche une valeur par nœud (grandeurs cumulées).
 */
import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { edgesOf, fmtValue, ranksOf, type MatrixModel } from '@/core/tensor';

const NODE_W = 150;
const LINE_H = 13;
const RANK_GAP = 70;
const NODE_GAP = 14;

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

const DagGraph: React.FC<{ model: MatrixModel; values?: number[]; valueUnit?: string; ariaLabel: string }> = ({
  model,
  values,
  valueUnit,
  ariaLabel,
}) => {
  const { theme } = useApp();
  const stroke = theme.isDark ? '#64748b' : '#94a3b8';
  const textColor = theme.isDark ? '#e2e8f0' : '#0f172a';
  const subColor = theme.isDark ? '#94a3b8' : '#64748b';
  const fill = theme.isDark ? '#1e293b' : '#ffffff';

  const n = model.rows.length;
  const lines = model.rows.map((r) => wrap(r, 20));
  const heights = lines.map((l) => 10 + l.length * LINE_H + (values ? 16 : 0) + 8);
  const edges = edgesOf(model);

  let pos: { x: number; y: number }[];
  let W: number;
  let H: number;

  if (model.directed) {
    // Layout en couches par rang (plus long chemin).
    const ranks = ranksOf(model);
    const maxRank = Math.max(...ranks, 0);
    const byRank: number[][] = Array.from({ length: maxRank + 1 }, () => []);
    ranks.forEach((r, i) => byRank[r].push(i));
    const colHeights = byRank.map((col) => col.reduce((s, i) => s + heights[i], 0) + Math.max(0, col.length - 1) * NODE_GAP);
    H = Math.max(...colHeights, 120) + 32;
    W = (maxRank + 1) * NODE_W + maxRank * RANK_GAP + 32;
    pos = new Array(n);
    byRank.forEach((col, r) => {
      let y = (H - colHeights[r]) / 2;
      col.forEach((i) => {
        pos[i] = { x: 16 + r * (NODE_W + RANK_GAP), y };
        y += heights[i] + NODE_GAP;
      });
    });
  } else {
    // Layout circulaire (liaisons non orientées).
    const R = Math.max(150, n * 34);
    W = 2 * R + NODE_W + 60;
    H = 2 * R * 0.62 + Math.max(...heights) + 60;
    pos = model.rows.map((_, i) => {
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      return { x: W / 2 + R * Math.cos(a) - NODE_W / 2, y: H / 2 + R * 0.62 * Math.sin(a) - heights[i] / 2 };
    });
  }

  const center = (i: number) => ({ cx: pos[i].x + NODE_W / 2, cy: pos[i].y + heights[i] / 2 });

  return (
    <div className="w-full overflow-x-auto custom-scrollbar">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} className="max-w-none h-auto" style={{ minWidth: Math.min(W, 720) }} role="img" aria-label={ariaLabel}>
        <defs>
          <marker id="dag-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" fill={stroke} />
          </marker>
        </defs>
        {edges.map((e, k) => {
          const a = center(e.from);
          const b = center(e.to);
          if (model.directed) {
            const x1 = pos[e.from].x + NODE_W;
            const x2 = pos[e.to].x;
            return (
              <path
                key={k}
                d={`M${x1},${a.cy} C${(x1 + x2) / 2},${a.cy} ${(x1 + x2) / 2},${b.cy} ${x2},${b.cy}`}
                fill="none"
                stroke={stroke}
                strokeWidth={1.5}
                markerEnd="url(#dag-arrow)"
                opacity={0.8}
              />
            );
          }
          // non orienté : une seule arête par paire (i<j)
          if (e.from > e.to) return null;
          return <line key={k} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke={stroke} strokeWidth={1.3} opacity={0.6} />;
        })}
        {model.rows.map((_, i) => (
          <g key={i}>
            <title>
              {model.rows[i]}
              {values ? ` — ${fmtValue(values[i])} ${valueUnit ?? ''}` : ''}
            </title>
            <rect x={pos[i].x} y={pos[i].y} width={NODE_W} height={heights[i]} rx={11} fill={fill} stroke={stroke} strokeWidth={1.2} />
            <text x={pos[i].x + 10} y={pos[i].y + 10 + LINE_H - 3} fontSize="10" fontWeight={700} fill={textColor}>
              {lines[i].map((ln, li) => (
                <tspan key={li} x={pos[i].x + 10} dy={li === 0 ? 0 : LINE_H}>
                  {ln}
                </tspan>
              ))}
            </text>
            {values && (
              <text
                x={pos[i].x + 10}
                y={pos[i].y + 10 + lines[i].length * LINE_H + 11}
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                fontWeight={600}
                fill={subColor}
              >
                {fmtValue(values[i])} {valueUnit ?? ''}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};

export default DagGraph;
