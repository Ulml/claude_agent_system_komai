"""Shared Pydantic contracts — the SINGLE SOURCE OF TRUTH for every message
exchanged between agents, the orchestrator, the judge and the web client.

The TypeScript mirror lives in `apps/web/src/core/types.ts`.
"""

from .models import (
    AgentEdge,
    AgentFolder,
    AgentGraph,
    AgentKind,
    AgentProfile,
    ComputeFormula,
    ComputeMethod,
    GroupingLogic,
    MetaNodeProposal,
    SotaSource,
    ConformityCriterion,
    ConformityReport,
    LearningEntry,
    LearningMode,
    LLMBinding,
    Perimeter,
    Project,
    TaskNode,
    TaskOutput,
    TaskSpecification,
    TaskStatus,
    WorkEvent,
    WorkPhase,
)

__all__ = [
    "AgentEdge",
    "AgentFolder",
    "AgentGraph",
    "AgentKind",
    "AgentProfile",
    "ComputeFormula",
    "ComputeMethod",
    "GroupingLogic",
    "MetaNodeProposal",
    "SotaSource",
    "ConformityCriterion",
    "ConformityReport",
    "LearningEntry",
    "LearningMode",
    "LLMBinding",
    "Perimeter",
    "Project",
    "TaskNode",
    "TaskOutput",
    "TaskSpecification",
    "TaskStatus",
    "WorkEvent",
    "WorkPhase",
]
