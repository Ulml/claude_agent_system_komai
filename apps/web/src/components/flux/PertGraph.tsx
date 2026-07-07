/**
 * PertGraph — the PERT-style rendering of a task flow: a left-to-right DAG
 * where each node is a contracted task assigned to an agent. Tasks sharing
 * the same rank (no dependency between them) stack vertically = PARALLEL
 * branches of the flow.
 *
 * Dependency-free SVG (same philosophy as MermaidFlow). Interactions:
 *  - click a node        → select the task (detail panel);
 *  - double-click a node whose agent is a META-AGENT → expand its SUB-FLOW
 *    in place, inside a rounded-corner outline (no fill) marking the
 *    meta-agent's boundary.
 */
import React from 'react';
import { useApp } from '@/contexts/AppContext';
import type { TaskNode, TaskStatus } from '@/core/types';

const NODE_W = 176;
const NODE_H = 64;
const MINI_W = 148;
const MINI_H = 48;
const GAP_X = 56;
const GAP_Y = 22;
const PAD = 14;
const BOX_HEADER = 26;

const STATUS_COLOR: Record<TaskStatus, string> = {
  pending: '#94a3b8',
  running: '#2563eb',
  done: '#10b981',
  failed: '#ef4444',
};

/** rank = longest dependency path (within the given set) → column index. */
function rankTasks(tasks: TaskNode[]): Map<string, number> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ranks = new Map<string, number>();
  const rank = (t: TaskNode): number => {
    if (ranks.has(t.id)) return ranks.get(t.id)!;
    const deps = t.dependsOn.map((d) => byId.get(d)).filter((d): d is TaskNode => Boolean(d));
    const r = deps.length === 0 ? 0 : 1 + Math.max(...deps.map(rank));
    ranks.set(t.id, r);
    return r;
  };
  tasks.forEach(rank);
  return ranks;
}

interface LaidNode {
  task: TaskNode;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Laid-out sub-flow when the node is expanded (meta-agent). */
  sub?: { nodes: LaidNode[]; edges: string[] };
}

interface Laid {
  nodes: LaidNode[];
  edges: string[]; // SVG path d strings
  width: number;
  height: number;
}

