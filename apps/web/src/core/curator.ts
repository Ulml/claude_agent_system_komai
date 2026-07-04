/**
 * Curator engine — the graph brain of the « Curateur » agent.
 *
 * The Curator reasons on an AGENT GRAPH: every agent of the OS is a node,
 * and weighted edges encode affinities (same role, same LLM provider, same
 * project activity). On top of this graph it creates META-NODES — grouping
 * nodes that span a set of agent nodes — and proposes them to the user for
 * validation. An accepted meta-node materialises as an AgentFolder.
 *
 * Two entry points, as required by the product spec:
 *   - proposeMetaNodes(...)        → OS-wide proposals under several logics;
 *   - proposeMetaNodeForScope(...) → one meta-node over ANY group of agents
 *                                    designated by the user.
 *
 * Deterministic and local (no LLM needed) so proposals are instant and
 * explainable; the Python mirror lives in
 * packages/agent_harness/core/curator.py for server-side execution.
 */
import type {
  AgentEdge,
  AgentFolder,
  AgentGraph,
  AgentProfile,
  GroupingLogic,
  MetaNodeProposal,
  TaskNode,
} from './types';

let seq = 0;
const nextId = () => `meta-${Date.now()}-${seq++}`;

/* ------------------------------------------------------------------ */
/* Step 1 — build the agent graph                                      */
/* ------------------------------------------------------------------ */

/**
 * Builds the affinity graph. Edge weights:
 *   +2 same kind (role affinity),
 *   +1 same LLM provider,
 *   +1 both active on tasks of the same project.
 */
export function buildAgentGraph(agents: AgentProfile[], tasks: TaskNode[]): AgentGraph {
  const projectsOf = (id: string) =>
    new Set(tasks.filter((task) => task.agentId === id).map((task) => task.projectId));

  const edges: AgentEdge[] = [];
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i];
      const b = agents[j];
      let weight = 0;
      const reasons: GroupingLogic[] = [];
      if (a.kind === b.kind) {
        weight += 2;
        reasons.push('role');
      }
      if (a.llmBinding.providerId === b.llmBinding.providerId) {
        weight += 1;
        reasons.push('provider');
      }
      const shared = [...projectsOf(a.id)].some((p) => projectsOf(b.id).has(p));
      if (shared) {
        weight += 1;
        reasons.push('activity');
      }
      if (weight > 0) edges.push({ a: a.id, b: b.id, weight, reasons });
    }
  }
  return { nodes: agents.map((a) => a.id), edges };
}

/* ------------------------------------------------------------------ */
/* Step 2 — extract meta-nodes from the graph                          */
/* ------------------------------------------------------------------ */

/** True when a proposal duplicates an existing folder (same agent set). */
function isDuplicate(agentIds: string[], folders: AgentFolder[]): boolean {
  const set = new Set(agentIds);
  return folders.some(
    (f) => f.agentIds.length === set.size && f.agentIds.every((id) => set.has(id))
  );
}

/** Groups graph nodes sharing one trait value; keeps groups of 2+ agents. */
function groupBy(agents: AgentProfile[], key: (a: AgentProfile) => string): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const agent of agents) {
    const k = key(agent);
    groups.set(k, [...(groups.get(k) ?? []), agent.id]);
  }
  for (const [k, ids] of groups) if (ids.length < 2) groups.delete(k);
  return groups;
}

/**
 * OS-wide proposals: walks the graph traits and emits one meta-node per
 * coherent group, under three logics (role, provider, project activity).
 * Groups identical to an existing folder are skipped.
 */
export function proposeMetaNodes(
  agents: AgentProfile[],
  tasks: TaskNode[],
  folders: AgentFolder[]
): MetaNodeProposal[] {
  const proposals: MetaNodeProposal[] = [];

  // Logic 'role' — kind → meta-node (governance kinds are merged).
  const roleKey = (a: AgentProfile) =>
    a.kind === 'system' || a.kind === 'orchestrator' || a.kind === 'judge' ? 'governance' : a.kind;
  const roleNames: Record<string, string> = {
    worker: 'groupWorkers',
    human: 'groupHumans',
    governance: 'groupGovernance',
    coding: 'groupCoding',
  };
  for (const [trait, ids] of groupBy(agents, roleKey)) {
    if (!isDuplicate(ids, folders)) {
      proposals.push({
        id: nextId(),
        logic: 'role',
        nameKey: roleNames[trait] ?? 'groupCustom',
        rationaleKey: 'logicRole',
        agentIds: ids,
      });
    }
  }

  // Logic 'provider' — same LLM platform → meta-node.
  for (const [providerId, ids] of groupBy(agents, (a) => a.llmBinding.providerId)) {
    if (!isDuplicate(ids, folders)) {
      proposals.push({
        id: nextId(),
        logic: 'provider',
        nameKey: 'groupProvider',
        nameParam: providerId,
        rationaleKey: 'logicProvider',
        agentIds: ids,
      });
    }
  }

  // Logic 'activity' — agents contracted on the same project → meta-node.
  const byProject = new Map<string, Set<string>>();
  for (const task of tasks) {
    byProject.set(task.projectId, (byProject.get(task.projectId) ?? new Set()).add(task.agentId));
  }
  for (const [projectId, idSet] of byProject) {
    const ids = [...idSet];
    if (ids.length >= 2 && !isDuplicate(ids, folders)) {
      proposals.push({
        id: nextId(),
        logic: 'activity',
        nameKey: 'groupActivity',
        nameParam: projectId,
        rationaleKey: 'logicActivity',
        agentIds: ids,
      });
    }
  }

  return proposals;
}

/**
 * Scoped meta-node: the user designates ANY group of agents; the Curator
 * wraps it in a meta-node and names it after the dominant trait found in
 * the sub-graph (role if uniform, else provider, else custom).
 */
export function proposeMetaNodeForScope(
  agents: AgentProfile[],
  scopeIds: string[],
  folders: AgentFolder[]
): MetaNodeProposal | null {
  const scoped = agents.filter((a) => scopeIds.includes(a.id));
  if (scoped.length < 2 || isDuplicate(scopeIds, folders)) return null;

  const kinds = new Set(scoped.map((a) => a.kind));
  const providers = new Set(scoped.map((a) => a.llmBinding.providerId));
  if (kinds.size === 1) {
    const roleNames: Record<string, string> = {
      worker: 'groupWorkers',
      human: 'groupHumans',
      coding: 'groupCoding',
    };
    return {
      id: nextId(),
      logic: 'role',
      nameKey: roleNames[[...kinds][0]] ?? 'groupCustom',
      rationaleKey: 'logicRole',
      agentIds: scopeIds,
    };
  }
  if (providers.size === 1) {
    return {
      id: nextId(),
      logic: 'provider',
      nameKey: 'groupProvider',
      nameParam: [...providers][0],
      rationaleKey: 'logicProvider',
      agentIds: scopeIds,
    };
  }
  return {
    id: nextId(),
    logic: 'custom',
    nameKey: 'groupCustom',
    rationaleKey: 'logicCustom',
    agentIds: scopeIds,
  };
}
