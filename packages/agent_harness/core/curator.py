"""Curator agent — graph-based meta-node grouping (Python mirror).

The Curator reasons on an AGENT GRAPH: every agent of the OS is a node and
weighted edges encode affinities (same role +2, same LLM provider +1, active
on the same project +1). On top of this graph it creates META-NODES —
grouping nodes spanning a set of agent nodes — proposed to the user for
validation. An accepted meta-node materialises as a desktop folder.

Mirror of apps/web/src/core/curator.ts (same weights, same logics, same
dedup rule); the Curator itself runs on the standard AgentHarness like any
other agent — only this grouping toolset is specific to it.
"""

from __future__ import annotations

import uuid
from collections import defaultdict

from contracts import (
    AgentEdge,
    AgentGraph,
    AgentKind,
    AgentProfile,
    GroupingLogic,
    MetaNodeProposal,
    TaskNode,
)

_ROLE_NAME_KEYS = {
    "worker": "groupWorkers",
    "human": "groupHumans",
    "governance": "groupGovernance",
    "coding": "groupCoding",
}

# Governance kinds are merged into one trait, like the TS engine.
_GOVERNANCE = {AgentKind.SYSTEM, AgentKind.ORCHESTRATOR, AgentKind.JUDGE}


def _next_id() -> str:
    return f"meta-{uuid.uuid4().hex[:10]}"


def build_agent_graph(agents: list[AgentProfile], tasks: list[TaskNode]) -> AgentGraph:
    """Step 1 — build the weighted affinity graph over all agents."""
    projects_of: dict[str, set[str]] = defaultdict(set)
    for task in tasks:
        projects_of[task.agent_id].add(task.project_id)

    edges: list[AgentEdge] = []
    for i, a in enumerate(agents):
        for b in agents[i + 1 :]:
            weight, reasons = 0, []
            if a.kind == b.kind:
                weight += 2
                reasons.append(GroupingLogic.ROLE)
            if a.llm_binding.provider_id == b.llm_binding.provider_id:
                weight += 1
                reasons.append(GroupingLogic.PROVIDER)
            if projects_of[a.id] & projects_of[b.id]:
                weight += 1
                reasons.append(GroupingLogic.ACTIVITY)
            if weight:
                edges.append(AgentEdge(a=a.id, b=b.id, weight=weight, reasons=reasons))
    return AgentGraph(nodes=[a.id for a in agents], edges=edges)


def _is_duplicate(agent_ids: list[str], existing_sets: list[set[str]]) -> bool:
    return set(agent_ids) in existing_sets


def propose_meta_nodes(
    agents: list[AgentProfile],
    tasks: list[TaskNode],
    existing_folder_sets: list[set[str]],
) -> list[MetaNodeProposal]:
    """Step 2 — OS-wide meta-nodes under the role / provider / activity logics.

    Groups identical to an existing folder are skipped (dedup rule).
    """
    proposals: list[MetaNodeProposal] = []

    def add(logic: GroupingLogic, name_key: str, ids: list[str], name_param: str | None = None) -> None:
        if len(ids) >= 2 and not _is_duplicate(ids, existing_folder_sets):
            proposals.append(
                MetaNodeProposal(
                    id=_next_id(),
                    logic=logic,
                    name_key=name_key,
                    name_param=name_param,
                    rationale_key=f"logic{logic.value.capitalize()}",
                    agent_ids=ids,
                )
            )

    by_role: dict[str, list[str]] = defaultdict(list)
    for agent in agents:
        trait = "governance" if agent.kind in _GOVERNANCE else agent.kind.value
        by_role[trait].append(agent.id)
    for trait, ids in by_role.items():
        add(GroupingLogic.ROLE, _ROLE_NAME_KEYS.get(trait, "groupCustom"), ids)

    by_provider: dict[str, list[str]] = defaultdict(list)
    for agent in agents:
        by_provider[agent.llm_binding.provider_id].append(agent.id)
    for provider_id, ids in by_provider.items():
        add(GroupingLogic.PROVIDER, "groupProvider", ids, name_param=provider_id)

    by_project: dict[str, set[str]] = defaultdict(set)
    for task in tasks:
        by_project[task.project_id].add(task.agent_id)
    for project_id, id_set in by_project.items():
        add(GroupingLogic.ACTIVITY, "groupActivity", sorted(id_set), name_param=project_id)

    return proposals


def propose_meta_node_for_scope(
    agents: list[AgentProfile],
    scope_ids: list[str],
    existing_folder_sets: list[set[str]],
) -> MetaNodeProposal | None:
    """Scoped meta-node over ANY group of agents designated by the user.

    Named after the dominant trait of the sub-graph (uniform role, else
    uniform provider, else custom).
    """
    scoped = [a for a in agents if a.id in set(scope_ids)]
    if len(scoped) < 2 or _is_duplicate(scope_ids, existing_folder_sets):
        return None

    kinds = {a.kind for a in scoped}
    providers = {a.llm_binding.provider_id for a in scoped}
    if len(kinds) == 1:
        kind = kinds.pop().value
        return MetaNodeProposal(
            id=_next_id(),
            logic=GroupingLogic.ROLE,
            name_key=_ROLE_NAME_KEYS.get(kind, "groupCustom"),
            rationale_key="logicRole",
            agent_ids=scope_ids,
        )
    if len(providers) == 1:
        return MetaNodeProposal(
            id=_next_id(),
            logic=GroupingLogic.PROVIDER,
            name_key="groupProvider",
            name_param=providers.pop(),
            rationale_key="logicProvider",
            agent_ids=scope_ids,
        )
    return MetaNodeProposal(
        id=_next_id(),
        logic=GroupingLogic.CUSTOM,
        name_key="groupCustom",
        rationale_key="logicCustom",
        agent_ids=scope_ids,
    )