function edgePath(a: LaidNode, b: LaidNode): string {
  const x1 = a.x + a.w;
  const y1 = a.y + a.h / 2;
  const x2 = b.x;
  const y2 = b.y + b.h / 2;
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

/** Lays out a flow left→right; expanded meta nodes embed their sub-layout. */
function layout(
  tasks: TaskNode[],
  nodeW: number,
  nodeH: number,
  subFlowFor?: (t: TaskNode) => TaskNode[] | null
): Laid {
  const ranks = rankTasks(tasks);
  const maxRank = Math.max(0, ...ranks.values());
  const cols: TaskNode[][] = Array.from({ length: maxRank + 1 }, () => []);
  tasks.forEach((t) => cols[ranks.get(t.id) ?? 0].push(t));

  // Pre-compute node sizes (an expanded node grows into its sub-flow box).
  const sized = new Map<string, { w: number; h: number; sub?: Laid }>();
  for (const t of tasks) {
    const subTasks = subFlowFor?.(t) ?? null;
    if (subTasks && subTasks.length > 0) {
      const sub = layout(subTasks, MINI_W, MINI_H);
      sized.set(t.id, { w: sub.width + 2 * PAD, h: sub.height + BOX_HEADER + 2 * PAD, sub });
    } else {
      sized.set(t.id, { w: nodeW, h: nodeH });
    }
  }

  // Column x offsets from per-column max width; y stacking within columns.
  const nodes: LaidNode[] = [];
  let x = 0;
  const colHeights = cols.map((col) =>
    col.reduce((h, t) => h + sized.get(t.id)!.h, 0) + Math.max(0, col.length - 1) * GAP_Y
  );
  const totalH = Math.max(0, ...colHeights);
  for (const col of cols) {
    const colW = Math.max(0, ...col.map((t) => sized.get(t.id)!.w));
    const colH = col.reduce((h, t) => h + sized.get(t.id)!.h, 0) + Math.max(0, col.length - 1) * GAP_Y;
    let y = (totalH - colH) / 2; // vertically centre each column
    for (const t of col) {
      const s = sized.get(t.id)!;
      const n: LaidNode = { task: t, x, y, w: s.w, h: s.h };
      if (s.sub) {
        n.sub = {
          nodes: s.sub.nodes.map((m) => ({ ...m, x: m.x + x + PAD, y: m.y + y + BOX_HEADER + PAD })),
          edges: [],
        };
        n.sub.edges = n.sub.nodes.flatMap((m) =>
          m.task.dependsOn
            .map((d) => n.sub!.nodes.find((o) => o.task.id === d))
            .filter((o): o is LaidNode => Boolean(o))
            .map((o) => edgePath(o, m))
        );
      }
      nodes.push(n);
      y += s.h + GAP_Y;
    }
    x += colW + GAP_X;
  }

  const byId = new Map(nodes.map((n) => [n.task.id, n]));
  const edges = nodes.flatMap((n) =>
    n.task.dependsOn
      .map((d) => byId.get(d))
      .filter((o): o is LaidNode => Boolean(o))
      .map((o) => edgePath(o, n))
  );
  return { nodes, edges, width: Math.max(1, x - GAP_X), height: Math.max(1, totalH) };
}

interface PertGraphProps {
  tasks: TaskNode[];
  selectedId?: string | null;
  onSelect?: (taskId: string) => void;
  /** Double-click on a meta-agent's node toggles its sub-flow in place. */
  onToggleExpand?: (taskId: string) => void;
  expandedIds?: Set<string>;
  /** Sub-flow of a meta-agent (empty/undefined = not a meta-agent). */
  subFlowOf?: (agentId: string) => TaskNode[];
}

const PertGraph: React.FC<PertGraphProps> = ({
  tasks,
  selectedId,
  onSelect,
  onToggleExpand,
  expandedIds,
  subFlowOf,
}) => {
  const { theme, t, agents } = useApp();
  const isMeta = (agentId: string) => (subFlowOf?.(agentId)?.length ?? 0) > 0;
  const laid = layout(tasks, NODE_W, NODE_H, (task) =>
    expandedIds?.has(task.id) ? subFlowOf?.(task.agentId) ?? null : null
  );

  const edgeColor = theme.isDark ? '#475569' : '#cbd5e1';
  const textMain = theme.isDark ? '#f1f5f9' : '#0f172a';
  const textMut = theme.isDark ? '#94a3b8' : '#64748b';
  const nodeFill = theme.isDark ? 'rgba(30,41,59,0.85)' : 'rgba(255,255,255,0.9)';
  const nodeStroke = theme.isDark ? '#334155' : '#e2e8f0';

  const drawNode = (n: LaidNode, mini: boolean) => {
    const agent = agents.find((a) => a.id === n.task.agentId);
    const color = STATUS_COLOR[n.task.status];
    const meta = !mini && isMeta(n.task.agentId);
    const hidden = !n.task.accessible;
    const selected = selectedId === n.task.id;
    const title = n.task.title.length > (mini ? 20 : 24) ? `${n.task.title.slice(0, mini ? 19 : 23)}…` : n.task.title;

    if (n.sub) {
      // Expanded META-AGENT: rounded outline (no fill) around its sub-flow.
      return (
        <g key={n.task.id} onDoubleClick={() => onToggleExpand?.(n.task.id)} style={{ cursor: 'pointer' }}>
          <rect
            x={n.x}
            y={n.y}
            width={n.w}
            height={n.h}
            rx={18}
            fill="none"
            stroke={color}
            strokeWidth={1.6}
            strokeDasharray="none"
          />
          <text x={n.x + PAD} y={n.y + 18} fontSize="11" fontWeight="700" fill={textMain}>
            ▣ {agent?.name ?? n.task.agentId} — {t.metaAgent}
          </text>
          {n.sub.edges.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={edgeColor} strokeWidth={1.2} />
          ))}
          {n.sub.nodes.map((m) => drawNode(m, true))}
        </g>
      );
    }

    return (
      <g
        key={n.task.id}
        onClick={() => !hidden && onSelect?.(n.task.id)}
        onDoubleClick={() => meta && onToggleExpand?.(n.task.id)}
        style={{ cursor: hidden ? 'default' : 'pointer' }}
        role="button"
        aria-label={hidden ? t.metaTask : n.task.title}
      >
        <rect
          x={n.x}
          y={n.y}
          width={n.w}
          height={n.h}
          rx={14}
          fill={nodeFill}
          stroke={selected ? '#2563eb' : hidden ? textMut : nodeStroke}
          strokeWidth={selected ? 2 : 1.2}
          strokeDasharray={hidden ? '5 4' : 'none'}
        />
        <circle cx={n.x + 14} cy={n.y + n.h / 2} r={4.5} fill={color}>
          {n.task.status === 'running' && (
            <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
          )}
        </circle>
        <text x={n.x + 26} y={n.y + n.h / 2 - 4} fontSize={mini ? 10 : 11.5} fontWeight="600" fill={hidden ? textMut : textMain}>
          {hidden ? t.metaTask : title}
        </text>
        <text x={n.x + 26} y={n.y + n.h / 2 + 12} fontSize={mini ? 9 : 10} fill={textMut}>
          {hidden ? t.metaTaskHint : agent?.name ?? ''}
          {meta ? ` · ▣ ${t.metaAgent}` : ''}
        </text>
      </g>
    );
  };

  return (
    <div className="w-full overflow-x-auto custom-scrollbar pb-2">
      <svg
        width={laid.width + 4}
        height={laid.height + 4}
        viewBox={`-2 -2 ${laid.width + 4} ${laid.height + 4}`}
        role="group"
        aria-label={t.flux}
        className="max-w-none"
      >
        {laid.edges.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={edgeColor} strokeWidth={1.5} />
        ))}
        {laid.nodes.map((n) => drawNode(n, false))}
      </svg>
    </div>
  );
};

export default PertGraph;
