"""OS-administration toolset of the Orchestrator.

These are the tools that let the Orchestrator do, by itself, what a user can
do by hand on the desktop:

  - create_folder / create_subfolder : desktop folders, nested via parent_id
    (e.g. « Technologies Spatiales » → « Propulsion », « Protections
    Anti-Radiations »);
  - create_agent : instantiate a new agent on the STANDARD harness — only
    the content (readme, skills, LLM binding) is specific;
  - verify_agent_sources : fact-check a newly created agent's README against
    internet sources through the web_search tool, producing a
    ConformityReport that the Judge gates before the agent is published.

The registry is file-backed here (an OSAdminState the caller persists to
Firestore in production); the web client exposes the same primitives as
AppContext.createFolder / createAgent.
"""

from __future__ import annotations

import re
import uuid
from typing import Callable

from pydantic import BaseModel, Field

from contracts import (
    AgentFolder,
    AgentProfile,
    ConformityCriterion,
    ConformityReport,
)


class OSAdminState(BaseModel):
    """The mutable desktop state the Orchestrator administers."""

    agents: list[AgentProfile] = Field(default_factory=list)
    folders: list[AgentFolder] = Field(default_factory=list)


class OSAdminTools:
    """Orchestrator-facing tool functions over an OSAdminState.

    `search` is the web_search callable from core.tools — injected so the
    verification step uses the exact same tool the harness exposes.
    """

    def __init__(self, state: OSAdminState, search: Callable[[str], str]) -> None:
        self.state = state
        self.search = search

    # ------------------------------------------------------------------
    # Folders & sub-folders
    # ------------------------------------------------------------------

    def create_folder(self, name: str, agent_ids: list[str], parent_id: str | None = None) -> AgentFolder:
        """Create a desktop folder; pass parent_id to nest it as a sub-folder.

        Mirrors the iOS semantics of the client: an agent lives in a single
        folder, so members are removed from any previous folder.
        """
        for folder in self.state.folders:
            folder.agent_ids = [i for i in folder.agent_ids if i not in agent_ids]
        folder = AgentFolder(
            id=f"folder-{uuid.uuid4().hex[:10]}",
            name=name.strip(),
            agent_ids=list(agent_ids),
            parent_id=parent_id,
        )
        self.state.folders.append(folder)
        return folder

    def create_subfolder(self, name: str, agent_ids: list[str], parent_id: str) -> AgentFolder:
        """Explicit sub-folder variant (parent required)."""
        return self.create_folder(name, agent_ids, parent_id=parent_id)

    # ------------------------------------------------------------------
    # Agents
    # ------------------------------------------------------------------

    def create_agent(self, profile: AgentProfile) -> AgentProfile:
        """Register a new agent built on the standard harness.

        The profile carries only CONTENT (readme, skills, llm_binding);
        behaviour always comes from core.harness_graph.AgentHarness.
        """
        if any(a.id == profile.id for a in self.state.agents):
            raise ValueError(f"Agent déjà existant : {profile.id}")
        self.state.agents.append(profile)
        return profile

    # ------------------------------------------------------------------
    # Internet-source verification
    # ------------------------------------------------------------------

    def verify_agent_sources(self, agent: AgentProfile, max_claims: int = 5) -> ConformityReport:
        """Fact-check the agent's README against internet sources.

        Extracts the strongest factual claims from the README (lines with
        figures, project names or status assertions), queries web_search for
        each, and records one ConformityCriterion per claim with the sources
        found. The resulting report goes through the Judge gate before the
        agent is published on the desktop.
        """
        claims = self._extract_claims(agent.readme, max_claims)
        criteria: list[ConformityCriterion] = []
        for claim in claims:
            evidence = self.search(f"{agent.name} {claim}")
            criteria.append(
                ConformityCriterion(
                    name=f"Source : {claim[:60]}",
                    # A stubbed search engine cannot confirm anything; only a
                    # real engine returning evidence validates the claim.
                    passed=bool(evidence) and not evidence.startswith("[web_search]"),
                    comment=evidence[:200],
                )
            )
        checked = [c for c in criteria if c.passed]
        score = int(100 * len(checked) / len(criteria)) if criteria else 0
        return ConformityReport(
            verdict="conform" if criteria and len(checked) == len(criteria) else "non-conform",
            score=score,
            criteria=criteria,
            judge_model="verify_agent_sources",
            recommendations=(
                []
                if criteria and len(checked) == len(criteria)
                else ["Brancher un moteur web_search réel et re-vérifier les faits non confirmés."]
            ),
        )

    @staticmethod
    def _extract_claims(readme: str, max_claims: int) -> list[str]:
        """Heuristic claim extraction: bullet lines carrying numbers,
        uppercase acronyms or status keywords are the most checkable."""
        candidates = []
        for line in readme.splitlines():
            text = line.strip().lstrip("-• ").strip()
            if len(text) < 15:
                continue
            if re.search(r"\d|NASA|JAXA|ISP|GCR|NIAC|HALEU|mature|théorique|démontré", text, re.I):
                candidates.append(text)
        return candidates[:max_claims]
