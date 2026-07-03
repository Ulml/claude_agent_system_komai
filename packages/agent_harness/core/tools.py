"""Tool calling — the registry of actions an agent can take during ACT.

Tools are plain callables registered by name. The default set is deliberately
small and safe (search stub, calculator, workspace file I/O confined to the
agent's data directory); each concrete agent extends it with its own tools.
"""

from __future__ import annotations

import ast
import operator
from pathlib import Path
from typing import Callable

_SAFE_OPS: dict[type, Callable] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
}


def calculate(expression: str) -> str:
    """Safely evaluate an arithmetic expression (AST whitelist, no eval)."""

    def _eval(node: ast.AST) -> float:
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.BinOp) and type(node.op) in _SAFE_OPS:
            return _SAFE_OPS[type(node.op)](_eval(node.left), _eval(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in _SAFE_OPS:
            return _SAFE_OPS[type(node.op)](_eval(node.operand))
        raise ValueError(f"Expression non autorisée : {ast.dump(node)}")

    return str(_eval(ast.parse(expression, mode="eval")))


def web_search(query: str) -> str:
    """Search stub — bind your engine of choice (Tavily, SerpAPI, Brave…)
    here. Kept as a stub so the harness has zero mandatory network deps."""
    return f"[web_search] résultats pour « {query} » (branchez un moteur réel ici)"


class ToolRegistry:
    """Name → callable registry with a guarded plan-driven executor."""

    def __init__(self, workspace: Path | None = None) -> None:
        self._tools: dict[str, Callable[..., str]] = {}
        self.workspace = workspace or Path.cwd() / "workspace"

    @classmethod
    def default(cls) -> "ToolRegistry":
        registry = cls()
        registry.register("calculate", calculate)
        registry.register("web_search", web_search)
        registry.register("read_file", registry.read_file)
        registry.register("write_file", registry.write_file)
        return registry

    def register(self, name: str, func: Callable[..., str]) -> None:
        self._tools[name] = func

    def names(self) -> list[str]:
        return sorted(self._tools)

    # ------------------------- Built-in file I/O -------------------------

    def _resolve(self, relative_path: str) -> Path:
        """Confine file access to the agent workspace (no path traversal)."""
        target = (self.workspace / relative_path).resolve()
        if not target.is_relative_to(self.workspace.resolve()):
            raise PermissionError(f"Chemin hors du workspace : {relative_path}")
        return target

    def read_file(self, path: str) -> str:
        return self._resolve(path).read_text(encoding="utf-8")

    def write_file(self, path: str, content: str) -> str:
        target = self._resolve(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return f"Fichier écrit : {path}"

    # --------------------------- Plan executor ---------------------------

    def execute_from_plan(self, plan_step: str) -> str:
        """Best-effort execution of one plan line. A step that names a tool
        like `web_search("...")` runs it; anything else is a reasoning step
        and produces no observation."""
        for name, func in self._tools.items():
            marker = f"{name}("
            if marker in plan_step:
                start = plan_step.index(marker) + len(marker)
                arg = plan_step[start : plan_step.rindex(")")].strip().strip("\"'")
                try:
                    return f"{name} → {func(arg)}"
                except Exception as exc:  # noqa: BLE001 — observation, not crash
                    return f"{name} → erreur : {exc}"
        return ""
