"""Orchestrator — decomposes a project goal into an end-to-end agent flow.

The orchestrator is itself an agent (same harness, kind='orchestrator') whose
job is planning and supervision rather than production:

  1. DECOMPOSE : split the user's goal into contracted tasks (can scale to
     hundreds or thousands of steps — the flow is a DAG, not a fixed list).
  2. ASSIGN    : pick an agent per task, each with its own LLM binding.
  3. CONTRACT  : emit one TaskSpecification per task.
  4. SUPERVISE : run tasks in dependency order; a non-conform report loops
     the task back with the judge's recommendations appended.

The web client's local simulator (apps/web/src/core/orchestrator.ts) mirrors
this default plan so both executors are interchangeable.
"""

from __future__ import annotations

import uuid
from typing import Any

from contracts import TaskNode, TaskSpecification, TaskStatus

from core.harness_graph import AgentHarness

# Default linear plan: research → analysis → writing → closure review.
_DEFAULT_PLAN: list[tuple[str, str, str]] = [
    ("researcher", "Recherche — {title}", "Collecter le contexte nécessaire à : {goal}"),
    ("analyst", "Analyse — {title}", "Structurer et quantifier les éléments collectés."),
    ("writer", "Rédaction — {title}", "Produire le livrable final du projet."),
    ("orchestrator", "Revue — {title}", "Vérifier la cohérence de bout en bout et clôturer."),
]


class Orchestrator:
    """Plans and supervises one project flow.

    `agent_pool` maps agent ids to ready AgentHarness instances — each one
    potentially bound to a DIFFERENT provider/model (LLM agnosticism).
    """

    def __init__(self, agent_pool: dict[str, AgentHarness], planner_llm: Any | None = None) -> None:
        self.agent_pool = agent_pool
        self.planner_llm = planner_llm  # optional LLM-driven decomposition

    # ------------------------------------------------------------------
    # 1-3. Decompose + assign + contract
    # ------------------------------------------------------------------

    def decompose(self, project_id: str, title: str, goal: str) -> list[TaskNode]:
        """Build the contracted task DAG for a project goal."""
        tasks: list[TaskNode] = []
        previous_id: str | None = None
        for agent_id, title_tpl, objective_tpl in _DEFAULT_PLAN:
            task = TaskNode(
                id=f"{project_id}-{uuid.uuid4().hex[:8]}",
                project_id=project_id,
                title=title_tpl.format(title=title),
                agent_id=agent_id,
                depends_on=[previous_id] if previous_id else [],
                spec=TaskSpecification(
                    objective=objective_tpl.format(goal=goal),
                    constraints=[
                        "Respecter les standards transversaux du projet",
                        "Sortie structurée (contracts.TaskOutput)",
                    ],
                    deliverable_format="markdown",
                ),
                input=goal if previous_id is None else f"Sortie de {previous_id}",
            )
            tasks.append(task)
            previous_id = task.id
        return tasks

    # ------------------------------------------------------------------
    # 4. Supervise
    # ------------------------------------------------------------------

    def run_flow(self, tasks: list[TaskNode], max_retries: int = 2) -> list[TaskNode]:
        """Execute the flow in dependency order with conformity-gated retries."""
        outputs: dict[str, str] = {}
        for task in tasks:  # tasks arrive topologically sorted from decompose()
            harness = self.agent_pool.get(task.agent_id)
            if harness is None:
                task.status = TaskStatus.FAILED
                continue

            task_input = "\n".join(outputs[d] for d in task.depends_on if d in outputs) or task.input
            task.status = TaskStatus.RUNNING

            for attempt in range(1 + max_retries):
                output, report = harness.run(task.spec, task_input)
                task.output, task.conformity = output, report
                if report.verdict == "conform":
                    task.status = TaskStatus.DONE
                    outputs[task.id] = output.summary
                    break
                # Non-conform: re-contract with the judge's recommendations.
                task.spec.constraints.extend(report.recommendations)
                if attempt == max_retries:
                    task.status = TaskStatus.FAILED
        return tasks
