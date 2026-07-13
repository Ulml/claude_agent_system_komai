/**
 * SystemView — the MBSE block diagram of the designed physical system.
 *
 * Left: the ENVIRONNANTS — elements of the external environment, each
 * characterised by WEB RESEARCH (characteristics, physical quantities,
 * news) whose data is served as INPUT to the system's agents. Middle: the
 * META-COMPONENT block with its function-agent nodes. Right: the USER
 * environnant carrying the CONFORMITY ZONE (required physical criteria).
 *
 * Each functional flow starts at its source environnant, crosses the
 * function agents that TRANSFORM the physical quantity step by step, and
 * ends at the user — the delivered value is checked against the conformity
 * zone (badge per flow). Function nodes are clickable (agent page) and
 * show how many construction tasks realise them. The diagram densifies at
 * each planned refinement iteration (ask the orchestrator to « raffiner »).
 */
import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { MicroLabel, Panel } from '@/components/ui/Glass';
import { SYSTEM_NODE_ICONS } from '@/core/mbse';

const NODE_H = 56;
const ENV_H = 64;
const ENV_GAP = 24;
const FN_W = 260;
const SIDE_W = 158;
const GAP_Y = 26;
const COL_GAP = 90;

const fmt = (v: number) =>
  Number.isInteger(v) ? v.toString() : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toPrecision(3);

