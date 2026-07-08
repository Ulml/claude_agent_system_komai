/**
 * Global application state (SSOT for runtime state).
 *
 * One provider, one `useApp()` hook: theme, language, current user, agents,
 * projects + task flows, meta-chat, live work stream, LLM providers and
 * navigation. Components never own domain state — they read and mutate it
 * here, which is what keeps every screen (desktop, flow, agent pages,
 * meta-chat) perfectly synchronised.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AgentFolder,
  AgentProfile,
  AgentTabId,
  ChatMessage,
  Language,
  LearningEntry,
  LLMProvider,
  MetaNodeProposal,
  Project,
  TaskNode,
  ThemeColor,
  View,
  WorkEvent,
} from '@/core/types';

/** A pending request to grant access to an item the inviter cannot reach. */
export interface AccessRequest {
  id: string;
  inviterId: string;
  inviteeName: string;
  agentId: string;
}
import { defaultTheme } from '@/core/themes';
import { translations } from '@/core/i18n';
import {
  DEFAULT_AGENT_IDS,
  seedAgents,
  seedFolders,
  seedLearning,
  seedProject,
  seedProviders,
  seedTasks,
  seedWorkEvents,
} from '@/core/seed';
import { agentMethods } from '@/core/agent_methods';
import { decomposeAgentSubFlow, decomposeGoal, runFlowLocally } from '@/core/orchestrator';
import { proposeMetaNodeForScope, proposeMetaNodes } from '@/core/curator';
import { generateText } from '@/services/llm';
import { persistProject } from '@/services/firebase';

interface AppContextType {
  // Localisation & theming
  language: Language;
  setLanguage: (l: Language) => void;
  theme: ThemeColor;
  setTheme: (t: ThemeColor) => void;
  t: Record<string, string>;

  // Identity (the current, signed-in human — itself an agent)
  currentUserId: string;
  setCurrentUserId: (id: string) => void;

  // Multi-user access control
  /** Agents the CURRENT user is allowed to see/use (all by default). */
  accessibleAgentIds: (userId?: string) => 'all' | string[];
  hasAccess: (agentId: string, userId?: string) => boolean;
  invite: (inviteeName: string, agentIds: string[]) => void;
  accessRequests: AccessRequest[];
  resolveRequest: (requestId: string, grant: 'invitee' | 'both' | 'deny') => void;

  // Navigation
  view: View;
  setView: (v: View) => void;
  /** Contextual back: agent → its folder/home, folder → parent/root. */
  goBack: () => void;
  canGoBack: boolean;
  // Agent contextual tabs (rendered in the dock, not on the page)
  agentTab: AgentTabId;
  setAgentTab: (tab: AgentTabId) => void;
  /** Sub-selection of the Logs tab (from its hover menu). */
  logsFilter: 'all' | 'user' | 'judge' | 'learning';
  setLogsFilter: (f: 'all' | 'user' | 'judge' | 'learning') => void;
  /** True when the in-page agent title has scrolled out of view. */
  agentTitleHidden: boolean;
  setAgentTitleHidden: (hidden: boolean) => void;

  // Agents & desktop folders (nested via parentId)
  agents: AgentProfile[];
  /** Agents of the SELECTED PROJECT (the desktop shows only these). */
  visibleAgents: AgentProfile[];
  createAgent: (profile: AgentProfile) => void;
  folders: AgentFolder[];
  /** Folders whose members exist in the selected project. */
  visibleFolders: AgentFolder[];
  openFolderId: string | null;
  setOpenFolderId: (id: string | null) => void;
  createFolder: (name: string, agentIds: string[], parentId?: string) => void;
  deleteFolder: (id: string) => void;

  // Desktop selection (designating a group of agents)
  isSelectionMode: boolean;
  setIsSelectionMode: (on: boolean) => void;
  selectedAgentIds: string[];
  toggleAgentSelection: (id: string) => void;

  // Curator agent — meta-node grouping proposals
  proposals: MetaNodeProposal[];
  requestCuratorProposals: (scopeIds?: string[]) => void;
  acceptProposal: (id: string) => void;
  rejectProposal: (id: string) => void;
  resolveProposalName: (p: MetaNodeProposal) => string;

  // Projects & tasks
  projects: Project[];
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  createProject: (title: string, description: string) => void;
  toggleProjectLock: (id: string) => void;
  tasks: TaskNode[];
  visibleTasks: TaskNode[]; // perimeter-filtered: hidden tasks become meta-tasks
  runProjectFlow: () => void;
  isFlowRunning: boolean;

