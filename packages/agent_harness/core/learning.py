"""The four learning modes of every agent (product spec §Apprentissage).

Each mode converges on the same effect: rewriting the agent's PROCEDURAL
memory (skills) and harness documents so the next execution of a similar
task needs fewer iterations and fewer tokens.

  1. judge-feedback    : the SOTA judge's ConformityReport recommendations.
  2. user-feedback     : remarks and requests typed by a user in the meta-chat.
  3. task-replay       : input + achieved result of an already-completed task.
  4. expected-example  : input files + an expected-result file to imitate.
"""

from __future__ import annotations

import time
import uuid

from contracts import ConformityReport, LearningEntry, LearningMode

from .memory_layer import MemoryLayer


class LearningEngine:
    def __init__(self, memory: MemoryLayer) -> None:
        self.memory = memory

    def _write_skill(self, filename: str, header: str, lines: list[str]) -> None:
        """Append learned lines to a dedicated skill file (procedural memory)."""
        target = self.memory.skills_dir / filename
        prefix = "" if target.exists() else f"# {header}\n\n"
        stamp = time.strftime("%Y-%m-%d %H:%M")
        with target.open("a", encoding="utf-8") as fh:
            fh.write(prefix + "\n".join(f"- [{stamp}] {line}" for line in lines) + "\n")

    def _entry(self, mode: LearningMode, summary: str, skill: str) -> LearningEntry:
        return LearningEntry(
            id=f"l-{uuid.uuid4().hex[:10]}",
            agent_id=self.memory.agent_id,
            mode=mode,
            summary=summary,
            applied_to_skill=skill,
        )

    # ------------------------------------------------------------------
    # Mode 1 — SOTA judge feedback
    # ------------------------------------------------------------------

    def learn_from_judge(self, report: ConformityReport) -> LearningEntry:
        self.memory.apply_judge_feedback(report)
        return self._entry(
            LearningMode.JUDGE_FEEDBACK,
            f"{len(report.recommendations)} recommandation(s) du juge intégrée(s).",
            "learned_from_judge.md",
        )

    # ------------------------------------------------------------------
    # Mode 2 — user remarks & requests
    # ------------------------------------------------------------------

    def learn_from_user(self, remark: str) -> LearningEntry:
        self._write_skill("learned_from_users.md", "Compétences apprises des utilisateurs", [remark])
        return self._entry(LearningMode.USER_FEEDBACK, remark, "learned_from_users.md")

    # ------------------------------------------------------------------
    # Mode 3 — replay of an already-completed task (input + result)
    # ------------------------------------------------------------------

    def learn_from_replay(self, task_input: str, achieved_result: str) -> LearningEntry:
        self._write_skill(
            "learned_replays.md",
            "Rejeux de tâches accomplies",
            [f"ENTRÉE : {task_input[:400]}", f"RÉSULTAT : {achieved_result[:400]}"],
        )
        return self._entry(LearningMode.TASK_REPLAY, "Rejeu appris comme référence.", "learned_replays.md")

    # ------------------------------------------------------------------
    # Mode 4 — input files + expected result file
    # ------------------------------------------------------------------

    def learn_from_expected_example(self, input_files: list[str], expected_result: str) -> LearningEntry:
        self._write_skill(
            "learned_examples.md",
            "Exemples entrée → sortie attendue",
            [f"ENTRÉES : {', '.join(input_files)}", f"SORTIE ATTENDUE : {expected_result[:400]}"],
        )
        return self._entry(
            LearningMode.EXPECTED_EXAMPLE, "Exemple attendu intégré à la mémoire procédurale.", "learned_examples.md"
        )
