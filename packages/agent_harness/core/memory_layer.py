"""Memory layers of the standard agent — procedural, semantic, episodic.

- PROCEDURAL : the agent's skills (markdown files in skills/). This is what
  the learning loop rewrites to make the next run cheaper and shorter.
- SEMANTIC   : stable facts about the agent and its domain (persona JSON).
- EPISODIC   : past task episodes (spec + output + report), summarised by
  core/summarizer.py and retrievable through core/retrieval.py.

Vector search uses ChromaDB when installed; otherwise a plain keyword match
keeps the harness fully functional without native dependencies.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from contracts import ConformityReport, TaskOutput, TaskSpecification

try:  # Optional vector store — the harness degrades gracefully without it.
    import chromadb

    _HAS_CHROMA = True
except ImportError:  # pragma: no cover
    _HAS_CHROMA = False

_PKG_ROOT = Path(__file__).resolve().parent.parent


class MemoryLayer:
    """File-backed memory for one agent instance."""

    def __init__(self, agent_id: str, root: Path | None = None) -> None:
        self.agent_id = agent_id
        self.root = root or (_PKG_ROOT / "data" / agent_id)
        self.root.mkdir(parents=True, exist_ok=True)
        self.skills_dir = _PKG_ROOT / "skills"
        self.persona_path = _PKG_ROOT / "config" / "default_persona.json"
        self.episodes_path = self.root / "episodes.jsonl"
        self._chroma = (
            chromadb.PersistentClient(path=str(self.root / "chroma")).get_or_create_collection("episodes")
            if _HAS_CHROMA
            else None
        )

    # ---------------------------- Semantic ----------------------------

    def persona_prompt(self) -> str:
        """System prompt assembled from persona (semantic) + skills (procedural)."""
        persona = json.loads(self.persona_path.read_text(encoding="utf-8"))
        skills = self.load_skills()
        return (
            f"Tu es « {persona['name']} » : {persona['role']}\n"
            f"Style : {persona['style']}\n\n## Compétences (mémoire procédurale)\n{skills}"
        )

    # --------------------------- Procedural ---------------------------

    def load_skills(self) -> str:
        """Concatenate every skill markdown file (procedural memory)."""
        parts = [p.read_text(encoding="utf-8") for p in sorted(self.skills_dir.glob("*.md"))]
        return "\n\n".join(parts) if parts else "(aucune compétence enregistrée)"

    def apply_judge_feedback(self, report: ConformityReport) -> None:
        """Learning mode #1 — append the judge's recommendations to the
        agent's skill file so the next run needs fewer iterations/tokens."""
        if not report.recommendations:
            return
        target = self.skills_dir / "learned_from_judge.md"
        stamp = time.strftime("%Y-%m-%d %H:%M")
        lines = [f"- [{stamp}] {r}" for r in report.recommendations]
        header = "" if target.exists() else "# Compétences apprises du juge\n\n"
        with target.open("a", encoding="utf-8") as fh:
            fh.write(header + "\n".join(lines) + "\n")

    # ---------------------------- Episodic ----------------------------

    def record_episode(
        self,
        spec: TaskSpecification,
        output: TaskOutput | None,
        report: ConformityReport | None,
    ) -> None:
        """Append one completed task to episodic memory (JSONL + vectors)."""
        episode = {
            "timestamp": time.time(),
            "spec": spec.model_dump(),
            "output": output.model_dump() if output else None,
            "report": report.model_dump() if report else None,
        }
        with self.episodes_path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(episode, ensure_ascii=False) + "\n")
        if self._chroma is not None and output is not None:
            self._chroma.add(
                ids=[str(episode["timestamp"])],
                documents=[f"{spec.objective}\n{output.summary}"],
            )

    def search_episodes(self, query: str, k: int = 3) -> list[str]:
        """Semantic search over past episodes (vector or keyword fallback)."""
        if self._chroma is not None and self._chroma.count() > 0:
            hits = self._chroma.query(query_texts=[query], n_results=min(k, self._chroma.count()))
            return hits["documents"][0] if hits["documents"] else []
        if not self.episodes_path.exists():
            return []
        needles = query.lower().split()
        results: list[str] = []
        for line in self.episodes_path.read_text(encoding="utf-8").splitlines():
            episode = json.loads(line)
            text = json.dumps(episode, ensure_ascii=False).lower()
            if any(n in text for n in needles):
                results.append(episode["spec"]["objective"])
        return results[:k]
