/**
 * SINGLE SOURCE OF TRUTH — Domain types of Template_LM.
 *
 * Every entity of the AI Operating System is defined ONCE here and reused by
 * every component, context and service. These TypeScript types mirror 1:1 the
 * Pydantic contracts in `packages/shared_contracts/` used by the Python agent
 * harness (LangGraph). If you change a shape here, change it there too.
 */
import type { LucideIcon } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Localisation & theming                                              */
/* ------------------------------------------------------------------ */

export type Language = 'FR' | 'EN' | 'ES';

/** One of the seven preset glassmorphic themes (see core/themes.ts). */
export interface ThemeColor {
  name: string;
  hex: string;
  gradient: string;
  isDark: boolean;
  // Pre-computed Tailwind class groups so components never hardcode colors.
  primaryText: string;
  secondaryText: string;
  mutedText: string;
  glassBg: string;
  glassBorder: string;
  glassHover: string;
  iconBg: string;
  userBubble: string;
  accentBtn: string;
}

/* ------------------------------------------------------------------ */
/* LLM-agnostic provider layer                                         */
/* ------------------------------------------------------------------ */

/** Wire protocol used to reach a provider. Keeps the app LLM-agnostic. */
export type ProviderProtocol = 'google' | 'openai-compatible' | 'anthropic';

/**
 * An LLM platform (cloud API or local runtime such as Ollama / LMLite).
 * Each agent can be bound to a different provider+model.
 */
export interface LLMProvider {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  models: string[];
  /** Stored in memory/localStorage only; never sent anywhere except the provider. */
  apiKey: string;
  /** Base URL for local/self-hosted runtimes (Ollama, LMLite, vLLM…). */
  baseUrl?: string;
  isDefault?: boolean;
}

/** Binding of one agent to one provider+model (the "LLM agnostic" contract). */
export interface LLMBinding {
  providerId: string;
  model: string;
}

/* ------------------------------------------------------------------ */
/* Agents                                                              */
/* ------------------------------------------------------------------ */

export type AgentKind =
  | 'system'       // the general LLM of the OS
  | 'orchestrator' // decomposes projects into task flows
  | 'worker'       // standard autonomous task agent
  | 'judge'        // SOTA conformity judge
  | 'coding'       // KOMAÏ Coding — the GitHub-connected IDE agent
  | 'human';       // a human user, rendered with the same UI as an agent

/** One step of the explained formula chain (for non-specialists). */
export interface ComputeFormula {
  /** Short name of the quantity computed at this step. */
  name: string;
  /** The formula itself, plain text (e.g. "Δv = ve · ln(m0/mf)"). */
  formula: string;
  /** Plain-language explanation understandable without expertise. */
  explanation: string;
}

/** A web link to the SOTA source demonstrating one part of the computation. */
export interface SotaSource {
  /** What part of the computation this source demonstrates. */
  covers: string;
  label: string;
  url: string;
}

/**
 * The MANDATORY computation descriptor every agent of the OS must carry
 * (see docs/AGENT_STANDARD.md). Three parts, enforced by the agent-creator:
 *   1. `graph`    — Mermaid graph of the input-data → output-data algorithm;
 *   2. `formulas` — the explained chain of mathematical formulas;
 *   3. `sources`  — one web link to the SOTA reference per part of the calc.
 * `check` optionally runs the real computation on a known case so the agent
 * can be proven to "give the right result".
 */
export interface ComputeMethod {
  /** Mermaid: input data → … → output data. */
  graph: string;
  formulas: ComputeFormula[];
  sources: SotaSource[];
  /** Numeric self-check(s): known input → expected output (verifiable). */
  checks?: ComputeCheck[];
}

export interface ComputeCheck {
  label: string;
  got: number;
  expected: number;
  /** Relative tolerance (default 1e-3). */
  tol?: number;
  unit?: string;
}

/**
 * A persistent autonomous agent. The STRUCTURE is identical for all agents
 * (Hermes-style harness); only the CONTENT (readme, skills, memory, binding)
 * differs. Humans are agents too — same shape, kind = 'human'.
 */
export interface AgentProfile {
  id: string;
  name: string;
  kind: AgentKind;
  /** Lucide icon rendered on the desktop. */
  icon: LucideIcon;
  tagline: string;
  /** Markdown README: needs, deliverables, working method. */
  readme: string;
  /** Mermaid source describing the agent's algorithm (rendered as code). */
  mermaidAlgorithm: string;
  /** Procedural-memory skills, editable through the learning loop. */
  skills: string[];
  llmBinding: LLMBinding;
  status: 'idle' | 'working' | 'waiting';
  /**
   * Mandatory computation descriptor (graph + explained formulas + SOTA
   * links). Optional at the type level so partial/legacy profiles compile,
   * but the UI flags any agent missing it and the agent-creator refuses to
   * publish an agent without it.
   */
  method?: ComputeMethod;
}

/**
 * A desktop folder grouping agents on the home screen (iOS-style).
 * Rendered with the SAME rounded-square tile as an agent icon; the member
 * agents appear as miniatures inside. Opening it reveals the full cards.
 * Folders NEST: a folder with a `parentId` is a sub-folder, shown as a tile
 * inside its parent's open view instead of on the desktop root.
 */
export interface AgentFolder {
  id: string;
  name: string;
  agentIds: string[];
  /** Present on sub-folders only; undefined = desktop root. */
  parentId?: string;
}

/* ------------------------------------------------------------------ */
/* Curator agent — graph of agents & meta-node grouping proposals      */
/* ------------------------------------------------------------------ */