  // META-AGENTS — an agent detailed into a SUB-FLOW (its « Flux » tab)
  isMetaAgent: (agentId: string) => boolean;
  /** Details the agent into a sub-flow; false when impossible/already meta. */
  createSubFlow: (agentId: string) => boolean;

  // Live work & learning
  workEvents: WorkEvent[];
  learning: LearningEntry[];

  // Meta-chat — contextual: talks to the open agent, else the system LLM
  messages: ChatMessage[];
  /** The agent the chat currently addresses (derived from the view). */
  chatTarget: string;
  sendMessage: (text: string) => Promise<void>;
  isChatLoading: boolean;

  // LLM providers
  providers: LLMProvider[];
  addProvider: (p: Omit<LLMProvider, 'id'>) => void;
  updateProvider: (id: string, updates: Partial<LLMProvider>) => void;
  removeProvider: (id: string) => void;

  // Modals
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isProjectModalOpen: boolean;
  setIsProjectModalOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('FR');
  const [theme, setTheme] = useState<ThemeColor>(defaultTheme);
  // The signed-in user. 'user-owner' is the owner and sees everything.
  const [currentUserId, setCurrentUserId] = useState('user-owner');
  const [view, setViewRaw] = useState<View>({ kind: 'tab', tab: 'HOME' });
  // Navigation history for the top-left back arrow — works on EVERY view
  // (Flux, Système, agent pages…), returning to wherever the user was.
  const viewHistoryRef = useRef<View[]>([]);
  const setView = useCallback((v: View) => {
    setViewRaw((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(v)) {
        viewHistoryRef.current = [...viewHistoryRef.current, prev].slice(-50);
      }
      return v;
    });
  }, []);
  const [agentTab, setAgentTab] = useState<AgentTabId>('results');
  const [logsFilter, setLogsFilter] = useState<'all' | 'user' | 'judge' | 'learning'>('all');
  const [agentTitleHidden, setAgentTitleHidden] = useState(false);

  // Access grants: userId → set of agent ids (owner is implicitly 'all').
  const [grants, setGrants] = useState<Record<string, string[]>>({ 'user-guest': ['writer'] });
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);

  const [agents, setAgents] = useState<AgentProfile[]>(seedAgents);
  const [folders, setFolders] = useState<AgentFolder[]>(seedFolders);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [proposals, setProposals] = useState<MetaNodeProposal[]>([]);
  const [projects, setProjects] = useState<Project[]>([seedProject]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(seedProject.id);
  const [tasks, setTasks] = useState<TaskNode[]>(seedTasks);
  const [isFlowRunning, setIsFlowRunning] = useState(false);
  const cancelFlowRef = useRef<(() => void) | null>(null);

  const [workEvents, setWorkEvents] = useState<WorkEvent[]>(seedWorkEvents);
  const [learning] = useState<LearningEntry[]>(seedLearning);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  // The chat is contextual: it addresses the open agent, else the system LLM.
  const chatTarget = view.kind === 'agent' ? view.agentId : 'system-llm';

  // Opening a new agent shows its « Résultats » tab by default (the chat
  // stays the leftmost tab, but results is what the user wants to see first).
  useEffect(() => {
    if (view.kind === 'agent') setAgentTab('results');
  }, [view.kind === 'agent' ? view.agentId : null]);

  // Once the open agent starts a run, auto-switch to « Travail en direct ».
  const openAgentRunning =
    view.kind === 'agent' &&
    tasks.some((task) => task.agentId === view.agentId && task.status === 'running');
  useEffect(() => {
    if (openAgentRunning) setAgentTab('work');
  }, [openAgentRunning]);

  const [providers, setProviders] = useState<LLMProvider[]>(seedProviders);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  const t = translations[language];

  /* ----------------------- Folders & selection ------------------------ */

  /**
   * Creates an agent folder — at the desktop root, or as a SUB-FOLDER when
   * `parentId` is given. This is also the primitive the Orchestrator's
   * create_folder / create_subfolder tools call.
   */
  const createFolder = useCallback((name: string, agentIds: string[], parentId?: string) => {
    if (!name.trim() || agentIds.length === 0) return;
    const folder: AgentFolder = { id: `folder-${Date.now()}`, name: name.trim(), agentIds, parentId };
    // iOS semantics: an agent lives in one folder. Moving it into the new
    // folder removes it from any previous one; emptied LEAF folders
    // disappear (parents of sub-folders survive even with zero agents).
    setFolders((prev) => [
      ...prev
        .map((f) => ({ ...f, agentIds: f.agentIds.filter((id) => !agentIds.includes(id)) }))
        .filter((f) => f.agentIds.length > 0 || prev.some((child) => child.parentId === f.id)),
      folder,
    ]);
    setSelectedAgentIds([]);
    setIsSelectionMode(false);
  }, []);

  const deleteFolder = useCallback((id: string) => {
    // Deleting a folder releases its agents to the desktop root and
    // re-parents its sub-folders to the deleted folder's own parent.
    setFolders((prev) => {
      const deleted = prev.find((f) => f.id === id);
      return prev
        .filter((f) => f.id !== id)
        .map((f) => (f.parentId === id ? { ...f, parentId: deleted?.parentId } : f));
    });
    setOpenFolderId((current) => (current === id ? null : current));
  }, []);

  /** Registers a new agent (Orchestrator create_agent tool primitive). */
  const createAgent = useCallback((profile: AgentProfile) => {
    setAgents((prev) => (prev.some((a) => a.id === profile.id) ? prev : [...prev, profile]));
  }, []);

  const toggleAgentSelection = useCallback((id: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  /* ----------------- Project-scoped agents & folders ------------------ */

  // The desktop shows only the agents of the selected project (space-tech
  // simulators exist solely in the « Technologies Spatiales » demo project).
  const visibleAgents = useMemo(() => {
    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project) return agents.filter((a) => DEFAULT_AGENT_IDS.includes(a.id));
    return agents.filter((a) => project.agentIds.includes(a.id));
  }, [agents, projects, selectedProjectId]);

  const visibleFolders = useMemo(() => {
    const visibleIds = new Set(visibleAgents.map((a) => a.id));
    const kept = folders
      .map((f) => ({ ...f, agentIds: f.agentIds.filter((id) => visibleIds.has(id)) }))
      // Keep a folder if it still has agents or visible sub-folders.
      .filter((f, _, arr) => f.agentIds.length > 0 || arr.some((c) => c.parentId === f.id && c.agentIds.length > 0));
    return kept;
  }, [folders, visibleAgents]);

  /* --------------------- Back navigation (top-left arrow) -------------- */

  // The back arrow shows whenever we are not on the bare Home desktop.
  const canGoBack =
    openFolderId !== null ||
    view.kind === 'agent' ||
    (view.kind === 'tab' && view.tab !== 'HOME') ||
    viewHistoryRef.current.length > 0;
  const goBack = useCallback(() => {
    // Inside a folder → climb to its parent / desktop root first.
    if (openFolderId) {
      const current = folders.find((f) => f.id === openFolderId);
      setOpenFolderId(current?.parentId ?? null);
      return;
    }
    // Otherwise pop the navigation history (works on Flux / Système / agents).
    const hist = viewHistoryRef.current;
    if (hist.length > 0) {
      const prev = hist[hist.length - 1];
      viewHistoryRef.current = hist.slice(0, -1);
      setViewRaw(prev);
      return;
    }
    setViewRaw({ kind: 'tab', tab: 'HOME' });
  }, [openFolderId, folders]);

  /* -------------------------- Multi-user access ----------------------- */

  const accessibleAgentIds = useCallback(
    (userId: string = currentUserId): 'all' | string[] => {
      // The owner sees everything; others see only their granted agents.
      if (userId === 'user-owner') return 'all';
      return grants[userId] ?? [];
    },
    [currentUserId, grants]
  );

  const hasAccess = useCallback(
    (agentId: string, userId: string = currentUserId): boolean => {
      const acc = accessibleAgentIds(userId);
      return acc === 'all' || acc.includes(agentId);
    },
    [accessibleAgentIds, currentUserId]
  );

  const grantTo = useCallback((userId: string, agentIds: string[]) => {
    setGrants((prev) => {
      const existing = new Set(prev[userId] ?? []);
      agentIds.forEach((id) => existing.add(id));
      return { ...prev, [userId]: [...existing] };
    });
  }, []);

  /**
   * Invite a person to a set of agents. The inviter can only grant what THEY
   * can access; for anything they cannot, an access request is raised to the
   * owner, who decides whether to grant it to the invitee alone or to both.
   */
  const invite = useCallback(
    (inviteeName: string, agentIds: string[]) => {
      const granted = agentIds.filter((id) => hasAccess(id));
      const forbidden = agentIds.filter((id) => !hasAccess(id));
      if (granted.length) grantTo(`invitee:${inviteeName}`, granted);
      if (forbidden.length) {
        setAccessRequests((prev) => [
          ...prev,
          ...forbidden.map((agentId) => ({
            id: `req-${Date.now()}-${agentId}`,
            inviterId: currentUserId,
            inviteeName,
            agentId,
          })),
        ]);
      }
    },
    [hasAccess, grantTo, currentUserId]
  );

  const resolveRequest = useCallback(
    (requestId: string, grant: 'invitee' | 'both' | 'deny') => {
      setAccessRequests((prev) => {
        const req = prev.find((r) => r.id === requestId);
        if (req && grant !== 'deny') {
          grantTo(`invitee:${req.inviteeName}`, [req.agentId]);
          if (grant === 'both') grantTo(req.inviterId, [req.agentId]);
        }
        return prev.filter((r) => r.id !== requestId);
      });
    },
    [grantTo]
  );

  /* --------------------- Curator (meta-node) agent --------------------- */

  const pushCuratorEvents = useCallback((scopeLabel: string, count: number) => {
    const now = Date.now();
    const mk = (phase: WorkEvent['phase'], label: string, detail: string, offset: number): WorkEvent => ({
      id: `w-cur-${now}-${offset}`,
      agentId: 'curator',
      taskId: null,
      phase,
      label,
      detail,
      timestamp: now + offset,
    });
    setWorkEvents((prev) => [
      ...prev,
      mk('SENSE', 'Lecture du graphe d’agents', scopeLabel, 0),
      mk('PLAN', 'Pondération des arêtes', 'rôle +2 · plateforme +1 · activité +1', 1),
      mk('ACT', 'Création des méta-nœuds', `${count} proposition(s) générée(s)`, 2),
      mk('OBSERVE', 'Attente de validation utilisateur', 'Accepter ou refuser chaque méta-nœud.', 3),
    ]);
  }, []);

  const requestCuratorProposals = useCallback(
    (scopeIds?: string[]) => {
      // Humans and system agents are groupable too — the whole OS is the graph.
      if (scopeIds && scopeIds.length >= 2) {
        const proposal = proposeMetaNodeForScope(agents, scopeIds, folders);
        setProposals(proposal ? [proposal] : []);
        pushCuratorEvents(`Périmètre désigné : ${scopeIds.length} agents`, proposal ? 1 : 0);
      } else {
        const all = proposeMetaNodes(agents, tasks, folders);
        setProposals(all);
        pushCuratorEvents(`Graphe complet : ${agents.length} agents`, all.length);
      }
    },
    [agents, tasks, folders, pushCuratorEvents]
  );

  const resolveProposalName = useCallback(
    (p: MetaNodeProposal): string => {
      const base = t[p.nameKey] ?? p.nameKey;
      if (!p.nameParam) return base;
      // Human-readable parameter: provider name or project title when known.
      const provider = providers.find((pr) => pr.id === p.nameParam);
      const project = projects.find((pr) => pr.id === p.nameParam);
      return `${base} ${provider?.name ?? project?.title ?? p.nameParam}`;
    },
    [t, providers, projects]
  );

  const acceptProposal = useCallback(
    (id: string) => {
      const proposal = proposals.find((p) => p.id === id);
      if (!proposal) return;
      createFolder(resolveProposalName(proposal), proposal.agentIds);
      setProposals((prev) => prev.filter((p) => p.id !== id));
    },
    [proposals, createFolder, resolveProposalName]
  );

  const rejectProposal = useCallback((id: string) => {
    setProposals((prev) => prev.filter((p) => p.id !== id));
  }, []);

  /* ----------------------------- Projects ----------------------------- */

  const createProject = useCallback(
    (title: string, description: string) => {
      const id = `proj-${Date.now()}`;
      // A new project starts with the DEFAULT agents and an EMPTY flow:
      // nothing has been asked yet. The flow is generated later, when the
      // user describes a goal to the orchestrator through the chat.
      const project: Project = {
        id,
        title,
        description,
        createdAt: Date.now(),
        isLocked: false,
        perimeters: [{ memberId: currentUserId, taskIds: [], role: 'owner' }],
        agentIds: [...DEFAULT_AGENT_IDS],
      };
      setProjects((prev) => [project, ...prev]);
      setSelectedProjectId(id);
      // Land on the HOME desktop (not the flow, which is empty by design).
      setView({ kind: 'tab', tab: 'HOME' });
      // Fire-and-forget persistence (simulated Firestore: localStorage).
      void persistProject(project, []);
    },
    [currentUserId]
  );

  const toggleProjectLock = useCallback((id: string) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, isLocked: !p.isLocked } : p)));
  }, []);

  /* ------------------- Perimeters → meta-task mapping ------------------ */

  const visibleTasks = useMemo(() => {
    const project = projects.find((p) => p.id === selectedProjectId);
    const projectTasks = tasks.filter((task) => task.projectId === selectedProjectId);
    if (!project) return projectTasks;
    const perimeter = project.perimeters.find((p) => p.memberId === currentUserId);
    // Members outside every perimeter see the whole structure as meta-tasks.
    return projectTasks.map((task) =>
      perimeter?.taskIds.includes(task.id) ? task : { ...task, accessible: false }
    );
  }, [projects, tasks, selectedProjectId, currentUserId]);

  /* ---------------------------- Flow runner ---------------------------- */

  const runProjectFlow = useCallback(() => {
    if (isFlowRunning || !selectedProjectId) return;
    const flow = tasks.filter((task) => task.projectId === selectedProjectId && task.status !== 'done');
    if (flow.length === 0) return;
    setIsFlowRunning(true);
    cancelFlowRef.current = runFlowLocally(flow, {
      onTaskUpdate: (updated) =>
        setTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task))),
      onWorkEvent: (event) => setWorkEvents((prev) => [...prev, event]),
      onDone: () => setIsFlowRunning(false),
    });
  }, [isFlowRunning, selectedProjectId, tasks]);

  /* --------------------- Meta-agents (sub-flows) ----------------------- */

  /** An agent is a META-AGENT once a sub-flow details it. */
  const isMetaAgent = useCallback(
    (agentId: string) => tasks.some((task) => task.parentAgentId === agentId),
    [tasks]
  );

  /**
   * Details an agent into a SUB-FLOW (the « + » button of its tab bar).
   * The sub-tasks carry `parentAgentId` so they render only inside the
   * meta-agent (its « Flux » tab and the expanded outline in the main
   * PERT), and they run for real immediately — no fake placeholders.
   */
  const createSubFlow = useCallback(
    (agentId: string): boolean => {
      if (!selectedProjectId) return false;
      if (tasks.some((task) => task.parentAgentId === agentId)) return false; // already meta
      const agent = agents.find((a) => a.id === agentId);
      if (!agent || agent.kind === 'human') return false;
      const sub = decomposeAgentSubFlow(selectedProjectId, agent);
      setTasks((prev) => [...prev, ...sub]);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === selectedProjectId
            ? {
                ...p,
                perimeters: p.perimeters.map((per) =>
                  per.role === 'owner' ? { ...per, taskIds: [...per.taskIds, ...sub.map((s) => s.id)] } : per
                ),
              }
            : p
        )
      );
      runFlowLocally(sub, {
        onTaskUpdate: (updated) => setTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task))),
        onWorkEvent: (event) => setWorkEvents((prev) => [...prev, event]),
        onDone: () => {},
      });
      return true;
    },
    [selectedProjectId, tasks, agents]
  );

  /* ----------------------------- Meta-chat ----------------------------- */

  const sendMessage = useCallback(
    async (text: string) => {
      let target = agents.find((a) => a.id === chatTarget) ?? agents[0];

      // A goal sent from Home while the project's flow is empty is an
      // ACTION for the orchestrator, not small talk with the general LLM:
      // the conversation is re-addressed to the ORCHESTRATEUR and the app
      // opens its page (Chat tab) so the user watches the right agent act.
      const projectHasTasks = tasks.some((task) => task.projectId === selectedProjectId);
      if (target.id === 'system-llm' && selectedProjectId && !projectHasTasks) {
        target = agents.find((a) => a.id === 'orchestrator') ?? target;
        setView({ kind: 'agent', agentId: 'orchestrator' });
        setAgentTab('chat');
      }

      const userMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: 'user',
        text,
        targetId: target.id,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsChatLoading(true);

      // The chat is the SSOT trigger of agent behaviour:
      // — ORCHESTRATEUR: a goal sent while the project's flow is empty
      //   generates the contracted task flow (visible in « Flux »).
      let flowNote = '';
      if (target.id === 'orchestrator' && selectedProjectId) {
        const hasTasks = projectHasTasks;
        if (!hasTasks) {
          const project = projects.find((p) => p.id === selectedProjectId);
          const flow = decomposeGoal(selectedProjectId, project?.title ?? '', text);
          setTasks((prev) => [...prev, ...flow]);
          setProjects((prev) =>
            prev.map((p) =>
              p.id === selectedProjectId
                ? {
                    ...p,
                    perimeters: p.perimeters.map((per) =>
                      per.role === 'owner' ? { ...per, taskIds: [...per.taskIds, ...flow.map((task) => task.id)] } : per
                    ),
                  }
                : p
            )
          );
          flowNote = `\n\n→ Flux généré : ${flow.length} tâches contractualisées (voir l'onglet Flux).`;
        }
      }
      // — CURATEUR: any message asks it to work; its meta-node proposals
      //   land in ITS « Travail en direct » tab (no separate button).
      if (target.id === 'curator') {
        requestCuratorProposals();
      }

      try {
        const provider =
          providers.find((p) => p.id === target.llmBinding.providerId) ?? providers[0];
        const result = await generateText({
          provider,
          model: target.llmBinding.model,
          system: `Tu es « ${target.name} », un agent du système d'exploitation IA Template_LM. ${target.tagline}. Réponds de façon concise et structurée.`,
          prompt: text,
        });
        // Simulator agents are never fake: in simulated mode their reply
        // carries the REAL values computed by core/simulators.ts. When the
        // reply already narrates an orchestration ACTION (flowNote), the
        // demo checks are noise and are skipped.
        let replyText = result.text + flowNote;
        const method = agentMethods[target.id];
        if (result.simulated && !flowNote && method?.checks?.length) {
          const computed = method.checks
            .map((c) => `• ${c.label} = ${c.got.toPrecision(5)}${c.unit && c.unit !== '—' ? ` ${c.unit}` : ''}`)
            .join('\n');
          replyText += `\n\nCalculs réels (${target.name}) :\n${computed}`;
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}-r`,
            role: 'model',
            text: replyText,
            targetId: target.id,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsChatLoading(false);
      }
    },
    [agents, chatTarget, providers, selectedProjectId, tasks, projects, requestCuratorProposals]
  );

  /* --------------------------- LLM providers --------------------------- */

  const addProvider = useCallback((p: Omit<LLMProvider, 'id'>) => {
    setProviders((prev) => (prev.length >= 10 ? prev : [...prev, { ...p, id: `custom-${Date.now()}` }]));
  }, []);

  const updateProvider = useCallback((id: string, updates: Partial<LLMProvider>) => {
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  const removeProvider = useCallback((id: string) => {
    setProviders((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      return filtered.length > 0 ? filtered : prev; // never remove the last provider
    });
  }, []);

  const value: AppContextType = {
    language,
    setLanguage,
    theme,
    setTheme,
    t,
    currentUserId,
    setCurrentUserId,
    accessibleAgentIds,
    hasAccess,
    invite,
    accessRequests,
    resolveRequest,
    view,
    setView,
    goBack,
    canGoBack,
    agentTab,
    setAgentTab,
    logsFilter,
    setLogsFilter,
    agentTitleHidden,
    setAgentTitleHidden,
    agents,
    visibleAgents,
    createAgent,
    folders,
    visibleFolders,
    openFolderId,
    setOpenFolderId,
    createFolder,
    deleteFolder,
    isSelectionMode,
    setIsSelectionMode,
    selectedAgentIds,
    toggleAgentSelection,
    proposals,
    requestCuratorProposals,
    acceptProposal,
    rejectProposal,
    resolveProposalName,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    createProject,
    toggleProjectLock,
    tasks,
    visibleTasks,
    runProjectFlow,
    isFlowRunning,
    isMetaAgent,
    createSubFlow,
    workEvents,
    learning,
    messages,
    chatTarget,
    sendMessage,
    isChatLoading,
    providers,
    addProvider,
    updateProvider,
    removeProvider,
    isSettingsOpen,
    setIsSettingsOpen,
    isProjectModalOpen,
    setIsProjectModalOpen,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
