/**
 * Global application state (SSOT for runtime state).
 *
 * One provider, one `useApp()` hook: theme, language, current user, agents,
 * projects + task flows, meta-chat, live work stream, LLM providers and
 * navigation. Components never own domain state — they read and mutate it
 * here, which is what keeps every screen (desktop, flow, agent pages,
 * meta-chat) perfectly synchronised.
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type {
  AgentProfile,
  ChatMessage,
  Language,
  LearningEntry,
  LLMProvider,
  Project,
  TaskNode,
  ThemeColor,
  View,
  WorkEvent,
} from '@/core/types';
import { defaultTheme } from '@/core/themes';
import { translations } from '@/core/i18n';
import {
  seedAgents,
  seedLearning,
  seedProject,
  seedProviders,
  seedTasks,
  seedWorkEvents,
} from '@/core/seed';
import { decomposeGoal, runFlowLocally } from '@/core/orchestrator';
import { generateText } from '@/services/llm';
import { persistProject } from '@/services/firebase';

interface AppContextType {
  // Localisation & theming
  language: Language;
  setLanguage: (l: Language) => void;
  theme: ThemeColor;
  setTheme: (t: ThemeColor) => void;
  t: Record<string, string>;

  // Identity (the current human, itself an agent)
  currentUserId: string;
  setCurrentUserId: (id: string) => void;

  // Navigation
  view: View;
  setView: (v: View) => void;

  // Agents
  agents: AgentProfile[];

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

  // Live work & learning
  workEvents: WorkEvent[];
  learning: LearningEntry[];

  // Meta-chat
  messages: ChatMessage[];
  chatTarget: string;
  setChatTarget: (id: string) => void;
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
  const [currentUserId, setCurrentUserId] = useState('user-owner');
  const [view, setView] = useState<View>({ kind: 'tab', tab: 'HOME' });

  const [agents] = useState<AgentProfile[]>(seedAgents);
  const [projects, setProjects] = useState<Project[]>([seedProject]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(seedProject.id);
  const [tasks, setTasks] = useState<TaskNode[]>(seedTasks);
  const [isFlowRunning, setIsFlowRunning] = useState(false);
  const cancelFlowRef = useRef<(() => void) | null>(null);

  const [workEvents, setWorkEvents] = useState<WorkEvent[]>(seedWorkEvents);
  const [learning] = useState<LearningEntry[]>(seedLearning);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatTarget, setChatTarget] = useState('system-llm');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [providers, setProviders] = useState<LLMProvider[]>(seedProviders);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  const t = translations[language];

  /* ----------------------------- Projects ----------------------------- */

  const createProject = useCallback(
    (title: string, description: string) => {
      const id = `proj-${Date.now()}`;
      const project: Project = {
        id,
        title,
        description,
        createdAt: Date.now(),
        isLocked: false,
        // The creator owns every task of the new flow by default.
        perimeters: [{ memberId: currentUserId, taskIds: [], role: 'owner' }],
      };
      const flow = decomposeGoal(id, title, description);
      project.perimeters[0].taskIds = flow.map((task) => task.id);
      setProjects((prev) => [project, ...prev]);
      setTasks((prev) => [...prev, ...flow]);
      setSelectedProjectId(id);
      setView({ kind: 'tab', tab: 'FLUX' });
      // Fire-and-forget persistence (Firestore or localStorage fallback).
      void persistProject(project, flow);
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

  /* ----------------------------- Meta-chat ----------------------------- */

  const sendMessage = useCallback(
    async (text: string) => {
      const target = agents.find((a) => a.id === chatTarget) ?? agents[0];
      const userMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: 'user',
        text,
        targetId: target.id,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsChatLoading(true);
      try {
        const provider =
          providers.find((p) => p.id === target.llmBinding.providerId) ?? providers[0];
        const result = await generateText({
          provider,
          model: target.llmBinding.model,
          system: `Tu es « ${target.name} », un agent du système d'exploitation IA Template_LM. ${target.tagline}. Réponds de façon concise et structurée.`,
          prompt: text,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}-r`,
            role: 'model',
            text: result.text,
            targetId: target.id,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsChatLoading(false);
      }
    },
    [agents, chatTarget, providers]
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
    view,
    setView,
    agents,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    createProject,
    toggleProjectLock,
    tasks,
    visibleTasks,
    runProjectFlow,
    isFlowRunning,
    workEvents,
    learning,
    messages,
    chatTarget,
    setChatTarget,
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
