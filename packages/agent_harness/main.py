"""Entry point — run one contracted task or a whole project flow locally.

Usage:
    python main.py "Objectif de la tâche"          # one task, one agent
    python main.py --flow "Objectif du projet"     # full orchestrated flow

The LLM binding is read from environment variables so the SAME harness runs
against any provider (LLM agnosticism):
    LLM_PROVIDER = google | openai | anthropic | ollama   (default: google)
    LLM_MODEL    = model name for that provider
"""

from __future__ import annotations

import os
import sys
from typing import Any

from contracts import TaskSpecification

from core.harness_graph import AgentHarness
from orchestrator import Orchestrator


def build_llm() -> Any:
    """Instantiate the chat model for the configured provider.

    Imports are local so only the installed provider package is required.
    """
    provider = os.getenv("LLM_PROVIDER", "google").lower()
    model = os.getenv("LLM_MODEL", "")
    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(model=model or "gemini-2.5-flash")
    if provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(model=model or "gpt-5-mini")
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(model=model or "claude-sonnet-5")
    if provider == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(model=model or "qwen3-coder")
    raise ValueError(f"Fournisseur LLM inconnu : {provider}")


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    llm = build_llm()
    run_flow = args[0] == "--flow"
    goal = " ".join(args[1:] if run_flow else args)

    if run_flow:
        # One harness per agent role; bind different LLMs per agent if needed.
        pool = {
            agent_id: AgentHarness(agent_id, llm)
            for agent_id in ("researcher", "analyst", "writer", "orchestrator")
        }
        orchestrator = Orchestrator(pool)
        tasks = orchestrator.decompose("proj-cli", goal[:40] or "Projet CLI", goal)
        for task in orchestrator.run_flow(tasks):
            print(f"[{task.status.value:>7}] {task.title} — score "
                  f"{task.conformity.score if task.conformity else '—'}")
        return

    harness = AgentHarness("cli-agent", llm)
    spec = TaskSpecification(objective=goal, deliverable_format="markdown")
    output, report = harness.run(spec, goal)
    print(f"\n=== SORTIE ===\n{output.summary}")
    print(f"\n=== CONFORMITÉ ===\n{report.verdict} — score {report.score}/100")


if __name__ == "__main__":
    main()
