/**
 * SystemView — the MBSE block diagram of the designed physical system.
 *
 * Three columns: ENVIRONNEMENT (source) → META-COMPONENT block containing
 * its function-agent nodes → UTILISATEUR (sink). The end-to-end functional
 * flows (heat, humidity, loads, acoustics…) are drawn as colored paths
 * crossing the function agents that carry them, with an accessible legend.
 *
 * Every function node is clickable (opens the agent page) and shows how
 * many CONSTRUCTION TASKS realise it — the visible link between the task
 * flow (idea → keys) and the functional flow of the object. The diagram
 * densifies at each planned refinement iteration (ask the orchestrator to
 * « raffiner »).
 */
import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { MicroLabel } from '@/components/ui/Glass';
import { SYSTEM_NODE_ICONS } from '@/core/mbse';

const NODE_H = 56;
const FN_W = 260;
const SIDE_W = 150;
const GAP_Y = 26;
const COL_GAP = 90;

const SystemView: React.FC = () => {
  const { theme, t, systemComponents, functionalFlows, systemIteration, agents, tasks, setView, selectedProjectId } =
    useApp();

  const env = systemComponents.find((c) => c.kind === 'environment' && c.projectId === selectedProjectId);
  const component = systemComponents.find((c) => c.kind === 'component' && c.projectId === selectedProjectId);
  const user = systemComponents.find((c) => c.kind === 'user' && c.projectId === selectedProjectId);

  if (!env || !component || !user) {
    return (
      <p className={`text-center py-16 px-6 text-sm max-w-xl mx-auto leading-relaxed ${theme.mutedText}`}>
        {t.systemEmpty}
      </p>
    );
  }

  const fnAgents = component.functionAgentIds
    .map((id) => agents.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const flows = functionalFlows.filter((f) => f.projectId === selectedProjectId);

  // Layout: function nodes stacked inside the component block.
  const innerH = fnAgents.length * NODE_H + (fnAgents.length - 1) * GAP_Y;
  const blockPad = 46;
  const H = Math.max(innerH + 2 * blockPad, 260);
  const W = SIDE_W + COL_GAP + FN_W + COL_GAP + SIDE_W + 40;
  const fnX = SIDE_W + COL_GAP + 20;
  const fnY = (i: number) => (H - innerH) / 2 + i * (NODE_H + GAP_Y);
  const midY = H / 2;
  const fnIndex = new Map(fnAgents.map((a, i) => [a.id, i]));

  const stroke = theme.isDark ? '#94a3b8' : '#475569';
  const textColor = theme.isDark ? '#e2e8f0' : '#0f172a';
  const subColor = theme.isDark ? '#94a3b8' : '#64748b';
  const fill = theme.isDark ? '#1e293b' : '#ffffff';
  const blockFill = theme.isDark ? 'rgba(30,41,59,0.4)' : 'rgba(241,245,249,0.7)';

  /** Path of one flow: env → each carried function (in order) → user. */
  const flowPath = (flow: (typeof flows)[number]): string => {
    const carried = flow.path.filter((id) => fnIndex.has(id));
    const ys = carried.map((id) => fnY(fnIndex.get(id)!) + NODE_H / 2);
    const x0 = 20 + SIDE_W;
    const xIn = fnX;
    const xOut = fnX + FN_W;
    const xEnd = W - 20 - SIDE_W;
    let d = `M${x0},${midY}`;
    ys.forEach((y, i) => {
      const fromY = i === 0 ? midY : ys[i - 1];
      const fromX = i === 0 ? x0 : xOut;
      d += ` C${(fromX + xIn) / 2},${fromY} ${(fromX + xIn) / 2},${y} ${xIn},${y} L${xOut},${y}`;
    });
    const lastY = ys[ys.length - 1] ?? midY;
    d += ` C${(xOut + xEnd) / 2},${lastY} ${(xOut + xEnd) / 2},${midY} ${xEnd},${midY}`;
    return d;
  };

  const EnvIcon = SYSTEM_NODE_ICONS.environment;
  const UserIcon = SYSTEM_NODE_ICONS.user;

  const tasksRealizing = (agentId: string) =>
    tasks.filter((task) => task.projectId === selectedProjectId && task.realizes?.includes(agentId)).length;

  return (
    <section aria-label={t.system} className="w-full max-w-5xl mx-auto px-4 py-6 animate-fade-up space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <MicroLabel>
          {t.system} — {component.name}
        </MicroLabel>
        <span className={`text-xs ${theme.mutedText}`}>
          {t.systemIteration} {systemIteration} · {t.systemRefineHint}
        </span>
      </div>

      {/* Legend (accessible: color + text) */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label={t.systemFlows}>
        {flows.map((f) => (
          <li key={f.id} className={`flex items-center gap-1.5 text-xs ${theme.secondaryText}`}>
            <span className="w-4 h-1 rounded-full" style={{ background: f.color }} aria-hidden />
            {f.name}
          </li>
        ))}
      </ul>

      {/* The block diagram */}
      <div className="w-full overflow-x-auto custom-scrollbar" role="img" aria-label={`${t.system}: ${component.name}`}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} className="max-w-none h-auto" style={{ minWidth: 720 }}>
          {/* Flow paths (under the nodes) */}
          {flows.map((f) => (
            <path key={f.id} d={flowPath(f)} fill="none" stroke={f.color} strokeWidth={2.5} opacity={0.85} />
          ))}

          {/* Environment (source) */}
          <g>
            <rect x={20} y={midY - NODE_H / 2} width={SIDE_W} height={NODE_H} rx={14} fill={fill} stroke={stroke} />
            <text x={20 + SIDE_W / 2} y={midY - 4} fontSize="12" fontWeight="700" fill={textColor} textAnchor="middle">
              {env.name.split(' ')[0]}
            </text>
            <text x={20 + SIDE_W / 2} y={midY + 12} fontSize="10" fill={subColor} textAnchor="middle">
              {env.name.split(' ').slice(1).join(' ')}
            </text>
          </g>

          {/* Meta-component block */}
          <g>
            <rect
              x={fnX - 20}
              y={(H - innerH) / 2 - blockPad + 14}
              width={FN_W + 40}
              height={innerH + 2 * blockPad - 28}
              rx={22}
              fill={blockFill}
              stroke={stroke}
              strokeDasharray="6 4"
            />
            <text x={fnX + FN_W / 2} y={(H - innerH) / 2 - blockPad + 34} fontSize="11" fontWeight="700" fill={subColor} textAnchor="middle" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' } as never}>
              {component.name}
            </text>
          </g>

          {/* Function-agent nodes */}
          {fnAgents.map((agent, i) => {
            const y = fnY(i);
            const n = tasksRealizing(agent.id);
            return (
              <g key={agent.id} onClick={() => setView({ kind: 'agent', agentId: agent.id })} style={{ cursor: 'pointer' }}>
                <rect x={fnX} y={y} width={FN_W} height={NODE_H} rx={14} fill={fill} stroke={stroke} strokeWidth={1.4} />
                <text x={fnX + 14} y={y + 23} fontSize="12.5" fontWeight="700" fill={textColor}>
                  {agent.name}
                </text>
                <text x={fnX + 14} y={y + 40} fontSize="10" fill={subColor}>
                  {agent.tagline.split(' — ')[0]}
                </text>
                {n > 0 && (
                  <>
                    <rect x={fnX + FN_W - 58} y={y + 8} width={48} height={16} rx={8} fill={theme.isDark ? '#334155' : '#e2e8f0'} />
                    <text x={fnX + FN_W - 34} y={y + 19.5} fontSize="9" fontWeight="700" fill={subColor} textAnchor="middle">
                      {n} {t.systemTasksBadge}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* User (sink) */}
          <g>
            <rect x={W - 20 - SIDE_W} y={midY - NODE_H / 2} width={SIDE_W} height={NODE_H} rx={14} fill={fill} stroke={stroke} />
            <text x={W - 20 - SIDE_W / 2} y={midY - 4} fontSize="12" fontWeight="700" fill={textColor} textAnchor="middle">
              {user.name.split(' ')[0]}
            </text>
            <text x={W - 20 - SIDE_W / 2} y={midY + 12} fontSize="10" fill={subColor} textAnchor="middle">
              {user.name.split(' ').slice(1).join(' ')}
            </text>
          </g>
        </svg>
      </div>

      {/* Icon row for the three columns (accessible labels, same order) */}
      <div className={`flex items-center justify-between max-w-3xl mx-auto text-xs ${theme.mutedText}`}>
        <span className="flex items-center gap-1.5">
          <EnvIcon size={14} aria-hidden /> {env.name}
        </span>
        <span>{fnAgents.length} {t.systemFunctions}</span>
        <span className="flex items-center gap-1.5">
          <UserIcon size={14} aria-hidden /> {user.name}
        </span>
      </div>

      <p className={`text-xs max-w-3xl mx-auto leading-relaxed ${theme.mutedText}`}>{t.systemLinkHint}</p>
    </section>
  );
};

export default SystemView;
