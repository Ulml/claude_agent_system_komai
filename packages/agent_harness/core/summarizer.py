"""Summarizer agent — compacts episodic memory into semantic memory.

Long-lived agents accumulate episodes; replaying them verbatim would blow the
context budget. This summarizer periodically distils the last N episodes into
a short semantic digest that the RAGRetriever can inject cheaply.
"""

from __future__ import annotations

import json
from typing import Any

from .memory_layer import MemoryLayer

_SUMMARY_PROMPT = (
    "Condense les épisodes suivants en 5 enseignements réutilisables, "
    "orientés réduction d'itérations et de tokens :\n\n{episodes}"
)


class Summarizer:
    def __init__(self, llm: Any, memory: MemoryLayer) -> None:
        self.llm = llm
        self.memory = memory

    def summarize_recent(self, n: int = 10) -> str:
        """Distil the last n episodes and store the digest as a skill file."""
        if not self.memory.episodes_path.exists():
            return "(aucun épisode à résumer)"
        lines = self.memory.episodes_path.read_text(encoding="utf-8").splitlines()[-n:]
        episodes = "\n".join(
            json.loads(line)["spec"]["objective"] for line in lines if line.strip()
        )
        digest = str(self.llm.invoke(_SUMMARY_PROMPT.format(episodes=episodes)).content)
        target = self.memory.skills_dir / "episodic_digest.md"
        target.write_text(f"# Digest épisodique\n\n{digest}\n", encoding="utf-8")
        return digest
