"""Loop engineering & end-loop guardrails.

An autonomous loop must ALWAYS terminate. Three independent brakes:
  1. hard iteration cap,
  2. stagnation detection (no new observation between iterations),
  3. token/observation budget.
Whichever triggers first forces delivery (with a non-conform report rather
than an infinite loop — the orchestrator then decides to re-contract).
"""

from __future__ import annotations


class LoopGuardrails:
    def __init__(self, max_iterations: int = 8, max_observations: int = 60) -> None:
        self.max_iterations = max_iterations
        self.max_observations = max_observations
        self._last_observation_count = -1

    def should_stop(self, iterations: int, observations: list[str]) -> bool:
        """True when any brake fires; the harness must then deliver."""
        if iterations >= self.max_iterations:
            return True
        if len(observations) >= self.max_observations:
            return True
        stagnating = len(observations) == self._last_observation_count
        self._last_observation_count = len(observations)
        return stagnating
