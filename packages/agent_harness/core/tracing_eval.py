"""LLM Ops — LangSmith tracing, live work events, and the LLM-as-Judge gate.

- Tracing : LangSmith activates automatically when LANGSMITH_API_KEY is set
  (LangChain reads the env vars natively; nothing else to wire).
- Work events : every phase of the loop is published as a `WorkEvent`, which
  the web client renders live in the agent page's « Travail en direct » tab.
- JudgeGate : a SOTA 2026 LLM-as-Judge that grades each TaskOutput against
  its TaskSpecification and the project's transversal standards.
"""

from __future__ import annotations

import json
import os
import time
import uuid
from typing import Any

from contracts import (
    ConformityCriterion,
    ConformityReport,
    TaskOutput,
    TaskSpecification,
    WorkEvent,
    WorkPhase,
)

# LangSmith is enabled purely through environment variables:
#   LANGSMITH_TRACING=true, LANGSMITH_API_KEY=..., LANGSMITH_PROJECT=template-lm
TRACING_ENABLED = os.getenv("LANGSMITH_TRACING", "").lower() == "true"


def emit_work_event(agent_id: str, phase: WorkPhase, label: str, detail: str = "") -> WorkEvent:
    """Publish one live work event. In production this lands in Firestore
    (collection `work_events`) which the web client subscribes to; locally
    it is printed as structured JSON so any log collector can pick it up."""
    event = WorkEvent(
        id=f"w-{uuid.uuid4().hex[:10]}",
        agent_id=agent_id,
        phase=phase,
        label=label,
        detail=detail,
        timestamp=time.time(),
    )
    print(json.dumps({"work_event": event.model_dump()}, ensure_ascii=False))
    return event


_JUDGE_PROMPT = """Tu es le Juge SOTA 2026 de Template_LM.
Évalue la sortie d'un agent contre son contrat. Réponds UNIQUEMENT en JSON :
{{"score": <0-100>, "criteria": [{{"name": str, "passed": bool, "comment": str}}],
  "recommendations": [str]}}

## Contrat
Objectif : {objective}
Contraintes : {constraints}
Livrable attendu : {deliverable}

## Sortie de l'agent
{summary}
"""


class JudgeGate:
    """Grades a TaskOutput; verdict 'conform' requires score >= threshold.

    The report is sent to the next agent and the orchestrator, and its
    recommendations feed learning mode #1 (see memory_layer.apply_judge_feedback).
    """

    def __init__(self, judge_llm: Any, threshold: int = 75) -> None:
        self.judge_llm = judge_llm
        self.threshold = threshold

    def evaluate(self, spec: TaskSpecification, output: TaskOutput) -> ConformityReport:
        prompt = _JUDGE_PROMPT.format(
            objective=spec.objective,
            constraints="; ".join(spec.constraints),
            deliverable=spec.deliverable_format,
            summary=output.summary[:4000],
        )
        model_name = getattr(self.judge_llm, "model", None) or getattr(self.judge_llm, "model_name", "judge")
        try:
            raw = str(self.judge_llm.invoke(prompt).content)
            data = json.loads(raw[raw.index("{") : raw.rindex("}") + 1])
        except (ValueError, AttributeError, KeyError):
            # Unparseable judge output: fail safe (non-conform, retriable).
            return ConformityReport(
                verdict="non-conform",
                score=0,
                judge_model=str(model_name),
                recommendations=["Sortie du juge illisible : réémettre l'évaluation."],
            )
        score = int(data.get("score", 0))
        return ConformityReport(
            verdict="conform" if score >= self.threshold else "non-conform",
            score=score,
            criteria=[ConformityCriterion(**c) for c in data.get("criteria", [])],
            judge_model=str(model_name),
            recommendations=list(data.get("recommendations", [])),
        )
