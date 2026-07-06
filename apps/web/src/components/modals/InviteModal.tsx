/**
 * InviteModal — multi-user access management.
 *
 * A user invites a person and grants access to a SUBSET of what they
 * themselves can access. If they pick an item they cannot access, an access
 * request is sent to the owner, shown here, who decides to grant it to the
 * invitee alone or to both (inviter + invitee).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Check, Lock, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

const InviteModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { theme, t, agents, hasAccess, invite, accessRequests, resolveRequest } = useApp();
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setPicked([]);
      dialogRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Only real agents (not humans) are grantable scopes here.
  const scopeAgents = agents.filter((a) => a.kind !== 'human');
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const pickedForbidden = picked.some((id) => !hasAccess(id));

  const submit = () => {
    if (!name.trim() || picked.length === 0) return;
    invite(name.trim(), picked);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.inviteTitle}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar rounded-[2rem] p-6 space-y-5 backdrop-blur-2xl border ${theme.glassBorder} animate-fade-up`}
        style={{ backgroundColor: theme.isDark ? 'rgba(2,6,23,0.85)' : 'rgba(255,255,255,0.85)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-bold tracking-tight ${theme.primaryText}`}>{t.inviteTitle}</h2>
          <button onClick={onClose} aria-label={t.cancel} className={`p-2 rounded-full ${theme.glassHover} ${theme.primaryText}`}>
            <X size={16} aria-hidden />
          </button>
        </div>

        {/* Invite form */}
        <label className="block space-y-1">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${theme.mutedText}`}>{t.inviteName}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded-xl px-3 py-2.5 text-sm bg-transparent border ${theme.glassBorder} ${theme.primaryText} outline-none`}
          />
        </label>

        <fieldset className="space-y-2">
          <legend className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${theme.mutedText}`}>{t.inviteScope}</legend>
          <div className="grid grid-cols-2 gap-2">
            {scopeAgents.map((a) => {
              const accessible = hasAccess(a.id);
              const isPicked = picked.includes(a.id);
              return (
                <label
                  key={a.id}
                  className={`flex items-center gap-2 rounded-2xl p-2.5 cursor-pointer transition-colors ${isPicked ? theme.iconBg : theme.glassHover}`}
                >
                  <input type="checkbox" checked={isPicked} onChange={() => toggle(a.id)} className="sr-only" />
                  <span
                    aria-hidden
                    className={`w-4 h-4 shrink-0 rounded flex items-center justify-center border ${isPicked ? 'bg-blue-600 border-blue-600 text-white' : theme.glassBorder}`}
                  >
                    {isPicked && <Check size={11} />}
                  </span>
                  <span className={`text-xs font-semibold truncate ${theme.primaryText}`}>{a.name}</span>
                  {!accessible && <Lock size={11} className="ml-auto text-amber-500 shrink-0" aria-label="no access" />}
                </label>
              );
            })}
          </div>
          {pickedForbidden && <p className={`text-xs text-amber-600`}>{t.noAccessNote}</p>}
        </fieldset>

        <button
          onClick={submit}
          disabled={!name.trim() || picked.length === 0}
          className={`w-full min-h-[44px] rounded-full text-sm font-semibold ${theme.userBubble} disabled:opacity-40`}
        >
          {t.inviteSend}
        </button>

        {/* Pending access requests (owner decides) */}
        {accessRequests.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className={`text-[11px] font-bold uppercase tracking-wider ${theme.mutedText}`}>{t.accessRequests}</p>
            {accessRequests.map((r) => {
              const agent = agents.find((a) => a.id === r.agentId);
              return (
                <div key={r.id} className={`rounded-2xl p-3 space-y-2 ${theme.iconBg}`}>
                  <p className={`text-sm ${theme.secondaryText}`}>
                    <span className="font-semibold">{r.inviteeName}</span> {t.requestFor}{' '}
                    <span className="font-semibold">{agent?.name}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => resolveRequest(r.id, 'invitee')}
                      className={`px-3 min-h-[36px] rounded-full text-xs font-bold ${theme.accentBtn}`}
                    >
                      {t.grantInvitee}
                    </button>
                    <button
                      onClick={() => resolveRequest(r.id, 'both')}
                      className={`px-3 min-h-[36px] rounded-full text-xs font-bold ${theme.userBubble}`}
                    >
                      {t.grantBoth}
                    </button>
                    <button
                      onClick={() => resolveRequest(r.id, 'deny')}
                      className={`px-3 min-h-[36px] rounded-full text-xs font-bold ${theme.secondaryText} ${theme.glassHover}`}
                    >
                      {t.denyRequest}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default InviteModal;
