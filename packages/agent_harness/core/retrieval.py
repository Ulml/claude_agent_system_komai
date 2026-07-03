"""RAGRetriever — assembles the context injected during the SENSE phase.

Combines the two retrievable memory layers:
  - semantic  : the agent persona + skills (always included, compacted)
  - episodic  : top-k similar past episodes (vector or keyword search)
"""

from __future__ import annotations

from .memory_layer import MemoryLayer


class RAGRetriever:
    def __init__(self, memory: MemoryLayer, k: int = 3) -> None:
        self.memory = memory
        self.k = k

    def retrieve(self, query: str) -> str:
        """Return a compact context block for the given objective."""
        episodes = self.memory.search_episodes(query, k=self.k)
        if not episodes:
            return "(aucun épisode similaire en mémoire)"
        bullets = "\n".join(f"- {e[:300]}" for e in episodes)
        return f"Épisodes similaires déjà réalisés :\n{bullets}"
