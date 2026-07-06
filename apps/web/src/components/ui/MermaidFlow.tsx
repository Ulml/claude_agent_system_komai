/**
 * MermaidFlow — renders a `flowchart TD/TB` Mermaid source as a REAL SVG
 * diagram (boxes + arrows), not text in a code window. Dependency-free and
 * CSP-safe: it parses the subset of Mermaid used across the OS
 * (top-down flowcharts with `A --> B`, `A -->|label| B`, node shapes
 * `[..]`, `(..)`, `{..}`) and lays the nodes out in ranks by longest path.
 *
 * It intentionally supports only what our agents emit; anything unparsed
 * falls back to nothing so the caller can show the source text instead.
 */
import React, { useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';

interface Node {
  id: string;
  label: string;
  shape: 'rect' | 'round' | 'diamond';
}
interface Edge {
  from: string;
  to: string;
  label?: string;
}

const NODE_W = 240;
const NODE_H = 46;
const H_GAP = 28;
const V_GAP = 44;

function parseNodeToken(token: string): Node | null {
  // e.g.  ID[Label]  ID(Label)  ID{Label}  or bare ID
  const m = token.trim().match(/^([A-Za-z0-9_]+)\s*(\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\})?$/);
  if (!m) return null;
  const id = m[1];
  const label = (m[3] ?? m[4] ?? m[5] ?? id).replace(/^["']|["']$/g, '');
  const shape: Node['shape'] = m[4] != null ? 'round' : m[5] != null ? 'diamond' : 'rect';
  return { id, label, shape };
}

function parse(src: string): { nodes: Map<string, Node>; edges: Edge[] } {
  const nodes = new Map<string, Node>();
  const edges: Edge[] = [];
  const add = (n: Node | null) => {
    if (!n) return;
    const existing = nodes.get(n.id);
    // Keep the richest label seen for an id.
    if (!existing || (existing.label === existing.id && n.label !== n.id)) nodes.set(n.id, n);
  };

  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (!line || /^(flowchart|graph)\b/i.test(line)) continue;
    // Split on the arrow, capturing an optional |edge label|.
    const arrow = line.match(/^(.*?)\s*--+>?\s*(?:\|([^|]*)\|)?\s*(.*)$/);
    if (!arrow) {
      add(parseNodeToken(line));
      continue;
    }
    const left = parseNodeToken(arrow[1]);
    const right = parseNodeToken(arrow[3]);
    add(left);
    add(right);
    if (left && right) edges.push({ from: left.id, to: right.id, label: arrow[2]?.trim() || undefined });
  }
  return { nodes, edges };
}

/** Longest-path rank of each node (0 = roots). */
function rankNodes(nodes: Map<string, Node>, edges: Edge[]): Map<string, number> {
  const rank = new Map<string, number>();
  for (const id of nodes.keys()) rank.set(id, 0);
  // Relax edges |V| times (handles our small DAGs; cycles are damped).
  for (let i = 0; i < nodes.size; i++) {
    let changed = false;
    for (const e of edges) {
      const r = (rank.get(e.from) ?? 0) + 1;
      if (r > (rank.get(e.to) ?? 0) && r < nodes.size) {
        rank.set(e.to, r);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return rank;
}

export const MermaidFlow: React.FC<{ source: string; ariaLabel?: string }> = ({ source, ariaLabel }) => {
  const { theme } = useApp();
  const model = useMemo(() => parse(source), [source]);

  const layout = useMemo(() => {
    const { nodes, edges } = model;
    if (nodes.size === 0) return null;
    const rank = rankNodes(nodes, edges);
    const rows = new Map<number, string[]>();
    for (const [id] of nodes) {
      const r = rank.get(id) ?? 0;
      rows.set(r, [...(rows.get(r) ?? []), id]);
    }
    const maxCols = Math.max(...[...rows.values()].map((r) => r.length));
    const width = maxCols * NODE_W + (maxCols - 1) * H_GAP;
    const pos = new Map<string, { x: number; y: number }>();
    for (const [r, ids] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
      const rowW = ids.length * NODE_W + (ids.length - 1) * H_GAP;
      const x0 = (width - rowW) / 2;
      ids.forEach((id, i) => {
        pos.set(id, { x: x0 + i * (NODE_W + H_GAP), y: r * (NODE_H + V_GAP) });
      });
    }
    const rowCount = rows.size;
    const height = rowCount * NODE_H + (rowCount - 1) * V_GAP;
    return { pos, width: Math.max(width, NODE_W), height, nodes, edges };
  }, [model]);

  if (!layout) return null;

  const stroke = theme.isDark ? '#94a3b8' : '#475569';
  const fill = theme.isDark ? '#1e293b' : '#f1f5f9';
  const textColor = theme.isDark ? '#e2e8f0' : '#0f172a';

  const clip = (s: string, n = 34) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  return (
    <div className="w-full overflow-x-auto custom-scrollbar" role="img" aria-label={ariaLabel ?? 'diagramme'}>
      <svg
        viewBox={`-4 -4 ${layout.width + 8} ${layout.height + 8}`}
        width={layout.width}
        className="max-w-full h-auto"
        style={{ minWidth: Math.min(layout.width, 320) }}
      >
        <defs>
          <marker id="mf-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" fill={stroke} />
          </marker>
        </defs>
        {/* Edges */}
        {layout.edges.map((e, i) => {
          const a = layout.pos.get(e.from);
          const b = layout.pos.get(e.to);
          if (!a || !b) return null;
          const x1 = a.x + NODE_W / 2;
          const y1 = a.y + NODE_H;
          const x2 = b.x + NODE_W / 2;
          const y2 = b.y;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          return (
            <g key={i}>
              <path
                d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`}
                fill="none"
                stroke={stroke}
                strokeWidth={1.4}
                markerEnd="url(#mf-arrow)"
              />
              {e.label && (
                <text x={mx} y={my} fontSize="10" fill={textColor} textAnchor="middle" dominantBaseline="middle">
                  <tspan dx="4" style={{ paintOrder: 'stroke', stroke: theme.isDark ? '#0f172a' : '#fff', strokeWidth: 3 }}>
                    {clip(e.label, 20)}
                  </tspan>
                </text>
              )}
            </g>
          );
        })}
        {/* Nodes */}
        {[...layout.nodes.values()].map((n) => {
          const p = layout.pos.get(n.id);
          if (!p) return null;
          const isDiamond = n.shape === 'diamond';
          return (
            <g key={n.id}>
              {isDiamond ? (
                <polygon
                  points={`${p.x + NODE_W / 2},${p.y} ${p.x + NODE_W},${p.y + NODE_H / 2} ${p.x + NODE_W / 2},${p.y + NODE_H} ${p.x},${p.y + NODE_H / 2}`}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1.2}
                />
              ) : (
                <rect
                  x={p.x}
                  y={p.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={n.shape === 'round' ? NODE_H / 2 : 10}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1.2}
                />
              )}
              <text
                x={p.x + NODE_W / 2}
                y={p.y + NODE_H / 2}
                fontSize="12"
                fill={textColor}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {clip(n.label)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default MermaidFlow;
