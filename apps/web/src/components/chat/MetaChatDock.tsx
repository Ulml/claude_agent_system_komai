/**
 * MetaChatDock — THE core interaction surface of the AI Operating System.
 *
 * A single chat window + navigation tabs just above it, anchored at the
 * bottom of EVERY page. From here the user talks to any element of the OS:
 * the general LLM, the orchestrator, any worker agent, the judge or KOMAÏ
 * Coding — selected via the recipient picker. Messages open a floating
 * glass overlay above the input; clicking outside collapses it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AtSign, Loader2, SendHorizonal } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import ChatView from './ChatView';
import type { MainTab } from '@/core/types';

const TABS: { id: MainTab; labelKey: string }[] = [
  { id: 'HOME', labelKey: 'home' },
  { id: 'FLUX', labelKey: 'flux' },
  { id: 'KOMAI', labelKey: 'komai' },
];

const MetaChatDock: React.FC = () => {
  const { theme, t, view, setView, agents, chatTarget, setChatTarget, sendMessage, isChatLoading, messages } =
    useApp();
  const [text, setText] = useState('');
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Collapse the chat overlay when clicking outside the dock.
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setIsOverlayVisible(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  // Restore focus to the input once generation completes.
  useEffect(() => {
    if (!isChatLoading) inputRef.current?.focus();
  }, [isChatLoading]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isChatLoading) return;
    setIsOverlayVisible(true);
    setText('');
    void sendMessage(trimmed);
  };

  const activeTab = view.kind === 'tab' ? view.tab : null;

  return (
    <div ref={dockRef} className="w-full flex flex-col items-center gap-3 z-30 px-3 pb-4 sm:pb-6 shrink-0 relative">
      {/* Floating chat overlay above the dock */}
      {messages.length > 0 && isOverlayVisible && (
        <div className="absolute bottom-full w-full flex justify-center pb-3 px-3">
          <div
            className={`w-full max-w-3xl max-h-[55vh] overflow-y-auto custom-scrollbar rounded-[2rem] p-4 backdrop-blur-xl border ${theme.glassBg} ${theme.glassBorder} animate-fade-up`}
          >
            <ChatView />
          </div>
        </div>
      )}

      {/* Navigation tabs — just above the chat input, on every page */}
      <nav
        role="tablist"
        aria-label={t.appName}
        className={`flex items-center gap-1 p-1 rounded-full backdrop-blur-xl border ${theme.glassBg} ${theme.glassBorder}`}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setView({ kind: 'tab', tab: tab.id })}
            className={`px-4 sm:px-5 min-h-[40px] rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === tab.id
                ? `${theme.userBubble}`
                : `${theme.secondaryText} ${theme.glassHover}`
            }`}
          >
            {t[tab.labelKey]}
          </button>
        ))}
      </nav>

      {/* Single meta-chat input */}
      <div
        className={`w-full max-w-3xl backdrop-blur-xl border ${theme.glassBg} ${theme.glassBorder} rounded-[2rem] p-2 pl-4 flex items-end gap-2 shadow-[0_8px_32px_rgba(0,0,0,0.05)]`}
      >
        {/* Recipient picker: system LLM, orchestrator, any agent */}
        <label className="flex items-center gap-1 pb-2.5 shrink-0">
          <AtSign size={14} className={theme.mutedText} aria-hidden />
          <span className="sr-only">{t.chatTarget}</span>
          <select
            value={chatTarget}
            onChange={(e) => setChatTarget(e.target.value)}
            aria-label={t.chatTarget}
            className={`text-xs font-semibold bg-transparent max-w-[110px] sm:max-w-none cursor-pointer ${theme.primaryText}`}
          >
            {agents
              .filter((a) => a.kind !== 'human')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.kind === 'system' ? t.systemLLM : a.name}
                </option>
              ))}
          </select>
        </label>

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
          aria-label={t.chatPlaceholder}
          className={`flex-1 resize-none bg-transparent text-base leading-relaxed py-2.5 outline-none placeholder:opacity-50 ${theme.primaryText}`}
        />

        <button
          onClick={handleSend}
          disabled={isChatLoading || !text.trim()}
          aria-label={t.send}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all ${theme.userBubble} disabled:opacity-40`}
        >
          {isChatLoading ? (
            <Loader2 size={18} className="animate-spin" aria-hidden />
          ) : (
            <SendHorizonal size={18} aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
};

export default MetaChatDock;
