"""Pydantic domain models of Template_LM (mirror of apps/web/src/core/types.ts).

Every agent-to-agent and agent-to-orchestrator message is one of these
models, serialized as JSON. Structured communication is a hard rule of the
system: an agent NEVER sends free-form text to another agent — it sends a
`TaskOutput` plus a `ConformityReport`, and receives a `TaskSpecification`.
"""

from __future__ import annotations

import time
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field

# --------------------------------------------------------------------------
# Enums
# --------------------------------------------------------------------------


class AgentKind(str, Enum):
    """Role of an agent inside the OS. Humans are agents too."""

    SYSTEM = "system"
    ORCHESTRATOR = "orchestrator"
    WORKER = "worker"
    JUDGE = "judge"
    CODING = "coding"
    HUMAN = "human"


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class WorkPhase(str, Enum):
    """The four phases of the standard agent loop (Hermes-style harness)."""

    SENSE = "SENSE"
    PLAN = "PLAN"
    ACT = "ACT"
    OBSERVE = "OBSERVE"


class GroupingLogic(str, Enum):
    """Logics the Curator agent applies over the agent graph (meta-nodes)."""

    ROLE = "role"
    PROVIDER = "provider"
    ACTIVITY = "activity"
    CUSTOM = "custom"


class LearningMode(str, Enum):
    """The four ways an agent learns (see docs/PRD.md §Learning)."""

    JUDGE_FEEDBACK = "judge-feedback"
    USER_FEEDBACK = "user-feedback"
    TASK_REPLAY = "task-replay"
    EXPECTED_EXAMPLE = "expected-example"


# --------------------------------------------------------------------------
# Agents
# --------------------------------------------------------------------------


class LLMBinding(BaseModel):
    """Binds one agent to one provider+model — the LLM-agnostic contract."""

    provider_id: str
    model: str


class AgentProfile(BaseModel):
    """A persistent autonomous agent. The structure is identical for all
    agents; only the content (readme, skills, binding) differs."""

    id: str
    name: str
    kind: AgentKind
    tagline: str = ""
    readme: str = ""
    mermaid_algorithm: str = ""
    skills: list[str] = Field(default_factory=list)
    llm_binding: LLMBinding
    status: Literal["idle", "working", "waiting"] = "idle"


class AgentEdge(BaseModel):
    """One weighted affinity edge between two agent nodes of the graph."""

    a: str
    b: str
    weight: int = 0
    reasons: list[GroupingLogic] = Field(default_factory=list)


class AgentGraph(BaseModel):
    """The graph the Curator reasons on: nodes = agent ids, edges = affinities."""

    nodes: list[str] = Field(default_factory=list)
    edges: list[AgentEdge] = Field(default_factory=list)


class MetaNodeProposal(BaseModel):
    """A META-NODE: a grouping node created over agent nodes of the graph,
    proposed to the user for validation. Accepted → desktop AgentFolder.
    Names/rationales are i18n keys resolved by the client."""

    id: str
    logic: GroupingLogic
    name_key: str
    name_param: Optional[str] = None
    rationale_key: str = ""
    agent_ids: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------
# Task contracts (orchestrator → agent → next agent)
# --------------------------------------------------------------------------


class TaskSpecification(BaseModel):
    """The work contract an agent RECEIVES from the orchestrator."""

    objective: str
    constraints: list[str] = Field(default_factory=list)
    deliverable_format: str = "markdown"


class TaskOutput(BaseModel):
    """The result an agent SENDS to the next agent and the orchestrator."""

    summary: str
    artifacts: list[str] = Field(default_factory=list)
    tokens_used: int = 0


class ConformityCriterion(BaseModel):
    name: str
    passed: bool
    comment: str = ""


class ConformityReport(BaseModel):
    """The judge report proving conformity to the spec and to the project's
    transversal standards (skills, organisational and quality standards)."""

    verdict: Literal["conform", "non-conform", "pending"] = "pending"
    score: int = Field(default=0, ge=0, le=100)
    criteria: list[ConformityCriterion] = Field(default_factory=list)
    judge_model: str = ""
    recommendations: list[str] = Field(default_factory=list)


class TaskNode(BaseModel):
    """One node of the end-to-end flow. `accessible=False` means the current
    viewer sees a meta-task (structure only, content hidden)."""

    id: str
    project_id: str
    title: str
    agent_id: str
    status: TaskStatus = TaskStatus.PENDING
    depends_on: list[str] = Field(default_factory=list)
    spec: TaskSpecification
    input: str = ""
    output: Optional[TaskOutput] = None
    conformity: Optional[ConformityReport] = None
    accessible: bool = True


# --------------------------------------------------------------------------
# Projects & perimeters
# --------------------------------------------------------------------------


class Perimeter(BaseModel):
    """Grants a member (human agent) access to a subset of a project's tasks.
    Enforced twice: in the UI and in firebase/firestore.rules."""

    member_id: str
    task_ids: list[str] = Field(default_factory=list)
    role: Literal["owner", "editor", "viewer"] = "viewer"


class Project(BaseModel):
    id: str
    title: str
    description: str
    created_at: float = Field(default_factory=time.time)
    is_locked: bool = False
    perimeters: list[Perimeter] = Field(default_factory=list)


# --------------------------------------------------------------------------
# Observability & learning
# --------------------------------------------------------------------------


class WorkEvent(BaseModel):
    """One entry of the live work stream shown on each agent's page."""

    id: str
    agent_id: str
    task_id: Optional[str] = None
    phase: WorkPhase
    label: str
    detail: str = ""
    timestamp: float = Field(default_factory=time.time)


class LearningEntry(BaseModel):
    """A skill/harness update produced by one of the four learning modes."""

    id: str
    agent_id: str
    mode: LearningMode
    summary: str
    applied_to_skill: str = ""
    timestamp: float = Field(default_factory=time.time)