const SystemView: React.FC = () => {
  const { theme, t, systemComponents, functionalFlows, systemIteration, agents, tasks, setView, selectedProjectId } =
    useApp();

  const envs = systemComponents.filter((c) => c.kind === 'environment' && c.projectId === selectedProjectId);
  const component = systemComponents.find((c) => c.kind === 'component' && c.projectId === selectedProjectId);
  const user = systemComponents.find((c) => c.kind === 'user' && c.projectId === selectedProjectId);

  if (envs.length === 0 || !component || !user) {
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

  // Layout: function nodes stacked inside the component block; environnant
  // blocks stacked in the left column.
  const innerH = fnAgents.length * NODE_H + (fnAgents.length - 1) * GAP_Y;
  const envsH = envs.length * ENV_H + (envs.length - 1) * ENV_GAP;
  const blockPad = 46;
  const H = Math.max(innerH + 2 * blockPad, envsH + 40, 260);
  const W = SIDE_W + COL_GAP + FN_W + COL_GAP + SIDE_W + 40;
  const fnX = SIDE_W + COL_GAP + 20;
  const fnY = (i: number) => (H - innerH) / 2 + i * (NODE_H + GAP_Y);
  const envY = (i: number) => (H - envsH) / 2 + i * (ENV_H + ENV_GAP);
  const midY = H / 2;
  const fnIndex = new Map(fnAgents.map((a, i) => [a.id, i]));
  const envIndex = new Map(envs.map((c, i) => [c.id, i]));

  const stroke = theme.isDark ? '#94a3b8' : '#475569';
  const textColor = theme.isDark ? '#e2e8f0' : '#0f172a';
  const subColor = theme.isDark ? '#94a3b8' : '#64748b';
  const fill = theme.isDark ? '#1e293b' : '#ffffff';
  const blockFill = theme.isDark ? 'rgba(30,41,59,0.4)' : 'rgba(241,245,249,0.7)';

  /** Path of one flow: its source environnant → carried functions → user. */
  const flowPath = (flow: (typeof flows)[number]): string => {
    const srcIdx = envIndex.get(flow.path[0]) ?? 0;
    const srcY = envY(srcIdx) + ENV_H / 2;
    const carried = flow.path.filter((id) => fnIndex.has(id));
    const ys = carried.map((id) => fnY(fnIndex.get(id)!) + NODE_H / 2);
    const x0 = 20 + SIDE_W;
    const xIn = fnX;
    const xOut = fnX + FN_W;
    const xEnd = W - 20 - SIDE_W;
    let d = `M${x0},${srcY}`;
    ys.forEach((y, i) => {
      const fromY = i === 0 ? srcY : ys[i - 1];
      const fromX = i === 0 ? x0 : xOut;
      d += ` C${(fromX + xIn) / 2},${fromY} ${(fromX + xIn) / 2},${y} ${xIn},${y} L${xOut},${y}`;
    });
    const lastY = ys[ys.length - 1] ?? srcY;
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

      {/* Legend (accessible: color + text + conformity badge) */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label={t.systemFlows}>
        {flows.map((f) => (
          <li key={f.id} className={`flex items-center gap-1.5 text-xs ${theme.secondaryText}`}>
            <span className="w-4 h-1 rounded-full" style={{ background: f.color }} aria-hidden />
            {f.name}
            {f.conform !== undefined &&
              (f.conform ? (
                <CheckCircle2 size={12} className="text-emerald-600" aria-label={t.conformOk} />
              ) : (
                <XCircle size={12} className="text-rose-600" aria-label={t.conformKo} />
              ))}
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

          {/* ENVIRONNANTS (sources) — one block each, researched data */}
          {envs.map((env, i) => {
            const y = envY(i);
            return (
              <g key={env.id}>
                <rect x={20} y={y} width={SIDE_W} height={ENV_H} rx={14} fill={fill} stroke={stroke} />
                <text x={20 + SIDE_W / 2} y={y + 22} fontSize="11.5" fontWeight="700" fill={textColor} textAnchor="middle">
                  {env.name}
                </text>
                {(env.quantities ?? []).slice(0, 2).map((q, j) => (
                  <text key={q.symbol} x={20 + SIDE_W / 2} y={y + 38 + j * 13} fontSize="9" fill={subColor} textAnchor="middle">
                    {q.symbol} = {fmt(q.value)} {q.unit}
                  </text>
                ))}
              </g>
            );
          })}

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

          {/* User environnant (sink, carries the conformity zone) */}
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

      {/* Icon row (accessible labels) */}
      <div className={`flex items-center justify-between max-w-3xl mx-auto text-xs ${theme.mutedText}`}>
        <span className="flex items-center gap-1.5">
          <EnvIcon size={14} aria-hidden /> {envs.length} {t.environnants.toLowerCase()}
        </span>
        <span>{fnAgents.length} {t.systemFunctions}</span>
        <span className="flex items-center gap-1.5">
          <UserIcon size={14} aria-hidden /> {user.name}
        </span>
      </div>

      {/* Step-by-step transformation of each flow, down to the conformity zone */}
      <div className="space-y-2">
        <MicroLabel>{t.flowStepsLabel}</MicroLabel>
        {flows
          .filter((f) => f.steps && f.steps.length > 0)
          .map((f) => (
            <Panel key={f.id} className="p-3">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: f.color }} aria-hidden />
                <span className={`font-bold ${theme.primaryText}`}>{f.name}</span>
                {f.steps!.map((s, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className={theme.mutedText} aria-hidden>→</span>}
                    <span className={theme.secondaryText}>
                      {s.label} : <span className={`font-mono font-semibold ${theme.primaryText}`}>{fmt(s.value)} {s.unit}</span>
                    </span>
                  </React.Fragment>
                ))}
                {f.requirement && (
                  <span className={`ml-auto flex items-center gap-1.5 font-semibold ${f.conform ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {f.conform ? <CheckCircle2 size={13} aria-hidden /> : <XCircle size={13} aria-hidden />}
                    {f.conform ? t.conformOk : t.conformKo} ({t.requiredLabel} {fmt(f.requirement.min)}–{fmt(f.requirement.max)} {f.requirement.unit})
                  </span>
                )}
              </div>
            </Panel>
          ))}
      </div>

      {/* The environnants: researched characteristics / quantities / news */}
      <div className="space-y-2">
        <MicroLabel>{t.environnants}</MicroLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...envs, user].map((env) => (
            <Panel key={env.id} className="p-4 space-y-2">
              <h3 className={`text-sm font-bold ${theme.primaryText}`}>{env.name}</h3>
              <p className={`text-[11px] leading-snug ${theme.mutedText}`}>{t.environnantNote}</p>
              {env.characteristics && env.characteristics.length > 0 && (
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${theme.mutedText}`}>{t.characteristicsLabel}</p>
                  <ul className={`list-disc pl-4 text-xs space-y-0.5 ${theme.secondaryText}`}>
                    {env.characteristics.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {env.quantities && env.quantities.length > 0 && (
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${theme.mutedText}`}>{t.quantitiesLabel}</p>
                  <ul className="flex flex-wrap gap-1.5 pt-1">
                    {env.quantities.map((q) => (
                      <li key={q.symbol} className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${theme.iconBg} ${theme.secondaryText}`}>
                        {q.symbol} = {fmt(q.value)} {q.unit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {env.requirements && env.requirements.length > 0 && (
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${theme.mutedText}`}>{t.conformityZone}</p>
                  <ul className={`list-disc pl-4 text-xs space-y-0.5 ${theme.secondaryText}`}>
                    {env.requirements.map((r) => (
                      <li key={r.name}>
                        {r.name} : <span className="font-mono">{fmt(r.min)}–{fmt(r.max)} {r.unit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {env.news && env.news.length > 0 && (
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${theme.mutedText}`}>{t.newsLabel}</p>
                  <ul className={`text-xs italic space-y-0.5 ${theme.mutedText}`}>
                    {env.news.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          ))}
        </div>
      </div>

      <p className={`text-xs max-w-3xl mx-auto leading-relaxed ${theme.mutedText}`}>{t.systemLinkHint}</p>
    </section>
  );
};

export default SystemView;
