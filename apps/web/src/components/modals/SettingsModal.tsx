/**
 * SettingsModal — language, theme palette and the LLM-agnostic platform
 * manager. Each platform (cloud API or local runtime like Ollama/LMLite)
 * can then be bound to any agent. Rendered as an accessible dialog.
 */
import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Plus, Trash2, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { themes } from '@/core/themes';
import { MicroLabel } from '@/components/ui/Glass';
import type { Language } from '@/core/types';

const LANGUAGES: Language[] = ['FR', 'EN', 'ES'];

const SettingsModal: React.FC = () => {
  const {
    theme,
    setTheme,
    t,
    language,
    setLanguage,
    providers,
    addProvider,
    updateProvider,
    removeProvider,
    isSettingsOpen,
    setIsSettingsOpen,
  } = useApp();

  const [newName, setNewName] = useState('');
  const [newModels, setNewModels] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Basic dialog accessibility: Escape closes, focus moves into the dialog.
  useEffect(() => {
    if (!isSettingsOpen) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsSettingsOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isSettingsOpen, setIsSettingsOpen]);

  if (!isSettingsOpen) return null;

  const submitProvider = () => {
    if (!newName.trim() || !newModels.trim()) return;
    addProvider({
      name: newName.trim(),
      protocol: newBaseUrl ? 'openai-compatible' : 'openai-compatible',
      models: newModels.split(',').map((m) => m.trim()).filter(Boolean),
      apiKey: newKey.trim(),
      baseUrl: newBaseUrl.trim() || undefined,
    });
    setNewName('');
    setNewModels('');
    setNewKey('');
    setNewBaseUrl('');
  };

  const inputClass = `w-full rounded-xl px-3 py-2 text-sm bg-transparent border ${theme.glassBorder} ${theme.primaryText} placeholder:opacity-50 outline-none`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={() => setIsSettingsOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.settings}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar rounded-[2rem] p-6 space-y-6 backdrop-blur-2xl border ${theme.glassBg} ${theme.glassBorder} animate-fade-up`}
        style={{ backgroundColor: theme.isDark ? 'rgba(2,6,23,0.85)' : 'rgba(255,255,255,0.85)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-bold tracking-tight ${theme.primaryText}`}>{t.settings}</h2>
          <button
            onClick={() => setIsSettingsOpen(false)}
            aria-label={t.cancel}
            className={`p-2 rounded-full ${theme.glassHover} ${theme.primaryText}`}
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <MicroLabel>{t.language}</MicroLabel>
          <div className="flex gap-2" role="group" aria-label={t.language}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                aria-pressed={language === lang}
                className={`px-4 min-h-[40px] rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                  language === lang ? theme.userBubble : `${theme.secondaryText} ${theme.glassHover}`
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Theme palette */}
        <div className="space-y-2">
          <MicroLabel>{t.themeLabel}</MicroLabel>
          <div className="flex gap-2 flex-wrap" role="group" aria-label={t.themeLabel}>
            {themes.map((th) => (
              <button
                key={th.name}
                onClick={() => setTheme(th)}
                aria-label={`${t.themeLabel}: ${th.name}`}
                aria-pressed={theme.name === th.name}
                className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 ${
                  theme.name === th.name ? 'border-blue-500' : 'border-slate-300/50'
                }`}
                style={{ backgroundColor: th.hex }}
              />
            ))}
          </div>
        </div>

        {/* LLM providers */}
        <div className="space-y-3">
          <MicroLabel>{t.llmProviders}</MicroLabel>
          <ul className="space-y-2">
            {providers.map((p) => (
              <li key={p.id} className={`rounded-2xl p-3 ${theme.iconBg} space-y-1.5`}>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-semibold ${theme.primaryText}`}>
                    {p.name}
                    {p.baseUrl && (
                      <span className={`ml-2 text-[10px] font-mono ${theme.mutedText}`}>{p.baseUrl}</span>
                    )}
                  </p>
                  {!p.isDefault && (
                    <button
                      onClick={() => removeProvider(p.id)}
                      aria-label={`${t.cancel}: ${p.name}`}
                      className={`p-1.5 rounded-full ${theme.glassHover} ${theme.mutedText}`}
                    >
                      <Trash2 size={13} aria-hidden />
                    </button>
                  )}
                </div>
                <p className={`text-xs font-mono ${theme.mutedText}`}>{p.models.join(' · ')}</p>
                <label className="block">
                  <span className="sr-only">{`${t.providerKey} — ${p.name}`}</span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={p.apiKey}
                    onChange={(e) => updateProvider(p.id, { apiKey: e.target.value })}
                    placeholder={t.providerKey}
                    className={inputClass}
                  />
                </label>
              </li>
            ))}
          </ul>

          {/* Add platform */}
          <div className={`rounded-2xl p-3 border border-dashed ${theme.glassBorder} space-y-2`}>
            <label className="block">
              <span className="sr-only">{t.providerName}</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t.providerName} className={inputClass} />
            </label>
            <label className="block">
              <span className="sr-only">{t.providerModels}</span>
              <input value={newModels} onChange={(e) => setNewModels(e.target.value)} placeholder={t.providerModels} className={inputClass} />
            </label>
            <label className="block">
              <span className="sr-only">{t.providerKey}</span>
              <input type="password" autoComplete="off" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder={t.providerKey} className={inputClass} />
            </label>
            <label className="block">
              <span className="sr-only">{t.providerBaseUrl}</span>
              <input value={newBaseUrl} onChange={(e) => setNewBaseUrl(e.target.value)} placeholder={t.providerBaseUrl} className={inputClass} />
            </label>
            <button
              onClick={submitProvider}
              className={`flex items-center gap-2 px-4 min-h-[40px] rounded-full text-xs font-bold uppercase tracking-wider ${theme.accentBtn}`}
            >
              <Plus size={14} aria-hidden /> {t.addProvider}
            </button>
          </div>
        </div>

        <button
          className={`w-full flex items-center justify-center gap-2 min-h-[44px] rounded-full text-sm font-semibold transition-colors ${theme.accentBtn}`}
        >
          <LogOut size={15} aria-hidden /> {t.logout}
        </button>
      </div>
    </div>
  );
};

export default SettingsModal;
