/**
 * MetaChatDock — the single chat window + contextual navigation tabs,
 * anchored at the bottom of EVERY page.
 *
 * Tabs are CONTEXTUAL:
 *   - on the home/flow views → « Accueil » and « Flux »;
 *   - inside an agent → that agent's own tabs (Entrées, Travail en direct,
 *     Conformité, Apprentissage, Compétences, Logs, Présentation).
 * KOMAÏ Coding is an agent icon like any other and never appears here.
 *
 * The chat is contextual too: it addresses the open agent (no recipient
 * dropdown); on home it talks to the system LLM.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, ScrollText, SendHorizonal } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import ChatView from './ChatView';
import type { AgentTabId, MainTab } from '@/core/types';

const HOME_TABS: { id: MainTab; labelKey: string }[] = [
  { id: 'HOME', labelKey: 'home' },
  { id: 'FLUX', labelKey: 'flux' },
];

const AGENT_TABS: { id: AgentTabId; labelKey: string }[] = [
  { id: 'chat', labelKey: 'tabChat' },
  { id: 'results', labelKey: 'tabResults' },
  { id: 'flow', labelKey: 'tabFlow' }, // meta-agents only (filtered below)
  { id: 'inputs', labelKey: 'tabInputs' },
  { id: 'work', labelKey: 'tabWork' },
  { id: 'conformity', labelKey: 'tabConformity' },
  { id: 'learning', labelKey: 'tabLearning' },
  { id: 'skills', labelKey: 'tabSkills' },
  { id: 'logs', labelKey: 'tabLogs' },
  { id: 'readme', labelKey: 'tabReadme' },
];

const MetaChatDock: React.FC = () => {
  const {
    theme,
    t,
    view,
    setView,
    agents,
    agentTab,
    setAgentTab,
    setLogsFilter,
    chatTarget,
    sendMessage,
    isChatLoading,
    messages,
    isMetaAgent,
    createSubFlow,
  } = useApp();
  const [text, setText] = useState('');
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [logsMenuOpen, setLogsMenuOpen] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) setIsOverlayVisible(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!isChatLoading) inputRef.current?.focus();
  }, [isChatLoading]);

  const inAgent = view.kind === 'agent';

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isChatLoading) return;
    // Inside an agent, the conversation lives in ITS « Chat » tab — no
    // overlay. The overlay is only used on the Home/Flux views. Note that
    // sendMessage may itself navigate into the Orchestrateur (actions).
    if (inAgent) setAgentTab('chat');
    else setIsOverlayVisible(true);
    setText('');
    void sendMessage(trimmed);
  };
  const activeAgent = inAgent ? agents.find((a) => a.id === view.agentId) : null;
  const activeTab = view.kind === 'tab' ? view.tab : null;
  const tabBtn = (selected: boolean) =>
    `px-3 sm:px-4 min-h-[40px] rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
      selected ? theme.userBubble : `${theme.secondaryText} ${theme.glassHover}`
    }`;

  return (
    <div ref={dockRef} className="w-full flex flex-col items-center gap-3 z-30 px-3 pb-4 sm:pb-6 shrink-0 relative">
      {/* Floating chat overlay above the dock */}
      {!inAgent && messages.length > 0 && isOverlayVisible && (
        <div className="absolute bottom-full w-full flex justify-center pb-3 px-3">
          <div
            className={`w-full max-w-3xl max-h-[55vh] overflow-y-auto custom-scrollbar rounded-[2rem] p-4 backdrop-blur-xl border ${theme.glassBg} ${theme.glassBorder} animate-fade-up`}
          >
            <ChatView />
          </div>
        </div>
      )}

      {/* Contextual navigation tabs */}
      <nav
        role="tablist"
        aria-label={activeAgent ? activeAgent.name : t.appName}
        className={`flex items-center gap-1 p-1 rounded-full backdrop-blur-xl border overflow-x-auto max-w-full custom-scrollbar ${theme.glassBg} ${theme.glassBorder}`}
      >
        {inAgent
          ? AGENT_TABS.filter((tab) => tab.id !== 'flow' || (activeAgent && isMetaAgent(activeAgent.id))).map((tab) =>
              tab.id === 'logs' ? (
                // Logs tab: hover reveals a menu above with the 3 traced views.
                <div
                  key={tab.id}
                  className="relative"
                  onMouseEnter={() => setLogsMenuOpen(true)}
                  onMouseLeave={() => setLogsMenuOpen(false)}
                >
                  {logsMenuOpen && (
                    <div
                      className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-52 p-1.5 rounded-2xl backdrop-blur-xl border ${theme.glassBg} ${theme.glassBorder} shadow-lg`}
                      role="menu"
                    >
                      {(['user', 'judge', 'learning'] as const).map((cat) => (
                        <button
                          key={cat}
                          role="menuitem"
                          onClick={() => {
                            setLogsFilter(cat);
                            setAgentTab('logs');
                            setLogsMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium ${theme.glassHover} ${theme.primaryText}`}
                        >
                          {cat === 'user' ? t.logsUser : cat === 'judge' ? t.logsJudge : t.logsLearning}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    role="tab"
                    aria-selected={agentTab === 'logs'}
                    onClick={() => {
                      setLogsFilter('all');
                      setAgentTab('logs');
                    }}
                    className={`${tabBtn(agentTab === 'logs')} flex items-center gap-1`}
                  >
                    <ScrollText size={13} aria-hidden /> {t.tabLogs}
                  </button>
                </div>
              ) : (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={agentTab === tab.id}
                  onClick={() => setAgentTab(tab.id)}
                  className={`${tabBtn(agentTab === tab.id)} whitespace-nowrap`}
                >
                  {t[tab.labelKey]}
                </button>
              )
            )
          : HOME_TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setView({ kind: 'tab', tab: tab.id })}
                className={tabBtn(activeTab === tab.id)}
              >
                {t[tab.labelKey]}
              </button>
            ))}

        {/* « + » (right of the tab bar): detail this agent into a SUB-FLOW —
            it becomes a META-AGENT and gains its « Flux » tab. */}
        {inAgent && activeAgent && activeAgent.kind !== 'human' && !isMetaAgent(activeAgent.id) && (
          <button
            aria-label={t.detailSubFlow}
            title={t.detailSubFlow}
            onClick={() => {
              if (createSubFlow(activeAgent.id)) setAgentTab('flow');
            }}
            className={`shrink-0 w-9 h-9 ml-1 rounded-full flex items-center justify-center border ${theme.glassBorder} ${theme.glassHover} ${theme.secondaryText}`}
          >
            <Plus size={15} aria-hidden />
          </button>
        )}
      </nav>

      {/* Single contextual chat input (talks to the open agent) */}
      <div
        className={`w-full max-w-3xl backdrop-blur-xl border ${theme.glassBg} ${theme.glassBorder} rounded-[2rem] p-2 pl-4 flex items-end gap-2 shadow-[0_8px_32px_rgba(0,0,0,0.05)]`}
      >
        {activeAgent && (
          <span className={`text-xs font-semibold pb-2.5 shrink-0 ${theme.mutedText}`}>
            {t.chatToAgent} {activeAgent.name} :
          </span>
        )}
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => messages.length > 0 && setIsOverlayVisible(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          placeholder={t.chatPlaceholder}
          aria-label={`${t.chatToAgent} ${chatTarget}`}
          className={`flex-1 resize-none bg-transparent text-base leading-relaxed py-2.5 outline-none placeholder:opacity-50 ${theme.primaryText}`}
        />
        <button
          onClick={handleSend}
          disabled={isChatLoading || !text.trim()}
          aria-label={t.send}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all ${theme.userBubble} disabled:opacity-40`}
        >
          {isChatLoading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <SendHorizonal size={18} aria-hidden />}
        </button>
      </div>
    </div>
  );
};

export default MetaChatDock;
