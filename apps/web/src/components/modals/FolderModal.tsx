/**
 * FolderModal — lets the user create their OWN agent folder: a name plus
 * any set of agents picked from the whole OS (humans included). Can be
 * pre-filled from the desktop selection mode.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Agents pre-checked when opening (from the desktop selection). */
  initialAgentIds: string[];
}

const FolderModal: React.FC<Props> = ({ isOpen, onClose, initialAgentIds }) => {
  const { theme, t, agents, createFolder } = useApp();
  const [name, setName] = useState('');
  const [checked, setChecked] = useState<string[]>(initialAgentIds);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Re-sync the pre-selection every time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setChecked(initialAgentIds);
      setName('');
      dialogRef.current?.focus();
    }
  }, [isOpen, initialAgentIds]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggle = (id: string) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = () => {
    if (!name.trim() || checked.length === 0) return;
    createFolder(name.trim(), checked);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.newFolder}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md max-h-[85vh] overflow-y-auto custom-scrollbar rounded-[2rem] p-6 space-y-4 backdrop-blur-2xl border ${theme.glassBorder} animate-fade-up`}
        style={{ backgroundColor: theme.isDark ? 'rgba(2,6,23,0.85)' : 'rgba(255,255,255,0.85)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-bold tracking-tight ${theme.primaryText}`}>{t.newFolder}</h2>
          <button
            onClick={onClose}
            aria-label={t.cancel}
            className={`p-2 rounded-full ${theme.glassHover} ${theme.primaryText}`}
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <label className="block space-y-1">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${theme.mutedText}`}>
            {t.folderName}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded-xl px-3 py-2.5 text-sm bg-transparent border ${theme.glassBorder} ${theme.primaryText} outline-none`}
          />
        </label>

        <fieldset className="space-y-2">
          <legend className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${theme.mutedText}`}>
            {t.selectAgents}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {agents.map((agent) => {
              const Icon = agent.icon;
              const isChecked = checked.includes(agent.id);
              return (
                <label
                  key={agent.id}
                  className={`flex items-center gap-2 rounded-2xl p-2.5 cursor-pointer transition-colors ${
                    isChecked ? theme.iconBg : theme.glassHover
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(agent.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={`w-4 h-4 shrink-0 rounded flex items-center justify-center border ${
                      isChecked ? 'bg-blue-600 border-blue-600 text-white' : theme.glassBorder
                    }`}
                  >
                    {isChecked && <Check size={11} />}
                  </span>
                  <Icon size={14} strokeWidth={1.5} className={theme.mutedText} aria-hidden />
                  <span className={`text-xs font-semibold truncate ${theme.primaryText}`}>{agent.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className={`px-4 min-h-[44px] rounded-full text-sm font-semibold ${theme.secondaryText} ${theme.glassHover}`}
          >
            {t.cancel}
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || checked.length === 0}
            className={`px-5 min-h-[44px] rounded-full text-sm font-semibold ${theme.userBubble} disabled:opacity-40`}
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FolderModal;
