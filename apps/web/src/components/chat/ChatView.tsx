/**
 * ChatView — the message stream of the meta-chat.
 * Renders user/model bubbles with the addressed agent's name, auto-scrolls
 * to the latest message and shows a triple-dot loader while generating.
 */
import React, { useEffect, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';

const ChatView: React.FC = () => {
  const { theme, t, messages, agents, isChatLoading } = useApp();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isChatLoading]);

  if (messages.length === 0 && !isChatLoading) {
    return <p className={`text-sm text-center py-6 ${theme.mutedText}`}>{t.noMessages}</p>;
  }

  return (
    <div className="space-y-3 px-1" role="log" aria-live="polite" aria-label={t.appName}>
      {messages.map((m) => {
        const target = agents.find((a) => a.id === m.targetId);
        return (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-3xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user' ? theme.userBubble : `${theme.iconBg} ${theme.primaryText}`
              }`}
            >
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70`}>
                {m.role === 'user' ? `→ ${target?.name ?? ''}` : target?.name ?? ''}
              </p>
              <p className="whitespace-pre-wrap">{m.text}</p>
            </div>
          </div>
        );
      })}
      {isChatLoading && (
        <div className="flex justify-start" aria-label={t.thinking}>
          <div className={`rounded-3xl px-4 py-3 ${theme.iconBg}`}>
            <span className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  aria-hidden
                  className={`w-2 h-2 rounded-full animate-pulse-dot ${theme.isDark ? 'bg-slate-300' : 'bg-slate-600'}`}
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </span>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
};

export default ChatView;