/** Grouping logics the Curator agent can apply over the agent graph. */
export type GroupingLogic = 'role' | 'provider' | 'activity' | 'custom';

/** One weighted affinity edge between two agent nodes. */
export interface AgentEdge {
  a: string; // agent id
  b: string; // agent id
  weight: number;
  reasons: GroupingLogic[];
}

/** The agent graph the Curator reasons on: nodes = agents, edges = affinities. */
export interface AgentGraph {
  nodes: string[];
  edges: AgentEdge[];
}

/**
 * A META-NODE: a grouping node the Curator creates OVER agent nodes of the
 * graph. Proposed to the user for validation; once accepted it materialises
 * as an AgentFolder on the desktop. Names/rationales are i18n keys so the
 * proposal renders in the user's language.
 */
export interface MetaNodeProposal {
  id: string;
  logic: GroupingLogic;
  nameKey: string;
  nameParam?: string;
  rationaleKey: string;
  agentIds: string[];
}

/* ------------------------------------------------------------------ */
/* Tasks, contracts and conformity (agent-to-agent messages)           */
/* ------------------------------------------------------------------ */

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';

/** The work contract an agent RECEIVES from the orchestrator. */
export interface TaskSpecification {
  objective: string;
  constraints: string[];
  deliverableFormat: string;
}

/** The result an agent SENDS to the next agent and to the orchestrator. */
export interface TaskOutput {
  summary: string;
  artifacts: string[];
  tokensUsed: number;
}

export interface ConformityCriterion {
  name: string;
  passed: boolean;
  comment: string;
}

/** The judge report proving conformity to the spec and project standards. */
export interface ConformityReport {
  verdict: 'conform' | 'non-conform' | 'pending';
  score: number; // 0..100
  criteria: ConformityCriterion[];
  judgeModel: string;
  recommendations: string[];
}

/**
 * One node of the end-to-end task flow. When the current user has no access
 * right on the task, `accessible` is false and the UI renders a META-TASK:
 * a coarse placeholder that only reveals the project structure.
 */
export interface TaskNode {
  id: string;
  projectId: string;
  title: string;
  agentId: string;
  status: TaskStatus;
  dependsOn: string[];
  spec: TaskSpecification;
  input: string;
  output: TaskOutput | null;
  conformity: ConformityReport | null;
  accessible: boolean;
}

/* ------------------------------------------------------------------ */
/* Projects & perimeters (multi-user access control)                   */
/* ------------------------------------------------------------------ */

/** A perimeter grants a member access to a subset of a project's tasks. */
export interface Perimeter {
  memberId: string; // AgentProfile id with kind === 'human'
  taskIds: string[];
  role: 'owner' | 'editor' | 'viewer';
}

export interface Project {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  isLocked: boolean;
  perimeters: Perimeter[];
  /**
   * The agents available inside this project. Every new project starts with
   * the DEFAULT agents (see core/seed.ts DEFAULT_AGENT_IDS); demo projects
   * may add specialised agents (e.g. the space-tech simulators).
   */
  agentIds: string[];
}

/* ------------------------------------------------------------------ */
/* Meta-chat                                                           */
/* ------------------------------------------------------------------ */

/** Who a chat message is addressed to: an agent id, or 'system' for the OS LLM. */
export type ChatTarget = string;

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  targetId: ChatTarget;
  timestamp: number;
}

/* ------------------------------------------------------------------ */
/* Live work stream (SENSE → PLAN → ACT → OBSERVE loop)                */
/* ------------------------------------------------------------------ */

export type WorkPhase = 'SENSE' | 'PLAN' | 'ACT' | 'OBSERVE';

export interface WorkEvent {
  id: string;
  agentId: string;
  taskId: string | null;
  phase: WorkPhase;
  label: string;
  detail: string;
  timestamp: number;
}

/* ------------------------------------------------------------------ */
/* Agent learning (the 4 learning modes)                               */
/* ------------------------------------------------------------------ */

export type LearningMode =
  | 'judge-feedback'      // 1. SOTA judge comments → skill/harness update
  | 'user-feedback'       // 2. user remarks → skill/harness update
  | 'task-replay'         // 3. input + achieved result of a past task
  | 'expected-example';   // 4. input files + expected result file

export interface LearningEntry {
  id: string;
  agentId: string;
  mode: LearningMode;
  summary: string;
  appliedToSkill: string;
  timestamp: number;
}

/* ------------------------------------------------------------------ */
/* KOMAÏ Coding workspace                                              */
/* ------------------------------------------------------------------ */

export interface RepoFile {
  path: string;
  content: string;
  status: 'original' | 'modified' | 'created';
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

/** Top-level views reachable from the navigation tabs above the meta-chat.
 *  KOMAÏ Coding is an agent icon like any other — it is NOT a top tab. */
export type MainTab = 'HOME' | 'FLUX';

export type View =
  | { kind: 'tab'; tab: MainTab }
  | { kind: 'agent'; agentId: string };

/** The contextual tabs of an agent page, in display order (Chat first). */
export type AgentTabId = 'chat' | 'inputs' | 'work' | 'conformity' | 'learning' | 'skills' | 'logs' | 'readme';

/** One point of an agent's end-of-run conformity score history. */
export interface ConformityPoint {
  label: string;
  score: number;
  /** What triggered this run: a learning loop or a user remark. */
  trigger: 'learning' | 'user';
}

/** A traced interaction line for the Logs tab. */
export interface LogEntry {
  id: string;
  agentId: string;
  category: 'user' | 'judge' | 'learning';
  text: string;
  timestamp: number;
}
