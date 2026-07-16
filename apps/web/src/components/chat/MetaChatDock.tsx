/**
 * MetaChatDock — the single chat window + contextual navigation tabs,
 * anchored at the bottom of EVERY page.
 *
 * Tabs are CONTEXTUAL:
 *   - on the home/flow views → « Accueil », « Flux », « Flux fonctionnel »,
 *     « Variables » (the named tensor);
 *   - inside an agent → that agent's own tabs (Chat, Résultats, Flux…).
 * KOMAÏ Coding is an agent icon like any other and never appears here.
 *
 * The TAB BAR is 5% narrower than the chat window on each side. Tabs that
 * overflow can be reached by scrolling the bar horizontally OR through the
 * « + » button, which opens a menu ABOVE the bar listing the hidden tabs
 * (and, on eligible agents, the « detail into a sub-flow » action).
 *
 * The chat is contextual too: it addresses the agent ON SCREEN — no visible
 * recipient prefix is needed (the context is the page itself); on home it
 * talks to the system LLM.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, ScrollText, SendHorizonal } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import ChatView from './ChatView';
import type { AgentTabId, MainTab } from '@/core/types';

const HOME_TABS: { id: MainTab; labelKey: string }[] = [
  { id: 'HOME', labelKey: 'home' },
  { id: 'FLUX', labelKey: 'flux' },
  { id: 'SYSTEM', labelKey: 'system' },
  { id: 'VARIABLES', labelKey: 'variables' },
];

/** Agent tab order: Chat → Résultats → Flux (meta-agents) → the rest. */
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
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const dockRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const tabElsRef = useRef(new Map<string, HTMLElement>());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setIsOverlayVisible(false);
        setPlusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!isChatLoading) inputRef.current?.focus();
  }, [isChatLoading]);

  const inAgent = view.kind === 'agent';
  const activeAgent = inAgent ? agents.find((a) => a.id === view.agentId) : null;
  const activeTab = view.kind === 'tab' ? view.tab : null;

  const visibleTabs: { id: string; labelKey: string }[] = inAgent
    ? AGENT_TABS.filter((tab) => tab.id !== 'flow' || (activeAgent && isMetaAgent(activeAgent.id)))
    : HOME_TABS;
  const canSubFlow = Boolean(inAgent && activeAgent && activeAgent.kind !== 'human' && !isMetaAgent(activeAgent.id));

  /** Tabs whose button is scrolled out of the bar's visible window — the
   *  « + » menu lists exactly these (comprehension-debt: nothing is lost). */
  const computeHidden = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const nr = nav.getBoundingClientRect();
    const hidden: string[] = [];
    tabElsRef.current.forEach((el, id) => {
      if (!el.isConnected) return;
      const r = el.getBoundingClientRect();
      if (r.left < nr.left - 2 || r.right > nr.right + 2) hidden.push(id);
    });
    setHiddenIds((prev) => (prev.join('|') === hidden.join('|') ? prev : hidden));
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    const raf = requestAnimationFrame(computeHidden);
    nav?.addEventListener('scroll', computeHidden, { passive: true });
    window.addEventListener('resize', computeHidden);
    const ro = new ResizeObserver(computeHidden);
    if (nav) ro.observe(nav);
    return () => {
      cancelAnimationFrame(raf);
      nav?.removeEventListener('scroll', computeHidden);
      window.removeEventListener('resize', computeHidden);
      ro.disconnect();
    };
  }, [computeHidden, view, agents.length]);

  const registerTab = (id: string) => (el: HTMLElement | null) => {
    if (el) tabElsRef.current.set(id, el);
    else tabElsRef.current.delete(id);
  };

  const openTab = (id: string) => {
    if (inAgent) {
      if (id === 'logs') setLogsFilter('all');
      setAgentTab(id as AgentTabId);
    } else {
      setView({ kind: 'tab', tab: id as MainTab });
    }
    setPlusMenuOpen(false);
    // Bring the (previously hidden) tab into the bar's visible window.
    requestAnimationFrame(() =>
      tabElsRef.current.get(id)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    );
  };

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
  const tabBtn = (selected: boolean) =>
    `px-3 sm:px-4 min-h-[40px] rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
      selected ? theme.userBubble : `${theme.secondaryText} ${theme.glassHover}`
    }`;
  const isTabSelected = (id: string) => (inAgent ? agentTab === id : activeTab === id);
  const tabLabel = (id: string) =>
    t[(inAgent ? AGENT_TABS : HOME_TABS).find((tab) => tab.id === id)?.labelKey ?? id];

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

      {/* Tab bar row: 5% narrower than the chat window on EACH side. */}
      <div className="w-full max-w-3xl px-[5%] flex items-center justify-center gap-1 relative">
        <nav
          ref={navRef}
          role="tablist"
          aria-label={activeAgent ? activeAgent.name : t.appName}
          className={`flex items-center gap-1 p-1 rounded-full backdrop-blur-xl border overflow-x-auto min-w-0 max-w-full custom-scrollbar ${theme.glassBg} ${theme.glassBorder}`}
        >
          {visibleTabs.map((tab) =>
            inAgent && tab.id === 'logs' ? (
              // Logs tab: hover reveals a menu above with the 3 traced views.
              <div
                key={tab.id}
                ref={registerTab(tab.id)}
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
                  className={`${tabBtn(agentTab === 'logs')} flex items-center gap-1 whitespace-nowrap`}
                >
                  <ScrollText size={13} aria-hidden /> {t.tabLogs}
                </button>
              </div>
            ) : (
              <button
                key={tab.id}
                ref={registerTab(tab.id)}
                role="tab"
                aria-selected={isTabSelected(tab.id)}
                onClick={() => openTab(tab.id)}
                className={`${tabBtn(isTabSelected(tab.id))} whitespace-nowrap`}
              >
                {t[tab.labelKey]}
              </button>
            )
          )}
        </nav>

        {/* « + » : menu ABOVE the bar with the tabs that are NOT displayed
            (also reachable by scrolling the bar), plus the sub-flow action. */}
        {(hiddenIds.length > 0 || canSubFlow) && (
          <>
            <button
              aria-label={t.moreTabs}
              title={t.moreTabs}
              aria-expanded={plusMenuOpen}
              onClick={() => {
                computeHidden();
                setPlusMenuOpen((o) => !o);
              }}
              className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center border backdrop-blur-xl ${theme.glassBg} ${theme.glassBorder} ${theme.glassHover} ${theme.secondaryText}`}
            >
              <Plus size={15} aria-hidden className={`transition-transform ${plusMenuOpen ? 'rotate-45' : ''}`} />
            </button>
            {plusMenuOpen && (
              <div
                role="menu"
                aria-label={t.moreTabs}
                className={`absolute bottom-full mb-2 right-[5%] w-56 p-1.5 rounded-2xl backdrop-blur-xl border ${theme.glassBg} ${theme.glassBorder} shadow-lg animate-fade-up`}
              >
                {hiddenIds.map((id) => (
                  <button
                    key={id}
                    role="menuitem"
                    onClick={() => openTab(id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider ${theme.glassHover} ${
                      isTabSelected(id) ? theme.primaryText : theme.secondaryText
                    }`}
                  >
                    {tabLabel(id)}
                  </button>
                ))}
                {canSubFlow && activeAgent && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      if (createSubFlow(activeAgent.id)) setAgentTab('flow');
                      setPlusMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium ${theme.glassHover} ${theme.primaryText}`}
                  >
                    {t.detailSubFlow}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Single contextual chat input — it talks to the agent ON SCREEN
          (no visible recipient prefix: the page itself is the context). */}
      <div
        className={`w-full max-w-3xl backdrop-blur-xl border ${theme.glassBg} ${theme.glassBorder} rounded-[2rem] p-2 pl-4 flex items-end gap-2 shadow-[0_8px_32px_rgba(0,0,0,0.05)]`}
      >
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
