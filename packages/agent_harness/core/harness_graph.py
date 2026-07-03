"""The HARNESS — the standard LangGraph loop shared by EVERY agent.

This is the Single Source of Truth of agent behaviour: one graph, one loop
(SENSE → PLAN → ACT → OBSERVE → judge gate), instantiated once per agent.
Only the *content* injected into it differs between agents:

  - the persona / system prompt      (config/default_persona.json)
  - the procedural skills            (skills/*.md, via memory_layer)
  - the LLM binding (provider+model) (contracts.LLMBinding — LLM agnostic)
  - the tool set                     (core/tools.py registry)

Inspired by the Hermes agent architecture (github.com/nousresearch/hermes-agent):
persistent loop, structured tool calling, memory layers, guarded termination.
"""

from __future__ import annotations

from typing import Annotated, Any, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from contracts import ConformityReport, TaskOutput, TaskSpecification, WorkPhase

from .loop_guardrails import LoopGuardrails
from .memory_layer import MemoryLayer
from .retrieval import RAGRetriever
from .tools import ToolRegistry
from .tracing_eval import JudgeGate, emit_work_event


class HarnessState(TypedDict):
    """State carried across the graph. LangGraph merges message updates."""

    messages: Annotated[list[BaseMessage], add_messages]
    spec: TaskSpecification
    task_input: str
    plan: list[str]
    observations: list[str]
    output: TaskOutput | None
    report: ConformityReport | None
    iterations: int


class AgentHarness:
    """Builds and runs the standard agent loop for one agent instance.

    Parameters
    ----------
    agent_id: stable id of the agent (matches AgentProfile.id).
    llm: any LangChain chat model — the harness never knows which provider
         is behind it, which is what makes the system LLM-agnostic.
    tools: the agent's tool registry (web_search, calculate, files…).
    memory: procedural + semantic + episodic memory layers.
    """

    def __init__(
        self,
        agent_id: str,
        llm: Any,
        tools: ToolRegistry | None = None,
        memory: MemoryLayer | None = None,
        max_iterations: int = 8,
    ) -> None:
        self.agent_id = agent_id
        self.llm = llm
        self.tools = tools or ToolRegistry.default()
        self.memory = memory or MemoryLayer(agent_id)
        self.retriever = RAGRetriever(self.memory)
        self.guardrails = LoopGuardrails(max_iterations=max_iterations)
        self.judge = JudgeGate(judge_llm=llm)
        self.graph = self._build_graph()

    # ------------------------------------------------------------------
    # Graph nodes — one per phase of the loop
    # ------------------------------------------------------------------

    def _sense(self, state: HarnessState) -> dict:
        """SENSE: read the contract, retrieve relevant memory and context."""
        emit_work_event(self.agent_id, WorkPhase.SENSE, "Analyse du contrat", state["spec"].objective)
        context = self.retriever.retrieve(state["spec"].objective)
        system = SystemMessage(
            content=(
                f"{self.memory.persona_prompt()}\n\n"
                f"## Contrat (TaskSpecification)\nObjectif : {state['spec'].objective}\n"
                f"Contraintes : {'; '.join(state['spec'].constraints)}\n"
                f"Livrable : {state['spec'].deliverable_format}\n\n"
                f"## Mémoire pertinente\n{context}"
            )
        )
        return {"messages": [system, HumanMessage(content=state["task_input"])]}

    def _plan(self, state: HarnessState) -> dict:
        """PLAN: ask the bound LLM for a short, tool-aware step plan."""
        emit_work_event(self.agent_id, WorkPhase.PLAN, "Plan d'exécution", f"itération {state['iterations'] + 1}")
        prompt = HumanMessage(
            content=(
                "Établis un plan concis (3-5 étapes numérotées) pour remplir le contrat. "
                f"Outils disponibles : {', '.join(self.tools.names())}."
            )
        )
        answer: AIMessage = self.llm.invoke([*state["messages"], prompt])
        plan = [line.strip() for line in str(answer.content).splitlines() if line.strip()]
        return {"messages": [answer], "plan": plan, "iterations": state["iterations"] + 1}

    def _act(self, state: HarnessState) -> dict:
        """ACT: execute the plan through structured tool calls."""
        emit_work_event(self.agent_id, WorkPhase.ACT, "Exécution des outils", f"{len(state['plan'])} étapes")
        results = [self.tools.execute_from_plan(step) for step in state["plan"]]
        return {"observations": state["observations"] + [r for r in results if r]}

    def _observe(self, state: HarnessState) -> dict:
        """OBSERVE: turn tool observations into a candidate TaskOutput."""
        emit_work_event(self.agent_id, WorkPhase.OBSERVE, "Contrôle du résultat", "")
        prompt = HumanMessage(
            content=(
                "Observations des outils :\n"
                + "\n".join(state["observations"][-10:])
                + "\n\nProduis maintenant le livrable final au format demandé."
            )
        )
        answer: AIMessage = self.llm.invoke([*state["messages"], prompt])
        output = TaskOutput(
            summary=str(answer.content)[:2000],
            artifacts=[state["spec"].deliverable_format],
            tokens_used=getattr(answer, "usage_metadata", None) and answer.usage_metadata.get("total_tokens", 0) or 0,
        )
        return {"messages": [answer], "output": output}

    def _judge(self, state: HarnessState) -> dict:
        """JUDGE GATE: LLM-as-Judge conformity check before delivery."""
        assert state["output"] is not None
        report = self.judge.evaluate(state["spec"], state["output"])
        # Judge feedback is learning mode #1: recommendations update skills.
        self.memory.apply_judge_feedback(report)
        return {"report": report}

    # ------------------------------------------------------------------
    # Routing
    # ------------------------------------------------------------------

    def _route_after_judge(self, state: HarnessState) -> str:
        """Deliver when conform; otherwise iterate — unless guardrails stop us."""
        report = state["report"]
        if report and report.verdict == "conform":
            return "deliver"
        if self.guardrails.should_stop(state["iterations"], state["observations"]):
            return "deliver"  # deliver with a non-conform report rather than loop forever
        return "retry"

    def _build_graph(self):
        g = StateGraph(HarnessState)
        g.add_node("sense", self._sense)
        g.add_node("plan", self._plan)
        g.add_node("act", self._act)
        g.add_node("observe", self._observe)
        g.add_node("judge", self._judge)

        g.set_entry_point("sense")
        g.add_edge("sense", "plan")
        g.add_edge("plan", "act")
        g.add_edge("act", "observe")
        g.add_edge("observe", "judge")
        g.add_conditional_edges("judge", self._route_after_judge, {"retry": "plan", "deliver": END})
        return g.compile()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run(self, spec: TaskSpecification, task_input: str) -> tuple[TaskOutput, ConformityReport]:
        """Execute one contracted task end-to-end.

        Returns the structured pair sent to the next agent AND to the
        orchestrator: (TaskOutput, ConformityReport).
        """
        final: dict = self.graph.invoke(
            HarnessState(
                messages=[],
                spec=spec,
                task_input=task_input,
                plan=[],
                observations=[],
                output=None,
                report=None,
                iterations=0,
            )
        )
        # Episodic memory records the whole exchange for future retrieval.
        self.memory.record_episode(spec, final["output"], final["report"])
        return final["output"], final["report"]
